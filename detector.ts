import Redis from "ioredis";
import { Trade, shouldFilterMarket, hasWalletTradedBefore } from "./polymarket.js";
import { postInsiderTrade } from "./twitter.js";
import { logger } from "./logger.js";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const FRESH_THRESHOLD = parseInt(process.env.FRESH_THRESHOLD_USD || "7500");
const POSTS_PER_MARKET_24H = parseInt(process.env.FRESH_POSTS_PER_MARKET_24H || "4");

export async function processFreshWallet(trade: Trade): Promise<string> {
  if (!trade.usdValue || trade.usdValue < FRESH_THRESHOLD) return "below_threshold";
  if (trade.side !== "BUY") return "below_threshold";

  // Filter markets first
  if (shouldFilterMarket(trade.title)) {
    logger.info(`🚫 Filtered: ${trade.proxyWallet.slice(0,8)} $${trade.usdValue.toFixed(0)} - ${trade.title}`);
    return "filtered";
  }

  // Check if already posted
  const posted = await redis.exists(`posted-wallet:${trade.proxyWallet}`);
  if (posted) {
    logger.debug(`Already posted: ${trade.proxyWallet.slice(0, 8)}`);
    return "already_posted";
  }

  // Check deduplication
  const dedupeKey = `fresh-processed:${trade.transactionHash}`;
  const exists = await redis.exists(dedupeKey);
  if (exists) {
    logger.debug(`Already processed: ${trade.transactionHash}`);
    return "already_processed";
  }

  // Check wallet history
  const cacheKey = `wallet-history:${trade.proxyWallet}`;
  let hasHistory = await redis.get(cacheKey);

  if (hasHistory === null) {
    // Pass timestamp to filter trades that occurred BEFORE this one
    const traded = await hasWalletTradedBefore(trade.proxyWallet, trade.timestamp);
    hasHistory = traded ? "1" : "0";
    await redis.setex(cacheKey, 7 * 86400, hasHistory);
  }

  if (hasHistory === "1") {
    logger.info(`❌ Has history: ${trade.proxyWallet.slice(0, 8)} $${trade.usdValue.toFixed(0)} - ${trade.title}`);
    return "has_history";
  }

  // Check market rate limit (4 posts per market per 24h)
  const marketKey = `fresh-market:${trade.eventSlug}`;
  const marketCount = await redis.get(marketKey);
  if (marketCount && parseInt(marketCount) >= POSTS_PER_MARKET_24H) {
    logger.info(`⏰ Market rate limit: ${trade.title} (${marketCount}/${POSTS_PER_MARKET_24H} posts)`);
    await redis.setex(dedupeKey, 48 * 3600, "1");
    return "market_rate_limited";
  }

  // FRESH WALLET CONFIRMED - TWEET!
  logger.info(`✅ FRESH WALLET: ${trade.proxyWallet} ($${trade.usdValue.toFixed(0)}) - ${trade.title}`);

  const success = await postInsiderTrade(trade);

  // Increment market counter (even if tweet failed to prevent retry spam)
  const newMarketCount = await redis.incr(marketKey);
  if (newMarketCount === 1) {
    await redis.expire(marketKey, 24 * 3600); // 24 hours
  }
  logger.debug(`Market counter: ${trade.title.substring(0, 30)}... (${newMarketCount}/${POSTS_PER_MARKET_24H})`);

  // Mark as posted even if tweet failed (to prevent retry spam)
  await redis.set(`posted-wallet:${trade.proxyWallet}`, "1");

  // Mark transaction as processed
  await redis.setex(dedupeKey, 48 * 3600, "1");

  return success ? "tweeted" : "tweet_failed";
}

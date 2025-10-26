import Redis from "ioredis";
import { Trade, shouldFilterMarket, hasWalletTradedBefore } from "./polymarket.js";
import { postInsiderTrade } from "./twitter.js";
import { logger } from "./logger.js";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const FRESH_THRESHOLD = parseInt(process.env.FRESH_THRESHOLD_USD || "7500");

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

  // FRESH WALLET CONFIRMED - TWEET!
  logger.info(`✅ FRESH WALLET: ${trade.proxyWallet} ($${trade.usdValue.toFixed(0)}) - ${trade.title}`);

  await postInsiderTrade(trade);

  // Mark as posted forever
  await redis.set(`posted-wallet:${trade.proxyWallet}`, "1");

  // Mark transaction as processed
  await redis.setex(dedupeKey, 48 * 3600, "1");

  return "tweeted";
}

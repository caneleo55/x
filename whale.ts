import Redis from "ioredis";
import { Trade, shouldFilterMarket } from "./polymarket.js";
import { postWhaleAlert } from "./twitter.js";
import { logger } from "./logger.js";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const WHALE_MIN = parseInt(process.env.WHALE_USD_MIN || "50000");
const POSTS_PER_WALLET = parseInt(process.env.WHALE_POSTS_PER_WALLET_24H || "2");
const POSTS_PER_MARKET = parseInt(process.env.WHALE_POSTS_PER_MARKET_24H || "6");
const MARKET_COOLDOWN_HOURS = parseInt(process.env.WHALE_MARKET_COOLDOWN_HOURS || "2");

export async function processWhaleTrade(trade: Trade): Promise<string> {
  if (!trade.usdValue || trade.usdValue < WHALE_MIN) return "below_threshold";
  if (trade.side !== "BUY") return "below_threshold";

  // Check if already processed
  const dedupeKey = `whale-processed:${trade.transactionHash}`;
  const exists = await redis.exists(dedupeKey);
  if (exists) {
    logger.debug(`Whale trade already processed: ${trade.transactionHash}`);
    return "already_processed";
  }

  logger.info(`🐋 Potential whale: ${trade.proxyWallet.slice(0, 8)} - $${trade.usdValue.toFixed(0)}`);

  // Check if wallet already posted as fresh (priority)
  const postedAsFresh = await redis.exists(`posted-wallet:${trade.proxyWallet}`);
  if (postedAsFresh) {
    logger.info(`Wallet already posted as fresh, skipping whale post`);
    await redis.setex(dedupeKey, 48 * 3600, "1");
    return "posted_as_fresh";
  }

  // Check rate limits
  const canPost = await canPostWhale(trade.proxyWallet, trade.eventSlug);
  if (!canPost) {
    logger.info(`Rate limit hit for whale post`);
    await redis.setex(dedupeKey, 48 * 3600, "1");
    return "rate_limited";
  }

  // Filter market
  if (shouldFilterMarket(trade.title)) {
    logger.info(`Filtered whale market: ${trade.title}`);
    await redis.setex(dedupeKey, 48 * 3600, "1");
    return "filtered";
  }

  // Post tweet
  const success = await postWhaleAlert(trade);

  // Increment rate limits even if tweet failed (to prevent retry spam)
  await incrementRateLimits(trade.proxyWallet, trade.eventSlug);

  // Mark as processed
  await redis.setex(dedupeKey, 48 * 3600, "1");

  return success ? "tweeted" : "tweet_failed";
}

async function canPostWhale(wallet: string, market: string): Promise<boolean> {
  // Check wallet post count (24h)
  const walletKey = `whale-wallet:${wallet}`;
  const walletCount = await redis.get(walletKey);
  if (walletCount && parseInt(walletCount) >= POSTS_PER_WALLET) {
    logger.debug(`Wallet ${wallet.slice(0, 8)} maxed posts (${walletCount}/${POSTS_PER_WALLET})`);
    return false;
  }

  // Check market post count (24h)
  const marketKey = `whale-market:${market}`;
  const marketCount = await redis.get(marketKey);
  if (marketCount && parseInt(marketCount) >= POSTS_PER_MARKET) {
    logger.debug(`Market ${market.slice(0, 8)} maxed posts (${marketCount}/${POSTS_PER_MARKET})`);
    return false;
  }

  // Check market cooldown
  const cooldownKey = `whale-cooldown:${market}`;
  const cooldown = await redis.get(cooldownKey);
  if (cooldown) {
    logger.debug(`Market ${market.slice(0, 8)} in cooldown`);
    return false;
  }

  return true;
}

async function incrementRateLimits(wallet: string, market: string): Promise<void> {
  // Increment wallet counter
  const walletKey = `whale-wallet:${wallet}`;
  const walletCount = await redis.incr(walletKey);
  if (walletCount === 1) {
    await redis.expire(walletKey, 24 * 3600);
  }

  // Increment market counter
  const marketKey = `whale-market:${market}`;
  const marketCount = await redis.incr(marketKey);
  if (marketCount === 1) {
    await redis.expire(marketKey, 24 * 3600);
  }

  // Set market cooldown
  const cooldownKey = `whale-cooldown:${market}`;
  await redis.setex(cooldownKey, MARKET_COOLDOWN_HOURS * 3600, "1");

  logger.debug(`Rate limits updated - Wallet: ${walletCount}/${POSTS_PER_WALLET}, Market: ${marketCount}/${POSTS_PER_MARKET}`);
}

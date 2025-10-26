import dotenv from "dotenv";
dotenv.config();

import { TwitterApi } from "twitter-api-v2";
import { Trade } from "./polymarket.js";
import { logger } from "./logger.js";

const REFERRAL = process.env.REFERRAL_CODE || "polyinsider";

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

const twitter = client.readWrite;

export async function postInsiderTrade(trade: Trade): Promise<void> {
  try {
    const amount = trade.usdValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00";
    const price = (trade.price * 100).toFixed(0); // Convert to cents

    // Get outcome emoji
    const outcomeEmoji = trade.outcome?.toLowerCase() === 'yes' ? '✅' : '❌';
    const outcomeName = trade.outcome || 'Unknown';

    // Profile URL with wallet address
    const profileUrl = `https://polymarket.com/profile/${trade.proxyWallet}?ref=${REFERRAL}`;

    const tweet = `👀 Fresh wallet just placed their FIRST bet on @Polymarket!

💰 $${amount} on ${outcomeEmoji} ${outcomeName} @ ${price}¢
📊 Market: ${trade.title}

🔗 ${profileUrl}`;

    await twitter.v2.tweet(tweet);
    logger.info(`✅ Posted insider tweet: $${amount} on ${outcomeName}`);
  } catch (err: any) {
    logger.error("Failed to post insider tweet:", err.message);
  }
}

export async function postWhaleAlert(trade: Trade): Promise<void> {
  try {
    const amount = trade.usdValue?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || "0";
    const price = (trade.price * 100).toFixed(0); // Convert to cents

    // Get outcome emoji
    const outcomeEmoji = trade.outcome?.toLowerCase() === 'yes' ? '✅' : '❌';
    const outcomeName = trade.outcome || 'Unknown';

    // Profile URL with wallet address
    const profileUrl = `https://polymarket.com/profile/${trade.proxyWallet}?ref=${REFERRAL}`;

    const tweet = `🐋 Whale trade spotted on @Polymarket

💰 $${amount} on ${outcomeEmoji} ${outcomeName} @ ${price}¢
📊 Market: ${trade.title}

🔗 ${profileUrl}`;

    await twitter.v2.tweet(tweet);
    logger.info(`✅ Posted whale tweet: $${amount} on ${outcomeName}`);
  } catch (err: any) {
    logger.error("Failed to post whale tweet:", err.message);
  }
}

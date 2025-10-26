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
    const amount = trade.usdValue?.toFixed(0) || "0";
    const referralUrl = `https://polymarket.com/?via=${REFERRAL}`;

    const tweet = `🚨 FRESH WALLET ALERT

💰 $${amount} bet
📊 ${trade.title}

First-time trader detected!

👤 ${referralUrl}`;

    await twitter.v2.tweet(tweet);
    logger.info(`✅ Posted insider tweet: $${amount}`);
  } catch (err: any) {
    logger.error("Failed to post insider tweet:", err.message);
  }
}

export async function postWhaleAlert(trade: Trade): Promise<void> {
  try {
    const amount = trade.usdValue?.toFixed(0) || "0";
    const referralUrl = `https://polymarket.com/?via=${REFERRAL}`;

    const tweet = `🐋 WHALE ALERT

💰 $${amount} bet
📊 ${trade.title}

Big money moving!

👤 ${referralUrl}`;

    await twitter.v2.tweet(tweet);
    logger.info(`✅ Posted whale tweet: $${amount}`);
  } catch (err: any) {
    logger.error("Failed to post whale tweet:", err.message);
  }
}

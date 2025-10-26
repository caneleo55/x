import dotenv from "dotenv";
import { RealTimeDataClient } from "@polymarket/real-time-data-client";
import { processFreshWallet } from "./detector.js";
import { processWhaleTrade } from "./whale.js";
import { logger } from "./logger.js";

dotenv.config();

const SUMMARY_INTERVAL = 15000; // 15 seconds

let isRunning = true;

// Rolling stats (reset every 15s)
let totalTradesScanned = 0;
let totalBuyOrders = 0;
let rejectedHistory = 0;
let rejectedFiltered = 0;
let rejectedBelowThreshold = 0;
let insiderTweetsPosted = 0;
let whaleTweetsPosted = 0;
let totalProcessingTime = 0;
let processCount = 0;

// Cumulative stats (never reset)
let cumulativeTradesScanned = 0;
let cumulativeBuyOrders = 0;
let cumulativeRejectedHistory = 0;
let cumulativeRejectedFiltered = 0;
let cumulativeRejectedBelowThreshold = 0;
let cumulativeInsiderTweets = 0;
let cumulativeWhaleTweets = 0;

// WebSocket client
let wsClient: RealTimeDataClient;

interface Trade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  eventSlug: string;
  transactionHash: string;
  name?: string;
  pseudonym?: string;
  outcome?: string;
  icon?: string;
  bio?: string;
  profileImage?: string;
  outcomeIndex?: number;
}

async function processTrade(trade: Trade) {
  const startTime = Date.now();

  totalTradesScanned++;
  cumulativeTradesScanned++;

  if (trade.side !== "BUY") return;

  totalBuyOrders++;
  cumulativeBuyOrders++;

  // Calculate USD value (same as REST API)
  const usdValue = trade.size * trade.price;
  const tradeWithValue = {
    ...trade,
    usdValue,
    marketUrl: `https://polymarket.com/event/${trade.eventSlug}`
  };

  // Process fresh wallet (instant tweet if $7,500+)
  const freshResult = await processFreshWallet(tradeWithValue);
  if (freshResult === "tweeted") {
    insiderTweetsPosted++;
    cumulativeInsiderTweets++;
  } else if (freshResult === "has_history") {
    rejectedHistory++;
    cumulativeRejectedHistory++;
  } else if (freshResult === "filtered") {
    rejectedFiltered++;
    cumulativeRejectedFiltered++;
  } else if (freshResult === "below_threshold") {
    rejectedBelowThreshold++;
    cumulativeRejectedBelowThreshold++;
  }

  // Process whale trades
  const whaleResult = await processWhaleTrade(tradeWithValue);
  if (whaleResult === "tweeted") {
    whaleTweetsPosted++;
    cumulativeWhaleTweets++;
  } else if (whaleResult === "filtered") {
    rejectedFiltered++;
    cumulativeRejectedFiltered++;
  }

  const processingTime = Date.now() - startTime;
  totalProcessingTime += processingTime;
  processCount++;
}

// WebSocket message handler
const onMessage = async (client: RealTimeDataClient, message: any) => {
  try {
    if (message.topic === "activity" && message.type === "trades") {
      const trade = message.payload as Trade;
      await processTrade(trade);
    }
  } catch (err: any) {
    logger.error("Error processing trade:", err.message);
  }
};

// WebSocket connection handler
const onConnect = (client: RealTimeDataClient) => {
  logger.info("✅ WebSocket connected!");
  logger.info("📡 Subscribing to real-time trades...");

  client.subscribe({
    subscriptions: [{
      topic: "activity",
      type: "trades",
      filters: "" // No filter = ALL trades
    }]
  });

  logger.info("🎯 Subscription active - waiting for trades...");
};

// Connection status handler
const onStatusChange = (status: string) => {
  logger.info(`🔌 Connection status: ${status}`);
};

// Summary logger - runs every 15 seconds
async function summaryLoop() {
  while (isRunning) {
    await new Promise(resolve => setTimeout(resolve, SUMMARY_INTERVAL));

    const avgProcessingTime = processCount > 0 ? (totalProcessingTime / processCount).toFixed(0) : 0;
    const totalRejected = rejectedHistory + rejectedFiltered + rejectedBelowThreshold;
    const cumulativeTotalRejected = cumulativeRejectedHistory + cumulativeRejectedFiltered + cumulativeRejectedBelowThreshold;

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(`📊 SUMMARY (Last 15s)`);
    logger.info(`   📈 Trades This Period: ${totalTradesScanned}`);
    logger.info(`   📈 TOTAL Since Startup: ${cumulativeTradesScanned}`);
    logger.info(`   🛒 BUY Orders: ${totalBuyOrders} (Total: ${cumulativeBuyOrders})`);
    logger.info(`   ❌ Rejected: ${totalRejected} (Total: ${cumulativeTotalRejected})`);
    logger.info(`      └─ Has History: ${rejectedHistory} (Total: ${cumulativeRejectedHistory})`);
    logger.info(`      └─ Filtered: ${rejectedFiltered} (Total: ${cumulativeRejectedFiltered})`);
    logger.info(`      └─ Below Threshold: ${rejectedBelowThreshold} (Total: ${cumulativeRejectedBelowThreshold})`);
    logger.info(`   🚨 Insider Tweets: ${insiderTweetsPosted} (Total: ${cumulativeInsiderTweets})`);
    logger.info(`   🐋 Whale Tweets: ${whaleTweetsPosted} (Total: ${cumulativeWhaleTweets})`);
    logger.info(`   ⚡ Avg Processing: ${avgProcessingTime}ms per trade`);
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Reset rolling stats
    totalTradesScanned = 0;
    totalBuyOrders = 0;
    rejectedHistory = 0;
    rejectedFiltered = 0;
    rejectedBelowThreshold = 0;
    insiderTweetsPosted = 0;
    whaleTweetsPosted = 0;
    totalProcessingTime = 0;
    processCount = 0;
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("🛑 Shutting down...");
  logger.info(`📊 Final Stats: ${cumulativeTradesScanned} trades scanned, ${cumulativeInsiderTweets} insider tweets, ${cumulativeWhaleTweets} whale tweets`);
  isRunning = false;
  if (wsClient) {
    wsClient.disconnect();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Shutting down...");
  logger.info(`📊 Final Stats: ${cumulativeTradesScanned} trades scanned, ${cumulativeInsiderTweets} insider tweets, ${cumulativeWhaleTweets} whale tweets`);
  isRunning = false;
  if (wsClient) {
    wsClient.disconnect();
  }
  process.exit(0);
});

// Start
logger.info("🚀 PolyInsider Bot Starting (WebSocket Mode)...");
logger.info("📊 Fresh wallet tracker active ($7,500+ instant tweets)");
logger.info("🐋 Whale tracker active ($50,000+ instant tweets)");
logger.info("⏱️  Summary reports every 15 seconds");
logger.info("🔌 Connecting to Polymarket real-time WebSocket...");

// Initialize WebSocket client
wsClient = new RealTimeDataClient({
  onMessage,
  onConnect,
  onStatusChange,
  autoReconnect: true, // Auto-reconnect on disconnect
  pingInterval: 5000   // Keep connection alive
});

// Connect to WebSocket
wsClient.connect();

// Start summary loop
summaryLoop();

import dotenv from "dotenv";
import { RealTimeDataClient } from "@polymarket/real-time-data-client";
import { shouldFilterMarket, hasWalletTradedBefore } from "./polymarket.js";

dotenv.config();

console.log("🧪 Testing Bot Trade Processing Logic\n");
console.log("This will show how trades are processed through your bot's filters\n");

let tradeCount = 0;
const MAX_TRADES = 10;

interface Trade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  title: string;
  eventSlug: string;
  transactionHash: string;
}

const onMessage = async (client: RealTimeDataClient, message: any) => {
  if (message.topic === "activity" && message.type === "trades") {
    tradeCount++;
    const trade: Trade = message.payload;
    const usdValue = trade.size * trade.price;

    console.log("═".repeat(80));
    console.log(`TRADE #${tradeCount}: ${trade.side} $${usdValue.toFixed(0)}`);
    console.log("═".repeat(80));
    console.log(`📊 Market: ${trade.title}`);
    console.log(`👤 Wallet: ${trade.proxyWallet.slice(0, 12)}...`);
    console.log(`💰 Amount: $${usdValue.toFixed(2)}`);
    console.log(`⏰ Time: ${new Date(trade.timestamp * 1000).toISOString()}`);
    console.log("");

    // Test filters
    console.log("🔍 FILTER CHECKS:");
    console.log("─".repeat(80));

    // 1. Side check
    const isBuy = trade.side === "BUY";
    console.log(`1. Is BUY order? ${isBuy ? "✅ YES" : "❌ NO (SELL)"}`);

    if (!isBuy) {
      console.log("   ❌ REJECTED: Only BUY orders processed\n");
      if (tradeCount >= MAX_TRADES) exitTest(client);
      return;
    }

    // 2. Fresh wallet threshold
    const FRESH_THRESHOLD = 7500;
    const meetsThreshold = usdValue >= FRESH_THRESHOLD;
    console.log(`2. Meets fresh wallet threshold ($7,500)? ${meetsThreshold ? "✅ YES" : "❌ NO"} ($${usdValue.toFixed(0)})`);

    // 3. Whale threshold
    const WHALE_THRESHOLD = 50000;
    const isWhale = usdValue >= WHALE_THRESHOLD;
    console.log(`3. Meets whale threshold ($50,000)? ${isWhale ? "✅ YES" : "❌ NO"} ($${usdValue.toFixed(0)})`);

    // 4. Market filter
    const isFiltered = shouldFilterMarket(trade.title);
    console.log(`4. Market filtered (crypto/sports)? ${isFiltered ? "❌ YES (BLOCKED)" : "✅ NO (ALLOWED)"}`);
    if (isFiltered) {
      console.log(`   📋 Reason: Market contains crypto or sports keywords`);
    }

    // 5. Wallet history check (if meets fresh threshold)
    if (meetsThreshold && !isFiltered) {
      try {
        const hasHistory = await hasWalletTradedBefore(trade.proxyWallet, trade.timestamp);
        console.log(`5. Wallet has previous trades? ${hasHistory ? "❌ YES (NOT FRESH)" : "✅ NO (FRESH!)"}`);

        if (!hasHistory) {
          console.log("\n🚨 WOULD POST FRESH WALLET TWEET! 🚨");
          console.log(`   💰 $${usdValue.toFixed(0)} bet`);
          console.log(`   📊 ${trade.title}`);
          console.log(`   👤 https://polymarket.com/profile/${trade.proxyWallet}?via=caneleo`);
        }
      } catch (err: any) {
        console.log(`5. Wallet history check: ⚠️ Error (${err.message})`);
      }
    }

    // 6. Whale check (if meets whale threshold)
    if (isWhale && !isFiltered) {
      console.log("\n🐋 WOULD POST WHALE TWEET! 🐋");
      console.log(`   💰 $${usdValue.toFixed(0)} bet`);
      console.log(`   📊 ${trade.title}`);
      console.log(`   👤 https://polymarket.com/profile/${trade.proxyWallet}?via=caneleo`);
    }

    console.log("\n");

    if (tradeCount >= MAX_TRADES) exitTest(client);
  }
};

function exitTest(client: RealTimeDataClient) {
  console.log("═".repeat(80));
  console.log(`✅ Processed ${MAX_TRADES} trades. Test complete!`);
  console.log("═".repeat(80));
  client.disconnect();
  process.exit(0);
}

const onConnect = (client: RealTimeDataClient) => {
  console.log("✅ Connected to Polymarket RTDS");
  console.log("📡 Subscribing to all trades...");
  console.log("⏳ Processing first 10 trades...\n");

  client.subscribe({
    subscriptions: [{
      topic: "activity",
      type: "trades",
      filters: ""
    }]
  });
};

const onStatusChange = (status: string) => {
  console.log(`🔌 Connection: ${status}`);
};

const wsClient = new RealTimeDataClient({
  onMessage,
  onConnect,
  onStatusChange,
  autoReconnect: false
});

wsClient.connect();

// Timeout
setTimeout(() => {
  console.log("⏱️  Timeout after 2 minutes");
  wsClient.disconnect();
  process.exit(0);
}, 120000);

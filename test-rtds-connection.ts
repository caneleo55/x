import { RealTimeDataClient } from "@polymarket/real-time-data-client";

console.log("🔌 Connecting to Polymarket Real-Time WebSocket...\n");

let tradeCount = 0;
const MAX_TRADES = 5; // Show first 5 trades then exit

const onMessage = (client: RealTimeDataClient, message: any) => {
  if (message.topic === "activity" && message.type === "trades") {
    tradeCount++;

    const trade = message.payload;

    console.log("═".repeat(80));
    console.log(`📊 TRADE #${tradeCount}`);
    console.log("═".repeat(80));
    console.log("RAW MESSAGE:", JSON.stringify(message, null, 2));
    console.log("\n");
    console.log("TRADE PAYLOAD:");
    console.log("─".repeat(80));
    console.log(`Wallet:          ${trade.proxyWallet}`);
    console.log(`Side:            ${trade.side}`);
    console.log(`Size:            ${trade.size}`);
    console.log(`Price:           ${trade.price}`);
    console.log(`USD Value:       $${(trade.size * trade.price).toFixed(2)}`);
    console.log(`Timestamp:       ${trade.timestamp} (${new Date(trade.timestamp * 1000).toISOString()})`);
    console.log(`Title:           ${trade.title}`);
    console.log(`Event Slug:      ${trade.eventSlug}`);
    console.log(`TX Hash:         ${trade.transactionHash}`);
    console.log(`Outcome:         ${trade.outcome || 'N/A'}`);
    console.log(`Outcome Index:   ${trade.outcomeIndex}`);
    console.log("═".repeat(80));
    console.log("\n");

    if (tradeCount >= MAX_TRADES) {
      console.log(`✅ Captured ${MAX_TRADES} trades. Disconnecting...\n`);
      client.disconnect();
      process.exit(0);
    }
  }
};

const onConnect = (client: RealTimeDataClient) => {
  console.log("✅ WebSocket Connected!");
  console.log("📡 Subscribing to all trades...");
  console.log("⏳ Waiting for trades (will show first 5)...\n");

  client.subscribe({
    subscriptions: [{
      topic: "activity",
      type: "trades",
      filters: ""
    }]
  });
};

const onStatusChange = (status: string) => {
  console.log(`🔌 Status: ${status}`);
};

const onError = (error: any) => {
  console.error("❌ Error:", error);
};

// Initialize client
const wsClient = new RealTimeDataClient({
  onMessage,
  onConnect,
  onStatusChange,
  onError,
  autoReconnect: false
});

// Connect
wsClient.connect();

// Timeout after 60 seconds
setTimeout(() => {
  console.log("⏱️  Timeout: No trades received in 60 seconds");
  wsClient.disconnect();
  process.exit(0);
}, 60000);

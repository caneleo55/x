import fetch from "node-fetch";

const DATA_API = "https://data-api.polymarket.com";

async function testOldMethod(wallet: string) {
  console.log("\n📝 OLD METHOD (Buggy)");
  console.log("═══════════════════════");
  console.log(`Endpoint: ${DATA_API}/trades?user=${wallet}&limit=2`);

  const res = await fetch(`${DATA_API}/trades?user=${wallet}&limit=2`);
  const trades: any = await res.json();
  const count = Array.isArray(trades) ? trades.length : 0;

  console.log(`Response count: ${count}`);
  const isFresh = count <= 1; // OLD LOGIC: Allows 1 trade
  console.log(`Result: ${isFresh ? "✅ FRESH (count <= 1)" : "❌ NOT FRESH (count > 1)"}`);

  return { count, isFresh };
}

async function testNewMethod(wallet: string, currentTimestamp: number) {
  console.log("\n📝 NEW METHOD (Fixed)");
  console.log("═══════════════════════");
  console.log(`Endpoint: ${DATA_API}/activity?user=${wallet}&type=TRADE&limit=50`);
  console.log(`Current timestamp: ${currentTimestamp}`);

  const res = await fetch(`${DATA_API}/activity?user=${wallet}&type=TRADE&limit=50`);
  const activities: any = await res.json();

  if (!Array.isArray(activities)) {
    console.log("❌ Invalid response");
    return { total: 0, previous: 0, isFresh: false };
  }

  // Filter trades BEFORE current timestamp
  const previousTrades = activities.filter((t: any) => t.timestamp < currentTimestamp);

  console.log(`Total trades: ${activities.length}`);
  console.log(`Previous trades (before ${currentTimestamp}): ${previousTrades.length}`);

  const isFresh = previousTrades.length === 0; // NEW LOGIC: Strict zero
  console.log(`Result: ${isFresh ? "✅ FRESH (0 previous)" : "❌ NOT FRESH (" + previousTrades.length + " previous)"}`);

  // Show first few trades
  if (previousTrades.length > 0) {
    console.log("\nFirst 3 previous trades:");
    previousTrades.slice(0, 3).forEach((t: any, i: number) => {
      console.log(`  ${i + 1}. Timestamp: ${t.timestamp}, Hash: ${t.transactionHash?.slice(0, 10)}...`);
    });
  }

  return { total: activities.length, previous: previousTrades.length, isFresh };
}

async function testWallet(wallet: string) {
  console.log("\n🧪 TESTING WALLET:", wallet);
  console.log("═".repeat(70));

  const currentTimestamp = Date.now(); // Current time in milliseconds

  try {
    const oldResult = await testOldMethod(wallet);
    const newResult = await testNewMethod(wallet, currentTimestamp);

    console.log("\n📊 COMPARISON");
    console.log("═══════════════");
    console.log(`OLD: ${oldResult.isFresh ? "FRESH ✅" : "NOT FRESH ❌"} (${oldResult.count} trades)`);
    console.log(`NEW: ${newResult.isFresh ? "FRESH ✅" : "NOT FRESH ❌"} (${newResult.previous}/${newResult.total} previous)`);

    if (oldResult.isFresh !== newResult.isFresh) {
      console.log("\n⚠️  MISMATCH! Results differ between methods.");
    } else {
      console.log("\n✅ Both methods agree.");
    }

  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
}

// Main
const testWallets = [
  process.argv[2] || "0x1234567890abcdef1234567890abcdef12345678", // Default test wallet
];

(async () => {
  console.log("🚀 Fresh Wallet Detection API Test");
  console.log("═".repeat(70));

  for (const wallet of testWallets) {
    await testWallet(wallet);
  }

  console.log("\n" + "═".repeat(70));
  console.log("✅ Test complete!");
  console.log("\nUsage: tsx test-wallet-check.ts 0xWALLET_ADDRESS");
})();

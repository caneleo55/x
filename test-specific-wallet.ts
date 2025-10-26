import fetch from "node-fetch";

const DATA_API = "https://data-api.polymarket.com";

// Wallet with 1 trade - perfect test case!
const TEST_WALLET = "0x2329a0b9c7db661ace14d1e8d361311336e1041b";

async function testWallet(wallet: string, currentTimestamp: number) {
  console.log("\n🧪 TESTING WALLET WITH 1 TRADE");
  console.log("═".repeat(70));
  console.log(`Wallet: ${wallet}`);
  console.log(`Current timestamp: ${currentTimestamp}`);
  console.log("");

  // TEST 1: OLD METHOD (Buggy)
  console.log("📝 TEST 1: OLD METHOD (Buggy - /trades endpoint)");
  console.log("─".repeat(70));

  try {
    const url1 = `${DATA_API}/trades?user=${wallet}&limit=2`;
    console.log(`Endpoint: ${url1}`);

    const res1 = await fetch(url1, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (!res1.ok) {
      console.log(`❌ API Error: ${res1.status}`);
    } else {
      const trades: any = await res1.json();
      const count = Array.isArray(trades) ? trades.length : 0;

      console.log(`Response: ${count} trade(s) returned`);

      if (count > 0) {
        console.log("\nTrades:");
        trades.forEach((t: any, i: number) => {
          console.log(`  ${i + 1}. Timestamp: ${t.timestamp}, Size: $${(t.size * t.price).toFixed(0)}, Hash: ${t.transactionHash?.slice(0, 12)}...`);
        });
      }

      // OLD LOGIC: count > 1
      const isFreshOld = count <= 1;
      console.log(`\nOLD Logic: count > 1 ? false : true`);
      console.log(`Result: ${count} trades → ${isFreshOld ? "✅ FRESH (WRONG!)" : "❌ NOT FRESH"}`);

      if (count === 1) {
        console.log("⚠️  BUG: With 1 trade, old logic marks as FRESH (should be NOT FRESH)");
      }
    }
  } catch (err: any) {
    console.log(`❌ Error: ${err.message}`);
  }

  console.log("\n");

  // TEST 2: NEW METHOD (Fixed)
  console.log("📝 TEST 2: NEW METHOD (Fixed - /activity endpoint)");
  console.log("─".repeat(70));

  try {
    const url2 = `${DATA_API}/activity?user=${wallet}&type=TRADE&limit=50`;
    console.log(`Endpoint: ${url2}`);

    const res2 = await fetch(url2, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (!res2.ok) {
      console.log(`❌ API Error: ${res2.status}`);
    } else {
      const activities: any = await res2.json();

      if (!Array.isArray(activities)) {
        console.log("❌ Invalid response format");
        return;
      }

      const totalCount = activities.length;

      // Filter trades BEFORE current timestamp
      const previousTrades = activities.filter((t: any) => t.timestamp < currentTimestamp);
      const previousCount = previousTrades.length;

      console.log(`Response: ${totalCount} total trade(s)`);
      console.log(`Previous trades (before timestamp ${currentTimestamp}): ${previousCount}`);

      if (previousTrades.length > 0) {
        console.log("\nPrevious Trades:");
        previousTrades.slice(0, 5).forEach((t: any, i: number) => {
          console.log(`  ${i + 1}. Timestamp: ${t.timestamp}, Hash: ${t.transactionHash?.slice(0, 12)}...`);
        });
      }

      // NEW LOGIC: previousTrades.length === 0
      const isFreshNew = previousCount === 0;
      console.log(`\nNEW Logic: previousTrades.length === 0 ? true : false`);
      console.log(`Result: ${previousCount} previous → ${isFreshNew ? "✅ FRESH" : "❌ NOT FRESH (CORRECT!)"}`);

      if (previousCount === 1) {
        console.log("✅ CORRECT: With 1 previous trade, new logic marks as NOT FRESH");
      }
    }
  } catch (err: any) {
    console.log(`❌ Error: ${err.message}`);
  }

  console.log("\n" + "═".repeat(70));
  console.log("📊 EXPECTED RESULT:");
  console.log("─".repeat(70));
  console.log("Wallet has 1 trade:");
  console.log("  OLD: Marks as FRESH ✅ (WRONG - allows first trade)");
  console.log("  NEW: Marks as NOT FRESH ❌ (CORRECT - strict zero previous trades)");
  console.log("═".repeat(70));
}

// Run test
const currentTime = Date.now();
testWallet(TEST_WALLET, currentTime);

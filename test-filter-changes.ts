// Test filter improvements - OLD vs NEW comparison

const SPORTS_KEYWORDS = [
  "nfl", "nba", "mlb", "nhl", "ufc", "boxing", "soccer", "football",
  "basketball", "baseball", "hockey", "tennis", "golf", "cricket",
  "super bowl", "world series", "stanley cup", "playoffs", "championship",
  " vs ", " vs. ", "game", "match", "tournament", "league", "team", "player", "score"
];

// OLD FILTER (Buggy - catches stocks)
function shouldFilterMarketOLD(marketTitle: string): boolean {
  const lower = marketTitle.toLowerCase();

  if (SPORTS_KEYWORDS.some(keyword => lower.includes(keyword))) {
    return true;
  }

  const cryptoPattern = /\b(btc|eth|sol|ada|doge)\b|bitcoin|ethereum|solana|cardano|dogecoin|shiba|crypto|price.*\$\d+|hit.*\$\d+|reach.*\$\d+|above.*\$\d+|up or down/i;
  return cryptoPattern.test(marketTitle);
}

// NEW FILTER (Fixed - allows stocks)
function shouldFilterMarketNEW(marketTitle: string): boolean {
  const lower = marketTitle.toLowerCase();

  if (SPORTS_KEYWORDS.some(keyword => lower.includes(keyword))) {
    return true;
  }

  const hasCryptoTicker = /\b(btc|eth|sol|ada|doge)\b/i.test(lower);
  const hasCryptoName = /(bitcoin|ethereum|solana|cardano|dogecoin|shiba|crypto)/i.test(lower);
  const hasUpOrDown = /up or down/i.test(lower);

  return hasCryptoTicker || hasCryptoName || hasUpOrDown;
}

// Test cases
const testMarkets = [
  // Crypto markets (should be filtered)
  "Will Bitcoin reach $200,000 by December 31, 2025?",
  "ETH price above $5,000?",
  "Will SOL hit $300?",
  "BTC up or down today?",
  "Crypto market crash in 2025?",

  // Stock/Finance markets (should NOT be filtered in NEW version)
  "Tesla stock above $300?",
  "Apple reaches $4 trillion market cap?",
  "S&P 500 hits 6000 by year end?",
  "Will Amazon stock price exceed $200?",

  // Tech markets (should NOT be filtered)
  "OpenAI browser by October 31?",
  "GPT-5 released by December?",
  "Apple Vision Pro hits 1M sales?",
  "Meta launches VR console?",

  // Sports markets (should be filtered)
  "Lakers win NBA championship?",
  "Patriots vs Chiefs - Super Bowl winner?",

  // Political markets (should NOT be filtered)
  "Will Trump win 2024 election?",
  "Fed rate cut by June?"
];

console.log("🧪 FILTER COMPARISON TEST\n");
console.log("═".repeat(100));

testMarkets.forEach((market, index) => {
  const oldResult = shouldFilterMarketOLD(market);
  const newResult = shouldFilterMarketNEW(market);
  const differs = oldResult !== newResult;

  console.log(`\n${index + 1}. "${market}"`);
  console.log(`   OLD: ${oldResult ? "❌ FILTERED" : "✅ PASS"}`);
  console.log(`   NEW: ${newResult ? "❌ FILTERED" : "✅ PASS"}`);

  if (differs) {
    console.log(`   🔄 CHANGED! ${oldResult ? "Was filtered" : "Was passing"} → ${newResult ? "Now filtered" : "Now passing"}`);
  }
});

console.log("\n" + "═".repeat(100));
console.log("\n📊 SUMMARY:");
console.log("─".repeat(100));

const oldFiltered = testMarkets.filter(m => shouldFilterMarketOLD(m)).length;
const newFiltered = testMarkets.filter(m => shouldFilterMarketNEW(m)).length;
const changes = testMarkets.filter(m => shouldFilterMarketOLD(m) !== shouldFilterMarketNEW(m));

console.log(`OLD Filter: ${oldFiltered}/${testMarkets.length} filtered`);
console.log(`NEW Filter: ${newFiltered}/${testMarkets.length} filtered`);
console.log(`\nChanged: ${changes.length} markets`);

if (changes.length > 0) {
  console.log("\nMarkets that changed:");
  changes.forEach(market => {
    const wasFiltered = shouldFilterMarketOLD(market);
    console.log(`  ${wasFiltered ? "❌→✅" : "✅→❌"} ${market}`);
  });
}

console.log("\n" + "═".repeat(100));

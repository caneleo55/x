#!/bin/bash

# Quick test for wallet: 0x2329a0b9c7db661ace14d1e8d361311336e1041b
# This wallet has 1 trade - perfect to show the bug!

WALLET="0x2329a0b9c7db661ace14d1e8d361311336e1041b"

echo "🧪 Testing Wallet with 1 Trade"
echo "Wallet: $WALLET"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "📝 OLD METHOD: /trades?limit=2"
echo "───────────────────────────────────────────────────────────────"
echo "If returns 1 trade → OLD logic says FRESH ✅ (WRONG!)"
echo ""
curl -s "https://data-api.polymarket.com/trades?user=$WALLET&limit=2" | python3 -m json.tool 2>/dev/null || curl -s "https://data-api.polymarket.com/trades?user=$WALLET&limit=2"
echo ""
echo ""

echo "📝 NEW METHOD: /activity?type=TRADE&limit=50"
echo "───────────────────────────────────────────────────────────────"
echo "If returns 1 trade → NEW logic says NOT FRESH ❌ (CORRECT!)"
echo ""
curl -s "https://data-api.polymarket.com/activity?user=$WALLET&type=TRADE&limit=50" | python3 -m json.tool 2>/dev/null || curl -s "https://data-api.polymarket.com/activity?user=$WALLET&type=TRADE&limit=50"
echo ""
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📊 ANALYSIS:"
echo "───────────────────────────────────────────────────────────────"
echo "This wallet has 1 trade."
echo ""
echo "OLD Bug: count > 1 → false → Marks as FRESH (allows 1 trade)"
echo "NEW Fix: previousTrades.length === 0 → Only 0 trades = FRESH"
echo ""
echo "The fix ensures ONLY wallets with ZERO previous trades are"
echo "marked as fresh, eliminating false positives."
echo "═══════════════════════════════════════════════════════════════"

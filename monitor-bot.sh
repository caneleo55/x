#!/bin/bash

echo "🤖 Polyinsider Bot Monitor"
echo "=========================="
echo ""

# Check if bot is running
if pm2 list | grep -q "polyinsider-bot.*online"; then
  echo "✅ Bot Status: RUNNING"
else
  echo "❌ Bot Status: STOPPED"
fi

echo ""
echo "📊 Redis Stats:"
echo "---------------"
npx tsx check-redis-stats.ts

echo ""
echo "📝 Recent Log Activity (last 20 lines):"
echo "----------------------------------------"
pm2 logs polyinsider-bot --lines 20 --nostream

echo ""
echo "📊 Tweet Stats (last 100 log lines):"
echo "-------------------------------------"
FRESH_COUNT=$(pm2 logs polyinsider-bot --lines 100 --nostream 2>/dev/null | grep -c "Posted insider tweet" || echo 0)
WHALE_COUNT=$(pm2 logs polyinsider-bot --lines 100 --nostream 2>/dev/null | grep -c "Posted whale tweet" || echo 0)
FAILED_COUNT=$(pm2 logs polyinsider-bot --lines 100 --nostream 2>/dev/null | grep -c "Failed to post" || echo 0)
FILTERED_COUNT=$(pm2 logs polyinsider-bot --lines 100 --nostream 2>/dev/null | grep -c "Filtered" || echo 0)

echo "✅ Fresh wallet tweets: $FRESH_COUNT"
echo "✅ Whale tweets: $WHALE_COUNT"
echo "❌ Failed posts: $FAILED_COUNT"
echo "🚫 Filtered markets: $FILTERED_COUNT"

echo ""
echo "🔗 View live logs: pm2 logs polyinsider-bot"

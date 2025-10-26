#!/bin/bash

# Test script for Polymarket API endpoints (no jq required)
# Compares OLD vs NEW fresh wallet detection logic

echo "🧪 Testing Polymarket Fresh Wallet Detection API"
echo "=================================================="
echo ""

# Test with different wallet addresses
TEST_WALLET="${1:-0x1234567890abcdef1234567890abcdef12345678}"

DATA_API="https://data-api.polymarket.com"

echo "Testing wallet: ${TEST_WALLET}"
echo ""

echo "📝 Test 1: OLD Method (Buggy /trades endpoint)"
echo "----------------------------------------------"
echo "Endpoint: ${DATA_API}/trades?user=${TEST_WALLET}&limit=2"
echo ""
curl -s "${DATA_API}/trades?user=${TEST_WALLET}&limit=2"
echo ""
echo ""

echo "📝 Test 2: NEW Method (Fixed /activity endpoint)"
echo "----------------------------------------------"
echo "Endpoint: ${DATA_API}/activity?user=${TEST_WALLET}&type=TRADE&limit=50"
echo ""
curl -s "${DATA_API}/activity?user=${TEST_WALLET}&type=TRADE&limit=50"
echo ""
echo ""

echo "=================================================="
echo "✅ To test with a specific wallet, run:"
echo "   ./test-api.sh 0xYOUR_WALLET_ADDRESS"

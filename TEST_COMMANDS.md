# Fresh Wallet Detection API Testing

## Quick Test Commands

### Example 1: Test a Known Wallet

Replace `WALLET_ADDRESS` with an actual wallet from your bot logs:

```bash
# OLD METHOD (Buggy - limit=2)
curl "https://data-api.polymarket.com/trades?user=WALLET_ADDRESS&limit=2"

# NEW METHOD (Fixed - activity endpoint with type=TRADE, limit=50)
curl "https://data-api.polymarket.com/activity?user=WALLET_ADDRESS&type=TRADE&limit=50"
```

---

## Test with Real Examples

### Get Recent Trades to Find Test Wallets

```bash
# Get recent trades
curl "https://data-api.polymarket.com/trades?limit=10"
```

Copy a `proxyWallet` address from the response, then test it:

```bash
# Example wallet (replace with actual)
WALLET="0x1234..."

# Test OLD endpoint
curl "https://data-api.polymarket.com/trades?user=$WALLET&limit=2"

# Test NEW endpoint
curl "https://data-api.polymarket.com/activity?user=$WALLET&type=TRADE&limit=50"
```

---

## What to Look For

### Fresh Wallet (First-Timer):
- **OLD**: Returns array with 0-1 items ✅
- **NEW**: Returns empty array `[]` ✅

### Established Wallet:
- **OLD**: Returns array with 2+ items ❌
- **NEW**: Returns array with 1+ items ❌

### The Difference:
- **OLD endpoint** (`/trades`): May include current trade if API is fast
- **NEW endpoint** (`/activity?type=TRADE`): More reliable, filters by timestamp in code

---

## Expected Response Format

### `/trades` Response:
```json
[
  {
    "proxyWallet": "0x123...",
    "side": "BUY",
    "size": 100,
    "price": 0.52,
    "timestamp": 1729900000000,
    "transactionHash": "0xabc...",
    "title": "Market Title",
    "eventSlug": "market-slug"
  }
]
```

### `/activity?type=TRADE` Response:
```json
[
  {
    "timestamp": 1729900000000,
    "transactionHash": "0xabc...",
    "user": "0x123...",
    "type": "TRADE",
    "size": 100,
    "price": 0.52
  }
]
```

---

## Testing Logic

In the code, we filter by timestamp:

```typescript
// Current trade timestamp: 1729900000000

// Get all trades for wallet
const activities = await fetch(`/activity?user=${wallet}&type=TRADE&limit=50`);

// Filter trades BEFORE current timestamp
const previousTrades = activities.filter(t => t.timestamp < 1729900000000);

// Fresh if zero previous trades
return previousTrades.length > 0; // true = has history, false = fresh
```

---

## Run the Test Script

```bash
# Make executable
chmod +x test-api.sh

# Test with specific wallet
./test-api.sh 0xYOUR_WALLET_ADDRESS

# Or just run to see the endpoints
./test-api.sh
```

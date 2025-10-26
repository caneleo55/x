import fetch from "node-fetch";
import { logger } from "./logger.js";

const GAMMA_API = process.env.POLY_GAMMA_API || "https://gamma-api.polymarket.com";
const DATA_API = process.env.POLY_DATA_API || "https://data-api.polymarket.com";

export interface Trade {
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
  usdValue?: number;
  marketUrl?: string;
}

const SPORTS_KEYWORDS = [
  "nfl", "nba", "mlb", "nhl", "ufc", "boxing", "soccer", "football",
  "basketball", "baseball", "hockey", "tennis", "golf", "cricket",
  "super bowl", "world series", "stanley cup", "playoffs", "championship",
  " vs ", " vs. ", "game", "match", "tournament", "league", "team", "player", "score"
];

let pollCount = 0;
let totalTradesReceived = 0;
let totalBuyOrders = 0;
let totalOver1k = 0;
let totalFiltered = 0;

export async function fetchRecentTrades(limit = 100): Promise<Trade[]> {
  try {
    pollCount++;
    const url = `${DATA_API}/trades?limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`Data API error: ${res.status}`);
    }

    const trades = await res.json() as Trade[];
    totalTradesReceived += trades.length;

    // Calculate USD value and add market URL
    for (const trade of trades) {
      trade.usdValue = trade.size * trade.price;
      trade.marketUrl = `https://polymarket.com/event/${trade.eventSlug}`;
    }

    // Statistics
    const buyTrades = trades.filter(t => t.side === "BUY");
    const over1k = buyTrades.filter(t => t.usdValue && t.usdValue >= 1000);
    const over50k = buyTrades.filter(t => t.usdValue && t.usdValue >= 50000);

    totalBuyOrders += buyTrades.length;
    totalOver1k += over1k.length;

    logger.debug(`📊 Poll #${pollCount}: ${trades.length} trades | ${buyTrades.length} BUY | ${over1k.length} over $1k | ${over50k.length} whales ($50k+)`);
    logger.debug(`📈 Totals: ${totalTradesReceived} received | ${totalBuyOrders} BUY | ${totalOver1k} over $1k | ${totalFiltered} filtered`);

    return trades;
  } catch (err: any) {
    logger.error("Failed to fetch trades:", err.message);
    return [];
  }
}

export function shouldFilterMarket(marketTitle: string): boolean {
  const lower = marketTitle.toLowerCase();

  // Check sports (word boundary safe)
  if (SPORTS_KEYWORDS.some(keyword => lower.includes(keyword))) {
    totalFiltered++;
    logger.debug(`🚫 Filtered (sports): ${marketTitle}`);
    return true;
  }

  // Check crypto - improved to avoid false positives on stock/finance markets
  // Crypto tickers (word boundary safe): btc, eth, sol, ada, doge
  const hasCryptoTicker = /\b(btc|eth|sol|ada|doge)\b/i.test(lower);

  // Crypto names: bitcoin, ethereum, solana, cardano, dogecoin, shiba, crypto
  const hasCryptoName = /(bitcoin|ethereum|solana|cardano|dogecoin|shiba|crypto)/i.test(lower);

  // "up or down" pattern (common in crypto day trading)
  const hasUpOrDown = /up or down/i.test(lower);

  // Filter if has crypto ticker, name, or day trading pattern
  if (hasCryptoTicker || hasCryptoName || hasUpOrDown) {
    totalFiltered++;
    logger.debug(`🚫 Filtered (crypto): ${marketTitle}`);
    return true;
  }

  return false;
}

export async function hasWalletTradedBefore(address: string, currentTimestamp: number): Promise<boolean> {
  try {
    // Use /activity endpoint with type=TRADE to match backend implementation
    const url = `${DATA_API}/activity?user=${address}&type=TRADE&limit=50`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      logger.warn(`Cannot check wallet history (${res.status}), assuming traded`);
      return true;
    }

    const activities: any = await res.json();

    if (!Array.isArray(activities)) {
      logger.warn(`Unexpected response format for wallet history`);
      return true;
    }

    // Filter trades that occurred BEFORE the current trade timestamp
    const previousTrades = activities.filter((t: any) => t.timestamp < currentTimestamp);

    const count = previousTrades.length;
    logger.debug(`Wallet ${address.slice(0, 8)}... has ${count} previous trade(s) (before timestamp ${currentTimestamp})`);

    // Strict check: wallet is fresh ONLY if zero previous trades
    return count > 0;
  } catch (err: any) {
    logger.warn(`Wallet history check error: ${err.message}`);
    return true; // Conservative: assume has history on error
  }
}

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
  name?: string;
  pseudonym?: string;
  outcome?: string;
  outcomeIndex?: number;
  usdValue?: number;
  marketUrl?: string;
}

const SPORTS_KEYWORDS = [
  // NFL & American Football
  "super bowl", "super-bowl", "superbowl", "49ers", "bears", "bengals", "bills", "broncos", "browns",
  "buccaneers", "bucs", "chargers", "chiefs", "colts", "commanders", "cowboys", "dolphins", "falcons",
  "jaguars", "jags", "jets", "lions", "packers", "panthers", "patriots", "pats", "raiders", "rams",
  "ravens", "saints", "seahawks", "steelers", "texans", "titans", "vikings", "cfb", "college-football",
  "ncaa-football", "nfl",

  // NBA & Basketball
  "nba", "wnba", "euroleague", "76ers", "sixers", "bucks", "bulls", "cavaliers", "cavs", "celtics",
  "clippers", "grizzlies", "hornets", "jazz", "knicks", "lakers", "magic", "mavericks", "mavs", "nets",
  "nuggets", "pacers", "pelicans", "pistons", "blazers", "trail-blazers", "raptors", "rockets",
  "spurs", "suns", "thunder", "timberwolves", "wolves", "warriors", "wizards", "lebron", "curry",
  "durant", "giannis", "jokic", "embiid", "luka", "doncic", "tatum", "booker", "harden",
  "college-basketball", "march-madness",

  // MLB & Baseball
  "mlb", "world-series", "world series", "angels", "astros", "athletics", "orioles", "red-sox", "white-sox", "cubs",
  "reds", "guardians", "royals", "brewers", "twins", "yankees", "mets", "phillies", "pirates", "padres",
  "mariners", "rays", "rangers", "blue-jays", "braves", "marlins", "diamondbacks", "rockies",
  "dodgers", "nationals",

  // NHL & Hockey
  "nhl", "stanley-cup", "stanley cup", "avalanche", "blackhawks", "blue-jackets", "blues", "bruins", "canadiens",
  "canucks", "capitals", "flames", "flyers", "golden-knights", "hurricanes", "islanders",
  "lightning", "maple-leafs", "leafs", "oilers", "penguins", "predators", "red-wings", "sabres",
  "sharks", "kraken", "ducks", "wild",

  // Soccer - Leagues
  "soccer", "football", "fifa", "uefa", "epl", "premier-league", "la-liga", "laliga", "bundesliga",
  "ligue-1", "serie-a", "mls", "ucl", "champions-league", "europa-league", "uel", "world-cup",
  "european-championship", "a-league", "fa-cup", "efl-cup", "efl-championship",

  // Premier League Teams
  "arsenal", "arsenal fc", "aston-villa", "aston villa", "bournemouth", "brentford", "brighton",
  "chelsea", "chelsea fc", "crystal-palace", "crystal palace", "everton", "fulham", "leeds",
  "leicester", "liverpool", "liverpool fc", "man-city", "manchester-city", "manchester city",
  "manchester city fc", "man-utd", "man-united", "manchester-united", "manchester united",
  "manchester united fc", "newcastle", "newcastle united", "nottingham-forest",
  "nottingham forest", "southampton", "tottenham", "west-ham", "west ham",

  // La Liga Teams
  "athletic-bilbao", "athletic bilbao", "atletico", "atletico-madrid", "atletico madrid",
  "barcelona", "barcelona fc", "barca", "fc barcelona", "betis", "real-madrid", "real madrid",
  "real madrid fc", "real-sociedad", "sevilla", "sevilla fc", "valencia", "valencia cf", "villarreal",

  // Bundesliga Teams
  "bayern", "bayern-munich", "bayern munich", "fc bayern", "dortmund", "borussia dortmund",
  "leipzig", "rb leipzig", "leverkusen", "bayer leverkusen", "frankfurt", "wolfsburg",

  // Serie A Teams
  "atalanta", "inter-milan", "inter milan", "fc inter", "juventus", "juventus fc", "lazio",
  "ac-milan", "ac milan", "napoli", "ssc napoli", "roma", "as roma",

  // Ligue 1 Teams
  "psg", "paris-saint-germain", "paris saint germain", "marseille", "monaco", "lyon", "lille", "lens", "nice",

  // Other Major Soccer Teams
  "ajax", "benfica", "celtic", "porto", "sporting", "rangers", "psv", "feyenoord",
  "galatasaray", "fenerbahce", "besiktas",

  // Soccer Stars
  "messi", "ronaldo", "mbappe", "haaland", "neymar", "lewandowski", "salah", "benzema", "modric",
  "kane", "son", "de-bruyne",

  // Tennis
  "tennis", "atp", "wta", "wimbledon", "french-open", "us-open", "australian-open", "djokovic",
  "nadal", "federer", "alcaraz",

  // Golf
  "golf", "pga", "lpga", "ryder-cup",

  // Combat Sports
  "mma", "ufc", "bellator", "boxing", "mcgregor", "mayweather", "tyson", "fury", "jake-paul",

  // Motorsports
  "formula-1", "f1", "nascar", "motogp", "indycar", "grand-prix",

  // Esports
  "esports", "e-sports", "counter-strike", "csgo", "cs:go", "cs2",
  "league-of-legends", "lol", "dota", "dota-2", "valorant", "overwatch", "rocket-league",
  "fortnite", "apex-legends", "cod", "call-of-duty", "pubg",

  // Other Sports
  "olympics", "cricket", "rugby", "wrestling", "wwe", "cycling", "tour-de-france",

  // Generic Sports Terms
  " vs ", " vs. ", "game", "match", "tournament", "playoff", "playoffs", "semifinal",
  "quarterfinal", "finals", "championship", "league", "team", "player", "score",
  "spread", "moneyline", "over/under", "point spread"
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

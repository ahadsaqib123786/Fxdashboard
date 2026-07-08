import { getCandlesForSymbols } from "../../lib/twelvedata";
import { rankPairs } from "../../lib/strength";

// Keep this list short to stay well within Twelve Data's free 800 calls/day limit
const WATCHLIST = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "AUD/USD",
  "AUD/JPY",
  "USD/CAD",
  "USD/CHF",
  "NZD/USD",
];

export default async function handler(req, res) {
  try {
    const candlesBySymbol = await getCandlesForSymbols(WATCHLIST, "4h", 30);
    const { strongest, ranked } = rankPairs(candlesBySymbol);
    res.status(200).json({ strongest, ranked, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

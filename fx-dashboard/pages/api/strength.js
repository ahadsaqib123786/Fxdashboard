import { getCandlesForSymbols } from "../../lib/twelvedata";
import { rankPairs } from "../../lib/strength";
import { WATCHLIST } from "../../lib/config";

// Still used for the lightweight currency-strength context; the main
// decision surface is now /api/scan (weighted confluence engine).
export default async function handler(req, res) {
  try {
    const candlesBySymbol = await getCandlesForSymbols(WATCHLIST, "4h", 30);
    const { strongest, ranked } = rankPairs(candlesBySymbol);
    res.status(200).json({ strongest, ranked, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

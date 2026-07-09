import { buildConfluence } from "../../lib/confluenceEngine";
import { generateTradeAnalysis, buildFallbackSummary } from "../../lib/ai";
import { isValidSymbol } from "../../lib/config";

// Detailed single-pair drill-down, used by the AI Analysis page. Kept
// separate from /api/scan (which covers the whole watchlist) because a user
// picking one pair from a dropdown shouldn't have to wait for all 8 pairs.
export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) return res.status(400).json({ error: "symbol is required, e.g. EUR/USD" });
  if (!isValidSymbol(symbol)) {
    return res.status(400).json({ error: "symbol must look like EUR/USD (three letters / three letters)" });
  }

  try {
    const confluence = await buildConfluence(symbol);

    let aiAnalysis;
    let aiSource = "gemini";
    try {
      aiAnalysis = await generateTradeAnalysis(confluence);
    } catch (err) {
      aiAnalysis = buildFallbackSummary(confluence);
      aiSource = "fallback";
    }

    res.status(200).json({ ...confluence, aiAnalysis, aiSource });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

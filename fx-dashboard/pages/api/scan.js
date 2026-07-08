import { scanWatchlist } from "../../lib/confluenceEngine";
import { deriveMarketStatus } from "../../lib/marketStatus";
import { generateTradeAnalysis, buildFallbackSummary } from "../../lib/ai";
import { REFRESH_MS } from "../../lib/config";

// This is the endpoint behind the "Market Pulse" homepage. It scans every
// monitored pair, works out whether there's a real A+ setup, and only calls
// the AI (Gemini) layer once for whichever pair actually qualifies — there's
// no reason to burn AI quota narrating pairs the engine has already ignored.
export default async function handler(req, res) {
  try {
    const { bestTrade, ranked, scannedAt, newsAvailable } = await scanWatchlist();
    const marketStatus = deriveMarketStatus({ bestTrade, ranked });

    let aiSummary = null;
    let aiSource = "none";
    if (bestTrade) {
      try {
        aiSummary = await generateTradeAnalysis(bestTrade);
        aiSource = "gemini";
      } catch (err) {
        aiSummary = buildFallbackSummary(bestTrade);
        aiSource = "fallback";
      }
    }

    res.status(200).json({
      marketStatus,
      bestTrade,
      opportunities: ranked.filter((r) => r.symbol !== bestTrade?.symbol),
      aiSummary,
      aiSource,
      newsAvailable,
      scannedAt,
      nextScanMs: REFRESH_MS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

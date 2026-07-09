import { scanWatchlist } from "../../lib/confluenceEngine";
import { deriveMarketStatus } from "../../lib/marketStatus";
import { generateTradeAnalysis, buildFallbackSummary } from "../../lib/ai";
import { REFRESH_MS } from "../../lib/config";

// This is the endpoint behind the "Market Pulse" homepage. It scans every
// monitored pair top-down (Daily -> 4H -> 1H -> 30M), works out whether
// there's a real Display-grade setup, and only calls the AI (Gemini) layer
// once for whichever single pair actually qualifies — there's no reason to
// burn AI quota narrating pairs the engine has already rejected or ignored.
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

    // Even when nothing qualifies as a Display-grade setup, the dashboard
    // should never look empty — surface whichever pair scored highest so
    // the trader can see what's closest and why it isn't there yet.
    const closestPair = !bestTrade && ranked.length ? ranked[0] : null;

    res.status(200).json({
      marketStatus,
      bestTrade,
      closestPair,
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

import { getCandles } from "../../lib/twelvedata";
import { buildOverlays } from "../../lib/smcOverlays";
import { isValidSymbol } from "../../lib/config";

// Maps chart-facing timeframe labels to Twelve Data interval strings
const TIMEFRAME_MAP = {
  "5M": "5min",
  "15M": "15min",
  "30M": "30min",
  "1H": "1h",
  "4H": "4h",
  D: "1day",
};

export default async function handler(req, res) {
  const { symbol, timeframe = "4H" } = req.query;

  if (!symbol || !isValidSymbol(symbol)) {
    return res.status(400).json({ error: "symbol must look like EUR/USD" });
  }

  const interval = TIMEFRAME_MAP[timeframe];
  if (!interval) {
    return res.status(400).json({ error: `Unsupported timeframe: ${timeframe}` });
  }

  try {
    const candles = await getCandles(symbol, interval, 300);
    const overlays = buildOverlays(candles);
    res.status(200).json({ symbol, timeframe, candles, overlays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

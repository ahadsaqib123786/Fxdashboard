import { getCandles } from "../../lib/twelvedata";
import { scorePair } from "../../lib/strength";
import { generateAnalysis } from "../../lib/ai";

export default async function handler(req, res) {
  const { symbol, interval = "4h" } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol is required, e.g. EUR/USD" });

  try {
    const candles = await getCandles(symbol, interval, 50);
    const scored = scorePair(symbol, candles);
    const aiText = await generateAnalysis(scored);
    res.status(200).json({ ...scored, aiAnalysis: aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

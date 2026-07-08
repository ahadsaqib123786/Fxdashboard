import { buildConfluence } from "../../lib/confluence";
import { generateTradeAnalysis } from "../../lib/ai";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol is required, e.g. EUR/USD" });

  try {
    const confluence = await buildConfluence(symbol);
    const aiText = await generateTradeAnalysis(confluence);
    res.status(200).json({ ...confluence, aiAnalysis: aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

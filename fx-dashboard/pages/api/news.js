import { getWeeklyNews, estimateNewsBias } from "../../lib/news";

export default async function handler(req, res) {
  try {
    const { past, upcoming } = await getWeeklyNews();
    res.status(200).json({
      past: past.map((e) => ({ ...e, bias: estimateNewsBias(e) })),
      upcoming,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

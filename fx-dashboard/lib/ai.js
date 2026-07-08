// Uses Google Gemini's free tier to turn the weighted confluence breakdown
// into an institutional-style analyst note. Get a free key at
// https://aistudio.google.com/app/apikey
//
// Design rule: the prompt hands the model every number it's allowed to talk
// about and explicitly forbids inventing anything else. This keeps the
// output trustworthy - a trader should never read a level here that didn't
// come from the engine.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

function formatBreakdown(breakdown) {
  return Object.entries(breakdown)
    .map(([key, f]) => `- ${key} (${f.points}/${f.max}): ${f.note}`)
    .join("\n");
}

function formatTradePlan(plan) {
  if (!plan) return "No trade plan - this pair does not currently qualify for an entry.";
  return `Direction: ${plan.direction.toUpperCase()}
Entry zone: ${plan.entryZone.bottom.toFixed(5)} to ${plan.entryZone.top.toFixed(5)}
Stop loss: ${plan.stopLoss.toFixed(5)}
Take profit 1 (2R): ${plan.takeProfit1.toFixed(5)}
Take profit 2 (3R): ${plan.takeProfit2.toFixed(5)}`;
}

export async function generateTradeAnalysis(confluence) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const prompt = `You are an institutional FX analyst writing a short internal note for a discretionary trader who already knows ICT/Smart Money concepts. Do not explain what an order block or fair value gap is - assume that knowledge.

Instrument: ${confluence.symbol}
Current price: ${confluence.currentPrice}
Confidence score: ${confluence.totalScore}/${confluence.maxScore} (grade ${confluence.grade})
Qualifies for a trade: ${confluence.qualifies}

Scored confluence factors (only use these numbers and notes - do not invent any level, indicator, or reason not listed here):
${formatBreakdown(confluence.breakdown)}

Trade plan computed by the engine (use these exact levels if quoting any price):
${formatTradePlan(confluence.tradePlan)}

Write 4 to 6 sentences in a direct, institutional tone:
1. Open with a clear verdict: qualifies for a trade, or WAIT - no hedging.
2. If it qualifies, state the institutional narrative in one sentence (why this move likely happens), then what confirms the entry and what would invalidate it (only using the levels given above).
3. If it does NOT qualify, name the single weakest factor from the breakdown that is holding it back, and say plainly that patience is correct here.
4. Never suggest a trade that the engine marked as not qualifying, even if some individual factors look strong.`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Gemini error: ${data.error.message}`);

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text in its response.");

  return text;
}

// Lightweight, non-AI fallback summary built directly from the breakdown.
// Used when GEMINI_API_KEY isn't configured, or the AI call fails, so the
// dashboard never shows a broken card just because the optional AI layer
// is unavailable - the underlying numbers still tell the story on their own.
export function buildFallbackSummary(confluence) {
  if (!confluence.qualifies) {
    const weakest = Object.entries(confluence.breakdown || {}).sort(
      (a, b) => a[1].points / a[1].max - b[1].points / b[1].max
    )[0];
    return `WAIT. ${confluence.symbol} scores ${confluence.totalScore}/${confluence.maxScore} (${confluence.grade}) - below the bar for a recommended trade.${
      weakest ? ` Weakest factor: ${weakest[1].note}` : ""
    }`;
  }
  const p = confluence.tradePlan;
  return `${confluence.symbol} qualifies as a ${confluence.grade}-grade ${p.direction.toUpperCase()} - ${confluence.totalScore}/${confluence.maxScore} confidence. Entry ${p.entryZone.bottom.toFixed(5)}-${p.entryZone.top.toFixed(5)}, stop ${p.stopLoss.toFixed(5)}, targets ${p.takeProfit1.toFixed(5)} / ${p.takeProfit2.toFixed(5)}.`;
}

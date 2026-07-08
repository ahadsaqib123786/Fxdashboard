// Uses Google Gemini's free tier to turn the computed strength/bias numbers
// into a readable analysis. Get a free key at https://aistudio.google.com/app/apikey

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

export async function generateTradeAnalysis(confluence) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const zoneText = (zones, label) =>
    zones.length
      ? zones.map((z) => `${label} between ${z.bottom.toFixed(5)} and ${z.top.toFixed(5)}`).join("; ")
      : "none unmitigated nearby";

  const prompt = `You are a forex analyst using ICT/Smart Money concepts. Here is computed multi timeframe data for ${confluence.symbol}, current price ${confluence.currentPrice}:

4H bias (directional bias): ${confluence.htf.bias}. Reason: ${confluence.htf.reason}
1H bias (confirms or contradicts 4H): ${confluence.mtf.bias}. Reason: ${confluence.mtf.reason}
Do the 4H and 1H agree: ${confluence.timeframesAgree}

30min unmitigated fair value gaps in the 4H direction: ${zoneText(confluence.ltf.fairValueGaps, "FVG")}
30min unmitigated order blocks in the 4H direction: ${zoneText(confluence.ltf.orderBlocks, "Order block")}

Overall confluence found: ${confluence.confluence}

Write a short, direct analysis (4 to 6 sentences) for a trader using ICT/SMC entries on order blocks or fair value gaps. State clearly whether there is a valid intraday trade opportunity right now based on this confluence, or whether the trader should wait. If there is a valid setup, describe which zone to watch for entry and what would invalidate it, using only the price levels given above, do not invent new levels. If there is no real confluence (timeframes disagree, or no unmitigated zone in the right direction), say so plainly and explain why patience is the correct call here. Do not hedge unnecessarily.`;

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const prompt = `You are a forex analyst using ICT/Smart Money concepts (order blocks, supply and demand zones, fair value gaps, market structure). 
Given this computed data for ${pairData.symbol}:
- Score: ${pairData.score.toFixed(2)}
- Bias: ${pairData.bias}
- Rule based reasoning: ${pairData.reason}

Write a short, professional analysis (3 to 4 sentences) explaining the likely bias and what a trader should watch for. Do not invent price levels that were not given to you. Be direct and avoid hedging language.`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no text in its response.");
  }

  return text;
}

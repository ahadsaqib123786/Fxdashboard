// Uses Google Gemini's free tier to turn the computed strength/bias numbers
// into a readable analysis. Get a free key at https://aistudio.google.com/app/apikey

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function generateAnalysis(pairData) {
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
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "AI analysis unavailable right now.";

  return text;
}

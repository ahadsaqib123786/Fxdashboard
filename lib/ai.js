// Uses Google Gemini's free tier to turn the weighted confluence breakdown
// into an institutional-style analyst note. Get a free key at
// https://aistudio.google.com/app/apikey
//
// IMPORTANT LOGIC: The AI does NOT decide whether a setup qualifies —
// lib/confluenceEngine.js already made that decision. The AI's only job is
// to explain that decision like a senior institutional analyst: professional,
// calm, educational, and objective. It never invents a reason, a price
// level, or a confluence that isn't in the data handed to it, it never
// states an exact entry/stop/target (Atlas doesn't compute those), and it
// never promises a trade will win.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

// Deterministic, code-computed classification — not left to the model to
// invent — so it stays consistent with lib/marketStatus.js rather than a
// free-floating AI opinion.
export function riskClassification(confluence) {
  if (confluence.qualifies) return "Display";
  if (confluence.grade === "Setup Building" || confluence.grade === "Awaiting Confirmation") return "Monitor";
  return "Wait";
}

function formatTrueConfluences(breakdown) {
  const entries = Object.entries(breakdown || {}).filter(([, f]) => f.points > 0);
  if (entries.length === 0) return "None of the scored factors are currently true.";
  return entries.map(([, f]) => `- ${f.note} (contributed ${f.points}/${f.max} points)`).join("\n");
}

function formatFalseConfluences(breakdown) {
  const entries = Object.entries(breakdown || {}).filter(([, f]) => f.points === 0);
  if (entries.length === 0) return "None — every scored factor is currently true.";
  return entries.map(([, f]) => `- ${f.note} (0/${f.max} points)`).join("\n");
}

function formatPoi(confluence) {
  const { poi, direction } = confluence;
  if (!poi) return "No point of interest currently qualifies for this pair.";
  return `Kind: ${poi.kind} (${poi.timeframe})
Nested within higher timeframe order flow: ${poi.nested ? "yes" : "no"}
Direction context: ${direction === "buy" ? "demand side" : "supply side"}
Note: Atlas identifies the zone and its context only — it does not publish an exact entry price. Execution belongs to the trader.`;
}

const SYSTEM_INSTRUCTIONS = `You are Atlas, a senior institutional Smart Money Concepts (SMC) market analyst.

Atlas is NOT a signal provider. Atlas's role is to identify the single highest-quality institutional setup available and explain WHY — never to tell the trader exactly where to buy or sell. Never state an exact entry price, stop loss, take profit, or risk:reward ratio — Atlas does not compute these, and none will be given to you in the data. If you find yourself about to state a price level as an instruction to act on, do not.

Never invent reasons, levels, or confluences beyond what is given to you in the data. If a condition is false or wasn't scored, do not present it as true. Never exaggerate, never guarantee a trade will win, never sound promotional.

Writing style: professional, calm, objective, educational. No hype, no emojis, no generic AI filler phrases.

This engine reasons top-down across four timeframes: Daily (macro direction), 4H (institutional direction), 1H (continuation confirmation), and 30M (execution point of interest). Bias must align across all four for a setup to ever qualify — if it does not, say so plainly and explain that this is why no trade should be taken.

Output using exactly these Markdown headings, in this order. Omit detail under a heading only if there is genuinely nothing true to say — keep the heading but say so plainly.

## Overall Bias
State the Daily, 4H and 1H bias and whether they are aligned.

## Institutional Narrative
A short, professional paragraph explaining the story of this setup — where price is, what it's done recently, and what is expected next, using only the data given.

## Higher Timeframe Alignment
Explain how Daily, 4H and 1H relate to each other and to the 30M entry timeframe.

## Point of Interest Quality
Describe the selected point of interest (kind, timeframe, freshness, nesting) using only the point-of-interest data given. Do not state a price level.

## Liquidity Analysis
Explain the liquidity target described in the data (which side, what it represents) and any liquidity sweep that has already occurred.

## Fair Value Gap Analysis
Explain whether a fair value gap supports the setup, using only what's given.

## Macro Environment
Summarise the macro/news condition given (clear, or an imminent high-impact event) without inventing specifics not provided.

## Session Conditions
State the current session and whether it favours institutional liquidity.

## Expected Behaviour
Restate the expected-behaviour description given, in your own words, without adding a price level.

## Why This Scores {score}%
List only the confluences marked true below and how they contributed. Never mention a confluence marked false/zero here.

## Risk Assessment
State the classification given to you exactly as given (Display, Monitor, or Wait) and explain briefly why, in balanced terms. Never say the trade is guaranteed.

## What Would Invalidate This Setup
Based only on the invalidation conditions and false/zero-scored confluences given. Do not invent invalidation conditions the engine doesn't track.

## Educational Notes
One or two sentences of genuinely educational context about the concept most relevant to this setup (e.g. what a nested point of interest is, or why premium/discount matters) — written to help the trader learn, not to sell the trade.

IMPORTANT: Atlas does not decide whether to trade and does not publish execution levels. If the setup does not qualify, explain the bias, why it doesn't yet qualify, and what is missing — never encourage taking it anyway.`;

export async function generateTradeAnalysis(confluence) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const classification = riskClassification(confluence);

  const dataBlock = `Instrument: ${confluence.symbol}
Current price (context only, not an execution level): ${confluence.currentPrice}
Confidence score: ${confluence.totalScore}/${confluence.maxScore}
Engine decision — qualifies as today's opportunity: ${confluence.qualifies}
Rejected before scoring: ${confluence.rejected ? `yes — ${confluence.rejectionReason}` : "no"}
Classification (use exactly this label in Risk Assessment): ${classification}

Daily bias: ${confluence.daily.bias.toUpperCase()} — ${confluence.daily.reason}
4H bias: ${confluence.htf.bias.toUpperCase()} — ${confluence.htf.reason}
1H bias: ${confluence.mtf.bias.toUpperCase()} — ${confluence.mtf.reason}
Timeframes aligned: ${confluence.timeframesAligned}
Current session: ${confluence.session}

Point of interest:
${formatPoi(confluence)}

Liquidity target: ${confluence.liquidityTarget ? confluence.liquidityTarget.description : "None identified."}

Expected behaviour: ${confluence.expectedBehaviour || "Not applicable — setup does not qualify."}

Confluences that are TRUE (only these may be cited as reasons the setup qualifies):
${formatTrueConfluences(confluence.breakdown)}

Confluences that are FALSE / not present (only these may be cited as gaps or invalidation risks):
${formatFalseConfluences(confluence.breakdown)}

Invalidation conditions tracked by the engine:
${(confluence.invalidation || []).map((r) => `- ${r}`).join("\n") || "- Standard structure invalidation applies."}`;

  const prompt = `${SYSTEM_INSTRUCTIONS}\n\n---\n\nDATA:\n${dataBlock}\n\n---\n\nWrite the analysis now, replacing {score} in the heading with the actual score.`;

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

// Lightweight, non-AI fallback built directly from the breakdown, structured
// with the same headings as the full AI output so the UI doesn't need to
// render two different shapes. Used when GEMINI_API_KEY isn't configured or
// the AI call fails. Never includes an exact price level.
export function buildFallbackSummary(confluence) {
  const classification = riskClassification(confluence);
  const trueList = Object.entries(confluence.breakdown || {}).filter(([, f]) => f.points > 0);
  const falseList = Object.entries(confluence.breakdown || {}).filter(([, f]) => f.points === 0);

  const lines = [
    `## Overall Bias`,
    `Daily: ${confluence.daily.bias.toUpperCase()} — ${confluence.daily.reason} · 4H: ${confluence.htf.bias.toUpperCase()} — ${confluence.htf.reason} · 1H: ${confluence.mtf.bias.toUpperCase()} — ${confluence.mtf.reason}. Timeframes ${confluence.timeframesAligned ? "are aligned." : `are NOT aligned${confluence.rejectionReason ? ` — ${confluence.rejectionReason}` : ""}.`}`,
  ];

  if (confluence.rejected) {
    lines.push(
      `## Institutional Narrative`,
      `This pair was rejected before scoring because higher timeframe bias does not align. Atlas only considers setups where Daily, 4H, 1H and 30M all agree on direction.`
    );
  } else if (confluence.qualifies && confluence.poi) {
    lines.push(
      `## Institutional Narrative`,
      `${confluence.symbol} shows aligned Daily, 4H and 1H structure with a qualifying 30M point of interest. ${confluence.expectedBehaviour || ""}`,
      `## Point of Interest Quality`,
      confluence.poi.description,
      `## Liquidity Analysis`,
      confluence.liquidityTarget?.description || "No liquidity target identified.",
      `## Expected Behaviour`,
      confluence.expectedBehaviour || "Not applicable."
    );
  } else {
    lines.push(
      `## Institutional Narrative`,
      `No qualifying institutional point of interest currently exists for this pair at the required confidence threshold.`
    );
  }

  lines.push(
    `## Why This Scores ${confluence.totalScore}%`,
    trueList.length > 0 ? trueList.map(([, f]) => `- ${f.note}`).join("\n") : "No scored factors are currently true.",
    `## Risk Assessment`,
    `Classification: ${classification}. This is an engine-computed classification, not a guarantee of outcome.`,
    `## What Would Invalidate This Setup`,
    confluence.invalidation && confluence.invalidation.length > 0
      ? confluence.invalidation.map((r) => `- ${r}`).join("\n")
      : falseList.length > 0
      ? falseList.map(([, f]) => `- ${f.note}`).join("\n")
      : "Standard structure invalidation applies."
  );

  return lines.join("\n\n");
}

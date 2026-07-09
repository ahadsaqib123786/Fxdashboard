// Uses Google Gemini's free tier to turn the weighted confluence breakdown
// into an institutional-style analyst note. Get a free key at
// https://aistudio.google.com/app/apikey
//
// IMPORTANT LOGIC (mirrors the product spec this was written against):
// The AI does NOT decide whether to trade - lib/confluenceEngine.js already
// made that decision (confluence.qualifies). The AI's only job is to explain
// that decision in plain, professional language: why the setup does or
// doesn't qualify, using only the structured data the engine computed.
// It must never invent a reason, a level, or a confluence that isn't in the
// data handed to it, and it must never promise a trade will win.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

// Deterministic, code-computed classification - not left to the model to
// invent - so "Watchlist" vs "Wait" is consistent with the Market Pulse
// status logic in lib/marketStatus.js rather than a free-floating AI opinion.
export function riskClassification(confluence) {
  if (confluence.qualifies) return confluence.grade; // "A+" | "A" | "B"
  return confluence.totalScore >= 50 ? "Watchlist" : "Wait";
}

function formatTrueConfluences(breakdown) {
  // Only the factors that actually scored points count as "true" confluences
  // - the model is told explicitly not to mention anything scoring zero.
  const entries = Object.entries(breakdown).filter(([, f]) => f.points > 0);
  if (entries.length === 0) return "None of the scored factors are currently true.";
  return entries.map(([, f]) => `- ${f.note} (contributed ${f.points} points)`).join("\n");
}

function formatFalseConfluences(breakdown) {
  const entries = Object.entries(breakdown).filter(([, f]) => f.points === 0);
  if (entries.length === 0) return "None - every scored factor is currently true.";
  return entries.map(([, f]) => `- ${f.note} (0 points)`).join("\n");
}

function formatPoi(confluence) {
  const { tradePlan } = confluence;
  if (!tradePlan) return "No point of interest selected - this pair has no qualifying trade plan.";
  const { poi, entryZone, direction } = tradePlan;
  return `Selected POI type: ${poi.kind}
Zone: ${entryZone.bottom.toFixed(5)} to ${entryZone.top.toFixed(5)} (${direction === "buy" ? "demand" : "supply"} side)
Formed at: ${poi.time}
Unmitigated (untouched since it formed): true
Other unmitigated zones in the same direction that were passed over: ${poi.alternativesCount ?? poi.alternativesConsidered ?? 0}`;
}

function formatTradePlanLevels(plan) {
  if (!plan) return "No trade plan - this pair does not currently qualify for an entry.";
  return `Direction: ${plan.direction.toUpperCase()}
Entry (limit order zone): ${plan.entryZone.bottom.toFixed(5)} to ${plan.entryZone.top.toFixed(5)}
Stop loss: ${plan.stopLoss.toFixed(5)} (placed beyond the POI boundary plus a volatility buffer sized from recent 30min candle ranges - this is a range-based buffer, not a true ATR calculation)
Take profit 1: ${plan.takeProfit1.toFixed(5)} (2R)
Take profit 2: ${plan.takeProfit2.toFixed(5)} (3R)
Risk:Reward: ${plan.riskReward}`;
}

const SYSTEM_INSTRUCTIONS = `You are an institutional Smart Money Concepts (SMC) market analyst.

Your role is NOT to predict the market. Your role is to explain the setup that the confluence engine below has already scored and decided on. Never invent reasons, levels, or confluences beyond what is given to you in the data. If a condition is false or wasn't scored, do not mention it. Never exaggerate and never promise a trade will win.

Writing style: professional, concise, educational, no hype, no emojis, no generic AI filler phrases. Never say a trade is "guaranteed" or "perfect." Explain WHY a setup qualifies (or doesn't) according to the confluences actually provided.

This engine tracks three timeframes only: 4H (higher timeframe trend), 1H (mid-timeframe structure), and 30min (entry-timeframe confirmation and zones). It does NOT track a Daily timeframe - never refer to a Daily bias.

Output using exactly these Markdown headings, in this order. Omit content under a heading only if there is genuinely nothing true to say (e.g. no POI when the pair doesn't qualify) - keep the heading but say so plainly.

## Overall Bias
Explain whether the 4H and 1H timeframes are aligned, using the bias/reason text given. If they are not aligned, state plainly that this is a primary reason no trade should be taken yet.

## Why This Point of Interest Was Selected
Only if a trade plan exists. Explain why this specific zone (order block or fair value gap) was chosen over the other unmitigated zones that were passed over, using only the true confluences listed below (e.g. freshness/unmitigated status, structure confirmation, liquidity sweep, session timing) - never invent ones not listed.

## Entry Logic
Only if a trade plan exists. Explain why the entry is placed at this zone and what reaction is expected there.

## Stop Loss Logic
Only if a trade plan exists. Explain the stop placement using only the reasoning given (beyond the zone boundary plus a volatility buffer, and/or structure invalidation) - do not claim it uses ATR, since it doesn't.

## Take Profit Logic
Only if a trade plan exists. Explain the 2R/3R targets and the stated risk:reward using only the levels given.

## Why This Trade Scores {score}%
List only the confluences marked true below and how they contributed. Never mention a confluence marked false/zero here.

## What Could Invalidate This Setup
Based only on the false/zero-scored confluences and the qualifying ones that could reverse (e.g. structure breaking against the bias, the zone becoming mitigated, a high-impact news event). Do not invent invalidation conditions the engine doesn't track.

## Risk Assessment
State the classification given to you exactly as given (A+, A, B, Watchlist, or Wait) and explain briefly why, in balanced terms. Never say the trade is guaranteed.

IMPORTANT: The AI does not decide whether to trade - the engine already decided (qualifies: true/false, classification given below). If it does not qualify, do not encourage taking it: explain the bias, why it doesn't yet qualify, what is missing, and what would improve it. Your only job is to explain the decision, not to sell the trade.`;

export async function generateTradeAnalysis(confluence) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const classification = riskClassification(confluence);

  const dataBlock = `Instrument: ${confluence.symbol}
Current price: ${confluence.currentPrice}
Confidence score: ${confluence.totalScore}/${confluence.maxScore}
Engine decision - qualifies for a trade: ${confluence.qualifies}
Classification (use exactly this label in Risk Assessment): ${classification}

4H bias: ${confluence.htf.bias.toUpperCase()} - ${confluence.htf.reason}
1H bias: ${confluence.mtf.bias.toUpperCase()} - ${confluence.mtf.reason}
Timeframes aligned: ${confluence.timeframesAgree}

Point of interest:
${formatPoi(confluence)}

Trade plan levels:
${formatTradePlanLevels(confluence.tradePlan)}

Confluences that are TRUE (only these may be cited as reasons the setup qualifies):
${formatTrueConfluences(confluence.breakdown)}

Confluences that are FALSE / not present (only these may be cited as gaps or invalidation risks):
${formatFalseConfluences(confluence.breakdown)}`;

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
// the AI call fails.
export function buildFallbackSummary(confluence) {
  const classification = riskClassification(confluence);
  const trueList = Object.entries(confluence.breakdown || {}).filter(([, f]) => f.points > 0);
  const falseList = Object.entries(confluence.breakdown || {}).filter(([, f]) => f.points === 0);

  const lines = [
    `## Overall Bias`,
    `4H: ${confluence.htf.bias.toUpperCase()} - ${confluence.htf.reason} · 1H: ${confluence.mtf.bias.toUpperCase()} - ${confluence.mtf.reason}. Timeframes ${confluence.timeframesAgree ? "are aligned." : "are NOT aligned - this alone is reason to wait."}`,
  ];

  if (confluence.qualifies && confluence.tradePlan) {
    const p = confluence.tradePlan;
    lines.push(
      `## Why This Point of Interest Was Selected`,
      `${p.poi.kind} at ${p.entryZone.bottom.toFixed(5)}-${p.entryZone.top.toFixed(5)}, unmitigated since it formed. ${p.poi.alternativesConsidered > 0 ? `${p.poi.alternativesConsidered} other unmitigated zone(s) were passed over in favour of proximity to current price.` : "No other unmitigated zones were available in this direction."}`,
      `## Entry Logic`,
      `Limit entry within the zone at ${p.entryZone.bottom.toFixed(5)}-${p.entryZone.top.toFixed(5)}, where price is expected to react on the first return.`,
      `## Stop Loss Logic`,
      `Stop at ${p.stopLoss.toFixed(5)}, beyond the zone boundary plus a volatility buffer sized from recent 30min ranges.`,
      `## Take Profit Logic`,
      `Targets at ${p.takeProfit1.toFixed(5)} (2R) and ${p.takeProfit2.toFixed(5)} (3R), risk:reward ${p.riskReward}.`
    );
  } else {
    lines.push(
      `## Why This Point of Interest Was Selected`,
      `No qualifying point of interest - this pair does not currently have a trade plan.`
    );
  }

  lines.push(
    `## Why This Trade Scores ${confluence.totalScore}%`,
    trueList.length > 0 ? trueList.map(([, f]) => `- ${f.note}`).join("\n") : "No scored factors are currently true.",
    `## What Could Invalidate This Setup`,
    falseList.length > 0 ? falseList.map(([, f]) => `- ${f.note}`).join("\n") : "All tracked factors are currently supportive; standard structure invalidation still applies.",
    `## Risk Assessment`,
    `Classification: ${classification}. This is an engine-computed classification, not a guarantee of outcome.`
  );

  return lines.join("\n\n");
}

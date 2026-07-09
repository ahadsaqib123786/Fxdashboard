// v2 structure-first bias engine.
// PRIMARY: market structure (BOS / CHOCH / swing sequence HH/HL vs LH/LL).
// SECONDARY: momentum and range expansion reinforce but never override.

import { detectSwingPoints, detectStructure } from "./smcOverlays";

function pctChange(candles) {
  if (candles.length < 2) return 0;
  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  return ((last - first) / first) * 100;
}

function avgRange(candles) {
  const ranges = candles.map((c) => c.high - c.low);
  return ranges.reduce((a, b) => a + b, 0) / ranges.length;
}

function recentRangeExpansion(candles, lookback = 5) {
  const recent = candles.slice(-lookback);
  const older = candles.slice(0, -lookback);
  if (older.length === 0) return 1;
  return avgRange(recent) / avgRange(older);
}

function swingSequenceBias(swings) {
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");
  if (highs.length < 2 || lows.length < 2) return { dir: 0, label: "insufficient confirmed swings" };
  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
  const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;
  if (hh && hl) return { dir: 1, label: "higher highs and higher lows" };
  if (lh && ll) return { dir: -1, label: "lower highs and lower lows" };
  if (hh && !hl) return { dir: 0, label: "higher high but lower low — expansion, no clean bias" };
  if (lh && !ll) return { dir: 0, label: "lower high but higher low — compression, no clean bias" };
  return { dir: 0, label: "mixed swing structure" };
}

function structureState(events) {
  const last = events[events.length - 1];
  if (!last) return { dir: 0, label: "no confirmed break of structure yet", lastType: null };
  const dir = last.direction === "bullish" ? 1 : -1;
  return { dir, label: `most recent ${last.type} is ${last.direction}`, lastType: last.type };
}

// Pure market-structure bias. No momentum, no expansion — only BOS/CHOCH
// and swing sequence (HH/HL vs LH/LL). Used by the confluence engine's
// top-down alignment gate where direction must be structure-confirmed.
export function deriveStructureBias(candles) {
  if (!candles || candles.length < 10) {
    return { bias: "neutral", reason: "Insufficient data", lastBreak: null };
  }

  const swings = detectSwingPoints(candles);
  const events = detectStructure(candles);

  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  let swingDir = 0;
  let swingLabel = "insufficient confirmed swings";
  if (highs.length >= 2 && lows.length < 2) {
    swingLabel = "insufficient confirmed swing lows";
  } else if (highs.length < 2 && lows.length >= 2) {
    swingLabel = "insufficient confirmed swing highs";
  } else if (highs.length >= 2 && lows.length >= 2) {
    const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
    const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
    const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
    const ll = lows[lows.length - 1].price < lows[lows.length - 2].price;
    if (hh && hl) { swingDir = 1; swingLabel = "higher highs and higher lows"; }
    else if (lh && ll) { swingDir = -1; swingLabel = "lower highs and lower lows"; }
    else if (hh && !hl) { swingLabel = "higher high but lower low — no clean swing bias"; }
    else if (lh && !ll) { swingLabel = "lower high but higher low — no clean swing bias"; }
    else { swingLabel = "mixed swing structure"; }
  }

  const last = events[events.length - 1];
  let structDir = 0;
  let structLabel = "no confirmed break of structure yet";
  let lastBreak = null;
  if (last) {
    structDir = last.direction === "bullish" ? 1 : -1;
    structLabel = `most recent ${last.type} is ${last.direction}`;
    lastBreak = last.type;
  }

  const dir = structDir !== 0 ? structDir : swingDir;
  const bias = dir > 0 ? "buy" : dir < 0 ? "sell" : "neutral";
  const reason = structDir !== 0 ? structLabel : swingLabel;

  return { bias, reason, lastBreak };
}

export function scorePair(symbol, candles) {
  if (!candles || candles.error) {
    return {
      symbol,
      score: 0,
      bias: "neutral",
      reason: candles?.error ? `Data unavailable: ${candles.error}` : "Insufficient data",
      dataOk: false,
    };
  }
  if (candles.length < 10) {
    return { symbol, score: 0, bias: "neutral", reason: "Insufficient data (too few candles returned)", dataOk: false };
  }

  const swings = detectSwingPoints(candles);
  const events = detectStructure(candles);
  const struct = structureState(events);
  const seq = swingSequenceBias(swings);

  // PRIMARY: structural direction
  let structuralDir = struct.dir !== 0 ? struct.dir : seq.dir;

  // SECONDARY: momentum + expansion only nudge when they agree
  const momentum = pctChange(candles);
  const expansion = recentRangeExpansion(candles);
  const momentumDir = momentum > 0 ? 1 : momentum < 0 ? -1 : 0;

  let score = structuralDir * 40;
  if (seq.dir === structuralDir && structuralDir !== 0) score += structuralDir * 15;
  if (momentumDir === structuralDir && structuralDir !== 0) score += structuralDir * Math.min(Math.abs(momentum) * 4, 15);
  if (expansion > 1.2 && structuralDir !== 0) score += structuralDir * 5;

  const bias = structuralDir > 0 ? "buy" : structuralDir < 0 ? "sell" : "neutral";

  const reasonParts = [];
  reasonParts.push(struct.lastType ? `Structure: ${struct.label}` : "Structure: no confirmed break yet");
  reasonParts.push(`Swing read: ${seq.label}`);
  if (expansion > 1.2) reasonParts.push("range expansion adds secondary confidence");
  reasonParts.push(momentum >= 0 ? `momentum +${momentum.toFixed(2)}% (secondary)` : `momentum ${momentum.toFixed(2)}% (secondary)`);

  return {
    symbol,
    score,
    bias,
    reason: reasonParts.join(", ") + ".",
    dataOk: true,
    structure: { lastBreak: struct.lastType, sequence: seq.label },
  };
}

export function rankPairs(candlesBySymbol) {
  const scored = Object.entries(candlesBySymbol).map(([symbol, candles]) => scorePair(symbol, candles));
  scored.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return { strongest: scored[0], ranked: scored };
}

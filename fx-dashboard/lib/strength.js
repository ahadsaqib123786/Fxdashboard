// v1 rule based bias engine.
// This is a starting point, not a full ICT/SMC engine. It measures:
//   - momentum: net directional move over the lookback window
//   - range expansion: recent range vs average range (volatility/interest)
//   - structure: whether price is making higher highs/lows or lower highs/lows
// Combined into a single strength score per pair. Refine the weighting
// and add real order block / FVG detection once this loop is working end to end.

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

function structureBias(candles) {
  // Compare the last swing high/low to the prior swing high/low
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const mid = Math.floor(candles.length / 2);

  const recentHigh = Math.max(...highs.slice(mid));
  const priorHigh = Math.max(...highs.slice(0, mid));
  const recentLow = Math.min(...lows.slice(mid));
  const priorLow = Math.min(...lows.slice(0, mid));

  const higherHigh = recentHigh > priorHigh;
  const higherLow = recentLow > priorLow;

  if (higherHigh && higherLow) return 1; // bullish structure
  if (!higherHigh && !higherLow) return -1; // bearish structure
  return 0; // mixed / consolidating
}

// Returns { score, bias, reason } for a single pair given its candles
export function scorePair(symbol, candles) {
  if (!candles || candles.error) {
    return {
      symbol,
      score: 0,
      bias: "neutral",
      reason: candles?.error
        ? `Data unavailable: ${candles.error}`
        : "Insufficient data",
    };
  }
  if (candles.length < 10) {
    return { symbol, score: 0, bias: "neutral", reason: "Insufficient data (too few candles returned)" };
  }

  const momentum = pctChange(candles);
  const expansion = recentRangeExpansion(candles);
  const structure = structureBias(candles);

  // Weighted composite score
  const score =
    momentum * 10 + // momentum dominates
    (expansion - 1) * 20 + // reward volatility expansion
    structure * 15; // reward clean directional structure

  const bias = score > 5 ? "buy" : score < -5 ? "sell" : "neutral";

  const reasonParts = [];
  reasonParts.push(
    momentum > 0
      ? `Price is up ${momentum.toFixed(2)}% over the lookback window`
      : `Price is down ${Math.abs(momentum).toFixed(2)}% over the lookback window`
  );
  if (expansion > 1.2) reasonParts.push("recent candles show range expansion, signalling fresh interest");
  if (structure === 1) reasonParts.push("structure shows higher highs and higher lows");
  if (structure === -1) reasonParts.push("structure shows lower highs and lower lows");
  if (structure === 0) reasonParts.push("structure is mixed, no clean directional bias yet");

  return { symbol, score, bias, reason: reasonParts.join(", ") + "." };
}

// Ranks multiple pairs and returns the strongest one plus the full ranked list
export function rankPairs(candlesBySymbol) {
  const scored = Object.entries(candlesBySymbol).map(([symbol, candles]) =>
    scorePair(symbol, candles)
  );
  scored.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return { strongest: scored[0], ranked: scored };
}

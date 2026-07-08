// Simplified, heuristic ICT/SMC zone detection. This is not a perfect
// replica of manual chart reading, but it follows the same core definitions:
//
// Fair Value Gap (FVG): a 3 candle imbalance where candle 1 and candle 3
// don't overlap, leaving a "gap" the market often returns to fill.
//
// Order Block: the last opposite-colour candle before a strong impulsive
// move that breaks recent structure, treated as the origin of that move.

const IMPULSE_MULTIPLIER = 1.5; // how much bigger than average range counts as "impulsive"

function candleRange(c) {
  return c.high - c.low;
}

function averageRange(candles) {
  return candles.reduce((sum, c) => sum + candleRange(c), 0) / candles.length;
}

function isBullish(c) {
  return c.close > c.open;
}

// Returns all fair value gaps found in the candle series
export function detectFVGs(candles) {
  const zones = [];
  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const third = candles[i];

    if (first.high < third.low) {
      zones.push({
        type: "bullish",
        top: third.low,
        bottom: first.high,
        index: i,
        time: candles[i - 1].time,
      });
    } else if (first.low > third.high) {
      zones.push({
        type: "bearish",
        top: first.low,
        bottom: third.high,
        index: i,
        time: candles[i - 1].time,
      });
    }
  }
  return zones;
}

// Returns candidate order blocks: the last opposite candle before an impulsive move
export function detectOrderBlocks(candles) {
  const avgRange = averageRange(candles);
  const zones = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    const isImpulsive = candleRange(curr) > avgRange * IMPULSE_MULTIPLIER;
    if (!isImpulsive) continue;

    // bullish order block: down candle followed by a strong up candle
    if (!isBullish(prev) && isBullish(curr)) {
      zones.push({
        type: "bullish",
        top: prev.high,
        bottom: prev.low,
        index: i - 1,
        time: prev.time,
      });
    }
    // bearish order block: up candle followed by a strong down candle
    if (isBullish(prev) && !isBullish(curr)) {
      zones.push({
        type: "bearish",
        top: prev.high,
        bottom: prev.low,
        index: i - 1,
        time: prev.time,
      });
    }
  }
  return zones;
}

// Marks whether price has traded back through a zone since it formed (mitigated)
export function markMitigation(zones, candles) {
  return zones.map((zone) => {
    const afterFormation = candles.slice(zone.index + 1);
    const mitigated = afterFormation.some(
      (c) => c.low <= zone.top && c.high >= zone.bottom
    );
    return { ...zone, mitigated };
  });
}

// Returns unmitigated zones sorted by proximity to current price
export function nearestUnmitigatedZones(zones, currentPrice, type, limit = 2) {
  return zones
    .filter((z) => !z.mitigated && z.type === type)
    .map((z) => ({ ...z, distance: Math.abs(currentPrice - (z.top + z.bottom) / 2) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

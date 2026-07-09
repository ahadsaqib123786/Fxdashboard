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

// Returns order blocks: the last opposite candle before a displacing move
// that is subsequently confirmed by a break of structure (BOS).
//
// Requirements (weak candidates are rejected):
// 1. Displacement — the impulse candle must be >1.5x average range AND its
//    body must be >50 % of its range (ruling out long-wick dojis).
// 2. BOS confirmation — a break of structure in the OB's direction must
//    occur after the OB forms before it is considered valid.
export function detectOrderBlocks(candles, structureEvents = []) {
  const avgRange = averageRange(candles);
  const candidates = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    // 1. Impulse size
    const isImpulsive = candleRange(curr) > avgRange * IMPULSE_MULTIPLIER;
    if (!isImpulsive) continue;

    // 2. Displacement — body must dominate the candle (not just wicks)
    const bodySize = Math.abs(curr.close - curr.open);
    const bodyRatio = bodySize / candleRange(curr);
    if (bodyRatio <= 0.5) continue;

    // bullish order block: down candle followed by a strong up candle
    if (!isBullish(prev) && isBullish(curr)) {
      candidates.push({
        type: "bullish",
        top: prev.high,
        bottom: prev.low,
        index: i - 1,
        time: prev.time,
      });
    }
    // bearish order block: up candle followed by a strong down candle
    if (isBullish(prev) && !isBullish(curr)) {
      candidates.push({
        type: "bearish",
        top: prev.high,
        bottom: prev.low,
        index: i - 1,
        time: prev.time,
      });
    }
  }

  // 3. BOS confirmation — reject any candidate without a subsequent BOS
  if (structureEvents.length === 0) return candidates;
  return candidates.filter((zone) => {
    const wantedDir = zone.type === "bullish" ? "bullish" : "bearish";
    return structureEvents.some((e) => e.index > zone.index && e.direction === wantedDir);
  });
}

// Classifies how price has interacted with a zone since it formed.
// Returns a mitigation status with four grades:
//   fresh               — price has never entered the zone
//   partially_mitigated  — price entered but did not trade through
//   fully_mitigated      — price closed beyond the zone's far edge
//   invalidated          — a BOS formed against the zone direction
//
// `structureEvents` (optional) enables the invalidation check; when omitted
// (e.g. for FVGs where invalidation is not tracked) the status is limited
// to fresh / partially_mitigated / fully_mitigated.
export function markMitigation(zones, candles, structureEvents = []) {
  return zones.map((zone) => {
    const afterFormation = candles.slice(zone.index + 1);

    // Has price entered the zone at all?
    const touched = afterFormation.some(
      (c) => c.low <= zone.top && c.high >= zone.bottom
    );

    // Has price traded completely through the zone?
    let tradedThrough = false;
    if (touched) {
      if (zone.type === "bullish") {
        // Bullish OB (demand) — mitigated when price closes below the zone
        tradedThrough = afterFormation.some((c) => c.close < zone.bottom);
      } else {
        // Bearish OB (supply) — mitigated when price closes above the zone
        tradedThrough = afterFormation.some((c) => c.close > zone.top);
      }
    }

    // Has a BOS formed against the zone direction? (invalidation)
    let invalidated = false;
    if (structureEvents.length > 0) {
      const againstDir = zone.type === "bullish" ? "bearish" : "bullish";
      invalidated = structureEvents.some(
        (e) => e.index > zone.index && e.direction === againstDir
      );
    }

    let mitigation;
    if (invalidated) {
      mitigation = "invalidated";
    } else if (!touched) {
      mitigation = "fresh";
    } else if (tradedThrough) {
      mitigation = "fully_mitigated";
    } else {
      mitigation = "partially_mitigated";
    }

    return { ...zone, mitigation, mitigated: mitigation !== "fresh" };
  });
}

// Returns fresh (unmitigated, non-invalidated) zones sorted by proximity
// to current price. Weak zones — partially mitigated, fully mitigated, or
// invalidated — are rejected.
export function nearestUnmitigatedZones(zones, currentPrice, type, limit = 2) {
  return zones
    .filter((z) => z.mitigation === "fresh" && z.type === type)
    .map((z) => ({ ...z, distance: Math.abs(currentPrice - (z.top + z.bottom) / 2) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

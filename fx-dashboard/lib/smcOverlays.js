// Detection logic for chart overlays. Builds on top of the FVG/order block
// detection already in lib/smc.js and adds structure, liquidity, and
// session/range concepts used by the TradingView chart overlay system.

import { detectFVGs, detectOrderBlocks, markMitigation } from "./smc";

const SWING_LOOKBACK = 2;

// Fractal-based swing point detection: a candle is a swing high/low if it's
// the extreme point relative to `lookback` candles on each side.
export function detectSwingPoints(candles, lookback = SWING_LOOKBACK) {
  const swings = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const isHigh = candles[i].high === Math.max(...window.map((c) => c.high));
    const isLow = candles[i].low === Math.min(...window.map((c) => c.low));
    if (isHigh) swings.push({ index: i, price: candles[i].high, type: "high", time: candles[i].time });
    if (isLow) swings.push({ index: i, price: candles[i].low, type: "low", time: candles[i].time });
  }
  return swings;
}

// Walks through candles tracking trend, flags BOS (continuation break) and
// CHOCH (first break against the prevailing trend, signalling a possible flip)
export function detectStructure(candles) {
  const swings = detectSwingPoints(candles);
  const events = [];
  let trend = null;
  let lastSwingHigh = null;
  let lastSwingLow = null;

  for (let i = 0; i < candles.length; i++) {
    if (lastSwingHigh && candles[i].close > lastSwingHigh.price) {
      const isChoch = trend === "bearish";
      events.push({
        index: i,
        time: candles[i].time,
        type: isChoch ? "CHOCH" : "BOS",
        direction: "bullish",
        price: lastSwingHigh.price,
      });
      trend = "bullish";
      lastSwingHigh = null;
    }
    if (lastSwingLow && candles[i].close < lastSwingLow.price) {
      const isChoch = trend === "bullish";
      events.push({
        index: i,
        time: candles[i].time,
        type: isChoch ? "CHOCH" : "BOS",
        direction: "bearish",
        price: lastSwingLow.price,
      });
      trend = "bearish";
      lastSwingLow = null;
    }
    const swingHere = swings.find((s) => s.index === i);
    if (swingHere) {
      if (swingHere.type === "high") lastSwingHigh = swingHere;
      else lastSwingLow = swingHere;
    }
  }
  return events;
}

// Clusters swing highs/lows that sit within tolerance% of each other,
// treated as equal highs / equal lows, i.e. resting liquidity.
export function detectLiquidityLevels(candles, tolerancePct = 0.05) {
  const swings = detectSwingPoints(candles);

  function cluster(type) {
    const points = swings.filter((s) => s.type === type);
    const clusters = [];
    for (const p of points) {
      const match = clusters.find((c) => (Math.abs(c.price - p.price) / p.price) * 100 < tolerancePct);
      if (match) {
        match.points.push(p);
        match.price = match.points.reduce((s, pt) => s + pt.price, 0) / match.points.length;
      } else {
        clusters.push({ price: p.price, points: [p] });
      }
    }
    return clusters
      .filter((c) => c.points.length >= 2)
      .map((c) => ({
        type,
        price: c.price,
        touches: c.points.length,
        lastIndex: Math.max(...c.points.map((p) => p.index)),
      }));
  }

  return { equalHighs: cluster("high"), equalLows: cluster("low") };
}

// A liquidity sweep: price wicks beyond a resting liquidity level then closes
// back inside it, the classic "stop hunt then reverse" pattern.
export function detectLiquiditySweeps(candles, liquidityLevels) {
  const sweeps = [];
  const allLevels = [...liquidityLevels.equalHighs, ...liquidityLevels.equalLows];

  for (const level of allLevels) {
    for (let i = level.lastIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      if (level.type === "high" && c.high > level.price && c.close < level.price) {
        sweeps.push({ index: i, time: c.time, type: "bearish", price: level.price });
        break;
      }
      if (level.type === "low" && c.low < level.price && c.close > level.price) {
        sweeps.push({ index: i, time: c.time, type: "bullish", price: level.price });
        break;
      }
    }
  }
  return sweeps;
}

// Premium / discount / equilibrium of the current dealing range (recent swing range)
export function premiumDiscountZones(candles, lookback = 50) {
  const recent = candles.slice(-lookback);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  return { high, low, equilibrium: (high + low) / 2 };
}

// Groups candles by UTC calendar date, needed for previous day and session ranges
function groupByDate(candles) {
  const byDate = {};
  for (const c of candles) {
    const date = c.time.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(c);
  }
  return byDate;
}

export function previousDayHighLow(candles) {
  const byDate = groupByDate(candles);
  const dates = Object.keys(byDate).sort();
  if (dates.length < 2) return null;
  const prev = byDate[dates[dates.length - 2]];
  return {
    high: Math.max(...prev.map((c) => c.high)),
    low: Math.min(...prev.map((c) => c.low)),
    date: dates[dates.length - 2],
  };
}

const SESSION_HOURS_UTC = {
  Asian: [0, 9],
  London: [7, 16],
  "New York": [12, 21],
};

// Range of the most recent occurrence of a session in the loaded candles.
// Requires intraday candles (with time-of-day); daily candles won't work here.
export function latestSessionRange(candles, sessionName) {
  const [start, end] = SESSION_HOURS_UTC[sessionName];
  const byDate = groupByDate(candles);
  const dates = Object.keys(byDate).sort().reverse();

  for (const date of dates) {
    const dayCandles = byDate[date].filter((c) => {
      const hour = new Date(c.time.replace(" ", "T") + "Z").getUTCHours();
      return start < end ? hour >= start && hour < end : hour >= start || hour < end;
    });
    if (dayCandles.length > 0) {
      return {
        high: Math.max(...dayCandles.map((c) => c.high)),
        low: Math.min(...dayCandles.map((c) => c.low)),
        date,
      };
    }
  }
  return null;
}

// Builds the full overlay dataset for a candle series in one pass
export function buildOverlays(candles) {
  const structure = detectStructure(candles);
  const liquidity = detectLiquidityLevels(candles);
  const sweeps = detectLiquiditySweeps(candles, liquidity);
  const fvgs = markMitigation(detectFVGs(candles), candles);
  const orderBlocks = markMitigation(detectOrderBlocks(candles), candles);
  const premiumDiscount = premiumDiscountZones(candles);
  const previousDay = previousDayHighLow(candles);
  const sessions = {
    Asian: latestSessionRange(candles, "Asian"),
    London: latestSessionRange(candles, "London"),
    "New York": latestSessionRange(candles, "New York"),
  };

  return { structure, liquidity, sweeps, fvgs, orderBlocks, premiumDiscount, previousDay, sessions };
}

// The institutional confluence engine. This does NOT produce a trade plan
// (entry price / stop loss / take profit) — Atlas is not a signal provider.
// It performs top-down Daily -> 4H -> 1H -> 30M analysis, rejects any setup
// where bias does not align at every step, locates the strongest nested
// institutional Point of Interest, and scores what's left against
// CONFLUENCE_WEIGHTS (lib/config.js) into a single 0-100 confidence score.
// Execution — exact price, sizing, timing — is left entirely to the trader.

import { getCandles } from "./twelvedata";
import { scorePair, deriveStructureBias } from "./strength";
import { detectFVGs, detectOrderBlocks, markMitigation, nearestUnmitigatedZones } from "./smc";
import { detectStructure, detectLiquidityLevels, detectLiquiditySweeps, premiumDiscountZones } from "./smcOverlays";
import { getWeeklyNews } from "./news";
import {
  CONFLUENCE_WEIGHTS,
  TOTAL_WEIGHT,
  GRADE,
  gradeForScore,
  meetsMinimumGrade,
  NEWS_VETO_WINDOW_MS,
  ACTIVE_SESSION_HOURS_UTC,
  WATCHLIST,
} from "./config";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function directionFromBias(bias) {
  if (bias === "buy") return "buy";
  if (bias === "sell") return "sell";
  return null;
}

// --- Top-down alignment gate ------------------------------------------------
// Atlas's strategy is Daily -> 4H -> 1H -> 30M. Any disagreement between
// adjacent steps in that chain is an outright rejection, not a lower score —
// a setup fighting a higher timeframe is not an institutional setup.

function lastStructureDirection(structureEvents) {
  const last = structureEvents[structureEvents.length - 1];
  if (!last) return null;
  return last.direction === "bullish" ? "buy" : "sell";
}

function checkTopDownAlignment(dailyBias, htfBias, mtfBias) {
  if (dailyBias !== htfBias) {
    return { aligned: false, reason: `Daily bias (${dailyBias.toUpperCase()}) disagrees with 4H bias (${htfBias.toUpperCase()}) — rejected before scoring.` };
  }
  if (htfBias !== mtfBias) {
    return { aligned: false, reason: `4H bias (${htfBias.toUpperCase()}) disagrees with 1H bias (${mtfBias.toUpperCase()}) — rejected before scoring.` };
  }
  return { aligned: true, reason: null };
}

// --- Individual factor scorers ---------------------------------------------
// Each returns { points, max, note } so the UI can render a breakdown bar.

function scoreBiasStrength(scoreObj, weight, label) {
  if (!scoreObj || scoreObj.bias === "neutral") {
    return { points: 0, max: weight, note: `${label} bias is flat — no directional edge.` };
  }
  const strength = Math.min(Math.abs(scoreObj.score) / 40, 1);
  return {
    points: Math.round(strength * weight),
    max: weight,
    note: `${label} bias is ${scoreObj.bias.toUpperCase()} — ${scoreObj.reason}`,
  };
}

function scoreStructureAlignment(structureEvents, direction, weight, label) {
  const wantedDirection = direction === "buy" ? "bullish" : "bearish";
  const last = structureEvents[structureEvents.length - 1];

  if (!last) return { points: 0, max: weight, note: `No ${label} structure break detected yet.` };

  if (last.direction === wantedDirection) {
    const points = last.type === "BOS" ? weight : Math.round(weight * 0.7);
    return {
      points,
      max: weight,
      note: `${label} ${last.type} confirms ${wantedDirection} direction.`,
    };
  }

  return {
    points: 0,
    max: weight,
    note: `Last ${label} structure break (${last.type}) is against the ${direction.toUpperCase()} idea.`,
  };
}

function zonesOverlap(a, b) {
  if (!a || !b) return false;
  return a.top >= b.bottom && b.top >= a.bottom;
}

// Checks whether the selected 30M POI sits nested inside a 1H POI, which in
// turn sits nested inside a 4H supply/demand zone — Atlas's preferred setup.
// Full weight for a complete three-level nest, partial credit for a single
// level of nesting, zero if the 30M zone stands alone.
function scoreNestedPOI(ltfZone, mtfZones, htfZones, weight) {
  if (!ltfZone) return { points: 0, max: weight, note: "No 30M point of interest selected to check for nesting." };

  const nestedIn1H = mtfZones.find((z) => zonesOverlap(ltfZone, z));
  const nestedIn4H = nestedIn1H ? htfZones.find((z) => zonesOverlap(nestedIn1H, z)) : null;

  if (nestedIn1H && nestedIn4H) {
    return {
      points: weight,
      max: weight,
      note: "30M point of interest is nested inside a 1H point of interest, itself nested inside 4H supply/demand — the preferred institutional structure.",
    };
  }
  if (nestedIn1H) {
    return {
      points: Math.round(weight * 0.5),
      max: weight,
      note: "30M point of interest is nested inside a 1H point of interest, but not confirmed within a 4H supply/demand zone.",
    };
  }
  return { points: 0, max: weight, note: "30M point of interest stands alone — no higher timeframe nesting found." };
}

// Freshness: how recently the zone formed relative to the loaded 30M window.
// Untouched is already guaranteed (only unmitigated zones are ever selected).
function scoreFreshUntouchedPOI(zone, ltfCandles, weight) {
  if (!zone) return { points: 0, max: weight, note: "No point of interest currently qualifies." };
  const barsAgo = ltfCandles.length - 1 - zone.index;
  const isFresh = barsAgo <= 20; // formed within roughly the last 10 hours of 30M bars
  if (isFresh) {
    return { points: weight, max: weight, note: "Point of interest is fresh and has never been mitigated." };
  }
  return {
    points: Math.round(weight * 0.5),
    max: weight,
    note: "Point of interest is unmitigated but has been resting for a while — treated as lower quality than a fresh zone.",
  };
}

function scoreZonePresence(zones, weight, label) {
  if (zones.length === 0) {
    return { points: 0, max: weight, note: `No unmitigated ${label} in the trade direction.` };
  }
  return {
    points: weight,
    max: weight,
    note: `${zones.length} unmitigated ${label}${zones.length > 1 ? "s" : ""} available in the trade direction.`,
  };
}

function scoreLiquiditySweep(sweeps, direction, weight) {
  const wantedType = direction === "buy" ? "bullish" : "bearish";
  const recentSweep = sweeps.slice(-3).find((s) => s.type === wantedType);
  if (!recentSweep) {
    return { points: 0, max: weight, note: "No recent liquidity sweep supporting entry timing." };
  }
  return { points: weight, max: weight, note: "A resting liquidity level was recently swept before price reversed — classic stop-hunt-then-reverse timing." };
}

function scorePremiumDiscount(premiumDiscount, currentPrice, direction, weight) {
  const { equilibrium } = premiumDiscount;
  const inDiscount = currentPrice < equilibrium;
  const wanted = direction === "buy" ? inDiscount : !inDiscount;
  if (wanted) {
    return {
      points: weight,
      max: weight,
      note: `Price is trading at a ${direction === "buy" ? "discount" : "premium"} relative to the current dealing range.`,
    };
  }
  return {
    points: 0,
    max: weight,
    note: `Price is on the wrong side of equilibrium for a ${direction.toUpperCase()} idea — buying premium / selling discount is lower probability.`,
  };
}

function scoreSessionTiming(weight) {
  const hour = new Date().getUTCHours();
  const inSession = hour >= ACTIVE_SESSION_HOURS_UTC.start && hour < ACTIVE_SESSION_HOURS_UTC.end;
  return {
    points: inSession ? weight : 0,
    max: weight,
    note: inSession ? "Inside London/New York session — normal institutional liquidity." : "Outside London/New York hours — thin liquidity, moves are less reliable.",
  };
}

function scoreMacroConditions(newsEvents, symbol, weight) {
  if (!newsEvents || newsEvents.length === 0) {
    return { points: weight, max: weight, note: "No economic calendar data available; treated as clear." };
  }
  const currencies = symbol.split("/");
  const now = Date.now();
  const imminent = newsEvents.find((e) => {
    if (e.impact !== "High") return false;
    if (!currencies.includes(e.country)) return false;
    const eventTime = new Date(e.date).getTime();
    return Math.abs(eventTime - now) <= NEWS_VETO_WINDOW_MS;
  });

  if (imminent) {
    return {
      points: 0,
      max: weight,
      note: `A high-impact ${imminent.country} event is due within the hour — spread and whipsaw risk is elevated.`,
    };
  }
  return { points: weight, max: weight, note: "No high-impact news for either currency in the next hour." };
}

// --- Reachability -----------------------------------------------------------
// Rejects setups whose point of interest is unlikely to be reached before
// today's active institutional sessions close. This is a heuristic built
// from the 30M average candle range and the hours remaining in today's
// session — not a price prediction.

function estimateReachableToday(zone, currentPrice, ltfCandles) {
  if (!zone) return { reachable: false, reason: "No point of interest selected." };

  const avgRange = ltfCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / ltfCandles.length;
  const zoneMid = (zone.top + zone.bottom) / 2;
  const distance = Math.abs(currentPrice - zoneMid);

  const now = new Date();
  const hourNow = now.getUTCHours() + now.getUTCMinutes() / 60;
  const sessionEnd = 21; // New York close, UTC
  const remainingHours = Math.max(sessionEnd - hourNow, 0);

  if (remainingHours <= 0) {
    return { reachable: false, reason: "Today's active trading sessions have already closed." };
  }

  const remainingBars = remainingHours * 2; // 30-minute bars remaining today
  const maxTravel = Math.max(avgRange * remainingBars * 0.6, avgRange * 3);

  const reachable = distance <= maxTravel;
  return {
    reachable,
    reason: reachable
      ? null
      : "The point of interest sits beyond a realistic move for the hours remaining in today's session.",
  };
}

// --- Descriptive opportunity output -----------------------------------------
// Deliberately contains no exact entry price, stop loss, take profit, or
// risk:reward figure — only what kind of zone it is, where it sits relative
// to structure, and what behaviour is expected. Execution is the trader's.

function describePOI({ zone, poiKind, nested }) {
  if (!zone) return null;
  const nestedText = nested ? "nested within higher timeframe order flow" : "trading in isolation, without higher timeframe nesting";
  return {
    kind: poiKind,
    timeframe: "30M",
    nested,
    description: `A ${poiKind.toLowerCase()} on the 30-minute chart, ${nestedText}.`,
  };
}

function describeLiquidityTarget(direction, liquidity) {
  const relevant = direction === "buy" ? liquidity.equalHighs : liquidity.equalLows;
  if (!relevant || relevant.length === 0) {
    return {
      side: direction === "buy" ? "buy-side" : "sell-side",
      description: `No clearly clustered resting ${direction === "buy" ? "buy-side" : "sell-side"} liquidity identified yet — continuation would be seeking the next untested swing point.`,
    };
  }
  const strongest = [...relevant].sort((a, b) => b.touches - a.touches)[0];
  return {
    side: direction === "buy" ? "buy-side" : "sell-side",
    description: `${direction === "buy" ? "Buy-side" : "Sell-side"} liquidity resting above/below a cluster of ${strongest.touches} equal ${direction === "buy" ? "highs" : "lows"}, untouched since it formed.`,
  };
}

function buildExpectedBehaviour({ direction, poi, liquidityTarget }) {
  if (!poi) return null;
  const towards = direction === "buy" ? "upside" : "downside";
  return `Price is expected to retrace into the identified 30-minute point of interest before seeking continuation to the ${towards}, targeting ${liquidityTarget.description.charAt(0).toLowerCase()}${liquidityTarget.description.slice(1)}`;
}

function buildInvalidation({ direction, breakdown }) {
  const reasons = [
    `A break of structure against the ${direction.toUpperCase()} bias on the 4H or 1H chart.`,
    "The point of interest being mitigated (traded through) before price reacts from it.",
    "A high-impact macro or news event that reverses the prevailing directional bias.",
  ];
  if (breakdown.liquiditySweep.points === 0) {
    reasons.push("Liquidity that was expected to be swept remains untouched, weakening entry timing.");
  }
  if (breakdown.premiumDiscount.points === 0) {
    reasons.push("Price remains on the wrong side of equilibrium, which already lowers the odds of this idea.");
  }
  return reasons;
}

// --- Main per-symbol builder -------------------------------------------------

export async function buildConfluence(symbol, options = {}) {
  const { newsEvents = null } = options;

  const daily = await sleepThenFetch(symbol, "1day", 60);
  const htf = await sleepThenFetch(symbol, "4h", 60);
  const mtf = await sleepThenFetch(symbol, "1h", 60);
  const ltf = await sleepThenFetch(symbol, "30min", 80);

  const dailyScore = scorePair(symbol, daily);
  const htfScore = scorePair(symbol, htf);
  const mtfScore = scorePair(symbol, mtf);

  const currentPrice = ltf[ltf.length - 1]?.close;

  // Pure market-structure biases — BOS/CHOCH + HH/HL/LH/LL, no momentum
  const dailyStructBias = deriveStructureBias(daily);
  const htfStructBias = deriveStructureBias(htf);
  const mtfStructBias = deriveStructureBias(mtf);

  const dailyDirection = directionFromBias(dailyStructBias.bias);

  if (!dailyDirection) {
    return finalizeNoBias(symbol, currentPrice, dailyStructBias, "No Daily directional bias — nothing to align 4H, 1H or 30M against.");
  }

  const htfStructure = detectStructure(htf);
  const mtfStructure = detectStructure(mtf);
  const ltfStructure = detectStructure(ltf);

  const alignment = checkTopDownAlignment(dailyStructBias.bias, htfStructBias.bias, mtfStructBias.bias);
  if (!alignment.aligned) {
    return finalizeRejected(symbol, currentPrice, dailyStructBias, htfStructBias, mtfStructBias, alignment.reason);
  }

  const direction = dailyDirection;
  const wantedType = direction === "buy" ? "bullish" : "bearish";

  const htfFvgs = markMitigation(detectFVGs(htf), htf);
  const htfObs = markMitigation(detectOrderBlocks(htf, htfStructure), htf, htfStructure);
  const mtfFvgs = markMitigation(detectFVGs(mtf), mtf);
  const mtfObs = markMitigation(detectOrderBlocks(mtf, mtfStructure), mtf, mtfStructure);
  const ltfFvgs = markMitigation(detectFVGs(ltf), ltf);
  const ltfObs = markMitigation(detectOrderBlocks(ltf, ltfStructure), ltf, ltfStructure);

  const liquidity = detectLiquidityLevels(ltf);
  const sweeps = detectLiquiditySweeps(ltf, liquidity);
  const premiumDiscount = premiumDiscountZones(ltf);

  const htfZones = [...nearestUnmitigatedZones(htfObs, currentPrice, wantedType, 5), ...nearestUnmitigatedZones(htfFvgs, currentPrice, wantedType, 5)];
  const mtfZones = [...nearestUnmitigatedZones(mtfObs, currentPrice, wantedType, 5), ...nearestUnmitigatedZones(mtfFvgs, currentPrice, wantedType, 5)];
  const relevantLtfObs = nearestUnmitigatedZones(ltfObs, currentPrice, wantedType);
  const relevantLtfFvgs = nearestUnmitigatedZones(ltfFvgs, currentPrice, wantedType);

  // Preferred POI is a 30M order block; fall back to a fair value gap.
  const bestZone = relevantLtfObs[0] || relevantLtfFvgs[0] || null;
  const poiKind = relevantLtfObs[0] ? "Order Block" : relevantLtfFvgs[0] ? "Fair Value Gap" : null;

  const reachability = estimateReachableToday(bestZone, currentPrice, ltf);

  const nestedIn1H = bestZone ? mtfZones.find((z) => zonesOverlap(bestZone, z)) : null;
  const nested = Boolean(nestedIn1H);

  const breakdown = {
    dailyBias: scoreBiasStrength(dailyScore, CONFLUENCE_WEIGHTS.dailyBias, "Daily"),
    htfBias: scoreBiasStrength(htfScore, CONFLUENCE_WEIGHTS.htfBias, "4H"),
    htfStructure: scoreStructureAlignment(htfStructure, direction, CONFLUENCE_WEIGHTS.htfStructure, "4H"),
    mtfBias: scoreBiasStrength(mtfScore, CONFLUENCE_WEIGHTS.mtfBias, "1H"),
    mtfStructure: scoreStructureAlignment(mtfStructure, direction, CONFLUENCE_WEIGHTS.mtfStructure, "1H"),
    ltfConfirmation: scoreStructureAlignment(ltfStructure, direction, CONFLUENCE_WEIGHTS.ltfConfirmation, "30M"),
    nestedPOI: scoreNestedPOI(bestZone, mtfZones, htfZones, CONFLUENCE_WEIGHTS.nestedPOI),
    freshUntouchedPOI: scoreFreshUntouchedPOI(bestZone, ltf, CONFLUENCE_WEIGHTS.freshUntouchedPOI),
    liquiditySweep: scoreLiquiditySweep(sweeps, direction, CONFLUENCE_WEIGHTS.liquiditySweep),
    fairValueGap: scoreZonePresence(relevantLtfFvgs, CONFLUENCE_WEIGHTS.fairValueGap, "fair value gap"),
    premiumDiscount: scorePremiumDiscount(premiumDiscount, currentPrice, direction, CONFLUENCE_WEIGHTS.premiumDiscount),
    sessionTiming: scoreSessionTiming(CONFLUENCE_WEIGHTS.sessionTiming),
    macroConditions: scoreMacroConditions(newsEvents, symbol, CONFLUENCE_WEIGHTS.macroConditions),
  };

  let totalScore = Object.values(breakdown).reduce((sum, f) => sum + f.points, 0);
  let grade = gradeForScore(totalScore);
  let qualifies = meetsMinimumGrade(grade) && Boolean(bestZone);

  // Reachability is a hard veto, not a score reduction — an A-grade setup
  // that can't realistically be reached today is not today's opportunity.
  if (!reachability.reachable) {
    qualifies = false;
    grade = GRADE.WAIT;
  }

  const poi = describePOI({ zone: bestZone, poiKind, nested });
  const liquidityTarget = describeLiquidityTarget(direction, liquidity);
  const expectedBehaviour = buildExpectedBehaviour({ direction, poi, liquidityTarget });
  const invalidation = buildInvalidation({ direction, breakdown });

  return {
    symbol,
    currentPrice,
    direction,
    totalScore,
    maxScore: TOTAL_WEIGHT,
    grade,
    qualifies,
    rejected: false,
    rejectionReason: !reachability.reachable ? reachability.reason : null,
    breakdown,
    poi,
    liquidityTarget,
    expectedBehaviour,
    invalidation,
    reachability,
    daily: { timeframe: "Daily", bias: dailyStructBias.bias, reason: dailyStructBias.reason },
    htf: { timeframe: "4H", bias: htfStructBias.bias, reason: htfStructBias.reason },
    mtf: { timeframe: "1H", bias: mtfStructBias.bias, reason: mtfStructBias.reason },
    ltf: {
      timeframe: "30M",
      fairValueGaps: relevantLtfFvgs.map(stripPrices),
      orderBlocks: relevantLtfObs.map(stripPrices),
    },
    session: currentSessionLabel(),
    timeframesAligned: true,
  };
}

// Zones are used internally for nesting/overlap math (which needs real
// prices), but Atlas never displays exact zone boundaries to the user — only
// their kind, freshness and structural context. This strips prices from
// anything handed back to the API/UI layer.
function stripPrices({ type, time, mitigation, mitigated }) {
  return { type, time, mitigation, mitigated };
}

function currentSessionLabel() {
  const hour = new Date().getUTCHours();
  if (hour >= 7 && hour < 16) return "London";
  if (hour >= 12 && hour < 21) return "New York";
  if (hour >= 0 && hour < 9) return "Asian";
  return "Between sessions";
}

function finalizeNoBias(symbol, currentPrice, dailyStructBias, reason) {
  const breakdown = Object.fromEntries(
    Object.entries(CONFLUENCE_WEIGHTS).map(([key, max]) => [key, { points: 0, max, note: "Not scored — no Daily directional bias to align against." }])
  );
  return {
    symbol,
    currentPrice,
    direction: null,
    totalScore: 0,
    maxScore: TOTAL_WEIGHT,
    grade: GRADE.WAIT,
    qualifies: false,
    rejected: true,
    rejectionReason: reason,
    breakdown,
    poi: null,
    liquidityTarget: null,
    expectedBehaviour: null,
    invalidation: [],
    daily: { timeframe: "Daily", bias: dailyStructBias.bias, reason: dailyStructBias.reason },
    htf: { timeframe: "4H", bias: "neutral", reason: "Not evaluated — no Daily bias to confirm." },
    mtf: { timeframe: "1H", bias: "neutral", reason: "Not evaluated — no Daily bias to confirm." },
    ltf: { timeframe: "30M", fairValueGaps: [], orderBlocks: [] },
    session: currentSessionLabel(),
    timeframesAligned: false,
  };
}

function finalizeRejected(symbol, currentPrice, dailyStructBias, htfStructBias, mtfStructBias, reason) {
  // Compute partial scores from the bias data we have, so the score is never
  // 0 just because alignment failed. This gives the UI something meaningful
  // to display and helps the user understand how close (or far) the pair is.
  const dailyDirection = directionFromBias(dailyStructBias.bias);

  const breakdown = {
    dailyBias: dailyStructBias.bias !== "neutral"
      ? { points: Math.round(CONFLUENCE_WEIGHTS.dailyBias * 0.8), max: CONFLUENCE_WEIGHTS.dailyBias, note: `Daily bias is ${dailyStructBias.bias.toUpperCase()} — ${dailyStructBias.reason}` }
      : { points: 0, max: CONFLUENCE_WEIGHTS.dailyBias, note: "Daily bias is flat — no directional edge." },
    htfBias: htfStructBias.bias !== "neutral"
      ? { points: Math.round(CONFLUENCE_WEIGHTS.htfBias * 0.8), max: CONFLUENCE_WEIGHTS.htfBias, note: `4H bias is ${htfStructBias.bias.toUpperCase()} — ${htfStructBias.reason}` }
      : { points: 0, max: CONFLUENCE_WEIGHTS.htfBias, note: "4H bias is flat — no directional edge." },
    htfStructure: { points: 0, max: CONFLUENCE_WEIGHTS.htfStructure, note: "4H structure alignment not scored — rejected at top-down alignment." },
    mtfBias: mtfStructBias.bias !== "neutral"
      ? { points: Math.round(CONFLUENCE_WEIGHTS.mtfBias * 0.8), max: CONFLUENCE_WEIGHTS.mtfBias, note: `1H bias is ${mtfStructBias.bias.toUpperCase()} — ${mtfStructBias.reason}` }
      : { points: 0, max: CONFLUENCE_WEIGHTS.mtfBias, note: "1H bias is flat — no directional edge." },
    mtfStructure: { points: 0, max: CONFLUENCE_WEIGHTS.mtfStructure, note: "1H structure alignment not scored — rejected at top-down alignment." },
    ltfConfirmation: { points: 0, max: CONFLUENCE_WEIGHTS.ltfConfirmation, note: "30M confirmation not scored — alignment gate failed." },
    nestedPOI: { points: 0, max: CONFLUENCE_WEIGHTS.nestedPOI, note: "POI nesting not scored — alignment gate failed." },
    freshUntouchedPOI: { points: 0, max: CONFLUENCE_WEIGHTS.freshUntouchedPOI, note: "POI freshness not scored — alignment gate failed." },
    liquiditySweep: { points: 0, max: CONFLUENCE_WEIGHTS.liquiditySweep, note: "Liquidity sweep not scored — alignment gate failed." },
    fairValueGap: { points: 0, max: CONFLUENCE_WEIGHTS.fairValueGap, note: "Fair value gap not scored — alignment gate failed." },
    premiumDiscount: { points: 0, max: CONFLUENCE_WEIGHTS.premiumDiscount, note: "Premium/discount not scored — alignment gate failed." },
    sessionTiming: scoreSessionTiming(CONFLUENCE_WEIGHTS.sessionTiming),
    macroConditions: { points: 0, max: CONFLUENCE_WEIGHTS.macroConditions, note: "Macro conditions not scored — alignment gate failed." },
  };

  const totalScore = Object.values(breakdown).reduce((sum, f) => sum + f.points, 0);
  const grade = gradeForScore(totalScore);

  return {
    symbol,
    currentPrice,
    direction: dailyDirection,
    totalScore,
    maxScore: TOTAL_WEIGHT,
    grade,
    qualifies: false,
    rejected: true,
    rejectionReason: reason,
    breakdown,
    poi: null,
    liquidityTarget: null,
    expectedBehaviour: null,
    invalidation: [],
    daily: { timeframe: "Daily", bias: dailyStructBias.bias, reason: dailyStructBias.reason },
    htf: { timeframe: "4H", bias: htfStructBias.bias, reason: htfStructBias.reason },
    mtf: { timeframe: "1H", bias: mtfStructBias.bias, reason: mtfStructBias.reason },
    ltf: { timeframe: "30M", fairValueGaps: [], orderBlocks: [] },
    session: currentSessionLabel(),
    timeframesAligned: false,
  };
}

async function sleepThenFetch(symbol, interval, outputsize) {
  await sleep(300); // light spacing; getCandles' own cache absorbs most repeat load
  return getCandles(symbol, interval, outputsize);
}

// --- Full watchlist scan -----------------------------------------------------
// Scans every monitored pair, returns the single best-qualifying opportunity
// (if any), every other pair ranked by score, and the raw scored list for
// the market status logic to reason about. Atlas only ever surfaces one.

export async function scanWatchlist(symbols = WATCHLIST) {
  let newsEvents = null;
  try {
    const { past, upcoming } = await getWeeklyNews();
    newsEvents = [...past, ...upcoming];
  } catch {
    newsEvents = null; // news.js already documents this feed can go down without notice
  }

  const results = [];
  for (const symbol of symbols) {
    try {
      const confluence = await buildConfluence(symbol, { newsEvents });
      results.push(confluence);
    } catch (err) {
      results.push({
        symbol,
        totalScore: 0,
        maxScore: TOTAL_WEIGHT,
        grade: GRADE.WAIT,
        qualifies: false,
        error: err.message,
      });
    }
  }

  const ranked = [...results].sort((a, b) => b.totalScore - a.totalScore);
  const bestTrade = ranked.find((r) => r.qualifies) || null;

  return { bestTrade, ranked, scannedAt: new Date().toISOString(), newsAvailable: Boolean(newsEvents) };
}

// The weighted confluence engine (Phase 3). Every factor below is scored
// independently against CONFLUENCE_WEIGHTS and summed into a single 0-100
// confidence score, which is then graded (A+/A/B/Ignore). This replaces the
// old all-or-nothing boolean check ("do timeframes agree AND is there a
// zone") with something that reflects how strong a setup actually is, and
// gives the AI engine and UI real numbers to explain rather than a single
// yes/no.

import { getCandles } from "./twelvedata";
import { scorePair } from "./strength";
import { detectFVGs, detectOrderBlocks, markMitigation, nearestUnmitigatedZones } from "./smc";
import { detectStructure, detectLiquidityLevels, detectLiquiditySweeps, premiumDiscountZones } from "./smcOverlays";
import { getWeeklyNews } from "./news";
import { CONFLUENCE_WEIGHTS, TOTAL_WEIGHT, gradeForScore, meetsMinimumGrade, NEWS_VETO_WINDOW_MS, WATCHLIST } from "./config";

const SESSION_HOURS_UTC = { start: 7, end: 21 }; // London open through NY close

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Individual factor scorers -------------------------------------------
// Each returns { points, max, note } so the UI can render a breakdown bar.

function scoreHtfTrend(htfScore) {
  const max = CONFLUENCE_WEIGHTS.htfTrend;
  if (htfScore.bias === "neutral") {
    return { points: 0, max, note: "4H trend is flat — no directional edge." };
  }
  // Scale by how far the raw strength score sits above the neutral threshold,
  // capped at the max weight.
  const strength = Math.min(Math.abs(htfScore.score) / 40, 1);
  return {
    points: Math.round(strength * max),
    max,
    note: `4H bias is ${htfScore.bias.toUpperCase()} — ${htfScore.reason}`,
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

function scoreZonePresence(zones, weight, label) {
  if (zones.length === 0) {
    return { points: 0, max: weight, note: `No unmitigated ${label} in the trade direction.` };
  }
  return {
    points: weight,
    max: weight,
    note: `${zones.length} unmitigated ${label}${zones.length > 1 ? "s" : ""} available for entry.`,
  };
}

function scoreLiquiditySweep(sweeps, direction, weight) {
  const wantedType = direction === "buy" ? "bullish" : "bearish";
  const recentSweep = sweeps.slice(-3).find((s) => s.type === wantedType);
  if (!recentSweep) {
    return { points: 0, max: weight, note: "No recent liquidity sweep supporting entry timing." };
  }
  return { points: weight, max: weight, note: `Liquidity swept at ${recentSweep.price.toFixed(5)} before reversing.` };
}

function scorePremiumDiscount(premiumDiscount, currentPrice, direction, weight) {
  const { high, low, equilibrium } = premiumDiscount;
  const inDiscount = currentPrice < equilibrium;
  const wanted = direction === "buy" ? inDiscount : !inDiscount;
  if (wanted) {
    return {
      points: weight,
      max: weight,
      note: `Price is trading at a ${direction === "buy" ? "discount" : "premium"} relative to the dealing range (${low.toFixed(5)}–${high.toFixed(5)}).`,
    };
  }
  return {
    points: 0,
    max: weight,
    note: `Price is on the wrong side of equilibrium for a ${direction.toUpperCase()} — buying premium / selling discount is lower probability.`,
  };
}

function scoreSessionTiming(weight) {
  const hour = new Date().getUTCHours();
  const inSession = hour >= SESSION_HOURS_UTC.start && hour < SESSION_HOURS_UTC.end;
  return {
    points: inSession ? weight : 0,
    max: weight,
    note: inSession ? "Inside London/New York session — normal liquidity." : "Outside London/New York hours — thin liquidity, moves are less reliable.",
  };
}

function scoreNewsFilter(newsEvents, symbol, weight) {
  if (!newsEvents || newsEvents.length === 0) {
    return { points: weight, max: weight, note: "No news calendar data available; treated as clear." };
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
      note: `High-impact ${imminent.country} event ("${imminent.title}") within an hour — spread and whipsaw risk is elevated.`,
    };
  }
  return { points: weight, max: weight, note: "No high-impact news for either currency in the next hour." };
}

// --- Entry / stop / target construction ----------------------------------
// Built only from real detected zones/prices — never invents levels.

function buildTradePlan({ direction, currentPrice, zone, ltfCandles }) {
  if (!zone) return null;

  const avgRange =
    ltfCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / ltfCandles.length;
  const buffer = avgRange * 0.25;

  const entry = { top: zone.top, bottom: zone.bottom };
  const entryMid = (zone.top + zone.bottom) / 2;

  const stopLoss = direction === "buy" ? zone.bottom - buffer : zone.top + buffer;
  const risk = Math.abs(entryMid - stopLoss);

  const takeProfit1 = direction === "buy" ? entryMid + risk * 2 : entryMid - risk * 2;
  const takeProfit2 = direction === "buy" ? entryMid + risk * 3 : entryMid - risk * 3;

  return {
    direction,
    entryZone: entry,
    entryMid,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward: "1:2 / 1:3",
  };
}

// --- Main per-symbol builder ----------------------------------------------

export async function buildConfluence(symbol, options = {}) {
  const { newsEvents = null } = options;

  const htf = await sleepThenFetch(symbol, "4h", 60);
  const mtf = await sleepThenFetch(symbol, "1h", 60);
  const ltf = await sleepThenFetch(symbol, "30min", 80);

  const htfScore = scorePair(symbol, htf);
  const mtfScore = scorePair(symbol, mtf);

  const currentPrice = ltf[ltf.length - 1]?.close;
  const direction = htfScore.bias === "buy" ? "buy" : htfScore.bias === "sell" ? "sell" : null;

  const htfStructure = detectStructure(htf);
  const mtfStructure = detectStructure(mtf);
  const ltfStructure = detectStructure(ltf);

  const fvgs = markMitigation(detectFVGs(ltf), ltf);
  const obs = markMitigation(detectOrderBlocks(ltf), ltf);
  const liquidity = detectLiquidityLevels(ltf);
  const sweeps = detectLiquiditySweeps(ltf, liquidity);
  const premiumDiscount = premiumDiscountZones(ltf);

  const wantedType = direction === "buy" ? "bullish" : direction === "sell" ? "bearish" : null;
  const relevantFVGs = wantedType ? nearestUnmitigatedZones(fvgs, currentPrice, wantedType) : [];
  const relevantOBs = wantedType ? nearestUnmitigatedZones(obs, currentPrice, wantedType) : [];

  // If there's no directional bias at all, the setup can't score on anything
  // direction-dependent — short-circuit with an honest zero rather than
  // pretending a "neutral" bias can still qualify.
  if (!direction) {
    return finalizeNoBias(symbol, currentPrice, htfScore);
  }

  const breakdown = {
    htfTrend: scoreHtfTrend(htfScore),
    htfStructure: scoreStructureAlignment(htfStructure, direction, CONFLUENCE_WEIGHTS.htfStructure, "4H"),
    mtfStructure: scoreStructureAlignment(mtfStructure, direction, CONFLUENCE_WEIGHTS.mtfStructure, "1H"),
    ltfConfirmation: scoreStructureAlignment(ltfStructure, direction, CONFLUENCE_WEIGHTS.ltfConfirmation, "30min"),
    orderBlock: scoreZonePresence(relevantOBs, CONFLUENCE_WEIGHTS.orderBlock, "order block"),
    fairValueGap: scoreZonePresence(relevantFVGs, CONFLUENCE_WEIGHTS.fairValueGap, "fair value gap"),
    liquiditySweep: scoreLiquiditySweep(sweeps, direction, CONFLUENCE_WEIGHTS.liquiditySweep),
    premiumDiscount: scorePremiumDiscount(premiumDiscount, currentPrice, direction, CONFLUENCE_WEIGHTS.premiumDiscount),
    sessionTiming: scoreSessionTiming(CONFLUENCE_WEIGHTS.sessionTiming),
    newsFilter: scoreNewsFilter(newsEvents, symbol, CONFLUENCE_WEIGHTS.newsFilter),
  };

  const totalScore = Object.values(breakdown).reduce((sum, f) => sum + f.points, 0);
  const grade = gradeForScore(totalScore);
  const qualifies = meetsMinimumGrade(grade);

  const bestZone = relevantOBs[0] || relevantFVGs[0] || null;
  const tradePlan = qualifies ? buildTradePlan({ direction, currentPrice, zone: bestZone, ltfCandles: ltf }) : null;

  return {
    symbol,
    currentPrice,
    direction,
    totalScore,
    maxScore: TOTAL_WEIGHT,
    grade,
    qualifies: qualifies && Boolean(tradePlan),
    breakdown,
    tradePlan,
    htf: { timeframe: "4H", bias: htfScore.bias, reason: htfScore.reason },
    mtf: { timeframe: "1H", bias: mtfScore.bias, reason: mtfScore.reason },
    ltf: {
      timeframe: "30min",
      fairValueGaps: relevantFVGs,
      orderBlocks: relevantOBs,
    },
    // Preserved for backwards compatibility with the existing Analysis page
    timeframesAgree: htfScore.bias !== "neutral" && htfScore.bias === mtfScore.bias,
    hasEntryZone: relevantFVGs.length > 0 || relevantOBs.length > 0,
    confluence: qualifies && Boolean(tradePlan),
  };
}

function finalizeNoBias(symbol, currentPrice, htfScore) {
  const breakdown = Object.fromEntries(
    Object.entries(CONFLUENCE_WEIGHTS).map(([key, max]) => [
      key,
      { points: 0, max, note: "Not scored — no 4H directional bias." },
    ])
  );
  return {
    symbol,
    currentPrice,
    direction: null,
    totalScore: 0,
    maxScore: TOTAL_WEIGHT,
    grade: "Ignore",
    qualifies: false,
    breakdown,
    tradePlan: null,
    htf: { timeframe: "4H", bias: "neutral", reason: htfScore.reason },
    mtf: { timeframe: "1H", bias: "neutral", reason: "Not evaluated — no 4H bias to confirm." },
    ltf: { timeframe: "30min", fairValueGaps: [], orderBlocks: [] },
    timeframesAgree: false,
    hasEntryZone: false,
    confluence: false,
  };
}

async function sleepThenFetch(symbol, interval, outputsize) {
  await sleep(400); // light spacing; getCandles' own cache absorbs most repeat load
  return getCandles(symbol, interval, outputsize);
}

// --- Full watchlist scan (Phase 5 / Phase 6) ------------------------------
// Scans every monitored pair, returns the best-qualifying trade (if any),
// every other pair ranked by score, and the raw scored list for the market
// status logic to reason about.

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
        grade: "Ignore",
        qualifies: false,
        error: err.message,
      });
    }
  }

  const ranked = [...results].sort((a, b) => b.totalScore - a.totalScore);
  const bestTrade = ranked.find((r) => r.qualifies) || null;

  return { bestTrade, ranked, scannedAt: new Date().toISOString(), newsAvailable: Boolean(newsEvents) };
}

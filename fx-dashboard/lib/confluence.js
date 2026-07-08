import { getCandles } from "./twelvedata";
import { scorePair } from "./strength";
import { detectFVGs, detectOrderBlocks, markMitigation, nearestUnmitigatedZones } from "./smc";

// Fetches all 3 timeframes for one pair and builds a combined confluence picture.
// Spaced out calls to stay well within Twelve Data's free tier rate limit.
export async function buildConfluence(symbol) {
  const htf = await sleepThen(() => getCandles(symbol, "4h", 40));
  const mtf = await sleepThen(() => getCandles(symbol, "1h", 40));
  const ltf = await sleepThen(() => getCandles(symbol, "30min", 60));

  const htfScore = scorePair(symbol, htf);
  const mtfScore = scorePair(symbol, mtf);

  const currentPrice = ltf[ltf.length - 1]?.close;

  const fvgs = markMitigation(detectFVGs(ltf), ltf);
  const obs = markMitigation(detectOrderBlocks(ltf), ltf);

  // Only zones matching the higher timeframe bias direction are relevant for an entry
  const wantedType = htfScore.bias === "buy" ? "bullish" : htfScore.bias === "sell" ? "bearish" : null;

  const relevantFVGs = wantedType ? nearestUnmitigatedZones(fvgs, currentPrice, wantedType) : [];
  const relevantOBs = wantedType ? nearestUnmitigatedZones(obs, currentPrice, wantedType) : [];

  // Confluence: do 4H and 1H agree, AND is there an unmitigated zone in that direction on 30min?
  const timeframesAgree = htfScore.bias !== "neutral" && htfScore.bias === mtfScore.bias;
  const hasEntryZone = relevantFVGs.length > 0 || relevantOBs.length > 0;
  const confluence = timeframesAgree && hasEntryZone;

  return {
    symbol,
    currentPrice,
    htf: { timeframe: "4H", bias: htfScore.bias, reason: htfScore.reason },
    mtf: { timeframe: "1H", bias: mtfScore.bias, reason: mtfScore.reason },
    ltf: {
      timeframe: "30min",
      fairValueGaps: relevantFVGs,
      orderBlocks: relevantOBs,
    },
    timeframesAgree,
    hasEntryZone,
    confluence,
  };
}

function sleepThen(fn) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      fn().then(resolve).catch(reject);
    }, 1500);
  });
}

import { isValidSymbol } from "./config";
import { cacheGet, cacheSet, cacheKey } from "./cache";

const BASE_URL = "https://api.twelvedata.com";

// Fetches OHLC candles for a pair, e.g. symbol="EUR/USD", interval="4h".
// Results are cached (see lib/cache.js) so a 15-minute scan cycle across the
// whole watchlist doesn't re-fetch data that can't have changed yet.
export async function getCandles(symbol, interval = "4h", outputsize = 50) {
  if (!isValidSymbol(symbol)) {
    throw new Error(`Invalid symbol: ${symbol}. Expected format like EUR/USD.`);
  }

  const key = cacheKey(symbol, interval, outputsize);
  const cached = cacheGet(key);
  if (cached) return cached;

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("Missing TWELVE_DATA_API_KEY");

  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(
    outputsize
  )}&timezone=UTC&apikey=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status === "error") {
    throw new Error(`Twelve Data error for ${symbol}: ${data.message}`);
  }

  // Twelve Data returns newest first; reverse to chronological order
  const candles = (data.values || [])
    .map((c) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }))
    .reverse();

  cacheSet(key, candles, interval);
  return candles;
}

// Fetches candles for multiple symbols sequentially, spaced out to stay
// under the free tier's requests-per-minute limit. Only sleeps between calls
// that actually hit the network — cached symbols return instantly, which
// matters a lot once the watchlist scan (Phase 5) is calling this for every
// timeframe on every refresh.
export async function getCandlesForSymbols(symbols, interval = "4h", outputsize = 50) {
  const results = {};
  for (const symbol of symbols) {
    const key = cacheKey(symbol, interval, outputsize);
    const wasCached = Boolean(cacheGet(key));

    try {
      results[symbol] = await getCandles(symbol, interval, outputsize);
    } catch (err) {
      results[symbol] = { error: err.message };
    }

    if (!wasCached) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return results;
}

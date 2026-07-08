const BASE_URL = "https://api.twelvedata.com";

// Fetches OHLC candles for a pair, e.g. symbol="EUR/USD", interval="4h"
export async function getCandles(symbol, interval = "4h", outputsize = 50) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("Missing TWELVE_DATA_API_KEY");

  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=${interval}&outputsize=${outputsize}&timezone=UTC&apikey=${apiKey}`;

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

  return candles;
}

// Fetches candles for multiple symbols in parallel, with basic rate limit spacing
export async function getCandlesForSymbols(symbols, interval = "4h", outputsize = 50) {
  const results = {};
  for (const symbol of symbols) {
    try {
      results[symbol] = await getCandles(symbol, interval, outputsize);
    } catch (err) {
      results[symbol] = { error: err.message };
    }
    // spaced out to stay safely under the 8 requests/minute free tier limit,
    // even if the dashboard is reloaded more than once in quick succession
    await new Promise((r) => setTimeout(r, 1500));
  }
  return results;
}

// Minimal in-memory TTL cache. This process holds candle data in memory
// between requests (valid as long as the app runs as a long-lived Node
// process via `next start`, which is how package.json is configured — it is
// NOT safe to assume this persists across separate serverless invocations).
//
// Why this exists: scanning the full watchlist (Phase 5) means every 15-minute
// refresh needs 4H, 1H, and 30min candles for every symbol. Without caching
// that is 3 x WATCHLIST.length Twelve Data calls every refresh, which burns
// through the free 800 calls/day budget fast. A 4H candle only changes every
// 4 hours, so there is no reason to re-fetch it every 15 minutes.

const store = new Map();

// Sensible TTLs per interval — long enough to avoid redundant calls, short
// enough that a session still sees fresh data within one trading session.
const TTL_BY_INTERVAL_MS = {
  "4h": 20 * 60 * 1000,
  "1h": 10 * 60 * 1000,
  "30min": 8 * 60 * 1000,
  "15min": 5 * 60 * 1000,
  "5min": 3 * 60 * 1000,
  "1day": 60 * 60 * 1000,
};

export function cacheKey(symbol, interval, outputsize) {
  return `${symbol}|${interval}|${outputsize}`;
}

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, interval) {
  const ttl = TTL_BY_INTERVAL_MS[interval] ?? 5 * 60 * 1000;
  store.set(key, { value, expiresAt: Date.now() + ttl });
}

// Exposed for a future /api/health or debug endpoint; not wired up anywhere
// so it never leaks data by default.
export function cacheStats() {
  return { size: store.size, keys: [...store.keys()] };
}

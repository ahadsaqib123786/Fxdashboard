# Atlas — Institutional Smart Money Concepts Trading Assistant (Phase 1)

Atlas is not a signal provider and does not tell you exactly where to buy or
sell. It scans a watchlist top-down (Daily → 4H → 1H → 30M), identifies the
single highest-quality institutional Point of Interest available today (if
any), and explains why in plain, professional language. Execution — entry
price, stop loss, take profit, sizing — is left entirely to the trader.

Three tabs:

- **Market Pulse** (`/`): the homepage. Answers exactly one question —
  "what is today's highest-quality institutional opportunity?" — with one
  market status headline, one pair (or an honest "nothing qualifies yet"
  state), an AI-written institutional narrative, and the full confluence
  breakdown behind the score. No chart, no ranked watchlist, no execution
  levels. Auto-refreshes every 15 minutes.
- **Full Analysis** (`/analysis`): pick any pair and get the same engine's
  complete breakdown — bias alignment, point-of-interest quality, liquidity
  and fair value gap analysis, macro/session conditions, why it scores what
  it scores, and what would invalidate it.
- **News** (`/news`): past and upcoming high-impact economic events, used
  by the engine as a macro filter and available here for manual reference.

## The confluence engine (`lib/confluenceEngine.js`)

Atlas performs top-down analysis: Daily sets macro direction, 4H confirms
institutional direction, 1H confirms continuation, 30M identifies the
execution Point of Interest. Bias must align at every step — a Daily/4H
disagreement, a 4H/1H disagreement, or a 1H/30M disagreement rejects the
pair outright, before it ever reaches scoring.

Pairs that survive the top-down gate are scored across 13 independent
factors (see `lib/config.js` for the exact weights), summed to a 0-100
confidence score:

| Factor | Weight |
|---|---|
| Daily bias | 10 |
| 4H bias | 15 |
| 4H structure (BOS/CHOCH) | 10 |
| 1H bias | 10 |
| 1H structure (BOS/CHOCH) | 8 |
| 30M confirmation | 7 |
| Nested POI (30M inside 1H inside 4H) | 10 |
| Fresh / untouched POI | 8 |
| Liquidity sweep | 6 |
| Fair value gap | 5 |
| Premium/discount positioning | 4 |
| Session timing | 3 |
| Macro conditions / news | 4 |

Scores grade as **Display (85+)**, **Monitor (75-84)**, or **Ignore (<75)**.
Only **Display** is ever shown as "Today's Best Opportunity" — tune
`MIN_RECOMMENDABLE_GRADE` in `lib/config.js` if you want it stricter. A
setup whose Point of Interest is unlikely to be reached before today's
active sessions close is also rejected, regardless of score.

Atlas never computes or displays an entry price, stop loss, take profit, or
risk:reward ratio. It describes the Point of Interest (kind, timeframe,
freshness, nesting) and the expected liquidity target qualitatively —
never as a number to place an order against.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your keys:
   - `TWELVE_DATA_API_KEY`: free key from https://twelvedata.com/pricing (Basic/Free plan)
   - `GEMINI_API_KEY`: free key from https://aistudio.google.com/app/apikey (optional —
     the app falls back to an engine-computed summary if this is missing or the call fails)
3. Run locally:
   ```
   npm run dev
   ```
   Visit http://localhost:3000
4. **Run the production build before deploying anywhere:**
   ```
   npm run build
   ```

## Deploying for free

Standard Next.js app, deploys to Vercel's free tier in a few clicks:
1. Push this folder to a GitHub repo.
2. Import the repo at vercel.com.
3. Add `TWELVE_DATA_API_KEY` and `GEMINI_API_KEY` in the Vercel project settings.
4. Deploy.

Note: Vercel's serverless functions don't share memory across invocations
the way a long-running `next start` process does, so the in-memory cache in
`lib/cache.js` won't carry over between requests there. It still works
correctly (just re-fetches instead of hitting cache) — if you outgrow this,
swap `lib/cache.js` for a Redis/Upstash-backed cache with the same
`cacheGet`/`cacheSet` interface and nothing else needs to change.

## Design system

Dark, gold-accented "instrument panel" look in `styles/globals.css`, tokens
at the top of the file. Mobile-first: base rules target phones, `min-width`
media queries layer on desktop spacing. The signature bias gauge is
`components/BiasGauge.js`; the decision-surface components
(`MarketStatusBanner`, `BestTradeCard`, `ConfluenceBreakdown`, `GradeBadge`,
`WaitState`, `DashboardSkeleton`) all live in `components/` and follow the
same token set.

## Known limitations (still true, worth knowing before you trust this with real money)

- **This is a heuristic SMC engine, not a certified trading system.** It
  approximates order blocks, FVGs, structure, and liquidity using common
  ICT definitions applied programmatically — treat every output as
  well-reasoned context, not a signal to blindly follow.
- **Twelve Data free tier is 800 calls/day and 8 calls/minute.** A full
  8-instrument scan now costs up to 32 calls (Daily/4H/1H/30M each);
  `lib/cache.js` caches per-timeframe so a 15-minute refresh cycle mostly
  reuses cached candles instead of re-fetching everything.
- **The news feed uses Forex Factory's unofficial JSON endpoint** and can
  break without notice — the engine treats a failed news fetch as "clear"
  rather than blocking the whole scan.
- **Gemini free tier has its own rate limits.** `/api/scan` only calls it
  once per refresh (for the single qualifying opportunity, if any); if it
  fails or the key is missing, `lib/ai.js` falls back to a summary built
  directly from the scored breakdown so the UI never breaks.
- **Reachability is a heuristic**, built from the 30M average candle range
  and hours remaining in today's session — not a price prediction.

## Prepared, not yet built (future Premium features)

The architecture (shared `lib/config.js`, clean API boundaries, `lib/cache.js`)
is intentionally left ready for these without needing a rewrite — they are
out of scope for Phase 1:

- AI Trading Assistant (conversational)
- Trade Journal
- Backtesting
- Replay
- Statistics
- Performance Review
- Trade Coaching

`pages/api/candles.js` and `lib/smcOverlays.js` already expose raw candles
and SMC overlays (structure, liquidity, FVGs, order blocks, premium/discount,
sessions) for a future charting surface — kept but unused by any page in
Phase 1, since Atlas complements TradingView rather than replacing it.

## Where to go next

- Add a persistence layer (Supabase/Postgres) to track how each graded
  setup actually performed, which lets `CONFLUENCE_WEIGHTS` be tuned from
  real outcomes instead of judgment calls.
- Swap `lib/cache.js` for Redis/Upstash if deploying to serverless Vercel
  functions, so the cache survives across invocations.
- Add authentication once this moves beyond personal use.

# Meridian FX — AI Forex Decision Assistant (v2)

Not a chart viewer. A decision engine: it scans your watchlist, weighs real
ICT/Smart Money confluence, and tells you plainly whether there's a
trade-worthy setup right now — or to wait. Three tabs:

- **Market Pulse** (`/`): the homepage. Shows one market status headline
  (A+ Setup Available / Good Opportunities / Watchlist Only / No
  Institutional Setups / High Impact News / Market Closed), today's best
  qualifying trade with entry/stop/target and an AI-written analyst note,
  a full confluence breakdown, and a compact ranked list of everything
  else scanned. Auto-refreshes every 15 minutes.
- **AI Analysis** (`/analysis`): pick any pair and get the same weighted
  engine's full breakdown, trade plan, and chart with SMC overlays
  (order blocks, FVGs, liquidity, BOS/CHOCH, premium/discount, sessions).
- **News** (`/news`): past and upcoming high-impact economic events, used
  by the engine as a hard filter and available here for manual reference.

## The confluence engine (`lib/confluenceEngine.js`)

Every scan scores 10 independent factors (see `lib/config.js` for the exact
weights) and sums them to a 0-100 confidence score:

| Factor | Weight |
|---|---|
| 4H trend | 20 |
| 4H BOS/CHOCH alignment | 15 |
| 1H BOS/CHOCH alignment | 15 |
| 30min confirmation | 10 |
| Order block present | 10 |
| Fair value gap present | 10 |
| Liquidity sweep | 5 |
| Premium/discount positioning | 5 |
| Session timing | 5 |
| News filter | 5 |

Scores grade as **A+ (90+)**, **A (80-89)**, **B (70-79)**, or **Ignore
(<70)**. Only **B and above** are ever shown as "Today's Best Trade" —
tune `MIN_RECOMMENDABLE_GRADE` in `lib/config.js` if you want it stricter.
Entry/stop/target levels are always derived from the actual detected zone,
never invented.

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
4. **Run the production build before deploying anywhere.** This was edited
   without a live network connection to npm/Vercel, so while every file was
   syntax-checked, `npm run build` has not been executed against it yet:
   ```
   npm run build
   ```
   Fix anything it flags (there shouldn't be much — see "What changed" below).

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
`components/BiasGauge.js`; new decision-surface components
(`MarketStatusBanner`, `BestTradeCard`, `ConfluenceBreakdown`,
`OpportunityList`, `GradeBadge`, `WaitState`, `DashboardSkeleton`) all live
in `components/` and follow the same token set.

## Known limitations (still true, worth knowing before you trust this with real money)

- **This is a heuristic SMC engine, not a certified trading system.** It
  approximates order blocks, FVGs, structure, and liquidity using common
  ICT definitions applied programmatically — treat every output as a
  well-reasoned second opinion, not a signal to blindly follow.
- **Twelve Data free tier is 800 calls/day and 8 calls/minute.** A full
  8-pair scan costs up to 24 calls; `lib/cache.js` caches per-timeframe (20
  min for 4H, 10 min for 1H, 8 min for 30min) so a 15-minute refresh cycle
  mostly reuses cached candles instead of re-fetching everything.
- **The news feed uses Forex Factory's unofficial JSON endpoint** and can
  break without notice — the engine treats a failed news fetch as "clear"
  rather than blocking the whole scan.
- **Gemini free tier has its own rate limits.** `/api/scan` only calls it
  once per refresh (for the single best-qualifying trade, if any); if it
  fails or the key is missing, `lib/ai.js` falls back to a summary built
  directly from the scored breakdown so the UI never breaks.

## Explicitly not built (by design, per product scope)

Trade journal, trade history, economic calendar builder, watchlist manager,
alerts, authentication, portfolio tracking, backtesting. The architecture
(shared `lib/config.js`, clean API boundaries) is intentionally left ready
for these without needing a rewrite — they just aren't in scope yet.

## Where to go next

- Add a persistence layer (Supabase/Postgres) to track how each graded
  setup actually performed, which lets `CONFLUENCE_WEIGHTS` be tuned from
  real outcomes instead of judgment calls.
- Swap `lib/cache.js` for Redis/Upstash if deploying to serverless Vercel
  functions, so the cache survives across invocations.
- Add authentication once this moves beyond personal use.

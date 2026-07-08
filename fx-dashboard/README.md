# FX Dashboard (v1)

A personal forex dashboard with three tabs:
- **Dashboard**: shows today's strongest pair, bias (buy/sell/neutral), and a rule based reason. Auto-refreshes every 15 minutes.
- **AI Analysis**: pick any pair from the watchlist, get a computed bias and an AI generated writeup.
- **News**: past and upcoming economic events with impact level, and a simple actual-vs-forecast bias for past events.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your keys:
   - `TWELVE_DATA_API_KEY`: free key from https://twelvedata.com/pricing (Basic/Free plan)
   - `GEMINI_API_KEY`: free key from https://aistudio.google.com/app/apikey
3. Run locally:
   ```
   npm run dev
   ```
   Visit http://localhost:3000

## Deploying for free

This is a standard Next.js app, so it deploys to Vercel's free tier in a few clicks:
1. Push this folder to a GitHub repo.
2. Import the repo at vercel.com.
3. Add the two environment variables (`TWELVE_DATA_API_KEY`, `GEMINI_API_KEY`) in the Vercel project settings.
4. Deploy.

## Design system

The dark, gold-accented "instrument panel" look lives in `styles/globals.css` as CSS variables at the top of the file (colors, fonts, radius). Change values there to re-theme the whole app. The signature bias gauge component is in `components/BiasGauge.js`, reused on both the Dashboard and AI Analysis tabs.

## Known limitations (v1, worth knowing before you rely on this)

- **Bias logic is a rough approximation.** It scores momentum, range expansion, and basic swing high/low structure. It does NOT yet detect real order blocks, fair value gaps, or supply/demand zones the way you'd manually mark them on a chart. Treat it as a starting signal, not a finished ICT engine.
- **Twelve Data free tier is 800 calls/day and 8 calls/minute.** The strength calculation hits 8 pairs per refresh, so don't drop the refresh interval much below 15 minutes or you'll burn through the daily limit fast, especially if you're also using the Analysis tab.
- **The news feed uses Forex Factory's unofficial JSON endpoint.** It's not an official API and could change or break without notice.
- **Gemini free tier has its own rate limits.** Fine for personal use, but don't hammer the Analysis tab repeatedly in a short window.

## Where to go next

- Add real FVG/order block detection to `lib/strength.js` instead of the momentum/structure approximation.
- Add a database (Supabase free tier works well) to store bias history over time instead of recomputing on every load.
- Add auth if you ever want to share this with more than yourself.

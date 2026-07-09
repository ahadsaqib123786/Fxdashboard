// Single source of truth for tunable product behaviour. Nothing that appears
// here should be hardcoded again anywhere else in the app — import it instead.

// Atlas's monitored universe. XAU/USD (Gold) trades through the same
// Twelve Data time_series endpoint as the FX pairs, so it needs no special
// handling elsewhere — only listing it here.
export const WATCHLIST = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "NZD/USD",
  "USD/CAD",
  "XAU/USD",
];

// Three-letter/three-letter pairs (EUR/USD) and metals-as-FX pairs (XAU/USD)
// both match this shape, so one pattern covers the whole watchlist.
export const SYMBOL_PATTERN = /^[A-Z]{3}\/[A-Z]{3}$/;

export function isValidSymbol(symbol) {
  return typeof symbol === "string" && SYMBOL_PATTERN.test(symbol);
}

// How often Atlas re-scans the market and the client re-polls it.
export const REFRESH_MS = 15 * 60 * 1000;

// --- Top-down timeframe chain ---------------------------------------------
// Atlas always reasons Daily -> 4H -> 1H -> 30M. Bias must align at every
// step or the setup is rejected outright before it ever reaches scoring.
export const TIMEFRAME_CHAIN = ["daily", "htf", "mtf", "ltf"];

// --- Weighted confluence engine --------------------------------------------
// Every component below is scored independently and summed to a 0-100
// confidence score. Weights intentionally sum to 100 and map directly to the
// confluence categories Atlas is required to reason about: multi-timeframe
// bias, point-of-interest quality/freshness, structure, liquidity,
// premium/discount, session timing and macro conditions.
export const CONFLUENCE_WEIGHTS = {
  dailyBias: 10, // Daily directional bias strength (macro direction)
  htfBias: 15, // 4H directional bias strength (institutional direction)
  htfStructure: 10, // 4H BOS/CHOCH alignment with the bias
  mtfBias: 10, // 1H bias agrees with Daily/4H (continuation)
  mtfStructure: 8, // 1H BOS/CHOCH alignment with the bias
  ltfConfirmation: 7, // 30M structure confirms the same direction
  nestedPOI: 10, // 30M POI nested inside a 1H POI nested inside 4H supply/demand
  freshUntouchedPOI: 8, // The selected POI is fresh and has never been mitigated
  liquiditySweep: 6, // Recent liquidity sweep supports entry timing
  fairValueGap: 5, // Fair value gap overlapping the POI
  premiumDiscount: 4, // Price sitting in discount (buy) / premium (sell)
  sessionTiming: 3, // Inside an active institutional session
  macroConditions: 4, // No adverse high-impact news / macro risk
};

export const TOTAL_WEIGHT = Object.values(CONFLUENCE_WEIGHTS).reduce((a, b) => a + b, 0);

// Confidence bands applied to the 0-100 score.
// 85+   -> Display  (this is Atlas's single "Today's Best Opportunity")
// 75-84 -> Monitor  (worth watching, never surfaced as the headline setup)
// <75   -> Ignore
export const GRADE_BANDS = [
  { grade: "Display", min: 85 },
  { grade: "Monitor", min: 75 },
  { grade: "Ignore", min: 0 },
];

export function gradeForScore(score) {
  return GRADE_BANDS.find((b) => score >= b.min).grade;
}

// The minimum grade Atlas will ever present as "Today's Best Opportunity".
export const MIN_RECOMMENDABLE_GRADE = "Display";

const GRADE_RANK = { Display: 2, Monitor: 1, Ignore: 0 };

export function meetsMinimumGrade(grade) {
  return GRADE_RANK[grade] >= GRADE_RANK[MIN_RECOMMENDABLE_GRADE];
}

// How soon a high-impact news event must be to veto a currency's macro score.
export const NEWS_VETO_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Institutional trading sessions, UTC hours. Used for session-timing scoring
// and for the "Session Conditions" section of the full analysis page.
export const SESSIONS_UTC = {
  Asian: [0, 9],
  London: [7, 16],
  "New York": [12, 21],
};

// The window (London through New York) treated as "active institutional
// hours" for scoring purposes — thin Asian-only liquidity is deprioritised.
export const ACTIVE_SESSION_HOURS_UTC = { start: 7, end: 21 };

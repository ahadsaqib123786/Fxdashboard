// Single source of truth for tunable product behaviour. Nothing that appears
// here should be hardcoded again anywhere else in the app — import it instead.

// Keep this list short to stay well within Twelve Data's free 800 calls/day limit.
// Each full scan costs 3 candle requests per symbol (4H, 1H, 30min).
export const WATCHLIST = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "AUD/USD",
  "AUD/JPY",
  "USD/CAD",
  "USD/CHF",
  "NZD/USD",
];

export const SYMBOL_PATTERN = /^[A-Z]{3}\/[A-Z]{3}$/;

export function isValidSymbol(symbol) {
  return typeof symbol === "string" && SYMBOL_PATTERN.test(symbol);
}

// How often the client should re-scan the market.
export const REFRESH_MS = 15 * 60 * 1000;

// Weighted confluence engine. Every component below is scored independently
// and summed to a 0-100 confidence score. Weights intentionally sum to 100.
// Note: we don't score "currency strength" as a separate line item because it
// would double-count the HTF trend component (both are derived from the same
// momentum/structure data) — that would inflate scores without adding signal.
export const CONFLUENCE_WEIGHTS = {
  htfTrend: 20, // 4H directional bias strength
  htfStructure: 15, // 4H BOS/CHOCH alignment with the trend
  mtfStructure: 15, // 1H BOS/CHOCH alignment with the 4H trend
  ltfConfirmation: 10, // 30min structure confirms the same direction
  orderBlock: 10, // Unmitigated order block in the trade direction
  fairValueGap: 10, // Unmitigated fair value gap in the trade direction
  liquiditySweep: 5, // Recent sweep supporting entry timing
  premiumDiscount: 5, // Price sitting in discount (buy) / premium (sell)
  sessionTiming: 5, // Inside London or New York session
  newsFilter: 5, // No high-impact news imminent for either currency
};

export const TOTAL_WEIGHT = Object.values(CONFLUENCE_WEIGHTS).reduce((a, b) => a + b, 0);

// Grade bands, applied to the 0-100 confidence score.
export const GRADE_BANDS = [
  { grade: "A+", min: 90 },
  { grade: "A", min: 80 },
  { grade: "B", min: 70 },
  { grade: "Ignore", min: 0 },
];

export function gradeForScore(score) {
  return GRADE_BANDS.find((b) => score >= b.min).grade;
}

// The minimum grade the engine will ever present as "Today's Best Trade".
// Anything below this is filtered into WAIT / no-trade states. Configurable
// so this can be tightened as the engine is refined without touching logic.
export const MIN_RECOMMENDABLE_GRADE = "B";

const GRADE_RANK = { "A+": 3, A: 2, B: 1, Ignore: 0 };

export function meetsMinimumGrade(grade) {
  return GRADE_RANK[grade] >= GRADE_RANK[MIN_RECOMMENDABLE_GRADE];
}

// How soon a high-impact news event must be to veto a currency's news score.
export const NEWS_VETO_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Single source of truth for tunable product behaviour. Nothing that appears
// here should be hardcoded again anywhere else in the app — import it instead.

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

export const SYMBOL_PATTERN = /^[A-Z]{3}\/[A-Z]{3}$/;

export function isValidSymbol(symbol) {
  return typeof symbol === "string" && SYMBOL_PATTERN.test(symbol);
}

export const REFRESH_MS = 15 * 60 * 1000;

export const TIMEFRAME_CHAIN = ["daily", "htf", "mtf", "ltf"];

// --- Weighted confluence engine --------------------------------------------
export const CONFLUENCE_WEIGHTS = {
  dailyBias: 10,
  htfBias: 15,
  htfStructure: 10,
  mtfBias: 10,
  mtfStructure: 8,
  ltfConfirmation: 7,
  nestedPOI: 10,
  freshUntouchedPOI: 8,
  liquiditySweep: 6,
  fairValueGap: 5,
  premiumDiscount: 4,
  sessionTiming: 3,
  macroConditions: 4,
};

export const TOTAL_WEIGHT = Object.values(CONFLUENCE_WEIGHTS).reduce((a, b) => a + b, 0);

// --- Grade system ----------------------------------------------------------
export const GRADE = {
  READY: "Institutional Setup Available",
  CONFIRMING: "Awaiting Confirmation",
  BUILDING: "Setup Building",
  WAIT: "Wait",
  INVALIDATED: "Invalidated",
};

export const GRADE_BANDS = [
  { grade: GRADE.READY, min: 85 },
  { grade: GRADE.CONFIRMING, min: 70 },
  { grade: GRADE.BUILDING, min: 50 },
  { grade: GRADE.WAIT, min: 0 },
];

export function gradeForScore(score) {
  return GRADE_BANDS.find((b) => score >= b.min).grade;
}

export const MIN_RECOMMENDABLE_GRADE = GRADE.READY;

const GRADE_RANK = {
  [GRADE.READY]: 4,
  [GRADE.CONFIRMING]: 3,
  [GRADE.BUILDING]: 2,
  [GRADE.WAIT]: 1,
  [GRADE.INVALIDATED]: 0,
};

export function meetsMinimumGrade(grade) {
  return GRADE_RANK[grade] >= GRADE_RANK[MIN_RECOMMENDABLE_GRADE];
}

// --- Macro / session -------------------------------------------------------
export const NEWS_VETO_WINDOW_MS = 60 * 60 * 1000;

export const SESSIONS_UTC = {
  Asian: [0, 9],
  London: [7, 16],
  "New York": [12, 21],
};

export const ACTIVE_SESSION_HOURS_UTC = { start: 7, end: 21 };

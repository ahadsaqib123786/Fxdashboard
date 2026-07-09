// Turns a scanWatchlist() result into one confident, human-readable market
// status. This is the single most important sentence in the product: it is
// the difference between a tool traders trust and another noisy dashboard.

const STATUS = {
  DISPLAY: "A-Grade Setup Available",
  WATCHLIST: "Watchlist Only",
  NO_SETUPS: "No Institutional Setups",
  NEWS: "High Impact News",
  CLOSED: "Market Closed",
};

// Forex is effectively closed roughly Friday 21:00 UTC to Sunday 21:00 UTC.
function isMarketClosed(now = new Date()) {
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getUTCHours();
  if (day === 6) return true;
  if (day === 0 && hour < 21) return true;
  if (day === 5 && hour >= 21) return true;
  return false;
}

export function deriveMarketStatus({ bestTrade, ranked }, now = new Date()) {
  if (isMarketClosed(now)) {
    return {
      status: STATUS.CLOSED,
      headline: "Market is closed. Scanning resumes when trading reopens.",
    };
  }

  const imminentNews = ranked.some((r) =>
    r.breakdown?.macroConditions && r.breakdown.macroConditions.points === 0 && r.direction
  );

  if (bestTrade) {
    return {
      status: STATUS.DISPLAY,
      headline: `${bestTrade.symbol} is today's highest-quality institutional opportunity — ${bestTrade.totalScore}/${bestTrade.maxScore} confidence.`,
    };
  }

  if (imminentNews) {
    return {
      status: STATUS.NEWS,
      headline: "High-impact news is imminent for one or more monitored pairs. Standing aside until it clears.",
    };
  }

  const anyWatchable = ranked.some((r) => r.grade === "Monitor");
  if (anyWatchable) {
    return {
      status: STATUS.WATCHLIST,
      headline: "No A-grade setup currently available. A few pairs are building — worth watching, not trading yet.",
    };
  }

  return {
    status: STATUS.NO_SETUPS,
    headline: "No institutional-quality setups right now. Patience is the correct call.",
  };
}

export { STATUS };

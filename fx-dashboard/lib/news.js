// Forex Factory does not offer an official API. This uses their public
// weekly calendar JSON feed, which many retail tools rely on informally.
// It can break without notice if they change their site, so wrap calls
// to this in try/catch wherever it's used.

const FF_WEEKLY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export async function getWeeklyNews() {
  const res = await fetch(FF_WEEKLY_URL);
  if (!res.ok) throw new Error("Failed to fetch news calendar");
  const data = await res.json();

  const now = new Date();

  const events = data.map((e) => ({
    title: e.title,
    country: e.country,
    date: e.date,
    impact: e.impact, // "High", "Medium", "Low"
    forecast: e.forecast,
    previous: e.previous,
    actual: e.actual,
    isPast: new Date(e.date) < now,
  }));

  return {
    past: events.filter((e) => e.isPast).sort((a, b) => new Date(b.date) - new Date(a.date)),
    upcoming: events.filter((e) => !e.isPast).sort((a, b) => new Date(a.date) - new Date(b.date)),
  };
}

// Very simple heuristic bias: compares actual vs forecast for events that have reported.
// Positive surprise on a currency's own data generally supports that currency.
export function estimateNewsBias(event) {
  if (event.actual == null || event.forecast == null) return "pending";
  const actual = parseFloat(event.actual);
  const forecast = parseFloat(event.forecast);
  if (isNaN(actual) || isNaN(forecast)) return "neutral";
  if (actual > forecast) return "bullish";
  if (actual < forecast) return "bearish";
  return "neutral";
}

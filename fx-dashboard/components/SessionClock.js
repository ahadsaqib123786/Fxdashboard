import { useEffect, useState } from "react";

// Standard forex session hours in UTC (approximate, ignores DST shifts)
const SESSIONS = [
  { name: "Sydney", start: 21, end: 6 },
  { name: "Tokyo", start: 0, end: 9 },
  { name: "London", start: 7, end: 16 },
  { name: "New York", start: 12, end: 21 },
];

function activeSessions(utcHour) {
  return SESSIONS.filter((s) => {
    if (s.start < s.end) return utcHour >= s.start && utcHour < s.end;
    return utcHour >= s.start || utcHour < s.end; // wraps past midnight
  });
}

export default function SessionClock() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const utcHour = now.getUTCHours();
  const active = activeSessions(utcHour);
  const timeStr = now.toISOString().slice(11, 19);

  return (
    <div className="session-clock">
      <span className="session-time">{timeStr} UTC</span>
      <span className="session-dot" />
      <span className="session-active">
        {active.length ? active.map((s) => s.name).join(" / ") : "Between sessions"}
      </span>
    </div>
  );
}

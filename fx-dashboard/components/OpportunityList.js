import GradeBadge from "./GradeBadge";

export default function OpportunityList({ opportunities }) {
  if (!opportunities || opportunities.length === 0) return null;

  return (
    <div className="card">
      <h3>Other Opportunities</h3>
      <div className="opportunity-list">
        {opportunities.map((o) => (
          <div key={o.symbol} className="opportunity-row">
            <div className="opportunity-left">
              <span className="opportunity-symbol">{o.symbol}</span>
              {o.direction && <span className={`bias-${o.direction === "buy" ? "buy" : "sell"}`}>{o.direction.toUpperCase()}</span>}
            </div>
            <div className="opportunity-left">
              <span className="opportunity-score">{o.totalScore ?? 0}/{o.maxScore ?? 100}</span>
              <GradeBadge grade={o.grade || "Ignore"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

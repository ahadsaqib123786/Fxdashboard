import GradeBadge from "./GradeBadge";
import AnalystNote from "./AnalystNote";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="level-box">
      <div className="level-label">{label}</div>
      <div className="level-value">{value}</div>
    </div>
  );
}

export default function BestTradeCard({ trade, aiSummary, aiSource }) {
  const { symbol, direction, totalScore, maxScore, grade, poi, liquidityTarget, session } = trade;

  return (
    <div className="card highlight">
      <div className="best-trade-header">
        <div>
          <h3>Today&apos;s Best Opportunity</h3>
          <div className="best-trade-symbol">{symbol}</div>
        </div>
        <div className="best-trade-meta">
          <GradeBadge grade={grade} />
          <span className="confluence-points">{totalScore}/{maxScore}</span>
        </div>
      </div>

      <p className={`bias bias-${direction === "buy" ? "buy" : "sell"}`}>{direction.toUpperCase()}</p>

      <div className="level-grid">
        <InfoRow label="Point of Interest" value={poi ? `${poi.kind} (${poi.timeframe})${poi.nested ? " — nested" : ""}` : "—"} />
        <InfoRow label="Liquidity Target" value={liquidityTarget ? liquidityTarget.description : "—"} />
        <InfoRow label="Session" value={session} />
      </div>

      {aiSummary && (
        <>
          <AnalystNote text={aiSummary} />
          {aiSource === "fallback" && (
            <p className="timestamp">AI narrative unavailable — showing engine-computed summary.</p>
          )}
        </>
      )}

      <p className="reason" style={{ marginTop: 12 }}>
        Atlas identifies institutional context, not execution. Entry, stop and target remain the trader&apos;s decision.
      </p>
    </div>
  );
}

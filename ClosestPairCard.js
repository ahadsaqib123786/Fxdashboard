import GradeBadge from "./GradeBadge";

// What the UI shows as the reason this pair isn't a qualifying setup yet.
// Prefers the engine's own rejection reason; falls back to a sensible
// message built from grade + score for pairs that simply scored too low.
function explain(pair) {
  if (pair.error) return `Data unavailable for this pair right now (${pair.error}).`;
  if (pair.rejectionReason) return pair.rejectionReason;
  if (!pair.direction) return "No clear Daily directional bias to build a case around yet.";
  return `Aligned on direction but only scored ${pair.totalScore}/${pair.maxScore} — below the confidence bar for a real setup.`;
}

export default function ClosestPairCard({ pair }) {
  if (!pair) return null;

  const confidence = pair.maxScore ? Math.round((pair.totalScore / pair.maxScore) * 100) : 0;
  const hasDirection = Boolean(pair.direction);

  return (
    <div className="card pair-card">
      <div className="card-label">Closest Pair — Not Yet Qualifying</div>
      <div className="pair-symbol">{pair.symbol}</div>
      {hasDirection ? (
        <p className={`pair-bias pair-bias-${pair.direction === "buy" ? "buy" : "sell"}`}>
          {pair.direction === "buy" ? "Bullish" : "Bearish"} Lean
        </p>
      ) : (
        <p className="pair-bias">No Clear Bias</p>
      )}
      <div className="pair-confidence">{confidence}%</div>
      <div className="pair-confidence-label">Confidence</div>
      <div className="pair-grade">
        <GradeBadge grade={pair.grade} />
      </div>
      <p className="reason" style={{ textAlign: "center", marginTop: 14 }}>
        {explain(pair)}
      </p>
    </div>
  );
}

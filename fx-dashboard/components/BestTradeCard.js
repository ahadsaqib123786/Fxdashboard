import GradeBadge from "./GradeBadge";

export default function BestTradeCard({ trade }) {
  const { symbol, direction, totalScore, maxScore, grade } = trade;
  const confidence = maxScore ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <div className="card highlight pair-card">
      <div className="card-label">Strongest Pair</div>
      <div className="pair-symbol">{symbol}</div>
      <p className={`pair-bias pair-bias-${direction === "buy" ? "buy" : "sell"}`}>
        {direction === "buy" ? "Bullish" : "Bearish"} Bias
      </p>
      <div className="pair-confidence">{confidence}%</div>
      <div className="pair-confidence-label">Confidence</div>
      <div className="pair-grade">
        <GradeBadge grade={grade} />
      </div>
    </div>
  );
}

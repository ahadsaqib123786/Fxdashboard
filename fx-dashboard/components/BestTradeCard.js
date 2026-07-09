import GradeBadge from "./GradeBadge";
import AnalystNote from "./AnalystNote";

function LevelBox({ label, value, tone }) {
  return (
    <div className="level-box">
      <div className="level-label">{label}</div>
      <div className={`level-value ${tone || ""}`}>{value}</div>
    </div>
  );
}

export default function BestTradeCard({ trade, aiSummary, aiSource }) {
  const { symbol, direction, totalScore, maxScore, grade, tradePlan } = trade;
  const buySell = direction === "buy" ? "buy" : "sell";

  return (
    <div className="card highlight">
      <div className="best-trade-header">
        <div>
          <h3>Today&apos;s Best Trade</h3>
          <div className="best-trade-symbol">{symbol}</div>
        </div>
        <div className="best-trade-meta">
          <GradeBadge grade={grade} />
          <span className="confluence-points">{totalScore}/{maxScore}</span>
        </div>
      </div>

      <p className={`bias bias-${direction === "buy" ? "buy" : "sell"}`}>{direction.toUpperCase()}</p>

      {tradePlan && (
        <div className="level-grid">
          <LevelBox
            label="Entry Zone"
            value={`${tradePlan.entryZone.bottom.toFixed(5)} – ${tradePlan.entryZone.top.toFixed(5)}`}
          />
          <LevelBox label="Stop Loss" value={tradePlan.stopLoss.toFixed(5)} tone="sell" />
          <LevelBox
            label="Take Profit"
            value={`${tradePlan.takeProfit1.toFixed(5)} / ${tradePlan.takeProfit2.toFixed(5)}`}
            tone="buy"
          />
          <LevelBox label="Risk : Reward" value={tradePlan.riskReward} />
        </div>
      )}

      {aiSummary && (
        <>
          <AnalystNote text={aiSummary} />
          {aiSource === "fallback" && (
            <p className="timestamp">AI narrative unavailable — showing engine-computed summary.</p>
          )}
        </>
      )}
    </div>
  );
}

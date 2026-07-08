import { useState } from "react";
import BiasGauge from "../components/BiasGauge";
import GradeBadge from "../components/GradeBadge";
import ConfluenceBreakdown from "../components/ConfluenceBreakdown";
import TradingChart from "../components/TradingChart";
import { WATCHLIST } from "../lib/config";

function ZoneList({ zones, label }) {
  if (!zones || zones.length === 0) return <p className="reason">No unmitigated {label} nearby.</p>;
  return (
    <ul>
      {zones.map((z, i) => (
        <li key={i}>
          {z.type} {label} between {z.bottom.toFixed(5)} and {z.top.toFixed(5)}
        </li>
      ))}
    </ul>
  );
}

export default function Analysis() {
  const [symbol, setSymbol] = useState(WATCHLIST[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>AI Pair Analysis</h1>
      <p className="subtitle">Full weighted confluence breakdown for a single pair, on demand.</p>

      <div className="controls">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {WATCHLIST.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button onClick={runAnalysis} disabled={loading}>
          {loading ? "Analysing..." : "Analyse"}
        </button>
      </div>

      {error && <p className="error">Error: {error}</p>}

      {result && (
        <div>
          <div className={`card ${result.qualifies ? "highlight" : ""}`}>
            <div className="best-trade-header">
              <BiasGauge
                score={result.direction === "buy" ? 40 : result.direction === "sell" ? -40 : 0}
                bias={result.direction || "neutral"}
                label={result.symbol}
                sublabel={result.qualifies ? "Qualifies for a trade" : "Does not qualify"}
              />
              <div className="best-trade-meta">
                <GradeBadge grade={result.grade} />
                <span className="confluence-points">{result.totalScore}/{result.maxScore}</span>
              </div>
            </div>
            <p className="ai-text">{result.aiAnalysis}</p>
            {result.aiSource === "fallback" && (
              <p className="timestamp">AI narrative unavailable — showing engine-computed summary.</p>
            )}
          </div>

          <h3 style={{ margin: "24px 0 4px 4px" }}>{result.symbol} Chart</h3>
          <TradingChart symbol={result.symbol} />

          {result.tradePlan && (
            <div className="card">
              <h3>Trade Plan</h3>
              <div className="level-grid">
                <div className="level-box">
                  <div className="level-label">Entry Zone</div>
                  <div className="level-value">
                    {result.tradePlan.entryZone.bottom.toFixed(5)} – {result.tradePlan.entryZone.top.toFixed(5)}
                  </div>
                </div>
                <div className="level-box">
                  <div className="level-label">Stop Loss</div>
                  <div className="level-value sell">{result.tradePlan.stopLoss.toFixed(5)}</div>
                </div>
                <div className="level-box">
                  <div className="level-label">Take Profit</div>
                  <div className="level-value buy">
                    {result.tradePlan.takeProfit1.toFixed(5)} / {result.tradePlan.takeProfit2.toFixed(5)}
                  </div>
                </div>
                <div className="level-box">
                  <div className="level-label">Risk : Reward</div>
                  <div className="level-value">{result.tradePlan.riskReward}</div>
                </div>
              </div>
            </div>
          )}

          <ConfluenceBreakdown breakdown={result.breakdown} />

          <div className="card">
            <h3>4H bias (directional)</h3>
            <p className={`bias bias-${result.htf.bias}`}>{result.htf.bias.toUpperCase()}</p>
            <p className="reason">{result.htf.reason}</p>
          </div>

          <div className="card">
            <h3>1H structure</h3>
            <p className={`bias bias-${result.mtf.bias}`}>{result.mtf.bias.toUpperCase()}</p>
            <p className="reason">{result.mtf.reason}</p>
            <p className="reason">
              {result.timeframesAgree ? "Agrees with 4H bias." : "Does not agree with 4H bias, this weakens the setup."}
            </p>
          </div>

          <div className="card">
            <h3>30min entry zones</h3>
            <ZoneList zones={result.ltf.fairValueGaps} label="FVG" />
            <ZoneList zones={result.ltf.orderBlocks} label="order block" />
          </div>
        </div>
      )}
    </div>
  );
}

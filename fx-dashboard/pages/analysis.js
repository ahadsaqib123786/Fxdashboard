import { useState } from "react";
import BiasGauge from "../components/BiasGauge";
import GradeBadge from "../components/GradeBadge";
import ConfluenceBreakdown from "../components/ConfluenceBreakdown";
import AnalystNote from "../components/AnalystNote";
import { WATCHLIST } from "../lib/config";

function ZoneList({ zones, label }) {
  if (!zones || zones.length === 0) return <p className="reason">No unmitigated {label} nearby.</p>;
  return (
    <ul>
      {zones.map((z, i) => (
        <li key={i}>
          {z.type} {label}, formed {new Date(z.time).toLocaleString()} — unmitigated
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
      <h1>Full Analysis</h1>
      <p className="subtitle">
        The complete institutional breakdown for a single pair — bias, point of interest quality, liquidity,
        macro context and invalidation. On demand. Atlas complements TradingView; open your own chart there for execution.
      </p>

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
                sublabel={result.qualifies ? "Qualifies as today's opportunity" : result.rejected ? "Rejected before scoring" : "Does not qualify"}
              />
              <div className="best-trade-meta">
                <GradeBadge grade={result.grade} />
                <span className="confluence-points">{result.totalScore}/{result.maxScore}</span>
              </div>
            </div>

            {result.rejected && (
              <p className="reason">{result.rejectionReason}</p>
            )}

            <AnalystNote text={result.aiAnalysis} />
            {result.aiSource === "fallback" && (
              <p className="timestamp">AI narrative unavailable — showing engine-computed summary.</p>
            )}
          </div>

          <ConfluenceBreakdown breakdown={result.breakdown} />

          <div className="card">
            <h3>Higher Timeframe Alignment</h3>
            <p className={`bias bias-${result.daily.bias}`}>Daily: {result.daily.bias.toUpperCase()}</p>
            <p className="reason">{result.daily.reason}</p>
            <p className={`bias bias-${result.htf.bias}`}>4H: {result.htf.bias.toUpperCase()}</p>
            <p className="reason">{result.htf.reason}</p>
            <p className={`bias bias-${result.mtf.bias}`}>1H: {result.mtf.bias.toUpperCase()}</p>
            <p className="reason">{result.mtf.reason}</p>
            <p className="reason">
              {result.timeframesAligned
                ? "Daily, 4H and 1H bias are aligned."
                : "Timeframes are not aligned — this alone is reason to wait."}
            </p>
          </div>

          <div className="card">
            <h3>Point of Interest &amp; Liquidity</h3>
            {result.poi ? (
              <p className="reason">{result.poi.description}</p>
            ) : (
              <p className="reason">No qualifying point of interest for this pair right now.</p>
            )}
            {result.liquidityTarget && <p className="reason">{result.liquidityTarget.description}</p>}
            <h4 style={{ marginTop: 16 }}>30M fair value gaps</h4>
            <ZoneList zones={result.ltf?.fairValueGaps} label="FVG" />
            <h4 style={{ marginTop: 16 }}>30M order blocks</h4>
            <ZoneList zones={result.ltf?.orderBlocks} label="order block" />
          </div>

          <div className="card">
            <h3>Session &amp; Macro</h3>
            <p className="reason">Current session: {result.session}</p>
          </div>

          {result.invalidation && result.invalidation.length > 0 && (
            <div className="card">
              <h3>What Would Invalidate This Setup</h3>
              <ul>
                {result.invalidation.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

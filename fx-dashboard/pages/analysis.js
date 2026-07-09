import { useState } from "react";
import GradeBadge from "../components/GradeBadge";
import AnalystNote from "../components/AnalystNote";
import { WATCHLIST } from "../lib/config";

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
      <h1>AI Analysis</h1>
      <p className="subtitle">
        Institutional analysis for any currency pair. Select a pair and receive a detailed breakdown.
      </p>

      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="controls" style={{ margin: 0, flexWrap: "wrap" }}>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{ flex: 1, minWidth: 120 }}
          >
            {WATCHLIST.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button onClick={runAnalysis} disabled={loading} style={{ minWidth: 120 }}>
            {loading ? "Analysing..." : "Analyse"}
          </button>
        </div>
      </div>

      {error && <p className="error">Error: {error}</p>}

      {loading && !result && (
        <div>
          <div className="card skeleton-card">
            <div className="skeleton skeleton-line skeleton-line-short" style={{ margin: "0 auto 12px" }} />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line skeleton-line-medium" />
          </div>
        </div>
      )}

      {result && (
        <div>
          <div className={`card ${result.qualifies ? "highlight" : ""}`} style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700 }}>{result.symbol}</div>
                <p className={`bias bias-${result.direction || "neutral"}`} style={{ margin: "4px 0 0" }}>
                  {result.direction ? result.direction.toUpperCase() : "NEUTRAL"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GradeBadge grade={result.grade} />
                <span className="confluence-points" style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", color: "var(--accent-gold)" }}>
                  {result.totalScore}/{result.maxScore}
                </span>
              </div>
            </div>

            {result.rejected && (
              <p className="reason" style={{ marginBottom: 16 }}>{result.rejectionReason}</p>
            )}

            <AnalystNote text={result.aiAnalysis} />
            {result.aiSource === "fallback" && (
              <p className="timestamp" style={{ marginTop: 12 }}>
                AI narrative unavailable — showing engine-computed summary.
              </p>
            )}
          </div>

          <div className="card analysis-card">
            <div className="analysis-section">
              <div className="analysis-section-title">Daily Structure</div>
              <p className={`bias bias-${result.daily.bias}`}>{result.daily.bias.toUpperCase()}</p>
              <p className="analysis-section-content">{result.daily.reason}</p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">4H Structure</div>
              <p className={`bias bias-${result.htf.bias}`}>{result.htf.bias.toUpperCase()}</p>
              <p className="analysis-section-content">{result.htf.reason}</p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">1H Structure</div>
              <p className={`bias bias-${result.mtf.bias}`}>{result.mtf.bias.toUpperCase()}</p>
              <p className="analysis-section-content">{result.mtf.reason}</p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Liquidity</div>
              <p className="analysis-section-content">
                {result.liquidityTarget ? result.liquidityTarget.description : "No liquidity target identified."}
              </p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Order Blocks</div>
              {result.ltf?.orderBlocks && result.ltf.orderBlocks.length > 0 ? (
                <ul className="zone-list">
                  {result.ltf.orderBlocks.map((z, i) => (
                    <li key={i}>{z.type} order block, formed {new Date(z.time).toLocaleString()} — unmitigated</li>
                  ))}
                </ul>
              ) : (
                <p className="analysis-section-content">No unmitigated order blocks nearby.</p>
              )}
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Fair Value Gaps</div>
              {result.ltf?.fairValueGaps && result.ltf.fairValueGaps.length > 0 ? (
                <ul className="zone-list">
                  {result.ltf.fairValueGaps.map((z, i) => (
                    <li key={i}>{z.type} FVG, formed {new Date(z.time).toLocaleString()} — unmitigated</li>
                  ))}
                </ul>
              ) : (
                <p className="analysis-section-content">No unmitigated fair value gaps nearby.</p>
              )}
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Premium / Discount</div>
              <p className="analysis-section-content">
                {result.poi ? result.poi.description : "No qualifying point of interest for this pair."}
              </p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Fundamental Outlook</div>
              <p className="analysis-section-content">Current session: {result.session}</p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Execution Status</div>
              <p className="analysis-section-content">
                {result.qualifies
                  ? "Institutional setup available."
                  : result.rejected
                  ? `Rejected — ${result.rejectionReason}`
                  : "Setup does not currently qualify."}
              </p>
            </div>

            <div className="analysis-section">
              <div className="analysis-section-title">Overall Confidence</div>
              <p className="analysis-section-content" style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", color: "var(--accent-gold)" }}>
                {result.totalScore}/{result.maxScore}
              </p>
            </div>

            {result.invalidation && result.invalidation.length > 0 && (
              <div className="analysis-section">
                <div className="analysis-section-title">Invalidation Conditions</div>
                <ul>
                  {result.invalidation.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="disclaimer">
            Atlas identifies institutional context, not execution. Entry, stop and target remain the trader&apos;s decision.
          </p>
        </div>
      )}
    </div>
  );
}

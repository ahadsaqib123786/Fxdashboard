import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MarketStatusBanner from "../components/MarketStatusBanner";
import BestTradeCard from "../components/BestTradeCard";
import AnalystNote from "../components/AnalystNote";
import WaitState from "../components/WaitState";
import DashboardSkeleton from "../components/DashboardSkeleton";
import { REFRESH_MS } from "../lib/config";

export default function MarketPulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const runScan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scan");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runScan();
    const id = setInterval(runScan, REFRESH_MS);
    return () => clearInterval(id);
  }, [runScan]);

  if (loading && !data) {
    return (
      <div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p className="error" style={{ marginBottom: 16 }}>Unable to load market data.</p>
          <button onClick={runScan} className="btn-refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { marketStatus, bestTrade, aiSummary, aiSource, scannedAt } = data;

  return (
    <div>
      <div className="card" style={{ textAlign: "center", padding: "20px", marginBottom: 20 }}>
        <div className="atlas-logo">
          <div className="atlas-logo-mark" />
          <span className="atlas-logo-text">Atlas</span>
        </div>
        <p className="subtitle" style={{ margin: 0, fontSize: "0.82rem" }}>
          Today&apos;s Institutional Outlook
        </p>
      </div>

      {bestTrade ? (
        <>
          <BestTradeCard trade={bestTrade} />

          <MarketStatusBanner status={marketStatus.status} headline={marketStatus.headline} />

          <div className="card ai-card">
            <div className="card-label" style={{ textAlign: "center", marginBottom: 12, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>
              Institutional AI Analysis
            </div>
            {aiSummary ? (
              <AnalystNote text={aiSummary} />
            ) : (
              <p className="reason" style={{ textAlign: "center" }}>Analysis unavailable.</p>
            )}
            {aiSource === "fallback" && (
              <p className="timestamp" style={{ textAlign: "center", marginTop: 12 }}>
                AI narrative unavailable — showing engine-computed summary.
              </p>
            )}
          </div>

          <div className="card execution-card">
            <div className="execution-label">Execution Status</div>
            <div className="execution-status">
              {bestTrade.qualifies
                ? "Institutional setup available."
                : bestTrade.poi
                ? `Waiting for a fresh 30M ${bestTrade.direction === "buy" ? "bullish" : "bearish"} Order Block.`
                : "Setup building — monitoring for confirmation."}
            </div>
          </div>
        </>
      ) : (
        <MarketStatusBanner status={marketStatus.status} headline={marketStatus.headline} />
      )}

      {bestTrade && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="last-updated">
            <span className="last-updated-text">
              Last updated {new Date(scannedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
            </span>
            <button onClick={runScan} disabled={loading} className="btn-refresh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      )}

      {bestTrade && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <Link href="/analysis" className="last-updated-link">
            Open full analysis →
          </Link>
        </div>
      )}

      <p className="disclaimer">
        Atlas identifies institutional context, not execution. Entry, stop and target remain the trader&apos;s decision.
      </p>
    </div>
  );
}

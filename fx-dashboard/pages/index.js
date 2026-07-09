import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MarketStatusBanner from "../components/MarketStatusBanner";
import BestTradeCard from "../components/BestTradeCard";
import ConfluenceBreakdown from "../components/ConfluenceBreakdown";
import WaitState from "../components/WaitState";
import DashboardSkeleton from "../components/DashboardSkeleton";
import { REFRESH_MS } from "../lib/config";

// Market Pulse answers exactly one question: "what is today's highest
// quality institutional opportunity?" — not "what trades should I take?".
// It shows one pair, one opportunity, or an honest "nothing qualifies yet"
// state. No ranked watchlist, no chart, no execution levels here by design;
// the full per-pair breakdown lives on /analysis.
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
        <h1>Market Pulse</h1>
        <p className="subtitle">Scanning the watchlist for institutional-quality setups...</p>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1>Market Pulse</h1>
        <p className="error">Error: {error}</p>
        <button onClick={runScan} style={{ marginTop: 12 }}>Retry scan</button>
      </div>
    );
  }

  const { marketStatus, bestTrade, aiSummary, aiSource, scannedAt, nextScanMs } = data;

  return (
    <div>
      <h1>Market Pulse</h1>
      <p className="subtitle">Today&apos;s single highest-quality institutional opportunity. Refreshed every 15 minutes.</p>

      <MarketStatusBanner status={marketStatus.status} headline={marketStatus.headline} />

      {bestTrade ? (
        <BestTradeCard trade={bestTrade} aiSummary={aiSummary} aiSource={aiSource} />
      ) : (
        <WaitState headline={marketStatus.headline} nextScanMs={nextScanMs} />
      )}

      {bestTrade && <ConfluenceBreakdown breakdown={bestTrade.breakdown} />}

      <p className="timestamp">
        Last scanned {new Date(scannedAt).toLocaleTimeString()} ·{" "}
        <Link href="/analysis">Open full analysis →</Link>
      </p>
    </div>
  );
}

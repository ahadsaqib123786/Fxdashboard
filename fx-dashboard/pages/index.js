import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MarketStatusBanner from "../components/MarketStatusBanner";
import BestTradeCard from "../components/BestTradeCard";
import ConfluenceBreakdown from "../components/ConfluenceBreakdown";
import OpportunityList from "../components/OpportunityList";
import WaitState from "../components/WaitState";
import DashboardSkeleton from "../components/DashboardSkeleton";
import { REFRESH_MS } from "../lib/config";

// Market Pulse: the decision centre. This page answers, in order, the
// questions a trader actually opens the app for — should I trade today,
// which pair, where, and why — before anything else. Charts and watchlists
// are secondary and live on /analysis.
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

  const { marketStatus, bestTrade, opportunities, aiSummary, aiSource, scannedAt, nextScanMs } = data;

  return (
    <div>
      <h1>Market Pulse</h1>
      <p className="subtitle">The decision engine — not another chart. Refreshed every 15 minutes.</p>

      <MarketStatusBanner status={marketStatus.status} headline={marketStatus.headline} />

      {bestTrade ? (
        <BestTradeCard trade={bestTrade} aiSummary={aiSummary} aiSource={aiSource} />
      ) : (
        <WaitState headline={marketStatus.headline} nextScanMs={nextScanMs} />
      )}

      {bestTrade && <ConfluenceBreakdown breakdown={bestTrade.breakdown} />}

      <OpportunityList opportunities={opportunities} />

      <p className="timestamp">
        Last scanned {new Date(scannedAt).toLocaleTimeString()} ·{" "}
        <Link href="/analysis">Open full chart analysis →</Link>
      </p>
    </div>
  );
}

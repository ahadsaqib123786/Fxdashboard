import { useState } from "react";
import BiasGauge from "../components/BiasGauge";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "AUD/JPY", "USD/CAD", "USD/CHF", "NZD/USD"];

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
  const [symbol, setSymbol] = useState("EUR/USD");
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
      <p className="subtitle">Checks 4H bias, 1H structure, and 30min order blocks / fair value gaps for confluence.</p>

      <div className="controls">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {PAIRS.map((p) => (
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
          <div className={`card ${result.confluence ? "highlight" : ""}`}>
            <BiasGauge
              score={result.htf.bias === "buy" ? 40 : result.htf.bias === "sell" ? -40 : 0}
              bias={result.htf.bias}
              label={result.symbol}
              sublabel={result.confluence ? "Confluence found" : "No clean setup"}
            />
            <p className="ai-text">{result.aiAnalysis}</p>
          </div>

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

import { useState } from "react";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "AUD/JPY", "USD/CAD", "USD/CHF", "NZD/USD"];

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
        <div className="card">
          <h2>{result.symbol}</h2>
          <p className={`bias bias-${result.bias}`}>{result.bias.toUpperCase()}</p>
          <p className="reason"><strong>Rule based reason:</strong> {result.reason}</p>
          <p className="ai-text"><strong>AI analysis:</strong> {result.aiAnalysis}</p>
        </div>
      )}
    </div>
  );
}

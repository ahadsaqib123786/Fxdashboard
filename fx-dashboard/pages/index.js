import { useEffect, useState } from "react";
import BiasGauge from "../components/BiasGauge";

const REFRESH_MS = 15 * 60 * 1000; // 15 minutes, tune based on your Twelve Data credit budget

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchStrength() {
    setLoading(true);
    try {
      const res = await fetch("/api/strength");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStrength();
    const id = setInterval(fetchStrength, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) return <p className="reason">Reading today's strongest pair...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  const { strongest, ranked, updatedAt } = data;

  return (
    <div>
      <h1>Today's Strongest Pair</h1>
      <p className="subtitle">Ranked by momentum, volatility expansion, and structure across your watchlist.</p>

      <div className="card highlight">
        <BiasGauge score={strongest.score} bias={strongest.bias} label={strongest.symbol} />
        <p className="reason" style={{ marginTop: 16 }}>{strongest.reason}</p>
        <p className="timestamp">Updated {new Date(updatedAt).toLocaleTimeString()}</p>
      </div>

      <h3 style={{ margin: "24px 0 4px 4px" }}>Full Watchlist</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Bias</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p) => (
            <tr key={p.symbol}>
              <td>{p.symbol}</td>
              <td className={`bias-${p.bias}`}>{p.bias}</td>
              <td>{p.score.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

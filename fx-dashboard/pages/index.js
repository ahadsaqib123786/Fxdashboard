import { useEffect, useState } from "react";

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

  if (loading && !data) return <p>Loading today's strongest pair...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  const { strongest, ranked, updatedAt } = data;

  return (
    <div>
      <h1>Today's Strongest Pair</h1>
      <div className="card highlight">
        <h2>{strongest.symbol}</h2>
        <p className={`bias bias-${strongest.bias}`}>{strongest.bias.toUpperCase()}</p>
        <p className="reason">{strongest.reason}</p>
        <p className="timestamp">Updated {new Date(updatedAt).toLocaleTimeString()}</p>
      </div>

      <h3>Full Watchlist</h3>
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

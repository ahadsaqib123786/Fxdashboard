import { useEffect, useState } from "react";

export default function News() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">Error: {error}</p>;
  if (!data) return <p>Loading news calendar...</p>;

  return (
    <div>
      <h1>News Calendar</h1>

      <h3>Upcoming</h3>
      <table className="table">
        <thead>
          <tr><th>Date</th><th>Country</th><th>Event</th><th>Impact</th></tr>
        </thead>
        <tbody>
          {data.upcoming.map((e, i) => (
            <tr key={i}>
              <td>{new Date(e.date).toLocaleString()}</td>
              <td>{e.country}</td>
              <td>{e.title}</td>
              <td className={`impact-${(e.impact || "").toLowerCase()}`}>{e.impact}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Past (this week)</h3>
      <table className="table">
        <thead>
          <tr><th>Date</th><th>Country</th><th>Event</th><th>Impact</th><th>Actual vs Forecast</th><th>Bias</th></tr>
        </thead>
        <tbody>
          {data.past.map((e, i) => (
            <tr key={i}>
              <td>{new Date(e.date).toLocaleString()}</td>
              <td>{e.country}</td>
              <td>{e.title}</td>
              <td className={`impact-${(e.impact || "").toLowerCase()}`}>{e.impact}</td>
              <td>{e.actual ?? "-"} / {e.forecast ?? "-"}</td>
              <td className={`bias-${e.bias}`}>{e.bias}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

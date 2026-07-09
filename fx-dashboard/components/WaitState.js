export default function WaitState({ headline, nextScanMs }) {
  const minutes = Math.round((nextScanMs || 0) / 60000);
  return (
    <div className="card">
      <div className="wait-state">
        <div className="wait-state-icon" />
        <div className="wait-state-title">No institutional setup currently exists.</div>
        <p className="reason">{headline}</p>
        {minutes > 0 && <p className="timestamp">Next scan in ~{minutes} minutes.</p>}
      </div>
    </div>
  );
}

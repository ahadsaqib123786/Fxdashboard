import { STATUS } from "../lib/marketStatus";

const DOT_COLOR = {
  [STATUS.DISPLAY]: "status-dot-green",
  [STATUS.WATCHLIST]: "status-dot-neutral",
  [STATUS.NO_SETUPS]: "status-dot-neutral",
  [STATUS.NEWS]: "status-dot-red",
  [STATUS.CLOSED]: "status-dot-neutral",
};

export default function MarketStatusBanner({ status, headline }) {
  const dotClass = DOT_COLOR[status] || "status-dot-neutral";
  return (
    <div className="card phase-card">
      <div className="phase-label">Market Phase</div>
      <div className="phase-status">{status}</div>
      <p className="phase-headline">{headline}</p>
    </div>
  );
}

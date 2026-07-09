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
    <div className="status-banner" role="status">
      <span className={`status-dot ${dotClass}`} aria-hidden="true" />
      <div className="status-text">
        <span className="status-label">{status}</span>
        <span className="status-headline">{headline}</span>
      </div>
    </div>
  );
}

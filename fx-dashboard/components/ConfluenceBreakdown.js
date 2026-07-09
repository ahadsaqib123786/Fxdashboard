const FACTOR_LABELS = {
  htfTrend: "4H Trend",
  htfStructure: "4H BOS",
  mtfStructure: "1H BOS",
  ltfConfirmation: "30M Confirm",
  orderBlock: "Order Block",
  fairValueGap: "Fair Value Gap",
  liquiditySweep: "Liquidity Sweep",
  premiumDiscount: "Premium/Discount",
  sessionTiming: "Session Timing",
  newsFilter: "News Filter",
};

export default function ConfluenceBreakdown({ breakdown }) {
  return (
    <div className="card">
      <h3>Confluence Breakdown</h3>
      {Object.entries(breakdown).map(([key, factor]) => {
        const pct = factor.max ? (factor.points / factor.max) * 100 : 0;
        return (
          <div key={key}>
            <div className="confluence-row">
              <span className="confluence-name">{FACTOR_LABELS[key] || key}</span>
              <span className="confluence-track">
                <span
                  className={`confluence-fill ${factor.points === 0 ? "zero" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="confluence-points">{factor.points}/{factor.max}</span>
            </div>
            <p className="confluence-note">{factor.note}</p>
          </div>
        );
      })}
    </div>
  );
}

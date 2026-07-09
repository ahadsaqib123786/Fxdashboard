const FACTOR_LABELS = {
  dailyBias: "Daily Bias",
  htfBias: "4H Bias",
  htfStructure: "4H Structure",
  mtfBias: "1H Bias",
  mtfStructure: "1H Structure",
  ltfConfirmation: "30M Confirmation",
  nestedPOI: "Nested POI",
  freshUntouchedPOI: "Fresh / Untouched POI",
  liquiditySweep: "Liquidity Sweep",
  fairValueGap: "Fair Value Gap",
  premiumDiscount: "Premium/Discount",
  sessionTiming: "Session Timing",
  macroConditions: "Macro Conditions",
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

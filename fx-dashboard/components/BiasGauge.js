// The signature visual element of the product: a semicircle instrument dial
// that points toward sell, neutral, or buy based on the computed score.
// Used consistently across the Dashboard and AI Analysis tabs.

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export default function BiasGauge({ score = 0, bias = "neutral", label, sublabel }) {
  const clamped = Math.max(-60, Math.min(60, score));
  const needleAngle = 90 - (clamped / 60) * 90;
  const tip = polar(100, 100, 74, needleAngle);
  const base1 = polar(100, 100, 6, needleAngle + 90);
  const base2 = polar(100, 100, 6, needleAngle - 90);

  const sellArc = "M10,100 A90,90 0 0,1 55,22.06";
  const neutralArc = "M55,22.06 A90,90 0 0,1 145,22.06";
  const buyArc = "M145,22.06 A90,90 0 0,1 190,100";

  const biasColor =
    bias === "buy" ? "var(--buy)" : bias === "sell" ? "var(--sell)" : "var(--text-tertiary)";

  return (
    <div className="gauge">
      <svg viewBox="0 0 200 112" className="gauge-svg">
        <path d={sellArc} className="gauge-band gauge-band-sell" />
        <path d={neutralArc} className="gauge-band gauge-band-neutral" />
        <path d={buyArc} className="gauge-band gauge-band-buy" />
        <polygon
          points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
          className="gauge-needle"
        />
        <circle cx="100" cy="100" r="7" className="gauge-hub" />
      </svg>
      <div className="gauge-readout">
        {label && <div className="gauge-label">{label}</div>}
        <div className="gauge-bias" style={{ color: biasColor }}>
          {bias.toUpperCase()}
        </div>
        {sublabel && <div className="gauge-sublabel">{sublabel}</div>}
      </div>
    </div>
  );
}

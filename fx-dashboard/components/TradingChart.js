import { useEffect, useRef, useState } from "react";

const TIMEFRAMES = ["5M", "15M", "30M", "1H", "4H", "D"];

const OVERLAY_TOGGLES = [
  { key: "structure", label: "BOS / CHOCH" },
  { key: "orderBlocks", label: "Order Blocks" },
  { key: "fvgs", label: "Fair Value Gaps" },
  { key: "liquidity", label: "Equal Highs / Lows" },
  { key: "sweeps", label: "Liquidity Sweeps" },
  { key: "premiumDiscount", label: "Premium / Discount" },
  { key: "previousDay", label: "Prev Day High / Low" },
  { key: "sessionAsian", label: "Asian Session Range" },
  { key: "sessionLondon", label: "London Session Range" },
  { key: "sessionNY", label: "New York Session Range" },
];

function toUnixTime(t) {
  const iso = t.includes(" ") ? t.replace(" ", "T") + "Z" : t + "T00:00:00Z";
  return Math.floor(new Date(iso).getTime() / 1000);
}

export default function TradingChart({ symbol }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const chartLibRef = useRef(null);

  const [timeframe, setTimeframe] = useState("4H");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ohlc, setOhlc] = useState(null);
  const [toggles, setToggles] = useState(
    Object.fromEntries(OVERLAY_TOGGLES.map((o) => [o.key, o.key === "structure" || o.key === "orderBlocks" || o.key === "fvgs"]))
  );

  // Create the chart once on mount
  useEffect(() => {
    let disposed = false;

    import("lightweight-charts").then((lib) => {
      if (disposed || !containerRef.current) return;
      chartLibRef.current = lib;

      const chart = lib.createChart(containerRef.current, {
        layout: {
          background: { type: lib.ColorType.Solid, color: "#10141D" },
          textColor: "#9198A9",
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        },
        grid: {
          vertLines: { color: "#1B2230" },
          horzLines: { color: "#1B2230" },
        },
        crosshair: { mode: lib.CrosshairMode.Normal },
        timeScale: { borderColor: "#232B3B", timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderColor: "#232B3B" },
        width: containerRef.current.clientWidth,
        height: 480,
      });

      const series = chart.addCandlestickSeries({
        upColor: "#4CAF8C",
        downColor: "#D67B84",
        borderVisible: false,
        wickUpColor: "#4CAF8C",
        wickDownColor: "#D67B84",
      });

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData) {
          setOhlc(null);
          return;
        }
        const bar = param.seriesData.get(series);
        if (bar) setOhlc(bar);
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries[0] || !chartRef.current) return;
        chartRef.current.applyOptions({ width: entries[0].contentRect.width });
      });
      resizeObserver.observe(containerRef.current);

      chart._resizeObserver = resizeObserver;
    });

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current._resizeObserver?.disconnect();
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Fetch candles + overlays whenever symbol or timeframe changes
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setPayload(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [symbol, timeframe]);

  // Push candle data into the chart when it arrives
  useEffect(() => {
    if (!seriesRef.current || !payload) return;
    const data = payload.candles.map((c) => ({
      time: toUnixTime(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [payload]);

  // Redraw overlays whenever the data or toggles change
  useEffect(() => {
    const series = seriesRef.current;
    const lib = chartLibRef.current;
    if (!series || !lib || !payload) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];

    const addLine = (price, color, title, dashed = true) => {
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: dashed ? lib.LineStyle.Dashed : lib.LineStyle.Solid,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(line);
    };

    const { overlays } = payload;
    const goldGuide = "#C9A567";
    const buy = "#4CAF8C";
    const sell = "#D67B84";

    if (toggles.orderBlocks) {
      overlays.orderBlocks
        .filter((z) => !z.mitigated)
        .forEach((z) => {
          const color = z.type === "bullish" ? buy : sell;
          addLine(z.top, color, `OB ${z.type} top`);
          addLine(z.bottom, color, `OB ${z.type} bot`);
        });
    }

    if (toggles.fvgs) {
      overlays.fvgs
        .filter((z) => !z.mitigated)
        .forEach((z) => {
          const color = z.type === "bullish" ? buy : sell;
          addLine(z.top, color, "FVG top");
          addLine(z.bottom, color, "FVG bot");
        });
    }

    if (toggles.liquidity) {
      overlays.liquidity.equalHighs.forEach((l) => addLine(l.price, sell, `EQH x${l.touches}`));
      overlays.liquidity.equalLows.forEach((l) => addLine(l.price, buy, `EQL x${l.touches}`));
    }

    if (toggles.premiumDiscount) {
      const pd = overlays.premiumDiscount;
      addLine(pd.high, sell, "Premium");
      addLine(pd.equilibrium, goldGuide, "Equilibrium");
      addLine(pd.low, buy, "Discount");
    }

    if (toggles.previousDay && overlays.previousDay) {
      addLine(overlays.previousDay.high, "#8A93A6", "PDH");
      addLine(overlays.previousDay.low, "#8A93A6", "PDL");
    }

    const sessionMap = { sessionAsian: "Asian", sessionLondon: "London", sessionNY: "New York" };
    Object.entries(sessionMap).forEach(([key, name]) => {
      if (toggles[key] && overlays.sessions[name]) {
        addLine(overlays.sessions[name].high, "#5C6479", `${name} high`, true);
        addLine(overlays.sessions[name].low, "#5C6479", `${name} low`, true);
      }
    });

    // Structure (BOS/CHOCH) and liquidity sweeps are point events, use markers
    const markers = [];
    if (toggles.structure) {
      overlays.structure.forEach((e) => {
        markers.push({
          time: toUnixTime(e.time),
          position: e.direction === "bullish" ? "belowBar" : "aboveBar",
          color: e.type === "CHOCH" ? goldGuide : e.direction === "bullish" ? buy : sell,
          shape: e.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: e.type,
        });
      });
    }
    if (toggles.sweeps) {
      overlays.sweeps.forEach((s) => {
        markers.push({
          time: toUnixTime(s.time),
          position: s.type === "bullish" ? "belowBar" : "aboveBar",
          color: "#C9A567",
          shape: "circle",
          text: "Sweep",
        });
      });
    }
    markers.sort((a, b) => a.time - b.time);
    series.setMarkers(markers);
  }, [payload, toggles]);

  const toggle = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }));

  return (
    <div className="card chart-card">
      <div className="chart-toolbar">
        <div className="timeframe-group">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`tf-btn ${tf === timeframe ? "tf-btn-active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        {ohlc && (
          <div className="ohlc-readout">
            <span>O {ohlc.open?.toFixed(5)}</span>
            <span>H {ohlc.high?.toFixed(5)}</span>
            <span>L {ohlc.low?.toFixed(5)}</span>
            <span>C {ohlc.close?.toFixed(5)}</span>
          </div>
        )}
      </div>

      {error && <p className="error">Error: {error}</p>}
      {loading && !payload && <p className="reason">Loading chart...</p>}

      <div ref={containerRef} className="chart-container" />

      <div className="overlay-toggles">
        {OVERLAY_TOGGLES.map((o) => (
          <label key={o.key} className="overlay-toggle">
            <input type="checkbox" checked={toggles[o.key]} onChange={() => toggle(o.key)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

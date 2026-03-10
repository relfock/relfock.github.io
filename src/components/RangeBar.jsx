import { RANGE_BAR_FILL } from "../constants/rangeColors.js";

/**
 * Build horizontal range bar segments and value position (0–100) for table view.
 * Uses a capped display range so the "high" segment doesn't dominate the bar.
 */
export function buildRangeBar(b, numericValue) {
  const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
  const sufEnabled = b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0);
  const highEnabled = b.high && b.high[0] < 9999 && !(b.high[0] === 0 && b.high[1] === 0);
  const optHigh = b.optimal[1] > 900 ? null : b.optimal[1];

  const allVals = [b.optimal[0]];
  if (optHigh) allVals.push(optHigh);
  if (lowEnabled) allVals.push(b.low[0], b.low[1]);
  if (sufEnabled) allVals.push(b.sufficient[0], b.sufficient[1]);
  if (highEnabled) allVals.push(b.high[0]);
  const valid = allVals.filter((v) => v != null && isFinite(v));
  const rawMin = valid.length ? Math.min(...valid) : 0;
  const rawMax = valid.length ? Math.max(...valid) : 100;
  const optWidth = optHigh != null ? optHigh - b.optimal[0] : (b.sufficient && b.sufficient[1] < 9000 ? b.sufficient[1] - b.sufficient[0] : 50);
  const rawHighEnd = highEnabled ? b.high[1] : null;
  const normalSpan = highEnabled ? b.high[0] - rawMin : Math.max(rawMax - rawMin, 1);
  const highAdd = optWidth > 0 ? optWidth : Math.max(normalSpan * 0.25, 0.1);
  const displayMax = highEnabled
    ? Math.min(rawHighEnd >= 9999 ? Infinity : rawHighEnd, b.high[0] + highAdd)
    : (optHigh == null ? b.optimal[0] + highAdd : rawMax);
  const lowRangeWidth = lowEnabled ? b.low[1] - rawMin : 0;
  const lowDisplayWidth = lowEnabled && lowRangeWidth > 0
    ? Math.min(optWidth > 0 ? optWidth * 0.5 : highAdd, lowRangeWidth * 0.25, 18)
    : (optWidth > 0 ? optWidth : highAdd);
  const displayMin = lowEnabled && b.low[1] > rawMin
    ? Math.max(rawMin, b.low[1] - lowDisplayWidth)
    : rawMin;
  const rangeMin = displayMin;
  const rangeMax = Math.max(displayMax, rangeMin + 0.001);
  const span = rangeMax - rangeMin || 1;
  const clamp = (v) => Math.max(rangeMin, Math.min(rangeMax, v));
  const toPct = (v) => ((clamp(v) - rangeMin) / span) * 100;

  const segments = [];
  let prev = rangeMin;
  const fill = RANGE_BAR_FILL;

  if (lowEnabled && b.low[1] > prev) {
    const end = clamp(b.low[1]);
    segments.push({ pct: toPct(end) - toPct(prev), fill: fill.low });
    prev = end;
  }
  if (sufEnabled && b.sufficient[0] < b.optimal[0] && b.optimal[0] > prev) {
    const end = clamp(b.optimal[0]);
    const start = Math.max(prev, b.sufficient[0]);
    if (end > start) segments.push({ pct: toPct(end) - toPct(start), fill: fill.sufficient });
    prev = end;
  }
  const optEnd = optHigh != null ? clamp(optHigh) : rangeMax;
  if (optEnd > prev) {
    const start = Math.max(prev, b.optimal[0]);
    segments.push({ pct: toPct(optEnd) - toPct(start), fill: fill.optimal });
    prev = optEnd;
  }
  if (sufEnabled && optHigh != null && (highEnabled ? b.high[0] : b.sufficient[1]) > prev) {
    const end = highEnabled ? clamp(b.high[0]) : clamp(Math.min(b.sufficient[1], rangeMax));
    if (end > prev) segments.push({ pct: toPct(end) - toPct(prev), fill: fill.sufficient });
    prev = end;
  }
  if (highEnabled && rangeMax > prev) {
    segments.push({ pct: toPct(rangeMax) - toPct(prev), fill: b.eliteZone ? fill.elite : fill.high });
  }

  if (segments.length === 0) segments.push({ pct: 100, fill: "rgba(128,128,128,0.35)" });

  const valuePos = !Number.isNaN(numericValue) && isFinite(numericValue)
    ? Math.max(0, Math.min(100, ((numericValue - rangeMin) / span) * 100))
    : null;

  return { segments, valuePos };
}

export function RangeBarSegments({ segments, valuePos, height = 20 }) {
  const total = segments.reduce((s, seg) => s + seg.pct, 0);
  const scale = total > 0 ? 100 / total : 1;
  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: 6, overflow: "visible" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", background: "rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          {segments.map((seg, i) => (
            <div key={i} style={{ width: `${seg.pct * scale}%`, background: seg.fill, flexShrink: 0, minWidth: 1 }} />
          ))}
        </div>
      </div>
      {valuePos != null && (
        <div
          style={{
            position: "absolute",
            left: `${valuePos}%`,
            top: -2,
            bottom: -2,
            width: 5,
            transform: "translateX(-50%)",
            background: "#0a0a0a",
            boxShadow: "0 0 0 2px #fff",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

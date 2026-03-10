import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { BIOMARKER_DB } from "../data/biomarkerDb.js";
import { getCalculatedFrom } from "../data/derivedBiomarkers.js";
import { parseLabValue } from "../utils/parseLabValue.js";
import { getStatus, statusColor } from "../utils/rangeStatus.js";
import { RANGE_BAND_FILL, RANGE_COLORS, RANGE_BG } from "../constants/rangeColors.js";
import { MonitorFrequencyBadge } from "./MonitorFrequencyBadge.jsx";

export function TrendDetail({ name, personEntries, onBack, themeColors }) {
  const b = BIOMARKER_DB[name];
  if (!b) return null;
  const data = personEntries
    .filter((e) => e.biomarkers?.[name] !== undefined)
    .map((e) => {
      const parsed = parseLabValue(e.biomarkers[name]);
      return {
        date: e.date,
        value: parsed.numeric,
        displayValue: parsed.display,
        status: getStatus(name, parsed.numeric),
        label: new Date(e.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        year: new Date(e.date + "T12:00:00").getFullYear(),
      };
    });

  const latestVal = data[data.length - 1]?.value;
  const latestDisplay = data[data.length - 1]?.displayValue;
  const status = getStatus(name, latestVal);

  const computeBands = () => {
    if (data.length === 0) return { bands: [], yDomain: [0, 100], ticks: [] };
    const dataVals = data.map((d) => d.value);
    const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
    const sufEnabled = b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0);
    const highEnabled = b.high && b.high[0] < 9000;
    const optHigh = b.optimal[1] > 900 ? null : b.optimal[1];
    const boundaries = [b.optimal[0]];
    if (optHigh) boundaries.push(optHigh);
    if (lowEnabled) boundaries.push(b.low[1]);
    if (sufEnabled && b.sufficient[1] < 9000) boundaries.push(b.sufficient[0], b.sufficient[1]);
    if (highEnabled) boundaries.push(b.high[0]);
    const allVals = [...dataVals, ...boundaries.filter((v) => v != null)];
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const span = rawMax - rawMin || rawMax * 0.4 || 10;
    const yMin = rawMin - span * 0.35;
    const yMax = rawMax + span * 0.35;
    const clamp = (v) => Math.max(yMin, Math.min(yMax, v));
    const bands = [];
    const lowCeil = lowEnabled ? clamp(b.low[1]) : (sufEnabled && b.sufficient[0] < b.optimal[0] ? clamp(b.sufficient[0]) : clamp(b.optimal[0]));
    bands.push({ y1: yMin, y2: lowCeil, fill: RANGE_BAND_FILL.low, id: "low" });
    if (sufEnabled && b.sufficient[0] < b.optimal[0]) {
      const sufStart = lowEnabled ? clamp(b.low[1]) : yMin;
      const sufEnd = clamp(b.optimal[0]);
      if (sufEnd > sufStart) bands.push({ y1: sufStart, y2: sufEnd, fill: RANGE_BAND_FILL.sufficient, id: "suf-low" });
    }
    const optStart = clamp(b.optimal[0]);
    const optEnd = optHigh ? clamp(optHigh) : yMax;
    bands.push({ y1: optStart, y2: optEnd, fill: RANGE_BAND_FILL.optimal, id: "optimal" });
    if (sufEnabled && optHigh) {
      const sufAboveEnd = (highEnabled && b.high[0] < b.sufficient[1]) ? clamp(b.high[0]) : (b.sufficient[1] < 9000 ? clamp(b.sufficient[1]) : yMax);
      if (sufAboveEnd > optEnd) bands.push({ y1: optEnd, y2: sufAboveEnd, fill: RANGE_BAND_FILL.sufficient, id: "suf-high" });
    }
    const highStart = highEnabled ? clamp(b.high[0]) : (sufEnabled && b.sufficient[1] < 9000 ? clamp(b.sufficient[1]) : (optHigh ? clamp(optHigh) : yMax));
    if (highStart < yMax) {
      const highFill = b.eliteZone ? RANGE_BAND_FILL.elite : RANGE_BAND_FILL.high;
      bands.push({ y1: highStart, y2: yMax, fill: highFill, id: "high" });
    }
    const tickSet = new Set(boundaries.filter((v) => v != null && v >= yMin && v <= yMax).map((v) => parseFloat(v.toFixed(2))));
    const ticks = [...tickSet].sort((a, c) => a - c);
    return { bands, yDomain: [yMin, yMax], ticks };
  };

  const { bands, yDomain, ticks } = computeBands();

  const CustomXTick = ({ x, y, payload }) => {
    const entry = data.find((d) => d.label === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={14} textAnchor="middle" fill="#6a8aaa" fontSize={11} fontFamily="DM Mono, monospace">{payload.value}</text>
        {entry && <text x={0} y={0} dy={27} textAnchor="middle" fill="#4a6a8a" fontSize={10} fontFamily="DM Mono, monospace">{entry.year}</text>}
      </g>
    );
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const col = statusColor(payload.status);
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill="#050a14" stroke={col} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={5} fill={col} />
        <text x={cx} y={cy - 18} textAnchor="middle" fill={col} fontSize={12} fontWeight="700" fontFamily="Space Grotesk, sans-serif">
          {payload.displayValue ?? payload.value}
        </text>
      </g>
    );
  };

  const CustomActiveDot = (props) => {
    const { cx, cy, payload } = props;
    const col = statusColor(payload.status);
    return (
      <g>
        <circle cx={cx} cy={cy} r={14} fill={col} fillOpacity={0.15} />
        <circle cx={cx} cy={cy} r={10} fill="#050a14" stroke={col} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={5} fill={col} />
      </g>
    );
  };

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 20 }}>← Back</button>
      <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${statusColor(status)}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{b.icon} {name}</div>
            <div style={{ fontSize: 12, color: "#4a6a8a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{b.category} · {b.unit} <MonitorFrequencyBadge frequency={b.monitorFrequency} themeColors={themeColors} />{b.calculated && getCalculatedFrom(name).length > 0 && <span style={{ fontSize: 11, color: "#0ef" }}>Calculated from: {getCalculatedFrom(name).join(", ")}</span>}</div>
          </div>
          {(latestVal !== undefined || latestDisplay) && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1, marginBottom: 2 }}>LATEST</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: statusColor(status), fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>{latestDisplay ?? latestVal}</div>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 6 }}>{b.unit}</div>
              <span className="stat-pill" style={{ background: `${statusColor(status)}22`, color: statusColor(status) }}>{status.toUpperCase()}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "Out of Range / Low", color: RANGE_COLORS.low },
            { label: "Sufficient", color: RANGE_COLORS.sufficient },
            { label: "Optimal", color: RANGE_COLORS.optimal },
            ...(b.eliteZone ? [{ label: "Elite", color: RANGE_COLORS.elite }] : [{ label: "High", color: RANGE_COLORS.high }]),
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 32, height: 12, borderRadius: 6, background: color, opacity: 0.85 }} />
              <span style={{ fontSize: 11, color: "#8aabcc", fontFamily: "DM Mono, monospace" }}>{label}</span>
            </div>
          ))}
        </div>
        {data.length > 0 ? (
          <div style={{ height: 300, marginBottom: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 36, right: 30, bottom: 40, left: 24 }}>
                {bands.map((band, i) => (
                  <ReferenceArea key={i} y1={band.y1} y2={band.y2} fill={band.fill} fillOpacity={1} strokeWidth={0} ifOverflow="visible" />
                ))}
                <CartesianGrid strokeDasharray="0" stroke="rgba(26,48,80,0.4)" vertical={false} />
                <XAxis dataKey="label" stroke="transparent" tick={<CustomXTick />} tickLine={false} axisLine={{ stroke: "#1a3050" }} height={44} />
                <YAxis domain={yDomain} ticks={ticks} stroke="transparent" tick={{ fill: "#6a8aaa", fontSize: 11, fontFamily: "DM Mono, monospace" }} tickLine={false} axisLine={false} tickFormatter={(v) => { const n = parseFloat(v); return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1); }} width={48} />
                <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid #1a3050", borderRadius: 10, color: "#c8d8f0", fontFamily: "DM Mono, monospace", fontSize: 12 }} formatter={(val, _, props) => [<span style={{ color: statusColor(props.payload.status), fontWeight: 700 }}>{(props.payload.displayValue ?? val)} {b.unit}</span>, name]} labelFormatter={(label, payload) => { if (!payload?.[0]) return label; const entry = data.find((d) => d.label === label); return entry ? `${label} ${entry.year}` : label; }} />
                <Line type="monotone" dataKey="value" stroke="rgba(180,210,240,0.5)" strokeWidth={1.5} dot={<CustomDot />} activeDot={<CustomActiveDot />} isAnimationActive={true} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a5a7a", fontSize: 13 }}>No data yet — add entries to see your trend</div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>REFERENCE RANGES</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {b.low && !(b.low[0] === 0 && b.low[1] === 0) && <div className="stat-pill" style={{ background: RANGE_BG.low, color: RANGE_COLORS.low, border: `1px solid ${RANGE_COLORS.low}4D` }}>↓ Low: &lt;{b.low[1]} {b.unit}</div>}
          {b.sufficient && !(b.sufficient[0] === 0 && b.sufficient[1] === 0) && <div className="stat-pill" style={{ background: RANGE_BG.sufficient, color: RANGE_COLORS.sufficient, border: `1px solid ${RANGE_COLORS.sufficient}4D` }}>~ Sufficient: {b.sufficient[0]}–{b.sufficient[1] > 900 ? "∞" : b.sufficient[1]} {b.unit}</div>}
          {b.optimal && <div className="stat-pill" style={{ background: RANGE_BG.optimal, color: RANGE_COLORS.optimal, border: `1px solid ${RANGE_COLORS.optimal}4D` }}>✓ Optimal: {b.optimal[0]}–{b.optimal[1] > 900 ? "∞" : b.optimal[1]} {b.unit}</div>}
          {b.high && b.high[0] < 9999 && <div className="stat-pill" style={{ background: b.eliteZone ? RANGE_BG.elite : RANGE_BG.high, color: b.eliteZone ? RANGE_COLORS.elite : RANGE_COLORS.high, border: `1px solid ${(b.eliteZone ? RANGE_COLORS.elite : RANGE_COLORS.high)}4D` }}>{b.eliteZone ? "★ Elite: " : "↑ High: "}≥{b.high[0]} {b.unit}</div>}
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>ABOUT THIS MARKER</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.description}</p>
        </div>
        <div className="card" style={{ borderLeft: `3px solid ${RANGE_COLORS.optimal}` }}>
          <div style={{ fontSize: 11, color: RANGE_COLORS.optimal, letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>HOW TO IMPROVE</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc" }}>{b.improve}</p>
        </div>
      </div>
    </div>
  );
}

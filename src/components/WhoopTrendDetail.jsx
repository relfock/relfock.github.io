import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { buildFitnessMarkerRows, getFitnessMarkerById } from "../data/whoopFitnessMarkers.js";

/**
 * @param {object} props
 * @param {string} props.markerId
 * @param {object | null} props.cache
 * @param {() => void} props.onBack
 * @param {object} props.themeColors
 */
export function WhoopTrendDetail({ markerId, cache, onBack, themeColors }) {
  const def = getFitnessMarkerById(markerId);
  const rows = buildFitnessMarkerRows(cache);
  const row = rows.find((r) => r.id === markerId);
  const points = row?.points ?? [];
  const label = def?.label ?? markerId;
  const unit = def?.unit ?? "";
  const category = def?.category ?? "WHOOP";

  const data = points.map((p, i) => {
    const d = new Date(p.sortTime);
    return {
      idx: i,
      value: p.value,
      displayValue: p.displayValue,
      tooltipWhen: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    };
  });

  const latest = points[points.length - 1];
  let yDomain = [0, 1];
  let yTicks = [];
  /** @type {[number, number]} */
  let xDomain = [0, 1];
  /** @type {number[]} */
  let xTicks = [];

  if (data.length > 0) {
    const vals = data.map((d) => d.value);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const span = rawMax - rawMin || Math.abs(rawMax) * 0.15 || 1;
    const pad = span * 0.12;
    yDomain = [rawMin - pad, rawMax + pad];
    const mid = (yDomain[0] + yDomain[1]) / 2;
    yTicks = [yDomain[0], mid, yDomain[1]].map((v) => parseFloat(v.toFixed(4)));

    const n = data.length;
    const last = n - 1;
    const xPad = n > 1 ? 0.5 : 0;
    xDomain = [0 - xPad, last + xPad];

    if (n === 1) xTicks = [0];
    else if (n === 2) xTicks = [0, 1];
    else {
      const segments = n > 40 ? 5 : n > 18 ? 4 : 3;
      const set = new Set();
      for (let k = 0; k < segments; k++) {
        set.add(Math.round((k / (segments - 1)) * last));
      }
      xTicks = [...set].sort((a, b) => a - b);
    }
  }

  const lineColor = themeColors.accent || "#5ab0e8";

  const XAxisTick = ({ x, y, payload }) => {
    const i = payload?.value;
    if (i == null || !points[i]) return null;
    const d = new Date(points[i].sortTime);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={14} textAnchor="middle" fill="#6a8aaa" fontSize={11} fontFamily="DM Mono, monospace">
          {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </text>
        <text x={0} y={0} dy={27} textAnchor="middle" fill="#4a6a8a" fontSize={10} fontFamily="DM Mono, monospace">
          {d.getFullYear()}
        </text>
      </g>
    );
  };

  const WhoopChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    return (
      <div
        style={{
          background: "#0a1628",
          border: "1px solid #1a3050",
          borderRadius: 10,
          padding: "10px 12px",
          color: "#c8d8f0",
          fontFamily: "DM Mono, monospace",
          fontSize: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontSize: 11, color: "#6a8aaa", marginBottom: 6 }}>{p.tooltipWhen}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: lineColor, fontFamily: "Space Grotesk, sans-serif" }}>
          {p.displayValue ?? p.value}
          {unit ? <span style={{ fontWeight: 600, color: "#8aabcc", marginLeft: 6 }}>{unit}</span> : null}
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>
      <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 20 }}>
        ← Back
      </button>
      <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${lineColor}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{label}</div>
            <div style={{ fontSize: 12, color: "#4a6a8a" }}>
              {category}
              {unit ? ` · ${unit}` : ""} · WHOOP
            </div>
          </div>
          {latest && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1, marginBottom: 2 }}>LATEST</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: lineColor, fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>
                {latest.displayValue}
              </div>
              {unit ? (
                <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 4 }}>{unit}</div>
              ) : null}
            </div>
          )}
        </div>
        {data.length > 0 ? (
          <div style={{ height: 300, marginBottom: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 24, right: 24, bottom: 44, left: 24 }}>
                <CartesianGrid strokeDasharray="0" stroke="rgba(26,48,80,0.4)" vertical />
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={xDomain}
                  ticks={xTicks}
                  stroke="transparent"
                  tick={<XAxisTick />}
                  tickLine={false}
                  axisLine={{ stroke: "#1a3050" }}
                  height={44}
                />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  stroke="transparent"
                  tick={{ fill: "#6a8aaa", fontSize: 11, fontFamily: "DM Mono, monospace" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const n = parseFloat(v);
                    return Number.isFinite(n) ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)) : String(v);
                  }}
                  width={52}
                />
                <Tooltip content={(tipProps) => <WhoopChartTooltip {...tipProps} />} cursor={{ stroke: `${lineColor}55`, strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: lineColor, stroke: "#050a14", strokeWidth: 2 }}
                  isAnimationActive
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a5a7a", fontSize: 13 }}>
            No data for this marker yet — connect WHOOP and run a full sync.
          </div>
        )}
      </div>
      <div className="card">
        <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>ABOUT</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc", margin: 0 }}>
          Values come from your synced WHOOP data. Use <strong>Sync now</strong> on the Fitness screen to refresh; the first sync loads full
          history from WHOOP (within API limits). Background refreshes only merge recent weeks so older points stay on device.
        </p>
      </div>
    </div>
  );
}

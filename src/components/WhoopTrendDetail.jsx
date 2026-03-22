import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  LabelList,
} from "recharts";
import { Cell } from "recharts";
import { buildFitnessMarkerRows, getFitnessMarkerById } from "../data/whoopFitnessMarkers.js";
import {
  buildWhoopTrendChartSeries,
  WHOOP_TREND_RANGE_KEYS,
  WHOOP_TREND_RANGE_LABELS,
  WHOOP_TREND_DEFAULT_RANGE,
} from "../data/whoopTrendMath.js";
import { endOfLocalYmdMs } from "../data/whoopFitnessDate.js";
import { compareLatestToMonthAverage } from "../data/whoopMarkerDirection.js";
import { getWhoopRecoveryRingColor } from "../data/whoopScoreColors.js";

function fmtAvg(n, unit) {
  if (n == null || Number.isNaN(n)) return "—";
  const u = (unit || "").toLowerCase();
  if (u === "%") return `${n.toFixed(1)}%`;
  if (u === "strain" || u === "bpm" || u === "/min" || u === "count") return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

const PRIOR_RANGE_LABEL = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "6m": "6 months",
  all: "12 months",
};

/**
 * @param {object} props
 * @param {string} props.markerId
 * @param {object | null} props.cache
 * @param {() => void} props.onBack
 * @param {object} props.themeColors
 * @param {boolean} [props.embedded]
 * @param {string} [props.asOfYmd] — local YYYY-MM-DD; trends end at this day (default: today)
 */
export function WhoopTrendDetail({ markerId, cache, onBack, themeColors, embedded = false, asOfYmd }) {
  const def = getFitnessMarkerById(markerId);
  const rows = buildFitnessMarkerRows(cache);
  const row = rows.find((r) => r.id === markerId);
  const points = row?.points ?? [];
  const label = def?.label ?? markerId;
  const unit = def?.unit ?? "";
  const category = def?.category ?? "WHOOP";

  const [rangeKey, setRangeKey] = useState(WHOOP_TREND_DEFAULT_RANGE);

  const trendNowMs = useMemo(
    () => (asOfYmd && /^\d{4}-\d{2}-\d{2}$/.test(asOfYmd) ? endOfLocalYmdMs(asOfYmd) : Date.now()),
    [asOfYmd]
  );

  const { barSeries, bandLow, bandHigh, hasPoints, rangeAvg, priorCompare, chartKind } = useMemo(
    () => buildWhoopTrendChartSeries(points, rangeKey, trendNowMs),
    [points, rangeKey, trendNowMs]
  );

  const rangeVsPrior = useMemo(
    () => compareLatestToMonthAverage(markerId, rangeAvg, priorCompare?.priorAvg),
    [markerId, rangeAvg, priorCompare?.priorAvg]
  );

  const chartData = useMemo(() => {
    if (chartKind === "line") {
      return barSeries.map((b) => ({
        ...b,
        barValue: b.avg != null ? b.avg : 0,
        hasData: b.avg != null,
      }));
    }
    return barSeries.map((b, i) => {
      const prevAvg = i > 0 ? barSeries[i - 1].avg : null;
      const monthTrend = compareLatestToMonthAverage(markerId, b.avg, prevAvg);
      return {
        ...b,
        idx: i,
        barValue: b.avg != null ? b.avg : 0,
        hasData: b.avg != null,
        monthTrend,
      };
    });
  }, [barSeries, chartKind, markerId]);

  const line30TickSet = useMemo(() => {
    if (chartKind !== "line" || rangeKey !== "30d" || chartData.length === 0) return null;
    const last = chartData.length - 1;
    const set = new Set([0, 7, 14, 21, 28]);
    set.add(last);
    return set;
  }, [chartKind, rangeKey, chartData]);

  const dateRangeCaption = useMemo(() => {
    if (chartData.length === 0 || chartKind !== "line") return null;
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    if (!first?.day || !last?.day) return null;
    const opt = { month: "short", day: "numeric", year: "numeric" };
    const a = new Date(first.day + "T12:00:00").toLocaleDateString(undefined, opt).toUpperCase();
    const b = new Date(last.day + "T12:00:00").toLocaleDateString(undefined, opt).toUpperCase();
    return `${a} – ${b}`;
  }, [chartData, chartKind]);

  const insightLine = useMemo(() => {
    if (chartKind !== "line" || rangeAvg == null || bandLow == null || bandHigh == null) return null;
    if (rangeAvg > bandHigh) return "Above your typical range in this window.";
    if (rangeAvg < bandLow) return "Below your typical range in this window.";
    return "Within your typical range in this window.";
  }, [chartKind, rangeAvg, bandLow, bandHigh]);

  const lineColor = useMemo(() => {
    if (markerId === "whoop_recovery_score" && rangeAvg != null && Number.isFinite(Number(rangeAvg))) {
      return getWhoopRecoveryRingColor(rangeAvg);
    }
    return themeColors.accent || "#38bdf8";
  }, [markerId, rangeAvg, themeColors.accent]);

  let yDomain = [0, 1];
  let yTicks = [];
  /** @type {[number, number]} */
  let xDomain = [0, 1];
  /** @type {number[]} */
  let xTicks = [];

  if (chartData.length > 0) {
    const vals = chartData.map((d) => d.avg).filter((v) => v != null);
    if (priorCompare?.currentAvg != null) vals.push(priorCompare.currentAvg);
    if (priorCompare?.priorAvg != null) vals.push(priorCompare.priorAvg);
    if (bandLow != null) vals.push(bandLow);
    if (bandHigh != null) vals.push(bandHigh);
    if (vals.length === 0) {
      yDomain = [0, 1];
      yTicks = [0, 0.5, 1];
    } else {
      const rawMin = Math.min(...vals);
      const rawMax = Math.max(...vals);
      const span = rawMax - rawMin || Math.abs(rawMax) * 0.15 || 1;
      const pad = span * 0.15;
      const labelHeadroom = Math.max(span * 0.22, Math.abs(rawMax) * 0.08 || 0.01);
      yDomain = [rawMin - pad, rawMax + pad + labelHeadroom];
      const mid = (yDomain[0] + yDomain[1]) / 2;
      yTicks = [yDomain[0], mid, yDomain[1]].map((v) => parseFloat(v.toFixed(4)));
    }
    const n = chartData.length;
    const last = n - 1;
    const xPad = n > 1 ? 0.5 : 0;
    xDomain = [0 - xPad, last + xPad];
    if (chartKind === "line" && rangeKey === "7d") xTicks = Array.from({ length: n }, (_, i) => i);
    else if (chartKind === "line" && rangeKey === "30d" && line30TickSet) xTicks = [...line30TickSet].filter((i) => i <= last).sort((a, b) => a - b);
    else if (n <= 7) xTicks = Array.from({ length: n }, (_, i) => i);
    else if (n === 1) xTicks = [0];
    else if (n === 2) xTicks = [0, 1];
    else {
      const segments = Math.min(6, n);
      const set = new Set();
      for (let k = 0; k < segments; k++) {
        set.add(Math.round((k / (segments - 1)) * last));
      }
      xTicks = [...set].sort((a, b) => a - b);
    }
  }

  const XAxisTick = ({ x, y, payload }) => {
    const i = payload?.value;
    const row = chartData[i];
    if (i == null || !row) return null;
    if (chartKind === "line" && rangeKey === "30d" && line30TickSet && !line30TickSet.has(i)) return null;
    let text = row.label;
    if (chartKind === "line") {
      text = rangeKey === "7d" ? row.labelShort : row.labelWeek;
    }
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={14}
          textAnchor="middle"
          fill="#6a8aaa"
          fontSize={chartKind === "line" && rangeKey === "30d" ? 9 : 10}
          fontFamily="DM Mono, monospace"
        >
          {text}
        </text>
      </g>
    );
  };

  function BarDeltaLabel(props) {
    const vb = props.viewBox;
    const pct = props.value;
    if (!vb || pct == null || Number.isNaN(Number(pct))) return null;
    const n = Number(pct);
    const fill = n >= 0 ? "#6acc9a" : "#fb923c";
    const sign = n >= 0 ? "+" : "";
    const cx = vb.x + vb.width / 2;
    const ty = vb.y + vb.height + 14;
    return (
      <text x={cx} y={ty} textAnchor="middle" fill={fill} fontSize={10} fontFamily="DM Mono, monospace" fontWeight={700} style={{ pointerEvents: "none" }}>
        {sign}
        {n.toFixed(0)}%
      </text>
    );
  }

  function barFill(entry) {
    if (chartKind === "line") return lineColor;
    if (markerId === "whoop_recovery_score" && entry.avg != null && Number.isFinite(Number(entry.avg))) {
      return getWhoopRecoveryRingColor(entry.avg);
    }
    const g = entry.monthTrend?.good;
    if (g === true) return "#4ade80";
    if (g === false) return "#fb923c";
    return "#e2e8f0";
  }

  const WhoopChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    const title = chartKind === "line" ? (p.day ? new Date(p.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : p.label) : p.label;
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
        <div style={{ fontSize: 11, color: "#6a8aaa", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: lineColor, fontFamily: "Space Grotesk, sans-serif" }}>
          {p.hasData ? (
            <>
              {fmtAvg(p.avg, unit)}
              {unit?.toLowerCase() === "h" ? " h" : ""}
            </>
          ) : (
            "No data"
          )}
        </div>
        {chartKind === "bar" && p.hasData && p.deltaPct != null && (
          <div style={{ fontSize: 12, color: p.deltaPct >= 0 ? "#6acc9a" : "#fb923c", marginTop: 6 }}>
            {p.deltaPct >= 0 ? "+" : ""}
            {p.deltaPct.toFixed(1)}% vs prior month
          </div>
        )}
      </div>
    );
  };

  const showChart = points.length > 0 && hasPoints;
  const showEmptyRange = points.length > 0 && !hasPoints;
  const priorDeltaPct = priorCompare?.deltaPct;
  const chartBottom = chartKind === "line" ? (rangeKey === "7d" ? 58 : 52) : 56;
  const chartTop = chartKind === "line" && rangeKey === "7d" ? 36 : 20;

  return (
    <div style={{ animation: embedded ? "none" : "slideIn 0.3s ease" }}>
      {!embedded && (
        <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 20 }}>
          ← Back
        </button>
      )}
      <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${lineColor}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#4a6a8a", letterSpacing: 3, marginBottom: 6, fontWeight: 600 }}>TREND VIEW</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ddf", fontFamily: "Space Grotesk, sans-serif" }}>{label}</div>
            <div style={{ fontSize: 12, color: "#4a6a8a" }}>
              {category}
              {unit ? ` · ${unit}` : ""} · WHOOP
            </div>
          </div>
          {rangeAvg != null && (
            <div style={{ textAlign: "right", maxWidth: 340 }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1.2, marginBottom: 4 }}>AVERAGE</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: "#f8fafc", fontFamily: "Space Grotesk, sans-serif", lineHeight: 1 }}>
                  {fmtAvg(rangeAvg, unit)}
                  {unit ? <span style={{ fontSize: 18, color: "#94a3b8", marginLeft: 6 }}>{unit}</span> : null}
                </div>
              </div>
              {priorDeltaPct != null && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "rgba(15, 23, 42, 0.85)",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                  }}
                >
                  {rangeVsPrior.arrow !== "flat" && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: rangeVsPrior.good === true ? "#4ade80" : rangeVsPrior.good === false ? "#fb923c" : "#94a3b8",
                      }}
                    >
                      {rangeVsPrior.arrow === "up" ? "▲" : "▼"}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#cbd5e1", fontFamily: "DM Mono, monospace" }}>
                    {priorDeltaPct >= 0 ? "+" : ""}
                    {priorDeltaPct.toFixed(0)}% vs. prior {PRIOR_RANGE_LABEL[rangeKey] ?? "period"}
                  </span>
                </div>
              )}
              {priorCompare?.priorAvg != null && priorDeltaPct == null && (
                <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 8 }}>
                  Prior period avg <span style={{ color: "#8aabcc", fontWeight: 600 }}>{fmtAvg(priorCompare.priorAvg, unit)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#4a6a8a", marginRight: 4 }}>Range</span>
          {WHOOP_TREND_RANGE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRangeKey(k)}
              className="btn btn-secondary"
              style={{
                fontSize: 11,
                padding: "6px 12px",
                background: rangeKey === k ? `${lineColor}22` : undefined,
                borderColor: rangeKey === k ? lineColor : undefined,
                color: rangeKey === k ? lineColor : undefined,
              }}
            >
              {WHOOP_TREND_RANGE_LABELS[k]}
            </button>
          ))}
        </div>

        {dateRangeCaption && (
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, letterSpacing: 0.5, fontFamily: "DM Mono, monospace" }}>{dateRangeCaption}</div>
        )}

        {chartKind === "line" && bandLow != null && bandHigh != null && bandHigh > bandLow && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(148, 163, 184, 0.35)", border: "1px solid rgba(148,163,184,0.5)" }} aria-hidden />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#64748b" }}>TYPICAL RANGE</span>
          </div>
        )}

        {insightLine && (
          <p style={{ fontSize: 13, color: "#8aabcc", marginBottom: 12, lineHeight: 1.5, marginTop: 0 }}>{insightLine}</p>
        )}

        {showChart ? (
          <div style={{ height: 380, marginBottom: 8, overflow: "visible" }}>
            <ResponsiveContainer width="100%" height="100%" style={{ overflow: "visible" }}>
              <ComposedChart data={chartData} margin={{ top: chartTop, right: 24, bottom: chartBottom, left: 24 }}>
                {bandLow != null && bandHigh != null && bandHigh > bandLow && chartData.length > 0 && (
                  <ReferenceArea
                    y1={bandLow}
                    y2={bandHigh}
                    fill={chartKind === "line" ? "#94a3b8" : "#5ab0e8"}
                    fillOpacity={chartKind === "line" ? 0.14 : 0.08}
                    strokeOpacity={0}
                  />
                )}
                {chartKind === "bar" && priorCompare?.currentAvg != null && (
                  <ReferenceLine
                    y={priorCompare.currentAvg}
                    stroke={lineColor}
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    strokeOpacity={0.85}
                    isFront
                  />
                )}
                {chartKind === "bar" && priorCompare?.priorAvg != null && (
                  <ReferenceLine
                    y={priorCompare.priorAvg}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    strokeOpacity={0.75}
                    isFront
                  />
                )}
                <CartesianGrid strokeDasharray="0" stroke="rgba(26,48,80,0.35)" vertical={false} />
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={xDomain}
                  ticks={xTicks}
                  stroke="transparent"
                  tick={<XAxisTick />}
                  tickLine={false}
                  axisLine={{ stroke: "#1a3050" }}
                  height={48}
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
                {chartKind === "line" ? (
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke={lineColor}
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={(dotProps) => {
                      const { cx, cy, payload } = dotProps;
                      if (payload?.avg == null) return null;
                      return <circle cx={cx} cy={cy} r={5} fill="#0f172a" stroke={lineColor} strokeWidth={2} />;
                    }}
                    activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: "#0f172a" }}
                    isAnimationActive={false}
                  >
                    {rangeKey === "7d" && (
                      <LabelList
                        dataKey="avg"
                        position="top"
                        offset={14}
                        formatter={(v) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? fmtAvg(Number(v), unit) : "")}
                        style={{
                          fill: "#7dd3fc",
                          fontSize: 11,
                          fontFamily: "DM Mono, monospace",
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Line>
                ) : (
                  <Bar dataKey="barValue" radius={[4, 4, 0, 0]} maxBarSize={52} isAnimationActive={false}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${entry.idx}-${index}`} fill={barFill(entry)} />
                    ))}
                    <LabelList dataKey="deltaPct" position="bottom" content={BarDeltaLabel} />
                  </Bar>
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: "#6a8aaa", marginTop: 8, textAlign: "center" }}>
              {chartKind === "line"
                ? "Daily points · shaded band ≈ mean ± 1σ within the range (approximate typical band)."
                : "Monthly buckets · bar colors vs previous month (green / orange / neutral). % below bars vs prior month with data."}
            </div>
          </div>
        ) : showEmptyRange ? (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a5a7a", fontSize: 13, textAlign: "center", padding: 16 }}>
            No data in this range — choose <strong>All</strong> or a wider range, or sync more history.
          </div>
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a5a7a", fontSize: 13 }}>
            No data for this marker yet — connect WHOOP and run a full sync.
          </div>
        )}
      </div>
      {!embedded && (
        <div className="card">
          <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>ABOUT</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#8aabcc", margin: 0 }}>
            Matches WHOOP’s layout: <strong>7D / 30D</strong> use a daily line with a typical-range band; values on each day (7D only); <strong>6M / 90D / All</strong> use monthly bars with change vs the prior month. The headline average is the mean of daily values in the range; the pill compares that to the prior window of the same length.
          </p>
        </div>
      )}
    </div>
  );
}

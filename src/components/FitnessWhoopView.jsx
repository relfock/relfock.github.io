import { useMemo, useState } from "react";
import { buildFitnessMarkerRows } from "../data/whoopFitnessMarkers.js";
import { computeThirtyDayAverage } from "../data/whoopMetricMonthAvg.js";
import { compareLatestToMonthAverage } from "../data/whoopMarkerDirection.js";
import { getWorkoutsOnLocalDate, summarizeWorkoutRow, kilojouleToKcal, formatDurationMs } from "../data/whoopActivities.js";
import { computeSportDurationTypical, sportAccentColor } from "../data/whoopActivityTypical.js";
import { WhoopBarTrack } from "./WhoopBarTrack.jsx";
import { fitnessPointOnLocalDate, getCycleForLocalDate } from "../data/whoopFitnessDate.js";
import { WhoopRingDial } from "./WhoopRingDial.jsx";

const HERO = {
  recovery: { id: "whoop_recovery_score", title: "Recovery", max: 100, ringColor: "#6acc9a" },
  sleep: { id: "whoop_sleep_performance", title: "Sleep", max: 100, ringColor: "#a78bfa" },
  strain: { id: "whoop_cycle_strain", title: "Strain", max: 21, ringColor: "#f59e0b" },
};

/** Table / list order: Sleep → Recovery → Strain → Workout → Body */
const CATEGORY_RANK = { Sleep: 0, Recovery: 1, Strain: 2, Workout: 3, Body: 4 };

function formatTimeOnly(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function pickRow(rows, id) {
  return rows.find((r) => r.id === id) ?? null;
}

/**
 * @param {object} props
 * @param {object} props.themeColors
 * @param {string} props.viewDate — YYYY-MM-DD (local)
 * @param {object | null} props.cache — whoopCache[personId]
 * @param {boolean} props.connected — WHOOP OAuth connected for this profile
 * @param {{ status: string, message: string }} props.syncState
 * @param {boolean} props.isMobile
 * @param {(markerId: string) => void} props.onMarkerClick
 */
function augmentRowForDate(row, ymd) {
  if (!row) return null;
  const pt = fitnessPointOnLocalDate(row.points, ymd);
  if (!pt) return { ...row, latestDisplay: "—", latestValue: undefined };
  return { ...row, latestDisplay: pt.displayValue, latestValue: pt.value };
}

export function FitnessWhoopView({
  themeColors,
  viewDate,
  cache,
  connected,
  syncState,
  isMobile,
  onMarkerClick,
}) {
  const [allMetricsOpen, setAllMetricsOpen] = useState(false);
  const [tableSort, setTableSort] = useState({ by: "category", dir: "asc" });

  const rows = useMemo(() => buildFitnessMarkerRows(cache), [cache]);

  const sortedRows = useMemo(() => {
    const { by, dir } = tableSort;
    const mul = dir === "asc" ? 1 : -1;
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      if (by === "label") cmp = a.label.localeCompare(b.label);
      else if (by === "category") {
        const ra = CATEGORY_RANK[a.category] ?? 99;
        const rb = CATEGORY_RANK[b.category] ?? 99;
        cmp = ra - rb || a.label.localeCompare(b.label);
      }
      else if (by === "latest") {
        const av = a.latestValue;
        const bv = b.latestValue;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
      } else if (by === "points") cmp = a.pointCount - b.pointCount;
      return cmp * mul;
    });
    return list;
  }, [rows, tableSort]);

  const cycleEnergy = useMemo(() => {
    const c = getCycleForLocalDate(cache?.cycles, viewDate);
    const kj = c?.score?.kilojoule;
    return kilojouleToKcal(kj != null ? Number(kj) : null);
  }, [cache?.cycles, viewDate]);

  const dayActivities = useMemo(
    () => getWorkoutsOnLocalDate(cache?.workouts, viewDate).map((w) => ({ w, s: summarizeWorkoutRow(w) })),
    [cache?.workouts, viewDate]
  );

  const workoutDurationTypicalBySport = useMemo(() => {
    const ws = cache?.workouts;
    if (!ws?.length || !dayActivities.length) return new Map();
    const m = new Map();
    const names = [...new Set(dayActivities.map(({ s }) => s.sport))];
    for (const name of names) {
      const t = computeSportDurationTypical(ws, name);
      if (t) m.set(name, t);
    }
    return m;
  }, [cache?.workouts, dayActivities]);

  const metricsWithTrend = useMemo(() => {
    return rows
      .filter((r) => r.category !== "Sleep")
      .map((r) => {
        const monthAvg = computeThirtyDayAverage(r.points);
        const pt = fitnessPointOnLocalDate(r.points, viewDate);
        const latestVal = pt?.value;
        const t = compareLatestToMonthAverage(r.id, latestVal, monthAvg);
        return {
          ...r,
          latestDisplay: pt?.displayValue ?? "—",
          latestValue: latestVal,
          monthAvg,
          trend: t,
        };
      });
  }, [rows, viewDate]);

  const recoveryRow = augmentRowForDate(pickRow(rows, HERO.recovery.id), viewDate);
  const sleepRow = augmentRowForDate(pickRow(rows, HERO.sleep.id), viewDate);
  const strainRow = augmentRowForDate(pickRow(rows, HERO.strain.id), viewDate);
  const hrvRow = augmentRowForDate(pickRow(rows, "whoop_hrv_rmssd"), viewDate);

  const dialSize = isMobile ? 128 : 152;

  const recoverySublabel = hrvRow?.pointCount ? `HRV ${hrvRow.latestDisplay}` : undefined;
  const sleepSublabel = sleepRow?.pointCount ? "Sleep performance" : undefined;
  const strainSublabel = strainRow?.pointCount ? "Day strain (cycle)" : undefined;

  const toggleSort = (by) => {
    setTableSort((prev) => ({
      by,
      dir: prev.by === by && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const sortHint = (by) => (tableSort.by === by ? (tableSort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>
      {syncState?.message && syncState?.status !== "idle" && (
        <div
          style={{
            marginBottom: 16,
            fontSize: 12,
            color: syncState?.status === "error" ? "#f88" : syncState?.status === "ok" ? "#6acc9a" : themeColors.textDim,
          }}
        >
          {syncState.message}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: themeColors.textDim,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Day overview
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
          gap: isMobile ? 14 : 18,
          marginBottom: 28,
          maxWidth: 1200,
        }}
      >
        <WhoopRingDial
          title={HERO.sleep.title}
          value={sleepRow?.latestValue ?? null}
          max={HERO.sleep.max}
          display={sleepRow?.pointCount ? sleepRow.latestDisplay : "—"}
          sublabel={sleepSublabel}
          ringColor={HERO.sleep.ringColor}
          diameter={dialSize}
          dimmed={!sleepRow?.pointCount}
          onClick={() => onMarkerClick(HERO.sleep.id)}
        />
        <WhoopRingDial
          title={HERO.recovery.title}
          value={recoveryRow?.latestValue ?? null}
          max={HERO.recovery.max}
          display={recoveryRow?.pointCount ? recoveryRow.latestDisplay : "—"}
          sublabel={recoverySublabel}
          ringColor={HERO.recovery.ringColor}
          diameter={dialSize}
          dimmed={!recoveryRow?.pointCount}
          onClick={() => onMarkerClick(HERO.recovery.id)}
        />
        <WhoopRingDial
          title={HERO.strain.title}
          value={strainRow?.latestValue ?? null}
          max={HERO.strain.max}
          display={strainRow?.pointCount ? strainRow.latestDisplay : "—"}
          sublabel={strainSublabel}
          ringColor={HERO.strain.ringColor}
          diameter={dialSize}
          dimmed={!strainRow?.pointCount}
          onClick={() => onMarkerClick(HERO.strain.id)}
        />
        <WhoopRingDial
          title="Calories"
          value={cycleEnergy != null ? cycleEnergy : null}
          max={2500}
          display={cycleEnergy != null ? `${Math.round(cycleEnergy)} kcal` : "—"}
          sublabel="Day energy (cycle)"
          ringColor="#f472b6"
          diameter={dialSize}
          dimmed={cycleEnergy == null}
          onClick={() => onMarkerClick("whoop_cycle_kilojoule")}
        />
      </div>

      {/* Today’s activities */}
      <div
        style={{
          fontSize: 11,
          color: themeColors.textDim,
          letterSpacing: 2,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Activities on selected day
      </div>
      <div className="card" style={{ marginBottom: 24, maxWidth: 1200, padding: "12px 16px" }}>
        {dayActivities.map(({ w, s }) => {
          const typical = workoutDurationTypicalBySport.get(s.sport);
          const durMs = s.durationMs ?? 0;
          const refMaxMs = Math.max(typical?.refMaxMs ?? 0, durMs, 10 * 60 * 1000);
          const fillPct = refMaxMs > 0 ? Math.min(100, (durMs / refMaxMs) * 100) : 0;
          const lowPct = typical && refMaxMs > 0 ? (typical.lowMs / refMaxMs) * 100 : null;
          const highPct = typical && refMaxMs > 0 ? (typical.highMs / refMaxMs) * 100 : null;
          const barColor = sportAccentColor(s.sport);
          const strain = w.score?.strain != null ? Number(w.score.strain) : null;
          const showStrain = strain != null && !Number.isNaN(strain) && strain > 0.0001;
          return (
            <div
              key={w.id || `${w.start}-${s.sport}`}
              onClick={() => onMarkerClick("whoop_workout_strain")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onMarkerClick("whoop_workout_strain");
                }
              }}
              tabIndex={0}
              role="button"
              style={{
                borderBottom: `1px solid ${themeColors.border}`,
                cursor: "pointer",
                padding: "14px 0",
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(100px, 160px) minmax(0, 1fr) auto",
                gap: isMobile ? 10 : 14,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: themeColors.text, fontSize: 13 }}>{s.sport}</div>
                {showStrain && (
                  <div style={{ fontSize: 11, color: themeColors.textDim, marginTop: 4 }}>Strain {strain.toFixed(2)}</div>
                )}
              </div>
              <div
                style={{ position: "relative", minWidth: 0 }}
                title={
                  typical
                    ? `Typical duration for ${s.sport} (${typical.sampleSize} past): ${formatDurationMs(typical.lowMs)}–${formatDurationMs(typical.highMs)}`
                    : undefined
                }
              >
                <WhoopBarTrack
                  fillPct={fillPct}
                  lowPct={typical && lowPct != null && highPct != null && highPct > lowPct ? lowPct : null}
                  highPct={typical && lowPct != null && highPct != null && highPct > lowPct ? Math.min(100, highPct) : null}
                  fillColor={barColor}
                  height={32}
                />
                {fillPct > 0 && (durMs > 0 || s.kcal != null) && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${fillPct / 2}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      pointerEvents: "none",
                      flexWrap: "nowrap",
                      maxWidth: "min(96%, calc(100% - 16px))",
                    }}
                  >
                    {s.kcal != null && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#f8fafc",
                          fontFamily: "Space Grotesk, sans-serif",
                          textShadow: "0 1px 3px rgba(0,0,0,0.65)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {Math.round(s.kcal)} kcal
                      </span>
                    )}
                    {durMs > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "rgba(248,250,252,0.98)",
                          fontFamily: "DM Mono, monospace",
                          textShadow: "0 1px 3px rgba(0,0,0,0.65)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDurationMs(durMs)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: themeColors.textDim,
                  fontFamily: "DM Mono, monospace",
                  whiteSpace: "nowrap",
                  textAlign: isMobile ? "left" : "right",
                }}
              >
                {s.start ? formatTimeOnly(s.start) : "—"} → {s.end ? formatTimeOnly(s.end) : "—"}
              </div>
            </div>
          );
        })}
        {dayActivities.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: themeColors.textDim, fontSize: 13 }}>
            {connected ? "No activities on this day in synced data." : "Connect and sync to load activities."}
          </div>
        )}
      </div>

      {/* Metrics vs 30-day average */}
      <div
        style={{
          fontSize: 11,
          color: themeColors.textDim,
          letterSpacing: 2,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Metrics (vs 30-day average)
      </div>
      <div className="card" style={{ overflowX: "auto", marginBottom: 28, maxWidth: 1200 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
              <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>Metric</th>
              <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>Latest</th>
              <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>30d avg</th>
              <th style={{ textAlign: "center", padding: "10px 12px", color: themeColors.textDim, width: 56 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {metricsWithTrend.map((r) => {
              const { trend, monthAvg } = r;
              let mark = "—";
              let color = themeColors.textDim;
              if (trend.arrow !== "flat" && trend.good != null) {
                mark = trend.arrow === "up" ? "▲" : "▼";
                color = trend.good ? "#4ade80" : "#fb923c";
              } else if (trend.arrow !== "flat") {
                mark = trend.arrow === "up" ? "▲" : "▼";
                color = "#94a3b8";
              }
              return (
                <tr
                  key={r.id}
                  onClick={() => onMarkerClick(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMarkerClick(r.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: themeColors.textDim }}>{r.category}</div>
                    <div style={{ fontWeight: 600, color: themeColors.text }}>{r.label}</div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: r.pointCount ? themeColors.accent : themeColors.textDim }}>
                    {r.latestDisplay}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: themeColors.textDim }}>
                    {monthAvg != null ? (r.unit === "%" ? `${monthAvg.toFixed(1)}%` : monthAvg.toFixed(2)) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, color }} title="Vs 30-day average (directional cues are approximate)">
                    {mark}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {connected && rows.length === 0 && (
        <div style={{ fontSize: 12, color: themeColors.textDim, marginBottom: 24 }}>Sync to load metrics.</div>
      )}

      {/* Full table (collapsed) */}
      <button
        type="button"
        onClick={() => setAllMetricsOpen((o) => !o)}
        className="btn btn-secondary"
        style={{ marginBottom: 12, fontSize: 12 }}
        aria-expanded={allMetricsOpen}
      >
        {allMetricsOpen ? "Hide" : "Show"} all metrics table ({rows.length})
      </button>
      {allMetricsOpen && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("label")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600 }}
                  >
                    Metric{sortHint("label")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("latest")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600 }}
                  >
                    Latest{sortHint("latest")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>Unit</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("points")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600, width: "100%", textAlign: "right" }}
                  >
                    Points{sortHint("points")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("category")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600 }}
                  >
                    Category{sortHint("category")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows
                .filter((r) => r.category !== "Sleep")
                .map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onMarkerClick(r.id)}
                  style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMarkerClick(r.id);
                    }
                  }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: themeColors.text }}>{r.label}</td>
                  <td style={{ padding: "10px 12px", color: r.pointCount ? themeColors.text : themeColors.textDim }}>{r.latestDisplay}</td>
                  <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{r.unit}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: themeColors.textDim }}>{r.pointCount}</td>
                  <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

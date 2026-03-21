/**
 * Parse WHOOP sleep API records for stage breakdown (see SleepScore.stage_summary).
 */

/** @param {number | null | undefined} ms */
export function msToHours(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return null;
  return Number(ms) / 3_600_000;
}

export function formatHoursHm(h) {
  if (h == null || Number.isNaN(h)) return "—";
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh <= 0) return `${mm}m`;
  return `${hh}h ${mm.toString().padStart(2, "0")}m`;
}

/**
 * Pick the most recent main sleep (not nap) with a score, preferring end time in the last 48h if tied.
 * @param {object[]} sleeps
 */
export function getLatestMainSleep(sleeps) {
  const list = (sleeps || []).filter((s) => s && !s.nap && s.score_state === "SCORED" && s.score?.stage_summary);
  if (list.length === 0) return null;
  list.sort((a, b) => new Date(b.end || b.start).getTime() - new Date(a.end || a.start).getTime());
  return list[0];
}

/**
 * Main sleep whose **end** falls on this local wake date (YYYY-MM-DD), e.g. night ending Tuesday morning.
 * @param {object[]} sleeps
 * @param {string} ymd
 */
export function getMainSleepEndingOnDate(sleeps, ymd) {
  const list = (sleeps || []).filter((s) => s && !s.nap && s.score_state === "SCORED" && s.score?.stage_summary && s.end);
  const match = list.filter((s) => {
    const end = new Date(s.end);
    if (Number.isNaN(end.getTime())) return false;
    const d = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return d === ymd;
  });
  if (match.length === 0) return null;
  match.sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
  return match[0];
}

/**
 * @param {object} score — sleep.score
 */
export function parseStageSummary(score) {
  const st = score?.stage_summary;
  if (!st) return null;
  const awake = msToHours(st.total_awake_time_milli);
  const light = msToHours(st.total_light_sleep_time_milli);
  const sws = msToHours(st.total_slow_wave_sleep_time_milli);
  const rem = msToHours(st.total_rem_sleep_time_milli);
  const inBed = msToHours(st.total_in_bed_time_milli);
  const sleepTimeH =
    light != null && sws != null && rem != null ? light + sws + rem : null;
  const restorative =
    sws != null && rem != null ? sws + rem : sws != null || rem != null ? (sws || 0) + (rem || 0) : null;
  return {
    awake,
    light,
    sws,
    rem,
    restorative,
    inBed,
    sleepTimeH,
    disturbanceCount: st.disturbance_count,
    sleepCycleCount: st.sleep_cycle_count,
    respiratoryRate: score?.respiratory_rate,
    performancePct: score?.sleep_performance_percentage,
    efficiencyPct: score?.sleep_efficiency_percentage,
    consistencyPct: score?.sleep_consistency_percentage,
  };
}

/**
 * Typical % ranges for sleep stages (population heuristics; WHOOP app may differ).
 * Shown when user has no 30-day history to personalize.
 */
export const STAGE_TYPICAL_PCT = {
  awake: { min: 2, max: 10, label: "2–10%" },
  light: { min: 45, max: 55, label: "45–55%" },
  sws: { min: 15, max: 25, label: "15–25%" },
  rem: { min: 20, max: 25, label: "20–25%" },
  /** Deep + REM combined (% of in-bed), population heuristic */
  restorative: { min: 35, max: 50, label: "35–50%" },
};

/**
 * Compute % of in-bed time per stage; typical min/max from last `dayCount` main sleeps.
 * @param {object[]} sleeps
 */
export function computePersonalStageTypical(sleeps, dayCount = 30) {
  const mains = (sleeps || [])
    .filter((s) => s && !s.nap && s.score_state === "SCORED" && s.score?.stage_summary)
    .sort((a, b) => new Date(b.end || b.start).getTime() - new Date(a.end || a.start).getTime())
    .slice(0, dayCount);

  const rows = { awake: [], light: [], sws: [], rem: [], restorative: [] };
  for (const s of mains) {
    const p = parseStageSummary(s.score);
    if (!p || p.inBed == null || p.inBed <= 0) continue;
    if (p.awake != null) rows.awake.push((p.awake / p.inBed) * 100);
    if (p.light != null) rows.light.push((p.light / p.inBed) * 100);
    if (p.sws != null) rows.sws.push((p.sws / p.inBed) * 100);
    if (p.rem != null) rows.rem.push((p.rem / p.inBed) * 100);
    if (p.restorative != null) rows.restorative.push((p.restorative / p.inBed) * 100);
  }

  const band = (arr) => {
    if (arr.length === 0) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd =
      arr.length > 1
        ? Math.sqrt(arr.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (arr.length - 1))
        : 0;
    return { mean, low: Math.max(0, mean - sd), high: Math.min(100, mean + sd) };
  };

  return {
    awake: band(rows.awake),
    light: band(rows.light),
    sws: band(rows.sws),
    rem: band(rows.rem),
    restorative: band(rows.restorative),
    sampleSize: mains.length,
  };
}

export function stagePctOfBed(stageH, inBedH) {
  if (stageH == null || inBedH == null || inBedH <= 0) return null;
  return (stageH / inBedH) * 100;
}

const EPS = 0.35;

/**
 * Compare current stage % to your historical mean for trend glyph (WHOOP-style).
 * Awake: lower % is better. Light / SWS / REM / restorative: higher % is better.
 * @param {number | null} pct
 * @param {number | null | undefined} meanPct
 * @param {"awake"|"light"|"sws"|"rem"|"restorative"} field
 * @returns {{ arrow: "up"|"down"|"flat", good: boolean | null }}
 */
export function stageTrendVsAverage(pct, meanPct, field) {
  if (pct == null || meanPct == null || Number.isNaN(pct) || Number.isNaN(meanPct)) {
    return { arrow: "flat", good: null };
  }
  const d = pct - meanPct;
  if (Math.abs(d) < EPS) return { arrow: "flat", good: null };
  const up = d > 0;
  if (field === "awake") {
    return { arrow: up ? "up" : "down", good: !up };
  }
  return { arrow: up ? "up" : "down", good: up };
}

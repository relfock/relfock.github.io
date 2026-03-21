/**
 * WHOOP-style trends: date-range filter, daily aggregation, rolling mean (approximate — not WHOOP's internal baseline).
 */

/** @typedef {{ sortTime: string, date: string, value: number, displayValue: string }} FitnessPoint */

export const WHOOP_TREND_RANGE_KEYS = ["7d", "30d", "90d", "6m", "all"];

/** Default matches user preference */
export const WHOOP_TREND_DEFAULT_RANGE = "30d";

export const WHOOP_TREND_RANGE_LABELS = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  "6m": "6M",
  all: "All",
};

const MS_DAY = 86400000;

/** Local calendar YYYY-MM-DD (matches date picker). */
export function localYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * @param {string} key
 * @param {number} [nowMs]
 * @returns {number | null} cutoff timestamp (inclusive), or null for "all"
 */
export function getTrendRangeCutoffMs(key, nowMs = Date.now()) {
  if (key === "all") return null;
  if (key === "6m") return nowMs - 180 * MS_DAY;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[key];
  if (days == null) return nowMs - 30 * MS_DAY;
  return nowMs - days * MS_DAY;
}

/**
 * @param {FitnessPoint[]} points
 * @param {number | null} cutoffMs
 */
export function filterPointsByCutoff(points, cutoffMs) {
  if (cutoffMs == null) return [...points];
  return points.filter((p) => {
    const t = new Date(p.sortTime).getTime();
    return !Number.isNaN(t) && t >= cutoffMs;
  });
}

/**
 * One row per local calendar day; multiple samples same day → mean `value`.
 * @param {FitnessPoint[]} points
 * @returns {{ sortTime: string, day: string, value: number, displayValue: string }[]}
 */
export function aggregateFitnessPointsByDay(points) {
  const byDay = new Map();
  for (const p of points) {
    const d = new Date(p.sortTime);
    if (Number.isNaN(d.getTime())) continue;
    const day = localYmd(d);
    let g = byDay.get(day);
    if (!g) {
      g = { sum: 0, count: 0, displaySamples: [] };
      byDay.set(day, g);
    }
    g.sum += Number(p.value);
    g.count += 1;
    g.displaySamples.push(p.displayValue);
  }
  const days = [...byDay.keys()].sort();
  return days.map((day) => {
    const g = byDay.get(day);
    const v = g.sum / g.count;
    const displayValue =
      g.count === 1
        ? g.displaySamples[0]
        : Number.isFinite(v)
          ? v % 1 === 0
            ? String(Math.round(v))
            : v.toFixed(2)
          : "—";
    return {
      day,
      sortTime: `${day}T12:00:00.000Z`,
      value: v,
      displayValue,
    };
  });
}

/**
 * Trailing window mean on daily series (partial window at start uses available days).
 * @param {{ value: number }[]} dailySorted
 * @param {number} windowDays e.g. 7
 * @returns {(number | null)[]}
 */
export function rollingMeanDaily(dailySorted, windowDays) {
  const n = dailySorted.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - windowDays + 1);
    let s = 0;
    let c = 0;
    for (let j = start; j <= i; j++) {
      s += dailySorted[j].value;
      c += 1;
    }
    out.push(c > 0 ? s / c : null);
  }
  return out;
}

/**
 * Mean and sample stdev of values in window (for reference band).
 * @param {number[]} vals
 */
export function meanAndStdev(vals) {
  if (vals.length === 0) return { mean: null, stdev: null };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (vals.length === 1) return { mean, stdev: 0 };
  const v = vals.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (vals.length - 1);
  return { mean, stdev: Math.sqrt(v) };
}

const ROLLING_WINDOW_DAYS = 7;

/**
 * @param {FitnessPoint[]} points
 * @param {number} startMs inclusive
 * @param {number} endMs exclusive upper bound (points with sortTime < endMs)
 */
export function filterPointsBetween(points, startMs, endMs) {
  return points.filter((p) => {
    const t = new Date(p.sortTime).getTime();
    return !Number.isNaN(t) && t >= startMs && t < endMs;
  });
}

/**
 * Window length in ms for range key (for prior-period comparison).
 */
export function getRangeSpanMs(rangeKey, nowMs = Date.now()) {
  // Rolling windows for "current vs prior period" summary lines (not bar deltas).
  // "All" still shows full history as bars; comparison uses last 365d vs prior 365d.
  if (rangeKey === "all") return 365 * MS_DAY;
  if (rangeKey === "6m") return 180 * MS_DAY;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[rangeKey];
  return (days ?? 30) * MS_DAY;
}

/**
 * Current window [now - span, now) and prior window [now - 2*span, now - span).
 * @returns {{ currentStart: number, currentEnd: number, priorStart: number, priorEnd: number, spanMs: number } | null}
 */
export function getCurrentAndPriorWindows(rangeKey, nowMs = Date.now()) {
  const spanMs = getRangeSpanMs(rangeKey, nowMs);
  if (spanMs == null) return null;
  const currentEnd = nowMs;
  const currentStart = nowMs - spanMs;
  const priorEnd = currentStart;
  const priorStart = priorEnd - spanMs;
  return { currentStart, currentEnd, priorStart, priorEnd, spanMs };
}

export function meanDailyPoints(points) {
  const daily = aggregateFitnessPointsByDay(points);
  if (daily.length === 0) return null;
  const s = daily.reduce((a, d) => a + d.value, 0);
  return s / daily.length;
}

/**
 * Compare average in current window vs prior window of equal length.
 */
export function buildPriorWindowComparison(points, rangeKey, nowMs = Date.now()) {
  const w = getCurrentAndPriorWindows(rangeKey, nowMs);
  if (!w) return { currentAvg: null, priorAvg: null, deltaPct: null, label: null };
  const curPts = filterPointsBetween(points, w.currentStart, w.currentEnd);
  const prevPts = filterPointsBetween(points, w.priorStart, w.priorEnd);
  const currentAvg = meanDailyPoints(curPts);
  const priorAvg = meanDailyPoints(prevPts);
  let deltaPct = null;
  if (currentAvg != null && priorAvg != null && Math.abs(priorAvg) > 1e-9) {
    deltaPct = ((currentAvg - priorAvg) / Math.abs(priorAvg)) * 100;
  } else if (currentAvg != null && priorAvg != null && priorAvg === 0) {
    deltaPct = currentAvg === 0 ? 0 : 100;
  }
  return { currentAvg, priorAvg, deltaPct, ...w };
}

function lastNDatesLocal(nowMs, n) {
  const out = [];
  const end = new Date(nowMs);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(localYmd(d));
  }
  return out;
}

/** Monday 00:00 local week start for a calendar day (YYYY-MM-DD). */
function mondayYmdForDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = dt.getDay();
  const daysFromMon = (dow + 6) % 7;
  dt.setDate(dt.getDate() - daysFromMon);
  return localYmd(dt);
}

function shortSpanLabel(ymdA, ymdB) {
  const a = new Date(ymdA + "T12:00:00");
  const b = new Date(ymdB + "T12:00:00");
  if (ymdA === ymdB) {
    return a.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${b.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/**
 * Calendar months overlapping [windowStartMs, nowMs], monthly bucket averages (for 90D).
 */
function buildMonthlyComparisonSeriesInWindow(points, windowStartMs, nowMs) {
  const out = [];
  let prevAvg = null;
  const end = new Date(nowMs);
  const startBound = new Date(windowStartMs);
  let cur = new Date(startBound.getFullYear(), startBound.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    const yy = cur.getFullYear();
    const mm = cur.getMonth();
    const monthStart = new Date(yy, mm, 1).getTime();
    const monthEnd = new Date(yy, mm + 1, 1).getTime();
    const sliceStart = Math.max(monthStart, windowStartMs);
    const sliceEnd = Math.min(monthEnd, nowMs + 1);
    const pts = filterPointsBetween(points, sliceStart, sliceEnd);
    const dail = aggregateFitnessPointsByDay(pts);
    const avg = dail.length ? dail.reduce((a, x) => a + x.value, 0) / dail.length : null;
    let deltaPct = null;
    if (avg != null && prevAvg != null && Math.abs(prevAvg) > 1e-9) {
      deltaPct = ((avg - prevAvg) / Math.abs(prevAvg)) * 100;
    }
    const label = new Date(yy, mm, 15).toLocaleString(undefined, { month: "short", year: "numeric" });
    if (avg != null) {
      out.push({
        idx: out.length,
        label,
        avg,
        deltaPct,
        sortTime: new Date(sliceStart).toISOString(),
      });
      prevAvg = avg;
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return out.filter((row) => row.avg != null);
}

/**
 * Local calendar months: each bar = monthly average; delta vs previous month with data.
 * @param {FitnessPoint[]} points
 * @param {number} monthsBack — if null, all months from first data to now
 */
export function buildMonthlyComparisonSeriesLocal(points, nowMs = Date.now(), monthsBack = 6) {
  const out = [];
  let prevAvg = null;
  const end = new Date(nowMs);
  if (monthsBack != null) {
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const startMs = new Date(y, m, 1).getTime();
      const endMs = new Date(y, m + 1, 1).getTime();
      const pts = filterPointsBetween(points, startMs, endMs);
      const daily = aggregateFitnessPointsByDay(pts);
      const avg = daily.length ? daily.reduce((a, x) => a + x.value, 0) / daily.length : null;
      let deltaPct = null;
      if (avg != null && prevAvg != null && Math.abs(prevAvg) > 1e-9) {
        deltaPct = ((avg - prevAvg) / Math.abs(prevAvg)) * 100;
      }
      const label = new Date(y, m, 15).toLocaleString(undefined, { month: "short", year: "numeric" });
      if (avg != null) {
        out.push({
          idx: out.length,
          label,
          avg,
          deltaPct,
          sortTime: new Date(startMs).toISOString(),
        });
        prevAvg = avg;
      }
    }
  } else {
    const daily = aggregateFitnessPointsByDay(points);
    if (daily.length === 0) return [];
    const start = new Date(daily[0].day + "T12:00:00");
    const endM = new Date(nowMs);
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(endM.getFullYear(), endM.getMonth(), 1);
    while (cur <= endMonth) {
      const yy = cur.getFullYear();
      const mm = cur.getMonth();
      const startMs = new Date(yy, mm, 1).getTime();
      const endMs = new Date(yy, mm + 1, 1).getTime();
      const pts = filterPointsBetween(points, startMs, endMs);
      const dail = aggregateFitnessPointsByDay(pts);
      const avg = dail.length ? dail.reduce((a, x) => a + x.value, 0) / dail.length : null;
      let deltaPct = null;
      if (avg != null && prevAvg != null && Math.abs(prevAvg) > 1e-9) {
        deltaPct = ((avg - prevAvg) / Math.abs(prevAvg)) * 100;
      }
      const label = new Date(yy, mm, 15).toLocaleString(undefined, { month: "short", year: "numeric" });
      if (avg != null) {
        out.push({ idx: out.length, label, avg, deltaPct, sortTime: new Date(startMs).toISOString() });
        prevAvg = avg;
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return out.filter((row) => row.avg != null);
}

/**
 * WHOOP-style **line** series: one point per calendar day for 7D or 30D (trailing window ending `nowMs`).
 * @returns {{ idx: number, day: string, avg: number | null, labelShort: string, labelWeek: string, sortTime: string }[]}
 */
export function buildDailyLineSeries(points, rangeKey, nowMs = Date.now()) {
  const cutoff = getTrendRangeCutoffMs(rangeKey, nowMs);
  const filtered = filterPointsByCutoff(points, cutoff);
  const daily = aggregateFitnessPointsByDay(filtered);
  const dailyMap = new Map(daily.map((d) => [d.day, d]));
  const n = rangeKey === "7d" ? 7 : 30;
  const days = lastNDatesLocal(nowMs, n);
  return days.map((day, idx) => {
    const row = dailyMap.get(day);
    const v = row?.value;
    const d = new Date(day + "T12:00:00");
    const labelShort = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    const labelWeek = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return {
      idx,
      day,
      avg: v ?? null,
      labelShort,
      labelWeek,
      sortTime: `${day}T12:00:00`,
    };
  });
}

/**
 * Bar chart buckets (monthly / weekly aggregates — not 7D/30D daily lines).
 */
export function buildComparisonBarSeries(points, rangeKey, nowMs = Date.now()) {
  const cutoff = getTrendRangeCutoffMs(rangeKey, nowMs);
  const filtered = filterPointsByCutoff(points, cutoff);

  if (rangeKey === "90d") {
    if (cutoff == null) return [];
    return buildMonthlyComparisonSeriesInWindow(filtered, cutoff, nowMs);
  }

  if (rangeKey === "6m") {
    return buildMonthlyComparisonSeriesLocal(points, nowMs, 6);
  }

  return buildMonthlyComparisonSeriesLocal(points, nowMs, null);
}

/**
 * @param {FitnessPoint[]} points
 * @param {string} rangeKey
 * @param {number} [nowMs]
 */
export function buildWhoopTrendChartSeries(points, rangeKey, nowMs = Date.now()) {
  const cutoff = getTrendRangeCutoffMs(rangeKey, nowMs);
  const filtered = filterPointsByCutoff(points, cutoff);
  const dailyForLatest = aggregateFitnessPointsByDay(filtered);
  const avs = dailyForLatest.map((d) => d.value);
  const { mean, stdev } = meanAndStdev(avs);
  const bandLow = mean != null && stdev != null ? mean - stdev : null;
  const bandHigh = mean != null && stdev != null ? mean + stdev : null;

  const priorCompare = buildPriorWindowComparison(points, rangeKey, nowMs);
  const chartKind = rangeKey === "7d" || rangeKey === "30d" ? "line" : "bar";
  const barSeries = chartKind === "line" ? buildDailyLineSeries(points, rangeKey, nowMs) : buildComparisonBarSeries(points, rangeKey, nowMs);

  return {
    chartKind,
    barSeries,
    bandMean: mean,
    bandLow,
    bandHigh,
    hasPoints: barSeries.some((b) => b.avg != null),
    /** Mean of daily values in the selected range (same basis as dashed “current period” line). */
    rangeAvg: priorCompare.currentAvg,
    priorCompare,
  };
}

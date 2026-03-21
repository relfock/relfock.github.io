import { localYmd } from "./whoopTrendMath.js";

/** End of local calendar day (23:59:59.999) for trend "as of" anchoring. */
export function endOfLocalYmdMs(ymd) {
  if (!ymd || typeof ymd !== "string") return Date.now();
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return Date.now();
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/**
 * Latest point on this local date, else most recent on or before end of that day.
 * @param {{ sortTime: string, value: number, displayValue: string }[]} points
 * @param {string} ymd
 */
export function fitnessPointOnLocalDate(points, ymd) {
  if (!points?.length) return null;
  const exact = points.filter((p) => localYmd(new Date(p.sortTime)) === ymd);
  if (exact.length) {
    exact.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));
    return exact[0];
  }
  const end = new Date(ymd + "T23:59:59.999").getTime();
  const before = points.filter((p) => new Date(p.sortTime).getTime() <= end);
  before.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));
  return before[0] || null;
}

/**
 * Cycle active at local noon on this day (strain / calories).
 * @param {object[]} cycles
 * @param {string} ymd
 */
export function getCycleForLocalDate(cycles, ymd) {
  const midday = new Date(ymd + "T12:00:00").getTime();
  const list = (cycles || [])
    .filter((c) => c && c.score_state === "SCORED" && c.score)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  for (const c of list) {
    const s = new Date(c.start).getTime();
    const e = c.end ? new Date(c.end).getTime() : Infinity;
    if (midday >= s && midday <= e) return c;
  }
  const endMatches = list.filter((c) => {
    if (!c.end) return false;
    return localYmd(new Date(c.end)) === ymd;
  });
  if (endMatches.length) {
    endMatches.sort((a, b) => new Date(b.end) - new Date(a.end));
    return endMatches[0];
  }
  return list[0] || null;
}

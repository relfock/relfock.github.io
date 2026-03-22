/**
 * HR zone time from WHOOP workouts (`score.zone_durations`), rolling 7 local days ending `endYmd`.
 * Zones 1–3 = easy/moderate; 4–5 = hard/max — aligned with WHOOP app groupings.
 * Strength weekly time: sum of workout durations for strength-tagged sports in the same window.
 */

import { localYmd } from "./whoopTrendMath.js";
import { formatDurationMs } from "./whoopActivities.js";

/** WHOOP sport_id values commonly used for strength / resistance work. */
const STRENGTH_SPORT_IDS = new Set([45, 48, 59, 103, 123, 248]);

/** Normalized sport_name from API (lowercase). */
const STRENGTH_SPORT_NAMES = new Set([
  "weightlifting",
  "powerlifting",
  "functional fitness",
  "strength trainer",
  "box fitness",
  "f45 training",
  "gymnastics",
  "calisthenics",
  "crossfit",
]);

/**
 * @param {object} w — workout
 */
export function isStrengthWorkout(w) {
  if (!w) return false;
  const sid = w.sport_id ?? w.score?.sport_id;
  if (sid != null && STRENGTH_SPORT_IDS.has(Number(sid))) return true;
  const n = (w.sport_name || "").toLowerCase().trim();
  if (STRENGTH_SPORT_NAMES.has(n)) return true;
  return false;
}

function workoutDurationMs(w) {
  if (!w?.start || !w?.end) return 0;
  try {
    const s = new Date(w.start).getTime();
    const e = new Date(w.end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
    return e - s;
  } catch {
    return 0;
  }
}

/**
 * @param {object[]} workouts
 * @param {string} endYmd — local YYYY-MM-DD (end of 7-day window, inclusive)
 * @returns {{ strengthMs: number, strengthWorkouts: number }}
 */
export function getRolling7dStrengthDurationMs(workouts, endYmd) {
  if (!workouts?.length || !endYmd || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) {
    return { strengthMs: 0, strengthWorkouts: 0 };
  }
  const [y, m, d] = endYmd.split("-").map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const t0 = start.getTime();
  const t1 = end.getTime();

  let strengthMs = 0;
  let strengthWorkouts = 0;
  for (const w of workouts) {
    if (!w?.start) continue;
    if (w.score_state && w.score_state !== "SCORED") continue;
    const ts = new Date(w.start).getTime();
    if (ts < t0 || ts > t1) continue;
    if (!isStrengthWorkout(w)) continue;
    const dur = workoutDurationMs(w);
    if (dur <= 0) continue;
    strengthMs += dur;
    strengthWorkouts += 1;
  }
  return { strengthMs, strengthWorkouts };
}

function getWorkoutLocalDateRange(workouts) {
  let min = null;
  let max = null;
  for (const w of workouts || []) {
    if (!w?.start) continue;
    const ymd = localYmd(new Date(w.start));
    if (!min || ymd < min) min = ymd;
    if (!max || ymd > max) max = ymd;
  }
  return { min, max };
}

function eachYmdInclusive(fromYmd, toYmd) {
  const out = [];
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  const cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur <= end) {
    out.push(localYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function sortFitnessPoints(out) {
  out.sort((a, b) => new Date(a.sortTime) - new Date(b.sortTime));
  return out;
}

/**
 * One point per local day: rolling 7d total Z1–3 time (hours), display = duration string.
 * @param {object[] | undefined} workouts
 */
export function buildRollingWeeklyHrZoneLowSeries(workouts) {
  const { min, max } = getWorkoutLocalDateRange(workouts);
  if (!min || !max) return [];
  const out = [];
  for (const ymd of eachYmdInclusive(min, max)) {
    const { lowMs } = getRolling7dHrZoneBucketMs(workouts, ymd);
    const h = lowMs / 3_600_000;
    out.push({
      sortTime: new Date(ymd + "T12:00:00").toISOString(),
      date: ymd,
      value: h,
      displayValue: lowMs > 0 ? formatDurationMs(lowMs) : "0m",
    });
  }
  return sortFitnessPoints(out);
}

/**
 * One point per local day: rolling 7d total Z4–5 time (hours).
 * @param {object[] | undefined} workouts
 */
export function buildRollingWeeklyHrZoneHighSeries(workouts) {
  const { min, max } = getWorkoutLocalDateRange(workouts);
  if (!min || !max) return [];
  const out = [];
  for (const ymd of eachYmdInclusive(min, max)) {
    const { highMs } = getRolling7dHrZoneBucketMs(workouts, ymd);
    const h = highMs / 3_600_000;
    out.push({
      sortTime: new Date(ymd + "T12:00:00").toISOString(),
      date: ymd,
      value: h,
      displayValue: highMs > 0 ? formatDurationMs(highMs) : "0m",
    });
  }
  return sortFitnessPoints(out);
}

/**
 * One point per local day: rolling 7d total strength workout duration.
 * @param {object[] | undefined} workouts
 */
export function buildRollingWeeklyStrengthSeries(workouts) {
  const { min, max } = getWorkoutLocalDateRange(workouts);
  if (!min || !max) return [];
  const out = [];
  for (const ymd of eachYmdInclusive(min, max)) {
    const { strengthMs } = getRolling7dStrengthDurationMs(workouts, ymd);
    const h = strengthMs / 3_600_000;
    out.push({
      sortTime: new Date(ymd + "T12:00:00").toISOString(),
      date: ymd,
      value: h,
      displayValue: strengthMs > 0 ? formatDurationMs(strengthMs) : "0m",
    });
  }
  return sortFitnessPoints(out);
}

/** @param {object | undefined} zd — zone_durations from workout score */
function sumZoneMillis(zd) {
  if (!zd || typeof zd !== "object") return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  const n = (k) => {
    const v = zd[k];
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : 0;
  };
  return {
    z1: n("zone_one_milli"),
    z2: n("zone_two_milli"),
    z3: n("zone_three_milli"),
    z4: n("zone_four_milli"),
    z5: n("zone_five_milli"),
  };
}

/**
 * @param {object[]} workouts — WHOOP /v2/workout collection
 * @param {string} endYmd — local YYYY-MM-DD (end of 7-day window, inclusive)
 * @returns {{ lowMs: number, highMs: number, workoutsWithZones: number }}
 */
export function getRolling7dHrZoneBucketMs(workouts, endYmd) {
  if (!workouts?.length || !endYmd || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) {
    return { lowMs: 0, highMs: 0, workoutsWithZones: 0 };
  }
  const [y, m, d] = endYmd.split("-").map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const t0 = start.getTime();
  const t1 = end.getTime();

  let lowMs = 0;
  let highMs = 0;
  let workoutsWithZones = 0;

  for (const w of workouts) {
    if (!w?.start) continue;
    if (w.score_state && w.score_state !== "SCORED") continue;
    const ts = new Date(w.start).getTime();
    if (ts < t0 || ts > t1) continue;
    const z = sumZoneMillis(w.score?.zone_durations);
    const sum5 = z.z1 + z.z2 + z.z3 + z.z4 + z.z5;
    if (sum5 <= 0) continue;
    lowMs += z.z1 + z.z2 + z.z3;
    highMs += z.z4 + z.z5;
    workoutsWithZones += 1;
  }

  return { lowMs, highMs, workoutsWithZones };
}

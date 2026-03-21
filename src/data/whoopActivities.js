/**
 * Today's workouts / cycle energy (WHOOP-style list).
 */

export function kilojouleToKcal(kj) {
  if (kj == null || Number.isNaN(Number(kj))) return null;
  return Number(kj) / 4.184;
}

/**
 * @param {object[]} workouts
 * @param {string} ymd — local YYYY-MM-DD
 */
export function getWorkoutsOnLocalDate(workouts, ymd) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return (workouts || [])
    .filter((w) => {
      if (!w?.start) return false;
      const s = new Date(w.start);
      return s.getFullYear() === y && s.getMonth() + 1 === mo && s.getDate() === d;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Current physiological cycle or most recent scored cycle (for day calories / strain).
 * @param {object[]} cycles
 */
export function getCurrentOrLatestCycle(cycles) {
  const list = (cycles || [])
    .filter((c) => c && c.score_state === "SCORED" && c.score)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  if (list.length === 0) return null;
  const now = Date.now();
  for (const c of list) {
    const s = new Date(c.start).getTime();
    const e = c.end ? new Date(c.end).getTime() : Infinity;
    if (now >= s && now <= e) return c;
  }
  return list[0];
}

/**
 * @param {object} w — workout record
 * @returns {{ primary: string, secondary: string, kcal: number | null, start: string, end: string }}
 */
export function summarizeWorkoutRow(w) {
  const sc = w.score || {};
  const start = w.start || "";
  const end = w.end || "";
  const strain = sc.strain != null ? Number(sc.strain) : null;
  let durMs = 0;
  try {
    if (start && end) durMs = new Date(end) - new Date(start);
  } catch {
    durMs = 0;
  }
  const durStr = durMs > 0 ? formatDurationMs(durMs) : "—";
  const hasStrain = strain != null && !Number.isNaN(strain) && strain > 0.0001;
  const kj = sc.kilojoule != null ? Number(sc.kilojoule) : null;
  const kcal = kilojouleToKcal(kj);
  const primary = hasStrain ? `Strain ${strain.toFixed(2)}` : durStr;
  const secondary = hasStrain ? durStr : "";
  return {
    sport: w.sport_name || "Activity",
    primary,
    secondary,
    kcal,
    start,
    end,
    durationMs: durMs > 0 ? durMs : null,
    hasStrain,
  };
}

export function formatDurationMs(ms) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  return `${h}h ${min}m`;
}

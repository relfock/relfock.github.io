/**
 * Per-activity duration typicals (historical WHOOP workouts) + stable sport colors.
 */

function normSport(s) {
  return (s || "").trim().toLowerCase();
}

/** Deterministic saturated color per sport name */
export function sportAccentColor(sportName) {
  const s = sportName || "Activity";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 72% 52%)`;
}

function percentileLinear(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function percentile(arr, p) {
  return percentileLinear([...arr].sort((a, b) => a - b), p);
}

/**
 * Typical **duration** band (P25–P75 ms) and a reference max for left-filled duration bars.
 * @param {object[]} workouts
 * @param {string} sportName
 * @param {{ minSamples?: number }} [opts]
 * @returns {{ lowMs: number, highMs: number, refMaxMs: number, sampleSize: number } | null}
 */
export function computeSportDurationTypical(workouts, sportName, opts = {}) {
  const minSamples = opts.minSamples ?? 3;
  const target = normSport(sportName);
  const list = (workouts || []).filter((w) => w?.start && w?.end && normSport(w.sport_name) === target);
  if (list.length < minSamples) return null;

  const durs = [];
  for (const w of list) {
    const ms = new Date(w.end).getTime() - new Date(w.start).getTime();
    if (ms > 0 && Number.isFinite(ms)) durs.push(ms);
  }
  if (durs.length < minSamples) return null;

  const p25 = percentile(durs, 25);
  const p75 = percentile(durs, 75);
  const p95 = percentile(durs, 95);
  const refMaxMs = Math.max(p95 * 1.2, p75 * 1.5, 20 * 60 * 1000);

  return {
    lowMs: p25,
    highMs: p75,
    refMaxMs,
    sampleSize: durs.length,
  };
}

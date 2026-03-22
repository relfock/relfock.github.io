/**
 * Whether "better" is higher or lower vs your 30-day average (approximate WHOOP-style cues).
 * null = show magnitude only (neutral color).
 */

/** @type {Record<string, 'higher' | 'lower' | 'neutral'>} */
export const WHOOP_MARKER_BETTER = {
  fitness_lab_core_temp: "neutral",
  fitness_lab_bp_sys: "lower",
  fitness_lab_bp_dia: "lower",
  fitness_lab_vo2: "higher",
  whoop_recovery_score: "higher",
  whoop_resting_hr: "lower",
  whoop_hrv_rmssd: "higher",
  whoop_spo2: "higher",
  whoop_skin_temp: "neutral",
  whoop_sleep_performance: "higher",
  whoop_sleep_efficiency: "higher",
  whoop_sleep_consistency: "higher",
  whoop_respiratory_rate: "neutral",
  whoop_sleep_in_bed: "neutral",
  whoop_sleep_deep: "neutral",
  whoop_sleep_rem: "neutral",
  whoop_sleep_light: "neutral",
  whoop_sleep_awake: "lower",
  whoop_sleep_disturbances: "lower",
  whoop_cycle_strain: "neutral",
  whoop_cycle_avg_hr: "neutral",
  whoop_cycle_max_hr: "neutral",
  whoop_cycle_kilojoule: "neutral",
  whoop_workout_strain: "neutral",
  whoop_workout_avg_hr: "neutral",
  whoop_workout_max_hr: "neutral",
  whoop_workout_kilojoule: "neutral",
  whoop_workout_distance: "neutral",
  whoop_weekly_hr_zones_low: "neutral",
  whoop_weekly_hr_zones_high: "neutral",
  whoop_weekly_strength_time: "neutral",
  whoop_body_height: "neutral",
  whoop_body_weight: "neutral",
  whoop_body_max_hr: "neutral",
};

/**
 * @param {string} markerId
 * @param {number | null | undefined} latest
 * @param {number | null | undefined} monthAvg
 * @returns {{ arrow: 'up' | 'down' | 'flat', good: boolean | null, diff: number | null }}
 */
export function compareLatestToMonthAverage(markerId, latest, monthAvg) {
  if (latest == null || monthAvg == null || Number.isNaN(latest) || Number.isNaN(monthAvg)) {
    return { arrow: "flat", good: null, diff: null };
  }
  const diff = latest - monthAvg;
  const eps = Math.max(1e-6, Math.abs(monthAvg) * 0.001);
  const arrow = diff > eps ? "up" : diff < -eps ? "down" : "flat";
  const mode = WHOOP_MARKER_BETTER[markerId] ?? "neutral";
  let good = null;
  if (arrow === "flat" || mode === "neutral") good = null;
  else if (mode === "higher") good = arrow === "up";
  else if (mode === "lower") good = arrow === "down";
  return { arrow, good, diff };
}

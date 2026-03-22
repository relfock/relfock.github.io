/**
 * WHOOP-style colors for Recovery score (0–100): green / amber / red bands.
 * Aligns with common WHOOP UI: green ≥67%, amber 34–66%, red &lt;34%.
 */

const RECOVERY = {
  green: "#2dd4bf", // teal-green (WHOOP-adjacent)
  amber: "#f59e0b",
  red: "#ef4444",
  neutral: "#6acc9a",
};

/**
 * @param {number | null | undefined} value — recovery_score 0–100
 * @returns {string} hex stroke / accent
 */
export function getWhoopRecoveryRingColor(value) {
  if (value == null || Number.isNaN(Number(value))) return RECOVERY.neutral;
  const v = Number(value);
  if (v >= 67) return RECOVERY.green;
  if (v >= 34) return RECOVERY.amber;
  return RECOVERY.red;
}

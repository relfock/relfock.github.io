/**
 * Lab / manual fitness biomarkers as time series for the Fitness metrics tables (merged with WHOOP rows).
 */
import { BIOMARKER_DB } from "./biomarkerDb.js";
import {
  computeDerivedBiomarkers,
  getNumericFromBiomarkers,
  getStoredBiomarkerValue,
} from "./derivedBiomarkers.js";
import { parseLabValue } from "../utils/parseLabValue.js";

/** @typedef {{ sortTime: string, date: string, value: number, displayValue: string }} FitnessPoint */

/** Stable IDs for trend direction + table keys (not WHOOP). */
/** Manual/lab-only rows (WHOOP supplies resting HR via whoop_resting_hr — no duplicate here). */
export const FITNESS_LAB_MARKER_META = [
  { id: "fitness_lab_core_temp", biomarkerKey: "Core Temperature" },
  { id: "fitness_lab_bp_sys", biomarkerKey: "Blood Pressure Systolic" },
  { id: "fitness_lab_bp_dia", biomarkerKey: "Blood Pressure Diastolic" },
  { id: "fitness_lab_vo2", biomarkerKey: "VO2 Max" },
];

/** @type {Record<string, string>} */
export const FITNESS_LAB_ID_TO_BIOMARKER = Object.fromEntries(
  FITNESS_LAB_MARKER_META.map((m) => [m.id, m.biomarkerKey])
);

/**
 * @param {object[] | undefined} personEntries — oldest → newest lab entries
 * @returns {{ id: string, label: string, unit: string, category: "Body", points: FitnessPoint[], pointCount: number, latestDisplay: string, latestValue: number | undefined, biomarkerKey: string }[]}
 */
export function buildFitnessLabRows(personEntries) {
  return FITNESS_LAB_MARKER_META.map((meta) => {
    const key = meta.biomarkerKey;
    const def = BIOMARKER_DB[key];
    /** @type {FitnessPoint[]} */
    const points = [];
    for (const e of personEntries || []) {
      const withDerived = computeDerivedBiomarkers(e.biomarkers || {});
      const num = getNumericFromBiomarkers(withDerived, key);
      if (num == null) continue;
      const raw = getStoredBiomarkerValue(withDerived, key);
      let displayValue = String(num);
      if (raw != null) {
        if (typeof raw === "object" && raw !== null && "numeric" in raw) {
          displayValue = String(raw.numeric);
        } else {
          const parsed = parseLabValue(raw);
          displayValue = parsed.display !== "–" && !Number.isNaN(parsed.numeric) ? String(parsed.display) : String(raw).trim();
        }
      }
      // Local noon on entry date — avoid toISOString() so the calendar day matches fitnessPointOnLocalDate(viewDate)
      const sortTime = `${e.date}T12:00:00`;
      points.push({
        sortTime,
        date: e.date,
        value: num,
        displayValue,
      });
    }
    points.sort((a, b) => new Date(a.sortTime) - new Date(b.sortTime));
    const latest = points[points.length - 1];
    return {
      id: meta.id,
      label: key,
      unit: def?.unit ?? "",
      category: "Body",
      points,
      pointCount: points.length,
      latestDisplay: latest?.displayValue ?? "—",
      latestValue: latest?.value,
      biomarkerKey: key,
    };
  });
}

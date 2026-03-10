import { BIOMARKER_DB } from "../data/biomarkerDb.js";
import { parseLabValue } from "./parseLabValue.js";
import { RANGE_COLORS, RANGE_BG } from "../constants/rangeColors.js";

export function getStatus(name, value) {
  const b = BIOMARKER_DB[name];
  if (!b) return "unknown";
  const { numeric: v } =
    typeof value === "object" && value?.numeric !== undefined ? value : parseLabValue(value);
  if (isNaN(v)) return "unknown";
  if (b.optimal && v >= b.optimal[0] && v <= b.optimal[1]) return "optimal";
  const highEnabled = b.high && b.high[0] > 0 && b.high[0] < 9999;
  if (b.eliteZone && highEnabled && v >= b.high[0]) return "elite";
  const lowEnabled = b.low && !(b.low[0] === 0 && b.low[1] === 0);
  if (lowEnabled && v < b.low[1]) {
    if (name === "Creatinine") return "sufficient";
    return "low";
  }
  if (!b.eliteZone && highEnabled && v >= b.high[0]) return "high";
  if (b.sufficient && v >= b.sufficient[0] && v <= b.sufficient[1]) return "sufficient";
  if (name === "Creatinine" && b.sufficient && v < b.sufficient[0]) return "sufficient";
  return "out-of-range";
}

export function statusColor(status) {
  return RANGE_COLORS[status] || RANGE_COLORS.unknown;
}

export function higherIsBetter(name) {
  const b = BIOMARKER_DB[name];
  if (!b || !b.optimal) return false;
  const lowOk = b.low && b.low[1] > 0;
  return lowOk && b.optimal[0] > b.low[1];
}

export function statusBg(status) {
  return RANGE_BG[status] || RANGE_BG.unknown;
}

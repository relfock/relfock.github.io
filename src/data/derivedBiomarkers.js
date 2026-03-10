import { BIOMARKER_DB } from "./biomarkerDb.js";
import { parseLabValue } from "../utils/parseLabValue.js";

export const CATEGORIES = [...new Set(Object.values(BIOMARKER_DB).map((b) => b.category))];

export function getBiomarkersForPerson(person) {
  const all = Object.keys(BIOMARKER_DB);
  if (!person?.gender || person.gender === "Other") return all;
  const personGender = (person.gender || "").toLowerCase();
  return all.filter((name) => {
    const g = BIOMARKER_DB[name].gender;
    return !g || (g && g.toLowerCase() === personGender);
  });
}

export const DERIVED_BIOMARKERS = {
  "Non-HDL Cholesterol": {
    from: ["Total Cholesterol", "HDL Cholesterol"],
    formula: (total, hdl) => {
      const t = Number(total);
      const h = Number(hdl);
      if (!Number.isFinite(t) || !Number.isFinite(h)) return null;
      const v = t - h;
      return v >= 0 && Number.isFinite(v) ? v : null;
    },
    unit: "mg/dL",
  },
  "HOMA-IR": {
    from: ["Fasting Glucose", "Fasting Insulin"],
    formula: (glucose, insulin) => (glucose * insulin) / 405,
    unit: "score",
  },
  "BUN/Creatinine Ratio": {
    from: ["BUN", "Creatinine"],
    formula: (bun, creat) => (creat != null && Number(creat) !== 0 ? Number(bun) / Number(creat) : null),
    unit: "ratio",
  },
  "Albumin-to-Creatinine Ratio": {
    from: ["Urine Albumin", "Urine Creatinine"],
    formula: (alb, creat) => (creat != null && Number(creat) !== 0 ? Number(alb) / (Number(creat) * 0.01) : null),
    unit: "mg/g",
  },
  Globulin: {
    from: ["Total Protein", "Albumin"],
    formula: (totalProtein, albumin) => {
      const tp = Number(totalProtein);
      const alb = Number(albumin);
      const g = tp - alb;
      if (!Number.isFinite(g) || g < -0.01 || g > tp + 0.01) return null;
      return Math.max(0, g);
    },
    unit: "g/dL",
  },
  "Cholesterol/HDL Ratio": {
    from: ["Total Cholesterol", "HDL Cholesterol"],
    formula: (total, hdl) => {
      const t = Number(total);
      const h = Number(hdl);
      if (!Number.isFinite(t) || !Number.isFinite(h) || h === 0) return null;
      return t / h;
    },
    unit: "ratio",
  },
  "ApoB/ApoA-1 Ratio": {
    from: ["ApoB", "ApoA-1"],
    formula: (apoB, apoA1) => {
      const b = Number(apoB);
      const a = Number(apoA1);
      if (!Number.isFinite(b) || !Number.isFinite(a) || a === 0) return null;
      return b / a;
    },
    unit: "ratio",
  },
  "Albumin/Globulin Ratio": {
    from: ["Albumin", "Globulin"],
    formula: (alb, glob) => (glob != null && Number(glob) !== 0 ? Number(alb) / Number(glob) : null),
    unit: "ratio",
  },
  "Iron Saturation": {
    from: ["Iron", "TIBC"],
    formula: (iron, tibc) => (tibc != null && Number(tibc) !== 0 ? (Number(iron) / Number(tibc)) * 100 : null),
    unit: "%",
  },
  "Omega-6/Omega-3 Ratio": {
    from: ["Omega-6 Total", "Omega-3 Total"],
    formula: (o6, o3) => (o3 != null && Number(o3) !== 0 ? Number(o6) / Number(o3) : null),
    unit: "ratio",
  },
  "LDL Cholesterol": {
    from: ["Total Cholesterol", "HDL Cholesterol", "Triglycerides"],
    formula: (total, hdl, tg) => {
      const t = Number(total);
      const h = Number(hdl);
      const trig = Number(tg);
      if (!Number.isFinite(t) || !Number.isFinite(h) || !Number.isFinite(trig) || trig >= 400) return null;
      const ldl = t - h - trig / 5;
      return ldl >= 0 && Number.isFinite(ldl) ? ldl : null;
    },
    unit: "mg/dL",
  },
  "Free Testosterone": {
    from: ["Total Testosterone", "SHBG", "Albumin"],
    formula: (totalT_ng_dL, shbg_nmol_L, albumin_g_dL) => {
      const t = Number(totalT_ng_dL);
      const shbg = Number(shbg_nmol_L);
      const albumin_g_dLNum = Number(albumin_g_dL);
      if (!Number.isFinite(t) || !Number.isFinite(shbg) || shbg <= 0 || !Number.isFinite(albumin_g_dLNum)) return null;
      const totalT_nmol_L = t / 28.84;
      const T_mol = totalT_nmol_L * 1e-9;
      const SHBG_mol = shbg * 1e-9;
      const albumin_g_L = albumin_g_dLNum * 10;
      const Alb_mol = albumin_g_L / 66000;
      const kat = 3.6e4;
      const kt = 1e9;
      const a = kat + kt + (kat * kt) * (SHBG_mol + Alb_mol - T_mol);
      const b = 1 + kt * SHBG_mol + kat * Alb_mol - (kat + kt) * T_mol;
      const disc = b * b + 4 * a * T_mol;
      if (disc < 0 || !Number.isFinite(a) || a <= 0) return null;
      const freeT_mol_L = (-b + Math.sqrt(disc)) / (2 * a);
      const freeT_nmol_L = freeT_mol_L * 1e9;
      const freeT_pg_mL = freeT_nmol_L * 288;
      return freeT_pg_mL > 0 && Number.isFinite(freeT_pg_mL) ? freeT_pg_mL : null;
    },
    unit: "pg/mL",
  },
};

export function getNumericFromBiomarkers(biomarkers, key) {
  let v = biomarkers[key];
  if (v === undefined) {
    const keyLower = key.toLowerCase();
    const foundKey = Object.keys(biomarkers || {}).find((k) => k.toLowerCase() === keyLower);
    v = foundKey != null ? biomarkers[foundKey] : undefined;
  }
  if (v == null || v === "") return null;
  // Support snapshot shape { val, date } (e.g. cumulativeSnapshot) as well as raw values
  if (typeof v === "object" && v !== null && "val" in v) v = v.val;
  const num = typeof v === "object" && v !== null && "numeric" in v ? v.numeric : parseLabValue(v).numeric;
  return Number.isFinite(num) ? num : null;
}

export function getMissingDerivedSources(derivedName, biomarkers) {
  const def = DERIVED_BIOMARKERS[derivedName];
  if (!def) return [];
  const sources = [...(def.from || []), ...(def.optionalFrom || [])];
  return sources.filter((s) => getNumericFromBiomarkers(biomarkers, s) == null);
}

export function getCalculatedFrom(name) {
  const def = DERIVED_BIOMARKERS[name];
  if (!def) return [];
  return [...(def.from || []), ...(def.optionalFrom || [])];
}

export function computeDerivedBiomarkers(biomarkers) {
  if (!biomarkers || typeof biomarkers !== "object") return biomarkers || {};
  const out = { ...biomarkers };
  Object.entries(DERIVED_BIOMARKERS).forEach(([name, def]) => {
    const { from: sources, formula } = def;
    const vals = sources.map((s) => getNumericFromBiomarkers(out, s));
    if (!vals.every((v) => v != null)) return;
    const forceRecompute = name === "Cholesterol/HDL Ratio";
    if (!forceRecompute && out[name] !== undefined && out[name] !== "") return;
    try {
      const computed = formula(...vals);
      if (computed != null && Number.isFinite(computed)) out[name] = String(Math.round(computed * 100) / 100);
    } catch (_) {}
  });
  return out;
}

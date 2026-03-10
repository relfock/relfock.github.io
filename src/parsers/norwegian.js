import { BIOMARKER_DB } from "../data/biomarkerDb.js";

/** Norwegian analysehistorikk.json: map lab analyse names to canonical BIOMARKER_DB keys. */
export const NORWEGIAN_ANALYSE_TO_KEY = {
  "B-Hemoglobin": "Hemoglobin",
  "B-Leukocytter": "WBC",
  "B-Trombocytter": "Platelets",
  "B-Erytrocytter": "RBC",
  "B-Hematokrit": "Hematocrit",
  "MCV": "MCV", "MCH": "MCH", "MCHC": "MCHC",
  "RDW-CV": "RDW",
  "-     Nøytrofile": "Neutrophils (Absolute)", "Nøytrofile": "Neutrophils (Absolute)",
  "-     Lymfocytter": "Lymphocytes (Absolute)", "Lymfocytter": "Lymphocytes (Absolute)",
  "-     Monocytter": "Monocytes (Absolute)", "Monocytter": "Monocytes (Absolute)",
  "-     Eosinofile": "Eosinophils (Absolute)", "Eosinofile": "Eosinophils (Absolute)",
  "-     Basofile": "Basophils (Absolute)", "Basofile": "Basophils (Absolute)",
  "S-Ferritin": "Ferritin",
  "S-Jern": "Iron",
  "S-Jernbindingskap.": "TIBC",
  "S-Transferrinmetning": "Iron Saturation",
  "S-Aktivt-B12": "Active B12",
  "S-Folat": "Folate",
  "P-Homocystein": "Homocysteine",
  "S-Metylmalonsyre": "Methylmalonic Acid",
  "S-Natrium": "Sodium", "S-Kalium": "Potassium", "S-Klorid": "Chloride",
  "S-Kalsium": "Calcium",
  "S-Kalsium, korrigert": "Corrected Calcium",
  "S-Magnesium": "Magnesium",
  "S-Kreatinin": "Creatinine",
  "S-eGFR (CKD-EPI)": "eGFR",
  "S-Cystatin C": "Cystatin C",
  "S-Urinstoff": "BUN",
  "S-Bilirubin, total": "Bilirubin, Total",
  "S-ASAT": "AST", "S-ALAT": "ALT",
  "S-Gamma GT": "GGT",
  "S-Fosfatase, alkalisk": "Alkaline Phosphatase",
  "S-CK": "Creatine Kinase",
  "B-HbA1c": "HbA1c",
  "fS-Glukose": "Fasting Glucose",
  "fS-Triglyserider": "Triglycerides",
  "S-Kolesterol": "Total Cholesterol",
  "S-HDL-kolesterol": "HDL Cholesterol",
  "S-LDL-kolesterol": "LDL Cholesterol",
  "S-non-HDL-kolesterol": "Non-HDL Cholesterol",
  "S-Apo A-1": "ApoA-1", "S-Apo B": "ApoB",
  "ApoB/ApoA-1 ratio": "ApoB/ApoA-1 Ratio",
  "S-Lp(a)": "Lp(a)",
  "S-MikroCRP": "hs-CRP",
  "S-Protein total": "Total Protein",
  "S-Albumin": "Albumin",
  "S-TSH": "TSH",
  "S-Fritt T4": "Free T4", "S-Fritt T3": "Free T3",
  "S-FSH": "FSH", "S-LH": "LH",
  "S-Østradiol-17beta": "Estradiol",
  "S-Progesteron": "Progesterone",
  "S-Testosteron": "Total Testosterone",
  "S-SHBG": "SHBG",
  "Fri Testosteron indeks": "Free Testosterone Index",
  "S-Kortisol morgen": "Cortisol",
  "S-Vitamin D": "Vitamin D", "- Vitamin D3": "Vitamin D",
  "P-Sink": "Zinc",
};

export function parseNorwegianSvarToNumber(svar, enhet) {
  if (svar == null || String(svar).trim() === "" || String(svar) === "Utført") return null;
  const raw = String(svar).trim().replace(/,/g, ".");
  const match = raw.replace(/^[<>]/, "").trim();
  const num = parseFloat(match);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function convertNorwegianValueToTarget(canonicalKey, num, enhet) {
  if (num == null || !Number.isFinite(num)) return null;
  const u = (enhet || "").trim();
  const key = canonicalKey;
  if (!BIOMARKER_DB[key]) return num;
  const targetUnit = (BIOMARKER_DB[key].unit || "").toLowerCase();
  if (key === "Hemoglobin" && (u === "g/dl" || u === "g/dL")) return num;
  if (key === "Iron" && u.includes("umol")) return num * 5.585;
  if (key === "TIBC" && u.includes("umol")) return num * 5.585;
  if (key === "Ferritin" && (u === "ug/l" || u === "µg/l")) return num;
  if (key === "Folate" && u.includes("nmol")) return num / 2.266;
  if (key === "Calcium" || key === "Corrected Calcium") { if (u.includes("mmol")) return num * 4; return num; }
  if (key === "Magnesium" && u.includes("mmol")) return num * 2.432;
  if (key === "Creatinine" && u.includes("umol")) return num / 88.4;
  if (key === "BUN" && u.includes("mmol")) return num * 2.8;
  if (key === "Bilirubin, Total" && u.includes("umol")) return num / 17.1;
  if (key === "Total Protein" || key === "Albumin") { if (u === "g/l") return num / 10; return num; }
  if (key === "HbA1c" && u.includes("mmol/mol")) return (num / 10.929) + 2.15;
  if (key === "Fasting Glucose" && u.includes("mmol")) return num * 18.016;
  if ((key === "Triglycerides" || key === "Total Cholesterol" || key === "HDL Cholesterol" || key === "LDL Cholesterol" || key === "Non-HDL Cholesterol") && u.includes("mmol")) return num * (key === "Triglycerides" ? 88.57 : 38.67);
  if ((key === "ApoA-1" || key === "ApoB") && u === "g/l") return num * 100;
  if (key === "Lp(a)" && u === "mg/l") return num * 0.25;
  if (key === "Methylmalonic Acid" && u.includes("umol")) return num * 1000;
  if (key === "Estradiol" && u.includes("nmol")) return num * 272.4;
  if (key === "Progesterone" && u.includes("nmol")) return num / 3.18;
  if (key === "Total Testosterone" && u.includes("nmol")) return num * 28.84;
  if (key === "Cortisol" && u.includes("nmol")) return num / 27.59;
  if (key === "Vitamin D" && u.includes("nmol")) return num / 2.496;
  if (key === "Free T4" && u.includes("pmol")) return num * 0.0777;
  if (key === "Free T3" && u.includes("pmol")) return num * 0.651;
  if (key === "Zinc" && u.includes("umol")) return num * 6.54;
  if (key === "Hematocrit" && num <= 1 && num > 0) return num * 100;
  return num;
}

export function parseNorwegianAnalysehistorikk(jsonArray) {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) return { entries: [] };
  const dateToBiomarkers = {};
  for (const item of jsonArray) {
    const analyseName = (item.analyse || "").trim();
    const canonicalKey = NORWEGIAN_ANALYSE_TO_KEY[analyseName] || NORWEGIAN_ANALYSE_TO_KEY[analyseName.replace(/\s+/g, " ").replace(/^\s*-\s+/, "")];
    if (!canonicalKey || !BIOMARKER_DB[canonicalKey]) continue;
    const samples = item.analysesvar;
    if (!Array.isArray(samples)) continue;
    const enhet = (item.enhet || "").trim();
    for (const s of samples) {
      const dato = s.dato;
      if (!dato) continue;
      const parts = String(dato).trim().split(".");
      if (parts.length !== 3) continue;
      const [d, m, y] = parts;
      const isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const svar = s.svar;
      const unit = (s.enhet || enhet || "").trim();
      const num = parseNorwegianSvarToNumber(svar, unit);
      if (num == null) continue;
      const converted = convertNorwegianValueToTarget(canonicalKey, num, unit);
      if (converted == null) continue;
      if (!dateToBiomarkers[isoDate]) dateToBiomarkers[isoDate] = {};
      dateToBiomarkers[isoDate][canonicalKey] = Number.isInteger(converted) ? String(converted) : String(Math.round(converted * 100) / 100);
    }
  }
  const entries = Object.entries(dateToBiomarkers)
    .map(([date, biomarkers]) => ({ date, biomarkers }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { entries };
}

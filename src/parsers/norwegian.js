import { BIOMARKER_DB } from "../data/biomarkerDb.js";

/** Norwegian analysehistorikk.json: map lab analyse names to canonical BIOMARKER_DB keys. */
export const NORWEGIAN_ANALYSE_TO_KEY = {
  "B-Hemoglobin": "Hemoglobin",
  "B-Leukocytter": "WBC",
  "B-Trombocytter": "Platelets",
  "B-Erytrocytter": "RBC",
  "B-Hematokrit": "Hematocrit",
  MCV: "MCV",
  MCH: "MCH",
  MCHC: "MCHC",
  "RDW-CV": "RDW",
  "-     Nøytrofile": "Neutrophils (Absolute)",
  Nøytrofile: "Neutrophils (Absolute)",
  "-     Lymfocytter": "Lymphocytes (Absolute)",
  Lymfocytter: "Lymphocytes (Absolute)",
  "-     Monocytter": "Monocytes (Absolute)",
  Monocytter: "Monocytes (Absolute)",
  "-     Eosinofile": "Eosinophils (Absolute)",
  Eosinofile: "Eosinophils (Absolute)",
  "-     Basofile": "Basophils (Absolute)",
  Basofile: "Basophils (Absolute)",
  "S-Ferritin": "Ferritin",
  "S-Jern": "Iron",
  "S-Jernbindingskap.": "TIBC",
  "S-Transferrinmetning": "Iron Saturation",
  "S-Aktivt-B12": "Active B12",
  "S-Folat": "Folate",
  "P-Homocystein": "Homocysteine",
  "S-Metylmalonsyre": "Methylmalonic Acid",
  "S-Natrium": "Sodium",
  "S-Kalium": "Potassium",
  "S-Klorid": "Chloride",
  "S-Kalsium": "Calcium",
  "S-Kalsium, korrigert": "Corrected Calcium",
  "S-Magnesium": "Magnesium",
  "S-Fosfat, uorganisk": "Phosphate",
  "S-Kreatinin": "Creatinine",
  "S-eGFR (CKD-EPI)": "eGFR",
  "S-Cystatin C eGFR": "eGFR (Cystatin C)",
  "S-Cystatin C": "Cystatin C",
  "S-Urinstoff": "BUN",
  "S-Urinsyre": "Uric Acid",
  "S-Bilirubin, total": "Bilirubin, Total",
  "S-ASAT": "AST",
  "S-ALAT": "ALT",
  "S-Gamma GT": "GGT",
  "S-Fosfatase, alkalisk": "Alkaline Phosphatase",
  "S-CK": "Creatine Kinase",
  "S-Amylase pankreas": "Amylase",
  "S-Lipase": "Lipase",
  "B-HbA1c": "HbA1c",
  "fS-Glukose": "Fasting Glucose",
  "fS-Triglyserider": "Triglycerides",
  "S-Triglys ikke fastende": "Triglycerides",
  "S-Kolesterol": "Total Cholesterol",
  "S-HDL-kolesterol": "HDL Cholesterol",
  "S-LDL-kolesterol": "LDL Cholesterol",
  "S-non-HDL-kolesterol": "Non-HDL Cholesterol",
  "S-Apo A-1": "ApoA-1",
  "S-Apo B": "ApoB",
  "ApoB/ApoA-1 ratio": "ApoB/ApoA-1 Ratio",
  "S-Lp(a)": "Lp(a)",
  "S-MikroCRP": "hs-CRP",
  "S-Protein total": "Total Protein",
  "S-Albumin": "Albumin",
  "S-TSH": "TSH",
  "S-Fritt T4": "Free T4",
  "S-Fritt T3": "Free T3",
  "P-PTH": "PTH",
  "S-FSH": "FSH",
  "S-LH": "LH",
  "S-Østradiol-17beta": "Estradiol",
  "S-Progesteron": "Progesterone",
  "S-Testosteron": "Total Testosterone",
  "S-SHBG": "SHBG",
  "Fri Testosteron indeks": "Free Testosterone Index",
  "S-Kortisol morgen": "Cortisol",
  "S-Vitamin D": "Vitamin D",
  "- Vitamin D3": "Vitamin D",
  "S-Vitamin A (retinol)": "Vitamin A",
  "S-Vitamin E": "Vitamin E (Alpha-Tocopherol)",
  "P-Sink": "Zinc",
  "P-Selen": "Selenium",
  "P-Kobber": "Copper",
  "B-Bly": "Lead",
  "B-Kvikksølv": "Mercury",
  "S-Reumatoid faktor": "Rheumatoid Factor",
  "S-Anti-TPOII": "TPO Antibodies",
  "S-Prolaktin": "Prolactin",
};

/** Collapse spaces; trim leading dash bullet (diff count lines). */
function normalizeAnalyseLabel(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[-–—]\s*/, "")
    .trim();
}

export function resolveNorwegianAnalyseKey(analyseName) {
  const raw = String(analyseName || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const collapsed = NORWEGIAN_ANALYSE_TO_KEY[raw];
  if (collapsed) return collapsed;
  const stripped = normalizeAnalyseLabel(raw);
  return NORWEGIAN_ANALYSE_TO_KEY[stripped] || null;
}

/** Lowercase, strip spaces in unit, unify mu variants → u */
export function normalizeNorwegianUnit(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/µ/g, "u")
    .replace(/μ/g, "u");
}

export function parseNorwegianSvarToNumber(svar) {
  if (svar == null || String(svar).trim() === "" || String(svar) === "Utført") return null;
  const raw = String(svar).trim().replace(/,/g, ".");
  const match = raw.replace(/^[<>≤≥]/, "").trim();
  const num = parseFloat(match);
  if (!Number.isFinite(num)) return null;
  return num;
}

/**
 * Convert numeric lab value from Norwegian report units → BIOMARKER_DB canonical unit.
 * @param {string} canonicalKey
 * @param {number} num — parsed number (already stripped of leading < >)
 * @param {string} enhet — unit string from JSON (sample or parent)
 */
export function convertNorwegianValueToTarget(canonicalKey, num, enhet) {
  if (num == null || !Number.isFinite(num)) return null;
  const ul = normalizeNorwegianUnit(enhet);
  const key = canonicalKey;
  if (!BIOMARKER_DB[key]) return num;

  if (key === "Hemoglobin") {
    if (ul.includes("g/l") && !ul.includes("g/dl")) return num / 10;
    return num;
  }
  if (key === "Iron" && ul.includes("umol")) return num * 5.585;
  if (key === "TIBC" && ul.includes("umol")) return num * 5.585;
  if (key === "Ferritin" && (ul.includes("ug/l") || ul.includes("microg/l"))) return num;
  if (key === "Folate" && ul.includes("nmol")) return num / 2.266;
  if (key === "Calcium" || key === "Corrected Calcium") {
    if (ul.includes("mmol")) return num * 4;
    return num;
  }
  if (key === "Magnesium" && ul.includes("mmol")) return num * 2.432;
  if (key === "Phosphate" && ul.includes("mmol")) return num * 3.097;
  if (key === "Creatinine" && ul.includes("umol")) return num / 88.4;
  if (key === "BUN" && ul.includes("mmol")) return num * 2.8;
  if (key === "Uric Acid" && ul.includes("umol")) return num / 59.48;
  if (key === "Bilirubin, Total" && ul.includes("umol")) return num / 17.1;
  if (key === "Total Protein" || key === "Albumin") {
    if (ul === "g/l") return num / 10;
    return num;
  }
  if (key === "HbA1c" && ul.includes("mmol/mol")) return num / 10.929 + 2.15;
  if (key === "Fasting Glucose" && ul.includes("mmol")) return num * 18.016;
  if (
    (key === "Triglycerides" || key === "Total Cholesterol" || key === "HDL Cholesterol" || key === "LDL Cholesterol" || key === "Non-HDL Cholesterol") &&
    ul.includes("mmol")
  ) {
    return num * (key === "Triglycerides" ? 88.57 : 38.67);
  }
  if ((key === "ApoA-1" || key === "ApoB") && ul.includes("g/l")) return num * 100;
  if (key === "Lp(a)" && (ul.includes("mg/l") || ul.includes("mg/dl"))) {
    if (ul.includes("mg/dl")) return num * 2.5;
    return num * 0.25;
  }
  if (key === "Methylmalonic Acid" && ul.includes("umol")) return num * 1000;
  if (key === "Estradiol" && ul.includes("nmol")) return num * 272.4;
  if (key === "Progesterone" && ul.includes("nmol")) return num / 3.18;
  if (key === "Total Testosterone" && ul.includes("nmol")) return num * 28.84;
  if (key === "Cortisol" && ul.includes("nmol")) return num / 27.59;
  if (key === "Vitamin D" && ul.includes("nmol")) return num / 2.496;
  if (key === "Vitamin A" && ul.includes("umol")) return num * 28.65;
  if (key === "Vitamin E (Alpha-Tocopherol)" && ul.includes("umol")) return num * 0.4307;
  if (key === "Selenium" && ul.includes("umol")) return num * 78.96;
  if (key === "Copper" && ul.includes("umol")) return num * 6.355;
  if (key === "Lead" && ul.includes("umol")) return num * 20.72;
  if (key === "Mercury" && ul.includes("nmol")) return num * 0.20059;
  if (key === "Zinc" && ul.includes("umol")) return num * 6.54;
  if (key === "Free T4" && ul.includes("pmol")) return num * 0.0777;
  if (key === "Free T3" && ul.includes("pmol")) return num * 0.651;
  if (key === "Prolactin" && (ul.includes("mu/l") || ul.includes("miu/l"))) return num / 21.2;
  if (key === "Hematocrit" && num <= 1 && num > 0 && !ul.includes("%")) return num * 100;
  return num;
}

export function parseNorwegianAnalysehistorikk(jsonArray) {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) return { entries: [] };
  const dateToBiomarkers = {};
  for (const item of jsonArray) {
    const analyseName = (item.analyse || "").trim();
    const canonicalKey = resolveNorwegianAnalyseKey(analyseName);
    if (!canonicalKey || !BIOMARKER_DB[canonicalKey]) continue;
    const samples = item.analysesvar;
    if (!Array.isArray(samples)) continue;
    const parentEnhet = (item.enhet || "").trim();
    for (const s of samples) {
      const dato = s.dato;
      if (!dato) continue;
      const parts = String(dato).trim().split(".");
      if (parts.length !== 3) continue;
      const [d, m, y] = parts;
      const isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const svar = s.svar;
      const unit = (s.enhet || parentEnhet || "").trim();
      const num = parseNorwegianSvarToNumber(svar);
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

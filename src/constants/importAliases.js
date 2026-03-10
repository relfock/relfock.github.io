import { BIOMARKER_DB } from "../data/biomarkerDb.js";

export const WBC_DIFF_IMPORT_ALIASES = {
  "NEUT%": "Neutrophils",
  NEUT: "Neutrophils",
  "LYMPH%": "Lymphocytes",
  LYMPH: "Lymphocytes",
  "MONO%": "Monocytes",
  MONO: "Monocytes",
  "EO%": "Eosinophils",
  EO: "Eosinophils",
  "BASO%": "Basophils",
  BASO: "Basophils",
  "IG%": "Band Neutrophils",
  IG: "Band Neutrophils",
  "Immature Granulocytes": "Band Neutrophils",
  "NEUT#": "Neutrophils (Absolute)",
  "LYMPH#": "Lymphocytes (Absolute)",
  "MONO#": "Monocytes (Absolute)",
  "EO#": "Eosinophils (Absolute)",
  "BASO#": "Basophils (Absolute)",
};

export const BIOCHEM_IMPORT_ALIASES = {
  GLUC: "Fasting Glucose",
  GLU: "Fasting Glucose",
  "BIL-T": "Bilirubin, Total",
  "BIL-Total": "Bilirubin, Total",
};

export const ALL_IMPORT_ALIASES = { ...WBC_DIFF_IMPORT_ALIASES, ...BIOCHEM_IMPORT_ALIASES };

export function normalizeExtractedBiomarkerKeys(parsed) {
  if (!parsed || typeof parsed.extracted !== "object") return;
  const ext = parsed.extracted;
  const out = {};
  const aliasKeys = Object.keys(ALL_IMPORT_ALIASES);
  for (const [key, val] of Object.entries(ext)) {
    const k = (key || "").trim();
    if (!k) continue;
    if (BIOMARKER_DB[k]) {
      out[k] = val;
      continue;
    }
    let canonical = ALL_IMPORT_ALIASES[k] || ALL_IMPORT_ALIASES[k.replace(/\s+/g, " ")];
    if (!canonical) {
      const match = aliasKeys.find((ak) => ak.toUpperCase() === k.toUpperCase());
      if (match) canonical = ALL_IMPORT_ALIASES[match];
    }
    if (canonical && out[canonical] === undefined) {
      out[canonical] = val;
    } else if (!canonical) {
      out[k] = val;
    }
  }
  parsed.extracted = out;
}

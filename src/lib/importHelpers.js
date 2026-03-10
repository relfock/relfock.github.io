/** AI provider display names and free-tier flags for import UI. */
export const AI_PROVIDERS = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "OpenAI",
  groq: "Groq",
  "groq-compound": "Groq (Compound)",
  ollama: "Llama (local)",
};

export const AI_PROVIDER_FREE_TIER = {
  gemini: true,
  anthropic: true,
  openai: false,
  groq: true,
  ollama: true,
};

/** Cyrillic → Latin transliteration (Russian/Ukrainian). */
export const CYRILLIC_TO_LATIN = {
  "\u0430": "a", "\u0431": "b", "\u0432": "v", "\u0433": "g", "\u0434": "d", "\u0435": "e", "\u0451": "e",
  "\u0436": "zh", "\u0437": "z", "\u0438": "i", "\u0439": "y", "\u043a": "k", "\u043b": "l", "\u043c": "m",
  "\u043d": "n", "\u043e": "o", "\u043f": "p", "\u0440": "r", "\u0441": "s", "\u0442": "t", "\u0443": "u",
  "\u0444": "f", "\u0445": "kh", "\u0446": "ts", "\u0447": "ch", "\u0448": "sh", "\u0449": "shch",
  "\u044a": "", "\u044b": "y", "\u044c": "", "\u044d": "e", "\u044e": "yu", "\u044f": "ya",
  "\u0410": "a", "\u0411": "b", "\u0412": "v", "\u0413": "g", "\u0414": "d", "\u0415": "e", "\u0401": "e",
  "\u0416": "zh", "\u0417": "z", "\u0418": "i", "\u0419": "y", "\u041a": "k", "\u041b": "l", "\u041c": "m",
  "\u041d": "n", "\u041e": "o", "\u041f": "p", "\u0420": "r", "\u0421": "s", "\u0422": "t", "\u0423": "u",
  "\u0424": "f", "\u0425": "kh", "\u0426": "ts", "\u0427": "ch", "\u0428": "sh", "\u0429": "shch",
  "\u042a": "", "\u042b": "y", "\u042c": "", "\u042d": "e", "\u042e": "yu", "\u042f": "ya",
};

export function transliterateCyrillic(s) {
  const str = typeof s === "string" ? s : "";
  const normalized = str.normalize ? str.normalize("NFC") : str;
  return normalized.toLowerCase().replace(/[\u0400-\u04ff]/g, (c) => CYRILLIC_TO_LATIN[c] ?? "");
}

/** Compare profile name with document name (order, punctuation, script; document may have extra part e.g. patronymic). */
export function nameAndSurnameMatch(profileName, documentNameEnglish, documentNameAsOnDocument) {
  const profile = (profileName || "").trim();
  const docEn = (documentNameEnglish || "").trim();
  const docAs = (documentNameAsOnDocument || "").trim();
  const nameParts = (s, transliterate = false) => {
    let raw = (s || "").trim();
    if (raw.normalize) raw = raw.normalize("NFC");
    raw = raw.toLowerCase();
    if (!raw) return new Set();
    if (transliterate) raw = transliterateCyrillic(raw);
    const words = raw.split(/[\s,]+/).map((w) => w.replace(/[^a-z]/g, "")).filter((w) => w.length > 1);
    return new Set(words);
  };
  const a = nameParts(profile);
  if (a.size === 0) return true;
  const check = (bSet, allowExtraParts = 0) => {
    if (bSet.size === 0) return false;
    const profileInDoc = [...a].every((w) => bSet.has(w));
    const sizeOk = allowExtraParts === 0 ? a.size === bSet.size : bSet.size <= a.size + allowExtraParts;
    return profileInDoc && sizeOk;
  };
  const allowDocExtra = 2;
  if (docAs && /[\u0400-\u04ff]/.test(docAs)) {
    if (check(nameParts(docAs, true), allowDocExtra)) return true;
  }
  if (docEn && check(nameParts(docEn), allowDocExtra)) return true;
  if (docEn && /[\u0400-\u04ff]/.test(docEn) && check(nameParts(docEn, true), allowDocExtra)) return true;
  if (docAs && check(nameParts(docAs, true), allowDocExtra)) return true;
  if (!docEn && !docAs) return true;
  return false;
}

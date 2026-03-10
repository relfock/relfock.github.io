/**
 * Parse lab values like "<5", ">100", "5.2", "4,2" (European) → { display, numeric }.
 */
export function parseLabValue(value) {
  if (value == null || value === "") return { display: "–", numeric: NaN };
  const s = String(value).trim();
  const lessMatch = /^<\s*([-\d.,]+)$/i.exec(s);
  const greaterMatch = /^>\s*([-\d.,]+)$/i.exec(s);
  const parseNum = (str) => parseFloat(str.replace(/,/g, "."));
  if (lessMatch) {
    const n = parseNum(lessMatch[1]);
    return { display: isNaN(n) ? s : `< ${lessMatch[1]}`, numeric: n };
  }
  if (greaterMatch) {
    const n = parseNum(greaterMatch[1]);
    return { display: isNaN(n) ? s : `> ${greaterMatch[1]}`, numeric: n };
  }
  const n = parseNum(s);
  return { display: isNaN(n) ? s : s, numeric: n };
}

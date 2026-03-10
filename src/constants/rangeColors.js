/** Single palette for status/range colors — used in UI, charts, and reference range pills. */
export const RANGE_COLORS = {
  optimal: "#00e5a0",
  sufficient: "#50ddc8",
  low: "#ff8c42",
  high: "#ff5e5e",
  elite: "#b48fff",
  "out-of-range": "#ff5e5e",
  unknown: "#555",
};

export const RANGE_BG = {
  optimal: "rgba(0,229,160,0.12)",
  sufficient: "rgba(80,221,200,0.12)",
  low: "rgba(255,140,66,0.12)",
  high: "rgba(255,94,94,0.12)",
  elite: "rgba(180,143,255,0.12)",
  "out-of-range": "rgba(255,94,94,0.12)",
  unknown: "rgba(80,80,80,0.1)",
};

export const RANGE_BAND_FILL = {
  optimal: "rgba(0,229,160,0.20)",
  sufficient: "rgba(80,221,200,0.18)",
  low: "rgba(255,140,66,0.18)",
  high: "rgba(255,94,94,0.18)",
  elite: "rgba(180,143,255,0.20)",
};

export const RANGE_BAR_FILL = {
  optimal: "rgba(0,200,140,0.55)",
  sufficient: "rgba(64,200,180,0.5)",
  low: "rgba(255,120,50,0.5)",
  high: "rgba(255,80,80,0.5)",
  elite: "rgba(160,120,240,0.55)",
};

export const RANGE_RGB = {
  optimal: [0, 229, 160],
  sufficient: [80, 221, 200],
  low: [255, 140, 66],
  high: [255, 94, 94],
  elite: [180, 143, 255],
};

export const MONITOR_FREQUENCY_LABELS = {
  "3mo": "Retest every 3 mo",
  "6mo": "Retest every 6 mo",
  "1y": "Retest yearly",
};

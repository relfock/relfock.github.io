import { MONITOR_FREQUENCY_LABELS } from "../constants/rangeColors.js";

export function MonitorFrequencyBadge({ frequency, themeColors }) {
  if (!frequency || !MONITOR_FREQUENCY_LABELS[frequency]) return null;
  const label = MONITOR_FREQUENCY_LABELS[frequency];
  return (
    <span
      title={`Blueprint Biomarkers: ${label}`}
      style={{
        fontSize: 9,
        padding: "2px 6px",
        borderRadius: 4,
        background: themeColors ? `${themeColors.accent}22` : "rgba(80,140,200,0.2)",
        color: themeColors ? themeColors.accent : "#6a9acc",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

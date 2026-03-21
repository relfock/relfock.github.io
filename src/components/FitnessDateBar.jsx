import { useMemo, useRef } from "react";

const HIDDEN_DATE_INPUT_STYLE = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
  opacity: 0,
};

/**
 * Centered WHOOP-style day selector: &lt; · date · &gt; — click date for native calendar.
 * @param {object} props
 * @param {string} props.viewDate — YYYY-MM-DD (local)
 * @param {(ymd: string) => void} props.onViewDateChange
 * @param {object} props.themeColors
 * @param {boolean} [props.compact] — inline / top-nav sizing (no full-width centering)
 */
export function FitnessDateBar({ viewDate, onViewDateChange, themeColors, compact = false }) {
  const dateInputRef = useRef(null);
  const dateInputId = compact ? "fitness-view-date-input-compact" : "fitness-view-date-input";

  const todayYmd = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const displayDate = useMemo(() => {
    try {
      const [y, m, d] = viewDate.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return viewDate;
    }
  }, [viewDate]);

  const shiftViewDate = (deltaDays) => {
    const [y, m, d] = viewDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const n = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    onViewDateChange(n);
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker().catch(() => {
        el.focus();
        el.click();
      });
      return;
    }
    el.focus();
    el.click();
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: compact ? "flex-start" : "center",
        marginBottom: compact ? 0 : 20,
        width: compact ? "auto" : "100%",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: compact ? 6 : 10,
          padding: compact ? "4px 8px" : "8px 12px",
          borderRadius: compact ? 8 : 12,
          border: `1px solid ${themeColors.border}`,
          background: `${themeColors.appBg}ee`,
          boxShadow: compact ? "none" : "0 4px 24px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        <input
          id={dateInputId}
          ref={dateInputRef}
          type="date"
          value={viewDate}
          max={todayYmd}
          onChange={(e) => onViewDateChange(e.target.value)}
          style={HIDDEN_DATE_INPUT_STYLE}
          aria-hidden="true"
          tabIndex={-1}
        />

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => shiftViewDate(-1)}
          aria-label="Previous day"
          style={{
            minWidth: compact ? 32 : 40,
            padding: compact ? "4px 8px" : "8px 12px",
            fontSize: compact ? 14 : 16,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          &lt;
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={openDatePicker}
          aria-label="Open calendar"
          style={{
            minWidth: compact ? 120 : 200,
            maxWidth: compact ? 200 : 320,
            padding: compact ? "4px 10px" : "8px 14px",
            border: `1px solid ${themeColors.border}`,
            borderRadius: 8,
            background: `${themeColors.accent}12`,
            color: themeColors.text,
            fontSize: compact ? 12 : 14,
            fontWeight: 600,
            fontFamily: "Space Grotesk, sans-serif",
            cursor: "pointer",
          }}
        >
          {displayDate}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => shiftViewDate(1)}
          disabled={viewDate >= todayYmd}
          aria-label="Next day"
          style={{
            minWidth: compact ? 32 : 40,
            padding: compact ? "4px 8px" : "8px 12px",
            fontSize: compact ? 14 : 16,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";

/**
 * WHOOP-inspired circular score ring (SVG). Progress arc + center label.
 */

const VIEW = 100;
const CX = 50;
const CY = 50;
const R = 38;
const CIRC = 2 * Math.PI * R;

/**
 * @param {object} props
 * @param {string} props.title — Accessible name / card title
 * @param {number | null | undefined} props.value — Numeric value for arc fill (0…max)
 * @param {number} props.max — Scale maximum (e.g. 100 for %, 21 for strain)
 * @param {string} props.display — Center text (formatted)
 * @param {string} [props.sublabel] — Small line under the score
 * @param {string} props.ringColor — Arc stroke
 * @param {string} [props.trackColor] — Background track
 * @param {() => void} [props.onClick]
 * @param {number} [props.diameter] — Outer container size in px
 * @param {boolean} [props.dimmed] — No data
 */
export function WhoopRingDial({
  title,
  value,
  max,
  display,
  sublabel,
  ringColor,
  trackColor = "rgba(26, 48, 80, 0.55)",
  onClick,
  diameter = 152,
  dimmed = false,
}) {
  const [hover, setHover] = useState(false);
  const pct = value != null && max > 0 ? Math.min(1, Math.max(0, Number(value) / max)) : 0;
  const offset = CIRC * (1 - pct);

  const inner = (
    <div
      style={{
        position: "relative",
        width: diameter,
        height: diameter,
        margin: "0 auto",
      }}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        style={{ transform: "rotate(-90deg)", display: "block" }}
        aria-hidden
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={trackColor} strokeWidth={7} />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={dimmed ? trackColor : ringColor}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dimmed ? CIRC : offset}
          style={{
            transition: "stroke-dashoffset 0.65s cubic-bezier(0.33, 1, 0.68, 1)",
            opacity: dimmed ? 0.45 : 1,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          padding: "18%",
        }}
      >
        <div
          style={{
            fontSize: diameter < 130 ? 22 : 28,
            fontWeight: 700,
            fontFamily: "Space Grotesk, sans-serif",
            color: dimmed ? "#5a7090" : "#e8f0ff",
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          {display}
        </div>
        {sublabel ? (
          <div
            style={{
              fontSize: 10,
              color: "#6a8aaa",
              marginTop: 4,
              textAlign: "center",
              lineHeight: 1.25,
              maxWidth: "100%",
            }}
          >
            {sublabel}
          </div>
        ) : null}
      </div>
    </div>
  );

  const cardStyle = {
    padding: "18px 14px 20px",
    borderRadius: 12,
    border: `1px solid rgba(26, 48, 80, 0.5)`,
    background: "linear-gradient(165deg, rgba(8, 18, 36, 0.95) 0%, rgba(5, 12, 24, 0.98) 100%)",
    cursor: onClick ? "pointer" : "default",
    transition: "box-shadow 0.2s, border-color 0.2s, transform 0.2s",
    outline: "none",
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...cardStyle,
          boxShadow: hover ? `0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px ${ringColor}33` : "0 4px 20px rgba(0,0,0,0.2)",
          transform: hover ? "translateY(-2px)" : "none",
        }}
        className="whoop-dial-card"
        aria-label={`${title}: ${display}${sublabel ? `, ${sublabel}` : ""}. Open trend.`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.stopPropagation();
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#7a9aba",
            marginBottom: 10,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        {inner}
      </button>
    );
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "#7a9aba",
          marginBottom: 10,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {inner}
    </div>
  );
}

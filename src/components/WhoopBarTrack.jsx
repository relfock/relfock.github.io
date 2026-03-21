/**
 * WHOOP-style bar: diagonal stripe unfilled region, solid fill from left,
 * typical range = soft shadow + dashed vertical markers (not a solid box).
 */

const ZEBRA = {
  backgroundColor: "#141c2a",
  backgroundImage: `repeating-linear-gradient(
    -42deg,
    rgba(30, 41, 59, 0.95) 0px,
    rgba(30, 41, 59, 0.95) 7px,
    rgba(45, 55, 72, 0.85) 7px,
    rgba(45, 55, 72, 0.85) 14px
  )`,
};

function DashedV({ xPct }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: 0,
        height: "100%",
        width: 0,
        borderLeft: "2px dashed rgba(248, 250, 252, 0.88)",
        marginLeft: -1,
        zIndex: 4,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 3px rgba(0,0,0,0.65))",
        boxSizing: "border-box",
      }}
    />
  );
}

/**
 * @param {object} props
 * @param {number} props.fillPct — 0–100, filled from left
 * @param {number | null} [props.lowPct] — typical low
 * @param {number | null} [props.highPct] — typical high
 * @param {string} props.fillColor — solid color or CSS `background` (e.g. linear-gradient)
 * @param {number} [props.height]
 * @param {import('react').ReactNode} [props.children] — overlay on the filled region (e.g. kcal + duration)
 */
export function WhoopBarTrack({ fillPct, lowPct, highPct, fillColor, height = 28, children }) {
  const fp = Math.min(100, Math.max(0, fillPct));
  const low = lowPct != null ? Math.min(100, Math.max(0, lowPct)) : null;
  const high = highPct != null ? Math.min(100, Math.max(0, highPct)) : null;
  const showTyp = low != null && high != null && high > low;
  const showZebraTail = fp < 99.5;

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: 8,
          overflow: "hidden",
          background: "#0f172a",
        }}
      >
        {/* Unfilled: stripes on the whole track when no fill, else only from fill end to 100% */}
        {showZebraTail && (
          <div
            style={{
              position: "absolute",
              left: fp < 0.5 ? 0 : `${fp}%`,
              right: 0,
              top: 0,
              bottom: 0,
              ...ZEBRA,
              borderRadius: fp < 0.5 ? 8 : "0 8px 8px 0",
            }}
          />
        )}

        {fp > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${fp}%`,
              background: fillColor,
              backgroundSize: "100% 100%",
              zIndex: 1,
              borderRadius: fp >= 99.5 ? 8 : "8px 0 0 8px",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          />
        )}

        {showTyp && (
          <div
            style={{
              position: "absolute",
              left: `${low}%`,
              width: `${high - low}%`,
              top: 0,
              bottom: 0,
              zIndex: 2,
              background: "linear-gradient(180deg, rgba(15,23,42,0.12), rgba(15,23,42,0.38))",
              boxShadow: "inset 0 0 22px rgba(0,0,0,0.32), inset 0 0 8px rgba(255,255,255,0.05)",
              pointerEvents: "none",
            }}
          />
        )}

        {showTyp && (
          <>
            <DashedV xPct={low} />
            <DashedV xPct={high} />
          </>
        )}

        {fp > 0 && children != null && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${fp}%`,
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 8,
              paddingRight: 8,
              gap: 10,
              pointerEvents: "none",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

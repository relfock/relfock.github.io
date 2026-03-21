import { useMemo } from "react";
import {
  getMainSleepEndingOnDate,
  parseStageSummary,
  formatHoursHm,
  computePersonalStageTypical,
  stagePctOfBed,
  STAGE_TYPICAL_PCT,
  stageTrendVsAverage,
} from "../data/whoopSleepStages.js";
import { WhoopBarTrack } from "./WhoopBarTrack.jsx";

const STAGES = [
  { key: "awake", label: "Awake", color: "#94a3b8" },
  { key: "light", label: "Light", color: "#93c5fd" },
  { key: "sws", label: "SWS (Deep)", color: "#f472b6" },
  { key: "rem", label: "REM", color: "#a855f7" },
];

function formatDurationClock(h) {
  if (h == null || Number.isNaN(h)) return "—";
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

function TrendGlyph({ trend, themeColors }) {
  if (trend.arrow === "flat" || trend.good == null) {
    return (
      <span style={{ fontSize: 11, color: themeColors.textDim, marginLeft: 6 }} title="Near your average">
        —
      </span>
    );
  }
  const mark = trend.arrow === "up" ? "▲" : "▼";
  const color = trend.good ? "#4ade80" : "#fb923c";
  return (
    <span style={{ fontSize: 12, color, marginLeft: 6, fontWeight: 700 }} title={trend.good ? "Better than your average" : "Worse than your average"}>
      {mark}
    </span>
  );
}

/**
 * @param {object} props
 * @param {object | null} props.cache
 * @param {string} props.wakeDateYmd — local YYYY-MM-DD (wake day for this sleep)
 * @param {() => void} props.onBack
 * @param {object} props.themeColors
 * @param {import('react').ReactNode} props.trendPanel — trend chart first
 */
export function WhoopSleepDetail({ cache, wakeDateYmd, onBack, themeColors, trendPanel }) {
  const sleep = useMemo(
    () => getMainSleepEndingOnDate(cache?.sleeps, wakeDateYmd) || null,
    [cache?.sleeps, wakeDateYmd]
  );
  const stages = useMemo(() => (sleep?.score ? parseStageSummary(sleep.score) : null), [sleep]);
  const personal = useMemo(() => computePersonalStageTypical(cache?.sleeps, 30), [cache?.sleeps]);

  const inBed = stages?.inBed ?? 0;

  /**
   * @param {string} stageKey
   * @param {string} label
   * @param {string} color
   * @param {"awake"|"light"|"sws"|"rem"} pctField
   */
  const stageRow = (stageKey, label, color, pctField) => {
    const h = stages?.[stageKey];
    const pct = stagePctOfBed(h, inBed);
    const typ = personal?.[pctField];
    const fallback = STAGE_TYPICAL_PCT[pctField];
    const low = typ && typ.low != null ? typ.low : fallback?.min ?? null;
    const high = typ && typ.high != null ? typ.high : fallback?.max ?? null;
    const meanPct = typ?.mean != null ? typ.mean : fallback != null ? (fallback.min + fallback.max) / 2 : null;
    const barPct = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
    const dur = formatHoursHm(h);
    const showTypical = low != null && high != null && high > low;
    const trend = stageTrendVsAverage(pct, meanPct, pctField);

    return (
      <div key={stageKey} style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: `2px solid ${themeColors.text}`,
                flexShrink: 0,
                opacity: 0.9,
              }}
              aria-hidden
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: themeColors.text,
                letterSpacing: 0.6,
                fontFamily: "Space Grotesk, sans-serif",
              }}
            >
              {label.toUpperCase()}
            </span>
            {pct != null && (
              <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "Space Grotesk, sans-serif" }}>{pct.toFixed(0)}%</span>
            )}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: themeColors.text, fontFamily: "Space Grotesk, sans-serif" }}>{dur}</span>
        </div>
        <div
          title={
            showTypical
              ? typ && typ.low != null
                ? `Typical for you ~${low.toFixed(0)}–${high.toFixed(0)}% of in-bed time`
                : `Typical ~${low}–${high}%`
              : undefined
          }
        >
          <WhoopBarTrack
            fillPct={barPct}
            lowPct={showTypical ? low : null}
            highPct={showTypical ? Math.min(100, high) : null}
            fillColor={color}
            height={28}
          />
        </div>
        <div style={{ fontSize: 11, color: themeColors.textDim, marginTop: 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <span>vs your avg</span>
          <span style={{ color: themeColors.text, fontWeight: 600 }}>
            {meanPct != null ? `${meanPct.toFixed(0)}%` : "—"}
          </span>
          <TrendGlyph trend={trend} themeColors={themeColors} />
        </div>
      </div>
    );
  };

  const restorativeHours =
    stages?.restorative != null ? stages.restorative : stages?.sws != null || stages?.rem != null ? (stages.sws || 0) + (stages.rem || 0) : null;

  const restorativePct = stagePctOfBed(restorativeHours, inBed);
  const rTyp = personal?.restorative;
  const rFallback = STAGE_TYPICAL_PCT.restorative;
  const rLow = rTyp && rTyp.low != null ? rTyp.low : rFallback?.min ?? null;
  const rHigh = rTyp && rTyp.high != null ? rTyp.high : rFallback?.max ?? null;
  const rMeanPct = rTyp?.mean != null ? rTyp.mean : rFallback != null ? (rFallback.min + rFallback.max) / 2 : null;
  const rBarPct = restorativePct != null ? Math.min(100, Math.max(0, restorativePct)) : 0;
  const rTrend = stageTrendVsAverage(restorativePct, rMeanPct, "restorative");
  const rShowTyp = rLow != null && rHigh != null && rHigh > rLow;
  const avgRestorativeH = rMeanPct != null && inBed > 0 ? (rMeanPct / 100) * inBed : null;

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>
      <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <div style={{ marginBottom: 24 }}>{trendPanel}</div>

      <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${themeColors.accent}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: themeColors.text, marginBottom: 8, fontFamily: "Space Grotesk, sans-serif" }}>
          Sleep stages
        </div>
        <div style={{ fontSize: 12, color: themeColors.textDim, marginBottom: 16 }}>
          Wake day <strong style={{ color: themeColors.text }}>{wakeDateYmd}</strong>
        </div>
        {!sleep || !stages ? (
          <div style={{ fontSize: 13, color: themeColors.textDim }}>
            No scored main sleep ending on this date — pick another day or sync WHOOP.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                paddingBottom: 10,
                borderBottom: `1px solid ${themeColors.border}`,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 18,
                    height: 10,
                    borderRadius: 2,
                    border: `1px dashed ${themeColors.textDim}`,
                    position: "relative",
                    opacity: 0.85,
                  }}
                  title="Typical range band"
                  aria-hidden
                />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: themeColors.textDim }}>TYPICAL RANGE</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: themeColors.text, fontFamily: "Space Grotesk, sans-serif" }}>
                DURATION {formatDurationClock(stages.inBed)}
              </div>
            </div>

            <div style={{ fontSize: 12, color: themeColors.textDim, marginBottom: 16 }}>
              Main sleep ending{" "}
              <strong style={{ color: themeColors.text }}>
                {sleep.end ? new Date(sleep.end).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
              </strong>
              {sleep.nap ? " · Nap" : ""}
            </div>

            {stageRow("awake", STAGES[0].label, STAGES[0].color, "awake")}
            {stageRow("light", STAGES[1].label, STAGES[1].color, "light")}
            {stageRow("sws", STAGES[2].label, STAGES[2].color, "sws")}
            {stageRow("rem", STAGES[3].label, STAGES[3].color, "rem")}

            {restorativeHours != null && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 18,
                  borderTop: `1px solid ${themeColors.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 2,
                        background: "linear-gradient(135deg, #f472b6, #a855f7)",
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        color: themeColors.text,
                        fontFamily: "Space Grotesk, sans-serif",
                      }}
                    >
                      RESTORATIVE SLEEP
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: themeColors.text, fontFamily: "Space Grotesk, sans-serif" }}>
                        {formatDurationClock(restorativeHours)}
                      </span>
                      <TrendGlyph trend={rTrend} themeColors={themeColors} />
                    </div>
                    <div style={{ fontSize: 12, color: themeColors.textDim, marginTop: 2 }}>{avgRestorativeH != null ? formatDurationClock(avgRestorativeH) : "—"}</div>
                  </div>
                </div>
                <WhoopBarTrack
                  fillPct={rBarPct}
                  lowPct={rShowTyp ? rLow : null}
                  highPct={rShowTyp ? Math.min(100, rHigh) : null}
                  fillColor="linear-gradient(90deg, #f472b6, #a855f7)"
                  height={28}
                />
                <div style={{ fontSize: 11, color: themeColors.textDim, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>vs your avg</span>
                  <span style={{ color: themeColors.text, fontWeight: 600 }}>{rMeanPct != null ? `${rMeanPct.toFixed(0)}%` : "—"}</span>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${themeColors.border}`,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 1, marginBottom: 4 }}>TIME IN BED</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: themeColors.accent }}>{formatHoursHm(stages.inBed)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 1, marginBottom: 4 }}>HOURS OF SLEEP</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: themeColors.accent }}>{formatHoursHm(stages.sleepTimeH)}</div>
              </div>
              {restorativeHours != null && (
                <div>
                  <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 1, marginBottom: 4 }}>RESTORATIVE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: themeColors.accent }}>{formatHoursHm(restorativeHours)}</div>
                </div>
              )}
              {stages.respiratoryRate != null && (
                <div>
                  <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 1, marginBottom: 4 }}>RESPIRATORY RATE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: themeColors.accent }}>{Number(stages.respiratoryRate).toFixed(1)} /min</div>
                </div>
              )}
              {stages.performancePct != null && (
                <div>
                  <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 1, marginBottom: 4 }}>PERFORMANCE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: themeColors.accent }}>{stages.performancePct}%</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

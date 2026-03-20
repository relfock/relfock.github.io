import { useMemo, useState } from "react";
import { millisToHm } from "../lib/whoop.js";
import { buildFitnessMarkerRows } from "../data/whoopFitnessMarkers.js";
import { WhoopRingDial } from "./WhoopRingDial.jsx";

const HERO = {
  recovery: { id: "whoop_recovery_score", title: "Recovery", max: 100, ringColor: "#6acc9a" },
  sleep: { id: "whoop_sleep_performance", title: "Sleep", max: 100, ringColor: "#a78bfa" },
  strain: { id: "whoop_cycle_strain", title: "Strain", max: 21, ringColor: "#f59e0b" },
};

const HERO_IDS = new Set([HERO.recovery.id, HERO.sleep.id, HERO.strain.id]);

function formatIsoDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function pickRow(rows, id) {
  return rows.find((r) => r.id === id) ?? null;
}

/**
 * @param {object} props
 * @param {object} props.themeColors
 * @param {object | null} props.cache — whoopCache[personId]
 * @param {boolean} props.connected
 * @param {{ status: string, message: string }} props.syncState
 * @param {() => void} props.onSync
 * @param {() => void} props.onConnect
 * @param {() => void} props.onDisconnect
 * @param {string} props.effectiveRedirectUri — resolved redirect for WHOOP app registration
 * @param {() => void} props.onOpenConnectionSettings — opens Settings → API keys & WHOOP
 * @param {boolean} props.isMobile
 * @param {(markerId: string) => void} props.onMarkerClick
 */
export function FitnessWhoopView({
  themeColors,
  cache,
  connected,
  syncState,
  onSync,
  onConnect,
  onDisconnect,
  effectiveRedirectUri,
  onOpenConnectionSettings,
  isMobile,
  onMarkerClick,
}) {
  const [allMetricsOpen, setAllMetricsOpen] = useState(false);
  const [tableSort, setTableSort] = useState({ by: "label", dir: "asc" });

  const rows = useMemo(() => buildFitnessMarkerRows(cache), [cache]);

  const sortedRows = useMemo(() => {
    const { by, dir } = tableSort;
    const mul = dir === "asc" ? 1 : -1;
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      if (by === "label") cmp = a.label.localeCompare(b.label);
      else if (by === "category") cmp = a.category.localeCompare(b.category) || a.label.localeCompare(b.label);
      else if (by === "latest") {
        const av = a.latestValue;
        const bv = b.latestValue;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
      } else if (by === "points") cmp = a.pointCount - b.pointCount;
      return cmp * mul;
    });
    return list;
  }, [rows, tableSort]);

  const secondaryRows = useMemo(() => rows.filter((r) => !HERO_IDS.has(r.id)), [rows]);

  const recoveryRow = pickRow(rows, HERO.recovery.id);
  const sleepRow = pickRow(rows, HERO.sleep.id);
  const strainRow = pickRow(rows, HERO.strain.id);
  const hrvRow = pickRow(rows, "whoop_hrv_rmssd");

  const dialSize = isMobile ? 128 : 152;

  const recoverySublabel = hrvRow?.pointCount ? `HRV ${hrvRow.latestDisplay}` : undefined;
  const sleepSublabel = sleepRow?.pointCount ? "Sleep performance" : undefined;
  const strainSublabel = strainRow?.pointCount ? "Day strain (cycle)" : undefined;

  const profile = cache?.profile;

  const toggleSort = (by) => {
    setTableSort((prev) => ({
      by,
      dir: prev.by === by && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const sortHint = (by) => (tableSort.by === by ? (tableSort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div style={{ animation: "slideIn 0.3s ease" }}>
      <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: themeColors.accent, fontFamily: "Space Grotesk, sans-serif" }}>
        Fitness (WHOOP)
      </div>
      <p style={{ fontSize: 12, color: themeColors.textDim, marginBottom: 16, maxWidth: 720, lineHeight: 1.55 }}>
        Overview inspired by the WHOOP app: recovery, sleep, and strain at a glance; drill into any metric for trends. Set your WHOOP OAuth app
        credentials under <strong>Settings → API keys & WHOOP</strong> (same place as AI keys; included in JSON backup). Use <strong>Sync now</strong>{" "}
        for a full history pull.
      </p>

      {/* Top bar: profile, sync, open API keys modal */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: "1 1 200px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            {profile && (
              <div style={{ fontSize: 14, color: themeColors.text, fontWeight: 600 }}>
                {profile.first_name} {profile.last_name}
              </div>
            )}
            {cache?.syncedAt && (
              <span style={{ fontSize: 11, color: themeColors.textDim }}>Last synced {formatIsoDate(cache.syncedAt)}</span>
            )}
          </div>
          {effectiveRedirectUri ? (
            <div style={{ fontSize: 10, color: themeColors.textDim, wordBreak: "break-all" }}>
              OAuth redirect URI (register in WHOOP): <code style={{ color: themeColors.accent }}>{effectiveRedirectUri}</code>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onOpenConnectionSettings}>
            API keys & WHOOP
          </button>
          {connected ? (
            <>
              <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={onSync} disabled={syncState.status === "loading"}>
                {syncState.status === "loading" ? "Syncing…" : "Sync now"}
              </button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onDisconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={onConnect}>
              Connect WHOOP
            </button>
          )}
        </div>
      </div>

      {syncState.message && syncState.status !== "idle" && (
        <div
          style={{
            marginBottom: 16,
            fontSize: 12,
            color: syncState.status === "error" ? "#f88" : syncState.status === "ok" ? "#6acc9a" : themeColors.textDim,
          }}
        >
          {syncState.message}
        </div>
      )}

      {/* Hero dials */}
      <div
        style={{
          fontSize: 11,
          color: themeColors.textDim,
          letterSpacing: 2,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Today at a glance
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: isMobile ? 14 : 18,
          marginBottom: 28,
          maxWidth: 1100,
        }}
      >
        <WhoopRingDial
          title={HERO.recovery.title}
          value={recoveryRow?.latestValue ?? null}
          max={HERO.recovery.max}
          display={recoveryRow?.pointCount ? recoveryRow.latestDisplay : "—"}
          sublabel={recoverySublabel}
          ringColor={HERO.recovery.ringColor}
          diameter={dialSize}
          dimmed={!recoveryRow?.pointCount}
          onClick={() => onMarkerClick(HERO.recovery.id)}
        />
        <WhoopRingDial
          title={HERO.sleep.title}
          value={sleepRow?.latestValue ?? null}
          max={HERO.sleep.max}
          display={sleepRow?.pointCount ? sleepRow.latestDisplay : "—"}
          sublabel={sleepSublabel}
          ringColor={HERO.sleep.ringColor}
          diameter={dialSize}
          dimmed={!sleepRow?.pointCount}
          onClick={() => onMarkerClick(HERO.sleep.id)}
        />
        <WhoopRingDial
          title={HERO.strain.title}
          value={strainRow?.latestValue ?? null}
          max={HERO.strain.max}
          display={strainRow?.pointCount ? strainRow.latestDisplay : "—"}
          sublabel={strainSublabel}
          ringColor={HERO.strain.ringColor}
          diameter={dialSize}
          dimmed={!strainRow?.pointCount}
          onClick={() => onMarkerClick(HERO.strain.id)}
        />
      </div>

      {/* Secondary metrics */}
      <div
        style={{
          fontSize: 11,
          color: themeColors.textDim,
          letterSpacing: 2,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        More metrics
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(148px, 1fr))",
          gap: 10,
          marginBottom: 28,
          maxWidth: 1100,
        }}
      >
        {secondaryRows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onMarkerClick(r.id)}
            className="card"
            style={{
              padding: "12px 14px",
              textAlign: "left",
              cursor: "pointer",
              border: `1px solid ${themeColors.border}`,
              background: themeColors.appBg,
              borderRadius: 10,
              transition: "border-color 0.2s, transform 0.15s",
              font: "inherit",
              color: "inherit",
            }}
          >
            <div style={{ fontSize: 10, color: themeColors.textDim, letterSpacing: 0.5, marginBottom: 4 }}>{r.category}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: themeColors.text, marginBottom: 6, lineHeight: 1.3 }}>{r.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: r.pointCount ? themeColors.accent : themeColors.textDim, fontFamily: "Space Grotesk, sans-serif" }}>
              {r.latestDisplay}
            </div>
          </button>
        ))}
      </div>
      {connected && secondaryRows.length === 0 && (
        <div style={{ fontSize: 12, color: themeColors.textDim, marginBottom: 24 }}>Sync to load secondary metrics.</div>
      )}

      {/* Recent workouts */}
      <div
        style={{
          fontSize: 11,
          color: themeColors.textDim,
          letterSpacing: 2,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Recent workouts
      </div>
      <div className="card" style={{ overflowX: "auto", marginBottom: 24, maxWidth: 1100 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
              <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>Sport</th>
              <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>Start</th>
              <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>Strain</th>
              <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>Avg HR</th>
              <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {(cache?.workouts || []).slice(0, 12).map((w) => {
              const sc = w.score;
              const start = w.start;
              const end = w.end;
              let dur = "—";
              if (start && end) {
                try {
                  dur = millisToHm(new Date(end) - new Date(start));
                } catch {
                  dur = "—";
                }
              }
              return (
                <tr
                  key={w.id || `${start}-${w.sport_name}`}
                  onClick={() => onMarkerClick("whoop_workout_strain")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMarkerClick("whoop_workout_strain");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}
                  title="Open workout strain trend"
                >
                  <td style={{ padding: "10px 12px" }}>{w.sport_name || "Activity"}</td>
                  <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{formatIsoDate(start)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{sc?.strain != null ? Number(sc.strain).toFixed(2) : "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{sc?.average_heart_rate != null ? `${sc.average_heart_rate}` : "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: themeColors.textDim }}>{dur}</td>
                </tr>
              );
            })}
            {(!cache?.workouts || cache.workouts.length === 0) && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center", color: themeColors.textDim }}>
                  {connected ? "No workouts in synced data yet." : "Connect and sync to load workouts."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Full table (collapsed) */}
      <button
        type="button"
        onClick={() => setAllMetricsOpen((o) => !o)}
        className="btn btn-secondary"
        style={{ marginBottom: 12, fontSize: 12 }}
        aria-expanded={allMetricsOpen}
      >
        {allMetricsOpen ? "Hide" : "Show"} all metrics table ({rows.length})
      </button>
      {allMetricsOpen && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${themeColors.border}` }}>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("label")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600 }}
                  >
                    Metric{sortHint("label")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("latest")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600 }}
                  >
                    Latest{sortHint("latest")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>Unit</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("points")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600, width: "100%", textAlign: "right" }}
                  >
                    Points{sortHint("points")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: themeColors.textDim }}>
                  <button
                    type="button"
                    onClick={() => toggleSort("category")}
                    style={{ background: "none", border: "none", color: themeColors.textDim, cursor: "pointer", font: "inherit", padding: 0, fontWeight: 600 }}
                  >
                    Category{sortHint("category")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onMarkerClick(r.id)}
                  style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: "pointer" }}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMarkerClick(r.id);
                    }
                  }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: themeColors.text }}>{r.label}</td>
                  <td style={{ padding: "10px 12px", color: r.pointCount ? themeColors.text : themeColors.textDim }}>{r.latestDisplay}</td>
                  <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{r.unit}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: themeColors.textDim }}>{r.pointCount}</td>
                  <td style={{ padding: "10px 12px", color: themeColors.textDim }}>{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

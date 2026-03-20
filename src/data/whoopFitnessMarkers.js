/**
 * WHOOP-derived fitness markers: extract time series from synced whoopCache for table + trends.
 */

/** @typedef {{ sortTime: string, date: string, value: number, displayValue: string }} FitnessPoint */

function sortPoints(arr) {
  arr.sort((a, b) => new Date(a.sortTime) - new Date(b.sortTime));
  return arr;
}

function addPoint(out, isoTime, value, displayValue) {
  if (value == null || Number.isNaN(Number(value))) return;
  const n = Number(value);
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return;
  out.push({
    sortTime: d.toISOString(),
    date: d.toISOString().slice(0, 10),
    value: n,
    displayValue: displayValue != null ? String(displayValue) : String(n),
  });
}

function hoursFromMilli(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return null;
  return Number(ms) / 3_600_000;
}

function extractRecoveries(cache, pick) {
  const out = [];
  for (const r of cache?.recoveries || []) {
    if (r.score_state && r.score_state !== "SCORED") continue;
    const t = r.created_at || r.updated_at;
    const row = pick(r.score, r);
    if (!row) continue;
    addPoint(out, t, row.value, row.display);
  }
  return sortPoints(out);
}

function extractSleeps(cache, pick) {
  const out = [];
  for (const r of cache?.sleeps || []) {
    if (r.score_state && r.score_state !== "SCORED") continue;
    const t = r.start || r.created_at;
    const row = pick(r.score, r);
    if (!row) continue;
    addPoint(out, t, row.value, row.display);
  }
  return sortPoints(out);
}

function extractCycles(cache, pick) {
  const out = [];
  for (const r of cache?.cycles || []) {
    if (r.score_state && r.score_state !== "SCORED") continue;
    const t = r.start || r.created_at;
    const row = pick(r.score, r);
    if (!row) continue;
    addPoint(out, t, row.value, row.display);
  }
  return sortPoints(out);
}

function extractWorkouts(cache, pick) {
  const out = [];
  for (const r of cache?.workouts || []) {
    if (r.score_state && r.score_state !== "SCORED") continue;
    const t = r.start || r.created_at;
    const row = pick(r.score, r);
    if (!row) continue;
    addPoint(out, t, row.value, row.display);
  }
  return sortPoints(out);
}

function extractBody(cache) {
  const out = [];
  const b = cache?.body;
  if (!b) return out;
  const t = cache?.syncedAt || new Date().toISOString();
  if (b.height_meter != null) {
    const cm = Number(b.height_meter) * 100;
    addPoint(out, t, cm, `${cm.toFixed(1)} cm`);
  }
  if (b.weight_kilogram != null) {
    const kg = Number(b.weight_kilogram);
    addPoint(out, t, kg, `${kg.toFixed(1)} kg`);
  }
  if (b.max_heart_rate != null) {
    const m = Number(b.max_heart_rate);
    addPoint(out, t, m, `${m} bpm`);
  }
  return sortPoints(out);
}

/** @returns {readonly { id: string, label: string, unit: string, category: string, extract: (cache: object) => FitnessPoint[] }[]} */
export function getWhoopFitnessMarkerDefs() {
  return [
    {
      id: "whoop_recovery_score",
      label: "Recovery score",
      unit: "%",
      category: "Recovery",
      extract: (c) =>
        extractRecoveries(c, (sc) => {
          const v = sc?.recovery_score;
          if (v == null) return null;
          return { value: v, display: `${v}%` };
        }),
    },
    {
      id: "whoop_resting_hr",
      label: "Resting heart rate",
      unit: "bpm",
      category: "Recovery",
      extract: (c) =>
        extractRecoveries(c, (sc) => {
          const v = sc?.resting_heart_rate;
          if (v == null) return null;
          return { value: v, display: `${v}` };
        }),
    },
    {
      id: "whoop_hrv_rmssd",
      label: "HRV (RMSSD)",
      unit: "ms",
      category: "Recovery",
      extract: (c) =>
        extractRecoveries(c, (sc) => {
          const v = sc?.hrv_rmssd_milli;
          if (v == null) return null;
          const n = Number(v);
          return { value: n, display: `${n.toFixed(1)}` };
        }),
    },
    {
      id: "whoop_spo2",
      label: "Blood oxygen (SpO₂)",
      unit: "%",
      category: "Recovery",
      extract: (c) =>
        extractRecoveries(c, (sc) => {
          const v = sc?.spo2_percentage;
          if (v == null) return null;
          return { value: v, display: `${Number(v).toFixed(1)}%` };
        }),
    },
    {
      id: "whoop_skin_temp",
      label: "Skin temperature",
      unit: "°C",
      category: "Recovery",
      extract: (c) =>
        extractRecoveries(c, (sc) => {
          const v = sc?.skin_temp_celsius;
          if (v == null) return null;
          return { value: v, display: `${Number(v).toFixed(2)} °C` };
        }),
    },
    {
      id: "whoop_sleep_performance",
      label: "Sleep performance",
      unit: "%",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const v = sc?.sleep_performance_percentage;
          if (v == null) return null;
          return { value: v, display: `${v}%` };
        }),
    },
    {
      id: "whoop_sleep_efficiency",
      label: "Sleep efficiency",
      unit: "%",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const v = sc?.sleep_efficiency_percentage;
          if (v == null) return null;
          return { value: v, display: `${Number(v).toFixed(1)}%` };
        }),
    },
    {
      id: "whoop_sleep_consistency",
      label: "Sleep consistency",
      unit: "%",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const v = sc?.sleep_consistency_percentage;
          if (v == null) return null;
          return { value: v, display: `${v}%` };
        }),
    },
    {
      id: "whoop_respiratory_rate",
      label: "Respiratory rate (sleep)",
      unit: "/min",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const v = sc?.respiratory_rate;
          if (v == null) return null;
          return { value: v, display: `${Number(v).toFixed(1)}` };
        }),
    },
    {
      id: "whoop_sleep_in_bed",
      label: "Time in bed",
      unit: "h",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const ms = sc?.stage_summary?.total_in_bed_time_milli;
          const h = hoursFromMilli(ms);
          if (h == null) return null;
          return { value: h, display: `${h.toFixed(2)} h` };
        }),
    },
    {
      id: "whoop_sleep_deep",
      label: "Deep sleep (SWS)",
      unit: "h",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const ms = sc?.stage_summary?.total_slow_wave_sleep_time_milli;
          const h = hoursFromMilli(ms);
          if (h == null) return null;
          return { value: h, display: `${h.toFixed(2)} h` };
        }),
    },
    {
      id: "whoop_sleep_rem",
      label: "REM sleep",
      unit: "h",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const ms = sc?.stage_summary?.total_rem_sleep_time_milli;
          const h = hoursFromMilli(ms);
          if (h == null) return null;
          return { value: h, display: `${h.toFixed(2)} h` };
        }),
    },
    {
      id: "whoop_sleep_light",
      label: "Light sleep",
      unit: "h",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const ms = sc?.stage_summary?.total_light_sleep_time_milli;
          const h = hoursFromMilli(ms);
          if (h == null) return null;
          return { value: h, display: `${h.toFixed(2)} h` };
        }),
    },
    {
      id: "whoop_sleep_awake",
      label: "Awake (sleep)",
      unit: "h",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const ms = sc?.stage_summary?.total_awake_time_milli;
          const h = hoursFromMilli(ms);
          if (h == null) return null;
          return { value: h, display: `${h.toFixed(2)} h` };
        }),
    },
    {
      id: "whoop_sleep_disturbances",
      label: "Sleep disturbances",
      unit: "count",
      category: "Sleep",
      extract: (c) =>
        extractSleeps(c, (sc) => {
          const v = sc?.stage_summary?.disturbance_count;
          if (v == null) return null;
          return { value: v, display: `${v}` };
        }),
    },
    {
      id: "whoop_cycle_strain",
      label: "Day strain (cycle)",
      unit: "strain",
      category: "Strain",
      extract: (c) =>
        extractCycles(c, (sc) => {
          const v = sc?.strain;
          if (v == null) return null;
          return { value: v, display: Number(v).toFixed(2) };
        }),
    },
    {
      id: "whoop_cycle_avg_hr",
      label: "Cycle average HR",
      unit: "bpm",
      category: "Strain",
      extract: (c) =>
        extractCycles(c, (sc) => {
          const v = sc?.average_heart_rate;
          if (v == null) return null;
          return { value: v, display: `${v}` };
        }),
    },
    {
      id: "whoop_cycle_max_hr",
      label: "Cycle max HR",
      unit: "bpm",
      category: "Strain",
      extract: (c) =>
        extractCycles(c, (sc) => {
          const v = sc?.max_heart_rate;
          if (v == null) return null;
          return { value: v, display: `${v}` };
        }),
    },
    {
      id: "whoop_cycle_kilojoule",
      label: "Cycle energy",
      unit: "kJ",
      category: "Strain",
      extract: (c) =>
        extractCycles(c, (sc) => {
          const v = sc?.kilojoule;
          if (v == null) return null;
          return { value: v, display: `${Math.round(v)}` };
        }),
    },
    {
      id: "whoop_workout_strain",
      label: "Workout strain",
      unit: "strain",
      category: "Workout",
      extract: (c) =>
        extractWorkouts(c, (sc) => {
          const v = sc?.strain;
          if (v == null) return null;
          return { value: v, display: Number(v).toFixed(2) };
        }),
    },
    {
      id: "whoop_workout_avg_hr",
      label: "Workout average HR",
      unit: "bpm",
      category: "Workout",
      extract: (c) =>
        extractWorkouts(c, (sc) => {
          const v = sc?.average_heart_rate;
          if (v == null) return null;
          return { value: v, display: `${v}` };
        }),
    },
    {
      id: "whoop_workout_max_hr",
      label: "Workout max HR",
      unit: "bpm",
      category: "Workout",
      extract: (c) =>
        extractWorkouts(c, (sc) => {
          const v = sc?.max_heart_rate;
          if (v == null) return null;
          return { value: v, display: `${v}` };
        }),
    },
    {
      id: "whoop_workout_kilojoule",
      label: "Workout energy",
      unit: "kJ",
      category: "Workout",
      extract: (c) =>
        extractWorkouts(c, (sc) => {
          const v = sc?.kilojoule;
          if (v == null) return null;
          return { value: v, display: `${Math.round(v)}` };
        }),
    },
    {
      id: "whoop_workout_distance",
      label: "Workout distance",
      unit: "km",
      category: "Workout",
      extract: (c) =>
        extractWorkouts(c, (sc) => {
          const m = sc?.distance_meter;
          if (m == null) return null;
          const km = Number(m) / 1000;
          return { value: km, display: `${km.toFixed(2)} km` };
        }),
    },
    {
      id: "whoop_body_height",
      label: "Height (profile)",
      unit: "cm",
      category: "Body",
      extract: (c) => {
        const b = c?.body;
        if (!b?.height_meter) return [];
        const out = [];
        const cm = Number(b.height_meter) * 100;
        addPoint(out, c?.syncedAt || new Date().toISOString(), cm, `${cm.toFixed(1)} cm`);
        return sortPoints(out);
      },
    },
    {
      id: "whoop_body_weight",
      label: "Weight (profile)",
      unit: "kg",
      category: "Body",
      extract: (c) => {
        const b = c?.body;
        if (!b?.weight_kilogram) return [];
        const out = [];
        const kg = Number(b.weight_kilogram);
        addPoint(out, c?.syncedAt || new Date().toISOString(), kg, `${kg.toFixed(1)} kg`);
        return sortPoints(out);
      },
    },
    {
      id: "whoop_body_max_hr",
      label: "Max HR (profile)",
      unit: "bpm",
      category: "Body",
      extract: (c) => {
        const b = c?.body;
        if (!b?.max_heart_rate) return [];
        const out = [];
        const m = Number(b.max_heart_rate);
        addPoint(out, c?.syncedAt || new Date().toISOString(), m, `${m}`);
        return sortPoints(out);
      },
    },
  ];
}

/**
 * @param {object | null} cache — whoopCache[personId]
 * @returns {{ id: string, label: string, unit: string, category: string, points: FitnessPoint[], pointCount: number, latestDisplay: string, latestValue: number | undefined }[]}
 */
export function buildFitnessMarkerRows(cache) {
  const defs = getWhoopFitnessMarkerDefs();
  return defs.map((def) => {
    const points = def.extract(cache || {});
    const latest = points[points.length - 1];
    return {
      id: def.id,
      label: def.label,
      unit: def.unit,
      category: def.category,
      points,
      pointCount: points.length,
      latestDisplay: latest?.displayValue ?? "—",
      latestValue: latest?.value,
    };
  });
}

export function getFitnessMarkerById(id) {
  return getWhoopFitnessMarkerDefs().find((d) => d.id === id) || null;
}

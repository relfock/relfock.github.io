import { aggregateFitnessPointsByDay, filterPointsByCutoff } from "./whoopTrendMath.js";

const MS_DAY = 86400000;

/** Mean of daily values over the last 30 days (calendar buckets). */
export function computeThirtyDayAverage(points, nowMs = Date.now()) {
  const cutoff = nowMs - 30 * MS_DAY;
  const filtered = filterPointsByCutoff(points, cutoff);
  const daily = aggregateFitnessPointsByDay(filtered);
  if (daily.length === 0) return null;
  return daily.reduce((a, d) => a + d.value, 0) / daily.length;
}

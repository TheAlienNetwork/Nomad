export interface ObservationRecord {
  id: string;
  species?: string;
  observedAt: string;
  windDirectionFromDegrees?: number | null;
  temperatureC?: number | null;
  elevationMeters?: number | null;
  nearWater?: boolean;
  terrainType?: string;
}

export interface PatternFinding {
  truthLayer: "inferred";
  statement: string;
  caveat: string;
  sampleSize: number;
}

function cardinalBucket(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  return dirs[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] ?? "N";
}

export function summarizeWindSightings(
  observations: ObservationRecord[],
  speciesFilter?: string,
): PatternFinding | null {
  const rows = observations.filter((row) => {
    if (speciesFilter && row.species !== speciesFilter) return false;
    return row.windDirectionFromDegrees !== null && row.windDirectionFromDegrees !== undefined;
  });
  if (rows.length < 3) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const bucket = cardinalBucket(row.windDirectionFromDegrees as number);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return null;
  return {
    truthLayer: "inferred",
    statement: `Across ${rows.length} recorded observations${speciesFilter ? ` for ${speciesFilter}` : ""}, ${top[1]} occurred during ${top[0]} winds.`,
    caveat:
      "This is a correlation in your own records, not a causal claim and not a prediction.",
    sampleSize: rows.length,
  };
}

export function summarizeHourlyActivity(
  observations: ObservationRecord[],
): PatternFinding | null {
  if (observations.length < 3) return null;
  const hours = new Map<number, number>();
  for (const row of observations) {
    const hour = new Date(row.observedAt).getHours();
    if (Number.isNaN(hour)) continue;
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  const ranked = [...hours.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return null;
  return {
    truthLayer: "inferred",
    statement: `Across ${observations.length} records, the most common hour was ${String(top[0]).padStart(2, "0")}:00 (${top[1]} observations).`,
    caveat: "Hourly counts describe your sample, not animal movement in general.",
    sampleSize: observations.length,
  };
}

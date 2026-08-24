import type { LonLat, TruthLayer, WaypointType } from "./types";

export function isHarvestMark(type: WaypointType): boolean {
  return type === "harvest";
}

export function harvestWaypoints<T extends { type: WaypointType }>(
  marks: readonly T[],
): T[] {
  return marks.filter((mark) => isHarvestMark(mark.type));
}

export function recordedKills<T extends { type: WaypointType; createdAt: string }>(
  marks: readonly T[],
): T[] {
  return harvestWaypoints(marks).sort((left, right) =>
    left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0,
  );
}

export function harvestLocations(
  marks: ReadonlyArray<{
    type: WaypointType;
    latitude: number;
    longitude: number;
  }>,
): LonLat[] {
  return harvestWaypoints(marks).map((mark) => ({
    latitude: mark.latitude,
    longitude: mark.longitude,
  }));
}

export interface HarvestHeatCell {
  cellId: string;
  center: LonLat;
  count: number;
  truthLayer: TruthLayer;
  disclaimer: string;
}

const DISCLAIMER =
  "This heat map is only your recorded kills. It is observed history, not a prediction that animals will be there.";

export function harvestHeatmap(
  points: readonly LonLat[],
  precision = 3,
): HarvestHeatCell[] {
  const buckets = new Map<string, { sumLat: number; sumLng: number; count: number }>();
  for (const point of points) {
    const cellId = `${point.latitude.toFixed(precision)}:${point.longitude.toFixed(precision)}`;
    const current = buckets.get(cellId) ?? { sumLat: 0, sumLng: 0, count: 0 };
    current.sumLat += point.latitude;
    current.sumLng += point.longitude;
    current.count += 1;
    buckets.set(cellId, current);
  }
  return [...buckets.entries()].map(([cellId, bucket]) => ({
    cellId,
    center: {
      latitude: bucket.sumLat / bucket.count,
      longitude: bucket.sumLng / bucket.count,
    },
    count: bucket.count,
    truthLayer: "observed",
    disclaimer: DISCLAIMER,
  }));
}

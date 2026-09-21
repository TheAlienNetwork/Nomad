import { destinationPoint, haversineMeters } from "./geo";
import type { LonLat } from "./types";

export const GLASSING_LOS_DISCLAIMER =
  "Line-of-sight is inferred from sampled elevations, not lidar. Trees, brush, and structures are not modeled.";

export type LosCell = {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  distanceMeters: number;
  visible: boolean;
};

export function glassingRayPoints(
  origin: LonLat,
  bearingDegrees: number,
  distanceMeters: number,
  steps = 16,
): LonLat[] {
  const count = Math.max(4, steps);
  const step = distanceMeters / count;
  const points: LonLat[] = [origin];
  for (let index = 1; index <= count; index += 1) {
    points.push(destinationPoint(origin, bearingDegrees, step * index));
  }
  return points;
}

export function evaluateLineOfSight(input: {
  observer: LonLat;
  observerElevationMeters: number;
  eyeHeightMeters?: number;
  samples: Array<{ point: LonLat; elevationMeters: number }>;
}): LosCell[] {
  const eye = input.observerElevationMeters + (input.eyeHeightMeters ?? 1.7);
  const cells: LosCell[] = input.samples
    .map((sample) => ({
      latitude: sample.point.latitude,
      longitude: sample.point.longitude,
      elevationMeters: sample.elevationMeters,
      distanceMeters: haversineMeters(input.observer, sample.point),
      visible: true,
    }))
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  for (let index = 1; index < cells.length; index += 1) {
    const target = cells[index];
    if (!target || target.distanceMeters < 1) continue;
    let blocked = false;
    for (let prior = 0; prior < index; prior += 1) {
      const mid = cells[prior];
      if (!mid || mid.distanceMeters < 1) continue;
      const lineElev =
        eye +
        (target.elevationMeters - eye) * (mid.distanceMeters / target.distanceMeters);
      if (mid.elevationMeters > lineElev + 0.5) {
        blocked = true;
        break;
      }
    }
    target.visible = !blocked;
  }
  return cells;
}

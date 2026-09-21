import { describe, expect, it } from "vitest";
import { evaluateLineOfSight, glassingRayPoints } from "../src/glassing-los";

describe("glassing line of sight", () => {
  it("samples a ray including the origin", () => {
    const origin = { latitude: 41.67, longitude: -79.17 };
    const points = glassingRayPoints(origin, 90, 800, 8);
    expect(points[0]).toEqual(origin);
    expect(points.length).toBe(9);
  });

  it("hides a far sample behind a ridge", () => {
    const observer = { latitude: 41.67, longitude: -79.17 };
    const cells = evaluateLineOfSight({
      observer,
      observerElevationMeters: 400,
      samples: [
        { point: observer, elevationMeters: 400 },
        { point: { latitude: 41.671, longitude: -79.17 }, elevationMeters: 480 },
        { point: { latitude: 41.673, longitude: -79.17 }, elevationMeters: 410 },
      ],
    });
    const far = cells[cells.length - 1];
    expect(far?.visible).toBe(false);
  });

  it("keeps a descending slope visible", () => {
    const observer = { latitude: 41.67, longitude: -79.17 };
    const cells = evaluateLineOfSight({
      observer,
      observerElevationMeters: 500,
      samples: [
        { point: observer, elevationMeters: 500 },
        { point: { latitude: 41.671, longitude: -79.17 }, elevationMeters: 480 },
        { point: { latitude: 41.673, longitude: -79.17 }, elevationMeters: 450 },
      ],
    });
    expect(cells.every((cell) => cell.visible)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  formatBearing,
  formatDistance,
  haversineMeters,
  initialBearingDegrees,
  normalizeBearing,
  pathLengthMeters,
  pointInPolygon,
  tileToBBox,
} from "../src/geo";

describe("distance and bearing", () => {
  it("computes the Houston–Dallas approximate distance", () => {
    const meters = haversineMeters(
      { latitude: 29.7604, longitude: -95.3698 },
      { latitude: 32.7767, longitude: -96.797 },
    );
    expect(meters / 1000).toBeGreaterThan(350);
    expect(meters / 1000).toBeLessThan(400);
  });

  it("computes northward bearing", () => {
    const bearing = initialBearingDegrees(
      { latitude: 30, longitude: -95 },
      { latitude: 31, longitude: -95 },
    );
    expect(bearing < 5 || bearing > 355).toBe(true);
  });

  it("normalizes negative bearings", () => {
    expect(normalizeBearing(-90)).toBe(270);
  });

  it("formats field distances", () => {
    expect(formatDistance(80)).toMatch(/yd/);
    expect(formatDistance(3200)).toMatch(/mi/);
  });

  it("formats compass bearings", () => {
    expect(formatBearing(0)).toContain("N");
    expect(formatBearing(90)).toContain("E");
  });

  it("sums a track length", () => {
    const length = pathLengthMeters([
      { latitude: 30, longitude: -95 },
      { latitude: 30.01, longitude: -95 },
      { latitude: 30.02, longitude: -95 },
    ]);
    expect(length).toBeGreaterThan(2000);
  });
});

describe("spatial helpers", () => {
  it("detects a point inside a polygon", () => {
    const ring: Array<[number, number]> = [
      [-96, 30],
      [-94, 30],
      [-94, 32],
      [-96, 32],
      [-96, 30],
    ];
    expect(pointInPolygon({ longitude: -95, latitude: 31 }, [ring])).toBe(true);
    expect(pointInPolygon({ longitude: -97, latitude: 31 }, [ring])).toBe(false);
  });

  it("converts a web-mercator tile to a bbox", () => {
    const bbox = tileToBBox(1, 0, 0);
    expect(bbox.west).toBe(-180);
    expect(bbox.east).toBe(0);
  });
});

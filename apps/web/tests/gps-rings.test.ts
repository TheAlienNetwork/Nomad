import { describe, expect, it } from "vitest";
import {
  buildGpsRangeRingCollection,
  classifyGpsRingIntel,
  formatDeltaFeet,
  formatHudDelta,
  formatHudFeet,
  formatHudYards,
  gpsRangeMeters,
  gpsRingHudLine,
  gpsRingSamplePoints,
  resolveGpsRingKind,
  type GpsRingKind,
  type GpsRingSample,
} from "../src/lib/gps-rings";

const ORIGIN = { latitude: 30.58, longitude: -95.47 };

function sample(
  yards: number,
  bearing: number,
  elevationMeters: number | null,
): GpsRingSample {
  return {
    yards,
    bearing,
    longitude: ORIGIN.longitude,
    latitude: ORIGIN.latitude,
    elevationMeters,
  };
}

describe("gps rings", () => {
  it("keeps range yards at 100 / 200 / 400", () => {
    expect(gpsRangeMeters(100)).toBeCloseTo(91.44);
    expect(gpsRangeMeters(200)).toBeCloseTo(182.88);
    expect(gpsRangeMeters(400)).toBeCloseTo(365.76);
  });

  it("samples eight bearings on each ring", () => {
    const points = gpsRingSamplePoints(ORIGIN);
    expect(points).toHaveLength(24);
    expect(points.filter((point) => point.yards === 200)).toHaveLength(8);
  });

  it("builds three geodesic range rings", () => {
    const collection = buildGpsRangeRingCollection(ORIGIN);
    expect(collection.features).toHaveLength(3);
    expect(collection.features.map((feature) => feature.properties?.yards)).toEqual([100, 200, 400]);
  });

  it("formats HUD feet and yard readouts", () => {
    expect(formatHudFeet(112.776)).toBe("0370");
    expect(formatHudYards(100)).toBe("0100");
    expect(formatHudDelta(9.144)).toBe("+030");
    expect(formatHudDelta(-3.6576)).toBe("-012");
  });

  it("formats signed foot deltas", () => {
    expect(formatDeltaFeet(5.4864)).toBe("+18 ft");
    expect(formatDeltaFeet(-3.6576)).toBe("-12 ft");
    expect(formatDeltaFeet(0)).toBe("0 ft");
  });

  it("classifies high ground at 10 ft of rise", () => {
    const intel = classifyGpsRingIntel(100, [
      sample(200, 40, 100),
      sample(400, 40, 112.2),
      sample(200, 220, 99),
    ]);
    expect(intel?.kind).toBe("high");
    expect(intel?.bearing).toBe(40);
    expect(intel?.label).toContain("HIGH");
    expect(gpsRingHudLine(intel)).toContain("HIGH");
  });

  it("classifies low ground when there is no 10 ft rise", () => {
    const intel = classifyGpsRingIntel(100, [sample(200, 180, 96), sample(400, 90, 100)]);
    expect(intel?.kind).toBe("low");
    expect(intel?.label).toContain("LOW");
    expect(gpsRingHudLine(intel)).toContain("LOW");
  });

  it("stays level when deltas are under 10 ft", () => {
    const intel = classifyGpsRingIntel(100, [sample(200, 0, 102), sample(200, 180, 99)]);
    expect(intel?.kind).toBe("level");
    expect(gpsRingHudLine(intel)).toBeNull();
  });

  it("skips labels when DEM samples are missing", () => {
    expect(classifyGpsRingIntel(100, [sample(200, 0, null)])).toBeNull();
    expect(classifyGpsRingIntel(null, [sample(200, 0, 120)])).toBeNull();
  });

  it("exhausts the high/low/level union", () => {
    const kinds: GpsRingKind[] = ["high", "low", "level"];
    expect(kinds.map(resolveGpsRingKind)).toEqual(kinds);
  });
});

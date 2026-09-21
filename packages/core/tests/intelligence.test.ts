import { describe, expect, it } from "vitest";
import { classifyAssistantIntent, refuseInventedLegalAnswer, runScout } from "../src/ai";
import { detectTerrainFeatures } from "../src/terrain-features";
import { attachHabitatContext, scoreHabitatCell, explainHuntScore } from "../src/habitat";
import { normalizeLandCover } from "../src/landcover";
import { deriveTerrainGrid, type ElevationSample } from "../src/terrain";
import { evaluateWind, whatIfWind } from "../src/wind";

describe("terrain derivation", () => {
  it("derives slope and aspect from a rising-east grid", () => {
    const samples = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        samples.push({
          point: { latitude: 30 + r * 0.01, longitude: -95 + c * 0.01 },
          elevationMeters: c * 40,
        });
      }
    }
    const grid = deriveTerrainGrid(samples, 3, 3, 1000);
    const center = grid.cells[4];
    expect(center?.slopeDegrees).toBeGreaterThan(1);
    expect(center?.aspectDegrees).not.toBeNull();
  });
});

function gridSamples(
  rows: number,
  cols: number,
  elevation: (row: number, col: number) => number,
): ElevationSample[] {
  const samples: ElevationSample[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      samples.push({
        point: { latitude: 30 + r * 0.01, longitude: -95 + c * 0.01 },
        elevationMeters: elevation(r, c),
      });
    }
  }
  return samples;
}

describe("terrain feature detection", () => {
  it("classifies a saddle from a ridge cut by a perpendicular low", () => {
    const samples = gridSamples(5, 5, (r, c) => 100 + (c === 2 ? 40 : 0) - (r === 2 ? 30 : 0));
    const grid = deriveTerrainGrid(samples, 5, 5, 100);
    const features = detectTerrainFeatures(grid);
    expect(features.every((feature) => feature.truthLayer === "inferred")).toBe(true);
    expect(features.some((feature) => feature.kind === "saddle")).toBe(true);
    expect(features[0]?.disclaimer).toMatch(/sampled elevations/i);
  });

  it("classifies a ridge and a glassing candidate on a local high", () => {
    const samples = gridSamples(
      5,
      5,
      (r, c) => 100 - ((r - 2) ** 2 + (c - 2) ** 2) * 20,
    );
    const grid = deriveTerrainGrid(samples, 5, 5, 100);
    const features = detectTerrainFeatures(grid);
    expect(features.some((feature) => feature.kind === "ridgeline")).toBe(true);
    expect(features.some((feature) => feature.kind === "glassing_candidate")).toBe(true);
  });

  it("classifies a bench on a mid-slope flattening", () => {
    const samples = gridSamples(5, 5, (_r, c) => [0, 35, 50, 65, 110][c] ?? 0);
    const grid = deriveTerrainGrid(samples, 5, 5, 100);
    const features = detectTerrainFeatures(grid);
    expect(features.some((feature) => feature.kind === "bench")).toBe(true);
  });

  it("classifies a pinch in a narrow valley", () => {
    const samples = gridSamples(5, 5, (_r, c) => 100 + Math.abs(c - 2) * 30);
    const grid = deriveTerrainGrid(samples, 5, 5, 100);
    const features = detectTerrainFeatures(grid);
    expect(
      features.some((feature) => feature.kind === "pinch" || feature.kind === "funnel"),
    ).toBe(true);
    expect(features.some((feature) => feature.kind === "drainage")).toBe(true);
  });

  it("classifies cliffs from steep sampled slopes", () => {
    const samples = gridSamples(5, 5, (_r, c) => c * 80);
    const grid = deriveTerrainGrid(samples, 5, 5, 100);
    const features = detectTerrainFeatures(grid);
    expect(features.some((feature) => feature.kind === "cliff")).toBe(true);
  });

  it("classifies a basin at a local elevation minimum", () => {
    const samples = gridSamples(
      5,
      5,
      (r, c) => 100 + ((r - 2) ** 2 + (c - 2) ** 2) * 8,
    );
    const grid = deriveTerrainGrid(samples, 5, 5, 100);
    const features = detectTerrainFeatures(grid);
    expect(features.some((feature) => feature.kind === "basin")).toBe(true);
  });
});

describe("land-cover normalization", () => {
  it("maps NLCD classes and preserves the original code", () => {
    const result = normalizeLandCover("42", "nlcd");
    expect(result.normalized).toBe("evergreen_forest");
    expect(result.originalClass).toBe("42");
    expect(result.truthLayer).toBe("authoritative");
  });

  it("does not invent a class for unknown codes", () => {
    expect(normalizeLandCover("999", "nlcd").normalized).toBe("unknown");
  });
});

describe("habitat scoring", () => {
  it("scores a forested, remote, near-water cell highly for bedding/security", () => {
    const result = scoreHabitatCell(
      {
        cellId: "abc123",
        species: "whitetail",
        slopeDegrees: 12,
        landCover: "deciduous_forest",
        distanceToWaterMeters: 180,
        distanceToRoadMeters: 1800,
        distanceToTrailMeters: 900,
        terrainPosition: "slope",
        publicLandStatus: "public",
        legalAccessConfidence: "authoritative",
      },
      { period: "morning" },
    );
    expect(result.truthLayer).toBe("inferred");
    expect(result.scores.bedding).toBeGreaterThan(60);
    expect(result.scores.water).toBeGreaterThan(70);
    expect(result.disclaimer).toMatch(/not claims that animals are present/i);
  });

  it("leaves water score null when distance is unknown", () => {
    const result = scoreHabitatCell(
      {
        cellId: "missing-water",
        species: "whitetail",
        landCover: "mixed_forest",
      },
      { period: "now" },
    );
    expect(result.scores.water).toBeNull();
    expect(result.missing.some((item) => item.factor === "distance_to_water")).toBe(
      true,
    );
    expect(result.confidence).toBeLessThan(0.85);
  });

  it("changes scores with morning vs evening period", () => {
    const input = {
      cellId: "period-cell",
      species: "whitetail" as const,
      landCover: "deciduous_forest" as const,
      distanceToWaterMeters: 180,
      distanceToRoadMeters: 1800,
      slopeDegrees: 12,
      terrainPosition: "slope" as const,
      publicLandStatus: "public" as const,
      windClass: "favorable" as const,
    };
    const morning = scoreHabitatCell(input, { period: "morning" });
    const evening = scoreHabitatCell(input, { period: "evening" });
    expect(morning.scores.bedding ?? 0).toBeGreaterThan(evening.scores.bedding ?? 0);
    expect(evening.scores.feeding ?? 0).toBeGreaterThan(morning.scores.feeding ?? 0);
  });

  it("explains a Nomad Score without claiming animals are present", () => {
    const result = scoreHabitatCell(
      {
        cellId: "explain",
        species: "whitetail",
        landCover: "deciduous_forest",
        distanceToWaterMeters: 384,
        distanceToRoadMeters: 1931,
        slopeDegrees: 10,
        aspectDegrees: 10,
        terrainPosition: "slope",
        terrainFeatures: ["bench", "funnel"],
        windClass: "favorable",
        publicLandStatus: "public",
      },
      { period: "morning" },
    );
    const explained = explainHuntScore(result);
    expect(explained.label).toBe("Nomad Score");
    expect(explained.truthLayer).toBe("inferred");
    expect(explained.score).not.toBeNull();
    expect(explained.reasons.join(" ")).toMatch(/bench/i);
    expect(explained.disclaimer).toMatch(/not claims that animals are present/i);
    expect(explained.reasons.join(" ").toLowerCase()).not.toMatch(/will be there|guaranteed|animals are present/);
  });

  it("attaches overlay names only when a cell sits inside a polygon", () => {
    const padus = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { Unit_Nm: "TEST PUBLIC UNIT A" },
          geometry: {
            type: "Polygon",
            coordinates: [[[-96, 30], [-94, 30], [-94, 32], [-96, 32], [-96, 30]]],
          },
        },
      ],
    };
    const hunts = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { LocName: "TEST LISTED HUNT" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [[-97.2, 30.4], [-97.1, 30.4], [-97.1, 30.6], [-97.2, 30.6], [-97.2, 30.4]],
            ],
          },
        },
      ],
    };
    const [inside, outside] = attachHabitatContext(
      [
        {
          cellId: "in",
          species: "whitetail",
          center: { latitude: 31, longitude: -95 },
          publicLandStatus: "unknown",
        },
        {
          cellId: "out",
          species: "whitetail",
          center: { latitude: 30.5, longitude: -97.15 },
          publicLandStatus: "public",
        },
      ],
      { padus, publicHuntAreas: hunts },
    );
    expect(inside?.publicLandStatus).toBe("public");
    expect(inside?.padusUnitName).toBe("TEST PUBLIC UNIT A");
    expect(inside?.publicHuntAreaLabel).toBeUndefined();
    expect(outside?.publicLandStatus).toBe("unknown");
    expect(outside?.padusUnitName).toBeUndefined();
    expect(outside?.publicHuntAreaLabel).toBe("TEST LISTED HUNT");
  });
});

describe("wind evaluation", () => {
  it("classifies a downwind setup as unfavorable", () => {
    const result = evaluateWind(
      { latitude: 30, longitude: -95 },
      { latitude: 30.01, longitude: -95 },
      {
        directionFromDegrees: 180,
        speedMps: 4,
        source: "test",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      },
    );
    expect(result.classification).toBe("unfavorable");
  });

  it("recalculates a what-if wind change", () => {
    const result = whatIfWind(
      { latitude: 30, longitude: -95 },
      { latitude: 30.01, longitude: -95 },
      0,
      4,
    );
    expect(result.classification).toBe("favorable");
  });
});

describe("AI safety", () => {
  it("refuses to invent regulations or property status without evidence", () => {
    const legal = refuseInventedLegalAnswer("regulations", []);
    expect(legal.allowed).toBe(false);
    expect(legal.answer).toMatch(/cannot be stated/i);
    const property = refuseInventedLegalAnswer("property", []);
    expect(property.allowed).toBe(false);
    expect(property.answer).toMatch(/cannot be determined/i);
  });

  it("records hunting units as evidence without treating them as seasons", () => {
    const scout = runScout({
      species: "whitetail",
      period: "now",
      bounds: { west: -96, south: 30, east: -94, north: 32 },
      cells: [
        {
          cellId: "30.0000:-95.0000",
          species: "whitetail",
          landCover: "mixed_forest",
          slopeDegrees: 10,
        },
      ],
      huntingUnitsAvailable: true,
      regulationsAvailable: false,
    });
    expect(scout.evidence.some((item) => item.tool === "queryHuntingUnits" && item.ok)).toBe(
      true,
    );
    expect(scout.warnings.join(" ")).not.toMatch(/hunting-unit boundaries are unavailable/i);
    expect(scout.warnings.join(" ")).toMatch(/wildlife agency/i);
  });

  it("does not let a scout invent hunting units", () => {
    const scout = runScout({
      species: "whitetail",
      period: "now",
      bounds: { west: -96, south: 30, east: -94, north: 32 },
      cells: [
        {
          cellId: "30.0000:-95.0000",
          species: "whitetail",
          landCover: "mixed_forest",
          slopeDegrees: 10,
        },
      ],
      huntingUnitsAvailable: false,
      regulationsAvailable: false,
    });
    expect(scout.warnings.join(" ")).toMatch(/hunting-unit/i);
    expect(scout.evidence.some((item) => item.tool === "queryHuntingUnits" && !item.ok)).toBe(
      true,
    );
    expect(scout.truthLayer).toBe("inferred");
  });

  it("routes legal language to the legal intent", () => {
    expect(classifyAssistantIntent("What is the bag limit?")).toBe("legal");
    expect(classifyAssistantIntent("Can I hunt this WMA?")).toBe("legal");
    expect(classifyAssistantIntent("Scout this ridge for whitetail")).toBe("scout");
    expect(classifyAssistantIntent("What TPWD hunt area overlay is this?")).toBe("data");
    expect(classifyAssistantIntent("Which DMU is this national forest in?")).toBe("data");
  });

  it("refuses to treat a hunt overlay as permission", () => {
    const legal = refuseInventedLegalAnswer("hunt_area", []);
    expect(legal.allowed).toBe(false);
    expect(legal.answer).toMatch(/not permission/i);
  });

  it("names PAD-US, DMU, and listed hunt overlays in scout without calling them permission", () => {
    const scout = runScout({
      species: "whitetail",
      period: "morning",
      bounds: { west: -96, south: 30, east: -94, north: 32 },
      cells: [
        {
          cellId: "30.5000:-95.4000",
          species: "whitetail",
          center: { latitude: 30.5, longitude: -95.4 },
          landCover: "mixed_forest",
          slopeDegrees: 10,
          padusUnitName: "Sam Houston National Forest",
          huntingUnitLabel: "14",
          publicHuntAreaLabel: "Sam Houston National Forest WMA",
          publicLandStatus: "public",
          terrainFeatures: ["bench", "funnel"],
        },
      ],
      huntingUnitsAvailable: true,
      publicHuntAreasAvailable: true,
      regulationsAvailable: false,
    });
    expect(scout.overlays.padusNames).toContain("Sam Houston National Forest");
    expect(scout.overlays.huntingUnitLabels).toContain("14");
    expect(scout.overlays.publicHuntAreaNames).toContain("Sam Houston National Forest WMA");
    expect(scout.evidence.some((item) => item.tool === "queryPublicHuntAreas" && item.ok)).toBe(
      true,
    );
    expect(scout.narrative).toMatch(/Sam Houston National Forest/);
    expect(scout.narrative).toMatch(/not permission/i);
    expect(scout.narrative.toLowerCase()).not.toMatch(/you may hunt|legal to hunt here/);
    expect(scout.warnings.join(" ")).toMatch(/GIS layers/i);
  });
});

import { describe, expect, it } from "vitest";
import { classifyAssistantIntent, refuseInventedLegalAnswer, runScout } from "../src/ai";
import { scoreHabitatCell } from "../src/habitat";
import { normalizeLandCover } from "../src/landcover";
import { deriveTerrainGrid } from "../src/terrain";
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
    expect(classifyAssistantIntent("Scout this ridge for whitetail")).toBe("scout");
  });
});

import { describe, expect, it } from "vitest";
import { harvestHeatmap, harvestLocations, isHarvestMark, recordedKills } from "../src/harvest";

describe("harvest heat map", () => {
  it("uses only kill/harvest marks", () => {
    expect(isHarvestMark("harvest")).toBe(true);
    expect(isHarvestMark("sighting")).toBe(false);
    const points = harvestLocations([
      { type: "harvest", latitude: 31.32, longitude: -95.15 },
      { type: "sighting", latitude: 31.4, longitude: -95.2 },
      { type: "scat", latitude: 31.33, longitude: -95.16 },
    ]);
    expect(points).toHaveLength(1);
  });

  it("clusters nearby kills and stays labeled observed", () => {
    const cells = harvestHeatmap([
      { latitude: 31.32, longitude: -95.15 },
      { latitude: 31.3201, longitude: -95.1501 },
      { latitude: 30.58, longitude: -95.47 },
    ]);
    expect(cells).toHaveLength(2);
    const hot = cells.find((cell) => cell.count === 2);
    expect(hot?.truthLayer).toBe("observed");
    expect(hot?.disclaimer).toMatch(/your recorded kills/i);
  });

  it("lists recorded kills newest first", () => {
    const listed = recordedKills([
      { type: "harvest" as const, createdAt: "2026-01-01T00:00:00.000Z" },
      { type: "sighting" as const, createdAt: "2026-08-01T00:00:00.000Z" },
      { type: "harvest" as const, createdAt: "2026-08-20T00:00:00.000Z" },
    ]);
    expect(listed.map((row) => row.createdAt)).toEqual([
      "2026-08-20T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
  });
});

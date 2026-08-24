import { describe, expect, it } from "vitest";
import { harvestsToFc, mapMarkWaypoints } from "../src/lib/harvest-map";
import { defaultLayers } from "../src/lib/store";
import type { Waypoint } from "@huntos/core";

function mark(partial: Partial<Waypoint> & Pick<Waypoint, "id" | "type">): Waypoint {
  return {
    userId: "user-1",
    name: partial.name ?? partial.type,
    latitude: partial.latitude ?? 31.32,
    longitude: partial.longitude ?? -95.15,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    photos: [],
    tags: [],
    visibility: "private",
    syncStatus: "local",
    version: 1,
    ...partial,
  };
}

describe("kill map layers", () => {
  it("keeps harvests on the kill layer only", () => {
    const waypoints = [
      mark({ id: "k1", type: "harvest", name: "Kill", latitude: 31.32, longitude: -95.15 }),
      mark({ id: "s1", type: "stand", name: "Oak stand", latitude: 31.33, longitude: -95.16 }),
    ];
    expect(mapMarkWaypoints(waypoints).map((row) => row.id)).toEqual(["s1"]);
    const harvests = harvestsToFc(waypoints);
    expect(harvests.features).toHaveLength(1);
    expect(harvests.features[0]?.properties.truthLayer).toBe("observed");
    expect(harvests.features[0]?.geometry.coordinates).toEqual([-95.15, 31.32]);
  });

  it("shows kill markers and heat by default", () => {
    const layers = defaultLayers();
    expect(layers.kills).toBe(true);
    expect(layers.killHeat).toBe(true);
  });
});

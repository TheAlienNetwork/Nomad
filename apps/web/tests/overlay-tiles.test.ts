import { describe, expect, it } from "vitest";
import { OVERLAY_CATALOG, overlayTileSpec } from "@huntos/core";
import { isOverlayTileSource, isBasemapTileSource, isDemTileSource } from "../src/server/tiles";
import { defaultLayers } from "../src/lib/store";

describe("overlay tile proxy", () => {
  it("registers every catalog tile slug", () => {
    for (const overlay of OVERLAY_CATALOG) {
      for (const tile of overlay.tiles) {
        expect(overlayTileSpec(tile.id)?.id).toBe(tile.id);
        expect(isOverlayTileSource(tile.id)).toBe(true);
      }
    }
    expect(isBasemapTileSource("usgs-topo")).toBe(true);
    expect(isOverlayTileSource("usgs-topo")).toBe(false);
    expect(isDemTileSource("terrarium")).toBe(true);
    expect(isBasemapTileSource("terrarium")).toBe(false);
  });

  it("keeps display flags independent of a download", () => {
    const layers = defaultLayers();
    expect(layers.publicLand).toBe(true);
    expect(layers.landCover).toBe(false);
    expect(layers.mvum).toBe(false);
    expect(layers.huntingUnits).toBe(false);
    expect(layers.lidar).toBe(false);
    expect(layers.wireframe).toBe(false);
  });

  it("defaults the hunt map to 3D orbit with Nera wire", async () => {
    const { setNeraMode, setNeraStyle, useHuntStore } = await import("../src/lib/store");
    expect(useHuntStore.getState().cameraMode).toBe("orbit");
    expect(useHuntStore.getState().mapTheme).toBe("dark");
    expect(useHuntStore.getState().neraMode).toBe(true);
    expect(useHuntStore.getState().neraStyle).toBe("wire");
    expect(useHuntStore.getState().followGps).toBe(false);
    expect(useHuntStore.getState().firstFixFlown).toBe(false);
    expect(useHuntStore.getState().terrainExaggeration).toBe(3.2);
    setNeraStyle("wire");
    expect(useHuntStore.getState().neraMode).toBe(true);
    expect(useHuntStore.getState().neraStyle).toBe("wire");
    setNeraMode(false);
    expect(useHuntStore.getState().neraMode).toBe(false);
    expect(useHuntStore.getState().neraStyle).toBe("wire");
    setNeraStyle("glass");
    setNeraMode(false);
  });
});

import { describe, expect, it } from "vitest";
import { createMapStyle, elevationSky, lightElevationSky, neraSky } from "../src/lib/map-style";

describe("map style", () => {
  it("uses USGS topo tiles for the default field basemap", () => {
    const style = createMapStyle("topo");
    expect(style.sources.basemap).toMatchObject({
      type: "raster",
    });
    const source = style.sources.basemap;
    if (source?.type === "raster") {
      expect(source.tiles?.[0]).toContain("/api/tiles/usgs-topo");
    }
  });

  it("loads Open Sans glyphs for DEM ring labels", () => {
    expect(createMapStyle("topo").glyphs).toBe("https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf");
  });

  it("uses a darker elevation sky than the 2D field sky", () => {
    expect(elevationSky()["sky-color"]).toBe("#031018");
    expect(elevationSky()["fog-color"]).toBe("#02080c");
  });

  it("uses a paler sky for the light 3D mesh", () => {
    expect(lightElevationSky()["sky-color"]).toBe("#9ec8d6");
    expect(lightElevationSky()["fog-color"]).toBe("#c5d4c8");
  });

  it("uses a void sky for Nera", () => {
    expect(neraSky()["sky-color"]).toBe("#000510");
    expect(neraSky()["fog-color"]).toBe("#031018");
  });
});

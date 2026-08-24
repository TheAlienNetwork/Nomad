import { describe, expect, it } from "vitest";
import { createMapStyle } from "../src/lib/map-style";

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
});

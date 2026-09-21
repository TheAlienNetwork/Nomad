import { describe, expect, it } from "vitest";
import {
  OVERLAY_IDS,
  defaultOverlayLayerFlags,
  defaultPackSelection,
  encodeLayerDefs,
  overlayDefinition,
  overlayTileRequestUrl,
  overlayTileSpec,
  overlaysForState,
} from "../src/overlays";
import {
  PACK_MAX_ZOOM,
  estimateOverlayPack,
  overlayPackUsesStatewideZoomCap,
  sanitizePackSelection,
} from "../src/overlay-pack";
import { TEXAS_PACK_EXTENT } from "../src/overlays";
import { isUsStateCode, stateHuntGuide } from "../src/state-guides";

describe("overlay catalog", () => {
  it("covers every overlay id in an exhaustive catalog", () => {
    for (const id of OVERLAY_IDS) {
      expect(overlayDefinition(id).id).toBe(id);
    }
    expect(defaultOverlayLayerFlags().publicLand).toBe(true);
    expect(defaultOverlayLayerFlags().landCover).toBe(false);
    expect(defaultOverlayLayerFlags().mvum).toBe(false);
    expect(defaultOverlayLayerFlags().lidar).toBe(false);
  });

  it("keeps TPWD overlays off the pack for non-Texas states", () => {
    const texas = overlaysForState("TX").map((item) => item.id);
    const colorado = overlaysForState("CO").map((item) => item.id);
    expect(texas).toContain("publicHuntAreas");
    expect(texas).toContain("huntingUnits");
    expect(texas).toContain("texasParcels");
    expect(colorado).not.toContain("publicHuntAreas");
    expect(colorado).not.toContain("huntingUnits");
    expect(colorado).not.toContain("texasParcels");
    expect(colorado).toContain("publicLand");
  });

  it("keeps PAD-US filters on Fee fields that exist in 4.1", () => {
    for (const item of overlaysForState("TX")) {
      if (item.datasetId !== "padus-4-1-fee") continue;
      const where = `${item.tiles[0]?.layerDefs?.["0"] ?? ""} ${item.vectorWhere ?? ""}`;
      expect(where).not.toMatch(/d_Des_Tp/);
      expect(where).not.toMatch(/Forest Service/);
      expect(where).not.toMatch(/Bureau of Land Management/);
    }
  });

  it("encodes ArcGIS layerDefs and builds export URLs", () => {
    expect(encodeLayerDefs({ "0": "Pub_Access = 'OA'" })).toBe(
      '{"0":"Pub_Access = \'OA\'"}',
    );
    const spec = overlayDefinition("publicLand").tiles[0];
    expect(spec).toBeDefined();
    const url = overlayTileRequestUrl(spec!, 8, 60, 105);
    expect(url).toContain("/export");
    expect(url).toContain("layerDefs=");
    expect(url).toContain("transparent=true");
    expect(spec!.dynamicLayers).toBeDefined();
    expect(overlayDefinition("nationalForests").tiles[0]?.dynamicLayers).toBeDefined();
    expect(overlayDefinition("publicHunting").tiles[0]?.opacity).toBeLessThan(0.5);
    const glass = overlayDefinition("publicLand").tiles[0]?.dynamicLayers as Array<{
      drawingInfo: { renderer: { symbol: { color: number[]; outline: { color: number[] } } } };
    }>;
    expect(glass[0]?.drawingInfo.renderer.symbol.color[3]).toBeGreaterThan(50);
    expect(glass[0]?.drawingInfo.renderer.symbol.color[3]).toBeLessThan(90);
    expect(glass[0]?.drawingInfo.renderer.symbol.outline.color[3]).toBeGreaterThan(150);
  });

  it("builds USGS 3DEP ImageServer lidar tiles", () => {
    const overlay = overlayDefinition("lidar");
    expect(overlay.group).toBe("terrain");
    expect(overlay.dense).toBe(true);
    expect(overlay.cacheMode).toBe("raster");
    const spec = overlay.tiles[0];
    expect(spec?.protocol).toBe("arcgis-image");
    expect(spec?.renderingRule).toBe("Hillshade Multidirectional");
    const url = overlayTileRequestUrl(spec!, 8, 60, 105);
    expect(url).toContain("/exportImage");
    expect(url).toContain("rasterFunction");
    expect(decodeURIComponent(url)).toContain("Hillshade Multidirectional");
    expect(overlayTileSpec("usgs-3dep-lidar")?.id).toBe("usgs-3dep-lidar");
  });
});

describe("overlay packs", () => {
  it("uses the Texas extent and skips unchecked ids", () => {
    const ids = sanitizePackSelection("TX", ["publicLand", "publicHuntAreas", "landCover", "nope"]);
    expect(ids).toEqual(["publicLand", "publicHuntAreas", "landCover"]);
    expect(sanitizePackSelection("CO", ["publicHuntAreas"])).toEqual([]);
    const estimate = estimateOverlayPack(TEXAS_PACK_EXTENT, ids);
    expect(estimate.extent).toEqual(TEXAS_PACK_EXTENT);
    expect(estimate.vectorLayers).toBe(2);
    expect(estimate.rasterSources).toBe(1);
    expect(overlayPackUsesStatewideZoomCap(estimate.minZoom, estimate.maxZoom)).toBe(true);
    expect(estimate.maxZoom).toBe(PACK_MAX_ZOOM);
    expect(estimate.maxZoom).toBeLessThan(11);
  });

  it("enables WTDMU tiles and keeps display flags independent of pack checks", () => {
    expect(overlayTileSpec("tpwd-wtdmu")?.id).toBe("tpwd-wtdmu");
    expect(overlayDefinition("huntingUnits").tiles[0]?.id).toBe("tpwd-wtdmu");
    const displayed = defaultOverlayLayerFlags();
    const pack = defaultPackSelection("TX");
    expect(displayed.landCover).toBe(false);
    expect(pack).toContain("huntingUnits");
    expect(pack).not.toContain("landCover");
    expect(sanitizePackSelection("TX", ["publicLand"])).toEqual(["publicLand"]);
    expect(sanitizePackSelection("TX", ["publicLand", "landCover"])).toEqual([
      "publicLand",
      "landCover",
    ]);
  });

  it("defaults pack checks to displayed land/hunt layers", () => {
    const selected = defaultPackSelection("TX", {
      publicLand: true,
      landCover: true,
      huntingUnits: false,
    });
    expect(selected).toContain("publicLand");
    expect(selected).not.toContain("landCover");
    expect(selected).not.toContain("huntingUnits");
  });
});

describe("state hunt guides", () => {
  it("resolves Texas without inventing seasons", () => {
    expect(isUsStateCode("TX")).toBe(true);
    expect(stateHuntGuide("TX")?.agency).toContain("Texas Parks");
  });
});

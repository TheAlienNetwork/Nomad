import { describe, expect, it } from "vitest";
import { parseRainViewerMaps, radarTileTemplate } from "../src/radar";

describe("RainViewer catalog", () => {
  it("joins past and nowcast frames", () => {
    const catalog = parseRainViewerMaps({
      host: "https://tilecache.rainviewer.com",
      radar: {
        past: [{ time: 100, path: "/v2/radar/100" }],
        nowcast: [{ time: 160, path: "/v2/radar/160" }],
      },
    });
    expect(catalog?.frames).toHaveLength(2);
    expect(catalog?.nowcastStartIndex).toBe(1);
    expect(radarTileTemplate(catalog!.host, catalog!.frames[0]!.path)).toContain(
      "/v2/radar/100/256/{z}/{x}/{y}/2/1_1.png",
    );
  });

  it("returns null without a host or frames", () => {
    expect(parseRainViewerMaps({})).toBeNull();
    expect(parseRainViewerMaps({ host: "https://example.com", radar: {} })).toBeNull();
  });
});

import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "topo" | "satellite" | "streets" | "hybrid";

export function createMapStyle(basemap: BasemapId): StyleSpecification {
  if (basemap === "streets") {
    return {
      version: 8,
      sources: {
        openfreemap: {
          type: "raster",
          tiles: [
            "https://tiles.openfreemap.org/styles/liberty",
          ],
          tileSize: 256,
          attribution: "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#0b120d" },
        },
      ],
    };
  }

  const rasterId =
    basemap === "satellite" || basemap === "hybrid" ? "usgs-imagery" : "usgs-topo";

  const style: StyleSpecification = {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [`/api/tiles/${rasterId}/{z}/{x}/{y}`],
        tileSize: 256,
        attribution: "USGS The National Map",
        maxzoom: 16,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#0b120d" },
      },
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
      },
    ],
  };

  return style;
}

export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

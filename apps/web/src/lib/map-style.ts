import type { SkySpecification, StyleSpecification } from "maplibre-gl";

export type BasemapId = "topo" | "satellite" | "streets" | "hybrid";

export function fieldSky(): SkySpecification {
  return {
    "sky-color": "#071018",
    "horizon-color": "#1a3d44",
    "fog-color": "#070b08",
    "fog-ground-blend": 0.32,
    "horizon-fog-blend": 0.82,
    "sky-horizon-blend": 0.5,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 11, 0.55, 16, 0.22],
  };
}

export function elevationSky(): SkySpecification {
  return {
    "sky-color": "#031018",
    "horizon-color": "#0e4a52",
    "fog-color": "#02080c",
    "fog-ground-blend": 0.18,
    "horizon-fog-blend": 0.9,
    "sky-horizon-blend": 0.42,
    "atmosphere-blend": 0.55,
  };
}

export function neraSky(): SkySpecification {
  return {
    "sky-color": "#000510",
    "horizon-color": "#0a5a6e",
    "fog-color": "#031018",
    "fog-ground-blend": 0.08,
    "horizon-fog-blend": 0.55,
    "sky-horizon-blend": 0.42,
    "atmosphere-blend": 0.22,
  };
}

export function lightElevationSky(): SkySpecification {
  return {
    "sky-color": "#9ec8d6",
    "horizon-color": "#d7e8ee",
    "fog-color": "#c5d4c8",
    "fog-ground-blend": 0.22,
    "horizon-fog-blend": 0.72,
    "sky-horizon-blend": 0.48,
    "atmosphere-blend": 0.35,
  };
}

export function createMapStyle(basemap: BasemapId): StyleSpecification {
  if (basemap === "streets") {
    return {
      version: 8,
      sky: fieldSky(),
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
          paint: { "background-color": "#070b08" },
        },
      ],
    };
  }

  const rasterId =
    basemap === "satellite" || basemap === "hybrid" ? "usgs-imagery" : "usgs-topo";

  const style: StyleSpecification = {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sky: fieldSky(),
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
        paint: { "background-color": "#070b08" },
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

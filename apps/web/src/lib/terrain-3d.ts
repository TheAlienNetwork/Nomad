import maplibregl, { type Map } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { geodesicCircleRing } from "@huntos/core";
import type { CameraMode, NeraStyle } from "./store";

export const TERRARIUM_PROXY_TILES = "/api/tiles/terrarium/{z}/{x}/{y}";
export const DEFAULT_TERRAIN_EXAGGERATION = 3.2;
export const MIN_TERRAIN_EXAGGERATION = 1.6;
export const MAX_TERRAIN_EXAGGERATION = 6;
export const ORBIT_PITCH = 70;
export const FPV_ZOOM = 17.4;
export const FPV_PITCH = 80;
export const FPV_LOOKAHEAD_M = 110;
export const NERA_MAX_ZOOM = 18.5;
export const NERA_MIN_PITCH = 38;
export const DEFAULT_MAP_MAX_ZOOM = 22;
export const NERA_WALK_ZOOM = 16.5;
export const RELIEF_DRAPE_TILES = "/api/tiles/usgs-hillshade/{z}/{x}/{y}";

const EARTH_RADIUS_M = 6_371_000;

type ContourModule = typeof import("maplibre-contour");

let demSource: InstanceType<ContourModule["default"]["DemSource"]> | null = null;
let contourUrl: string | null = null;
let neraDemSource: InstanceType<ContourModule["default"]["DemSource"]> | null = null;
let neraContourUrl: string | null = null;

export async function setupContourSource(): Promise<{
  sharedDemProtocolUrl: string;
  contourProtocolUrl: string;
} | null> {
  if (demSource && contourUrl) {
    return {
      sharedDemProtocolUrl: demSource.sharedDemProtocolUrl,
      contourProtocolUrl: contourUrl,
    };
  }
  try {
    const mlcontour = (await import("maplibre-contour")).default;
    demSource = new mlcontour.DemSource({
      url: TERRARIUM_PROXY_TILES,
      encoding: "terrarium",
      maxzoom: 15,
      worker: true,
    });
    demSource.setupMaplibre(maplibregl);
    contourUrl = demSource.contourProtocolUrl({
      overzoom: 1,
      thresholds: {
        11: [40, 200],
        12: [20, 100],
        13: [10, 50],
        14: [5, 25],
        15: [2.5, 10],
      },
      elevationKey: "ele",
      levelKey: "level",
      contourLayer: "contours",
    });
    return {
      sharedDemProtocolUrl: demSource.sharedDemProtocolUrl,
      contourProtocolUrl: contourUrl,
    };
  } catch {
    return null;
  }
}

export async function setupNeraContourSource(): Promise<string | null> {
  if (neraDemSource && neraContourUrl) return neraContourUrl;
  try {
    const mlcontour = (await import("maplibre-contour")).default;
    neraDemSource = new mlcontour.DemSource({
      url: TERRARIUM_PROXY_TILES,
      encoding: "terrarium",
      maxzoom: 15,
      worker: true,
    });
    neraDemSource.setupMaplibre(maplibregl);
    neraContourUrl = neraDemSource.contourProtocolUrl({
      overzoom: 2,
      thresholds: {
        11: [20, 100],
        12: [10, 50],
        13: [5, 25],
        14: [2.5, 10],
        15: [1, 5],
      },
      elevationKey: "ele",
      levelKey: "level",
      contourLayer: "contours",
    });
    return neraContourUrl;
  } catch {
    return null;
  }
}

export function resolveNeraStyle(style: NeraStyle): NeraStyle {
  switch (style) {
    case "glass":
      return "glass";
    case "wire":
      return "wire";
    default: {
      const _exhausted: never = style;
      return _exhausted;
    }
  }
}

export function neraGridSpacingMeters(zoom: number, dense = false): number {
  const base = zoom >= 16 ? 50 : zoom >= 14 ? 100 : zoom >= 12 ? 250 : 500;
  return dense ? Math.max(25, Math.round(base / 2)) : base;
}

export const WIREFRAME_ELEVATION_COLOR = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "ele"], 0],
  0,
  "#22d3ee",
  80,
  "#67e8f9",
  180,
  "#84cc16",
  360,
  "#f59e0b",
  720,
  "#fb7185",
] as const;

export function neraOrbitPitch(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - 11) / 6));
  return 58 + t * 24;
}

export function applyNeraLimits(map: Map, nera: boolean): void {
  if (nera) {
    map.setMaxZoom(NERA_MAX_ZOOM);
    if (map.getPitch() >= NERA_MIN_PITCH) {
      map.setMinPitch(NERA_MIN_PITCH);
    }
    return;
  }
  map.setMaxZoom(DEFAULT_MAP_MAX_ZOOM);
  map.setMinPitch(0);
}

export function applyNeraWalkIn(map: Map, nera: boolean, cameraMode: CameraMode): void {
  applyNeraLimits(map, nera);
  if (nera && cameraMode === "orbit") {
    const pitch = neraOrbitPitch(map.getZoom());
    if (Math.abs(map.getPitch() - pitch) > 3) {
      map.easeTo({ pitch, duration: 180 });
    }
  }
}

export function zoomFromBounds(bounds?: { south: number; north: number }): number {
  if (!bounds) return 13;
  const latSpan = Math.max(1e-6, bounds.north - bounds.south);
  return Math.min(NERA_MAX_ZOOM, Math.max(8, Math.log2(180 / latSpan)));
}

export function buildNeraGridCollection(options: {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  origin?: { latitude: number; longitude: number };
  dense?: boolean;
}): FeatureCollection {
  const features: Array<Feature<LineString>> = [];
  const spacing = neraGridSpacingMeters(options.zoom, options.dense);
  const midLat = (options.south + options.north) / 2;
  const dLat = spacing / 111_320;
  const dLng = spacing / (111_320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  const maxLines = 36;
  let lngCount = 0;
  for (let lng = options.west; lng <= options.east && lngCount < maxLines; lng += dLng, lngCount += 1) {
    features.push({
      type: "Feature",
      properties: { kind: "grid" },
      geometry: {
        type: "LineString",
        coordinates: [
          [lng, options.south],
          [lng, options.north],
        ],
      },
    });
  }
  let latCount = 0;
  for (let lat = options.south; lat <= options.north && latCount < maxLines; lat += dLat, latCount += 1) {
    features.push({
      type: "Feature",
      properties: { kind: "grid" },
      geometry: {
        type: "LineString",
        coordinates: [
          [options.west, lat],
          [options.east, lat],
        ],
      },
    });
  }
  if (options.origin) {
    for (const yards of [100, 200, 400] as const) {
      features.push({
        type: "Feature",
        properties: { kind: "range" },
        geometry: {
          type: "LineString",
          coordinates: geodesicCircleRing(options.origin, yards * 0.9144, 64),
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

export function destinationLngLat(
  lng: number,
  lat: number,
  bearingDeg: number,
  meters: number,
): { lng: number; lat: number } {
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const ang = meters / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lng: (lng2 * 180) / Math.PI, lat: (lat2 * 180) / Math.PI };
}

let fpvProgrammaticMove = false;

export function fpvLookaheadMeters(zoom: number): number {
  const z = Number.isFinite(zoom) ? zoom : FPV_ZOOM;
  return Math.min(160, Math.max(36, FPV_LOOKAHEAD_M * Math.pow(2, FPV_ZOOM - z)));
}

export function applyFpvCamera(
  map: Map,
  lng: number,
  lat: number,
  heading: number,
  options?: { resetView?: boolean },
): number | undefined {
  const elevation = map.queryTerrainElevation({ lng, lat });
  const resetView = options?.resetView === true;
  const zoom = resetView ? FPV_ZOOM : map.getZoom();
  const pitch = resetView ? FPV_PITCH : Math.max(FPV_PITCH - 12, map.getPitch());
  const look = destinationLngLat(lng, lat, heading, fpvLookaheadMeters(zoom));
  fpvProgrammaticMove = true;
  map.jumpTo({
    center: [look.lng, look.lat],
    zoom,
    pitch,
    bearing: heading,
  });
  queueMicrotask(() => {
    fpvProgrammaticMove = false;
  });
  return elevation ?? undefined;
}

export function isFpvProgrammaticMove(): boolean {
  return fpvProgrammaticMove;
}

export function clampExaggeration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TERRAIN_EXAGGERATION;
  return Math.min(MAX_TERRAIN_EXAGGERATION, Math.max(MIN_TERRAIN_EXAGGERATION, value));
}

export function applyTerrainMesh(map: Map, exaggeration: number): void {
  if (!map.getSource("terrain")) return;
  const value = clampExaggeration(exaggeration);
  const mesh = () => {
    if (!map.getSource("terrain")) return;
    map.setTerrain({ source: "terrain", exaggeration: value });
  };
  mesh();
  map.once("idle", mesh);
}

export function applyElevationSkin(
  map: Map,
  threeD: boolean,
  options: {
    basemap: string;
    hillshadeLayerOn: boolean;
    mapTheme?: "dark" | "light";
    neraMode?: boolean;
    neraStyle?: NeraStyle;
    contoursLayerOn?: boolean;
    wireframe?: boolean;
  },
): void {
  const sat = options.basemap === "satellite" || options.basemap === "hybrid";
  const dark = options.mapTheme !== "light";
  const nera = Boolean(options.neraMode && threeD);
  const style = resolveNeraStyle(options.neraStyle ?? "wire");
  const mesh = Boolean(options.wireframe && threeD);
  const neraWire = nera && style === "wire";
  const wire = neraWire || mesh;
  const glass = nera && style === "glass" && !mesh;
  const intel = Boolean(threeD && dark && !nera && !mesh);
  map.getContainer().classList.toggle("is-elevation", threeD);
  map.getContainer().classList.toggle("is-elevation-light", threeD && !dark && !nera && !mesh);
  map.getContainer().classList.toggle("is-nera", nera);
  map.getContainer().classList.toggle("is-nera-wire", neraWire);
  map.getContainer().classList.toggle("is-wireframe-mesh", mesh);
  if (map.getLayer("background")) {
    map.setPaintProperty(
      "background",
      "background-color",
      threeD ? (mesh || nera ? "#000104" : dark ? "#02080c" : "#d7e4dc") : "#070b08",
    );
  }
  if (map.getLayer("basemap")) {
    map.setPaintProperty(
      "basemap",
      "raster-opacity",
      threeD
        ? mesh
          ? sat
            ? 0.16
            : 0.08
          : wire
            ? sat
              ? 0.46
              : 0.38
            : nera
              ? sat
                ? 0.52
                : 0.4
              : sat
                ? dark
                  ? 0.22
                  : 0.42
                : dark
                  ? 0.06
                  : 0.22
        : 1,
    );
    map.setPaintProperty(
      "basemap",
      "raster-saturation",
      threeD ? (mesh ? -0.55 : wire ? -0.35 : nera ? -0.18 : sat ? -0.2 : dark ? -0.55 : -0.2) : 0,
    );
    map.setPaintProperty(
      "basemap",
      "raster-contrast",
      threeD ? (mesh ? 0.28 : wire ? 0.16 : nera ? 0.28 : dark ? 0.22 : 0.08) : 0,
    );
    map.setPaintProperty("basemap", "raster-brightness-min", threeD && (mesh || nera) ? (mesh ? 0.02 : wire ? 0.05 : 0.06) : 0);
    map.setPaintProperty("basemap", "raster-brightness-max", threeD && (mesh || nera) ? (mesh ? 0.78 : wire ? 0.9 : 0.92) : 1);
  }
  if (map.getLayer("hillshade")) {
    map.setLayoutProperty(
      "hillshade",
      "visibility",
      threeD || options.hillshadeLayerOn ? "visible" : "none",
    );
    map.setPaintProperty(
      "hillshade",
      "raster-opacity",
      threeD ? (wire ? 0.55 : nera ? 0.42 : dark ? 0.92 : 0.7) : 0.35,
    );
    map.setPaintProperty("hillshade", "raster-saturation", threeD ? (nera ? -0.22 : dark ? -0.18 : -0.05) : 0);
    map.setPaintProperty("hillshade", "raster-contrast", threeD ? (nera ? 0.22 : dark ? 0.28 : 0.12) : 0);
  }
  if (map.getLayer("dem-hillshade")) {
    map.setLayoutProperty("dem-hillshade", "visibility", threeD ? "visible" : "none");
    map.setPaintProperty("dem-hillshade", "hillshade-exaggeration", threeD ? (nera ? 0.88 : dark ? 0.92 : 0.62) : 0.5);
    map.setPaintProperty("dem-hillshade", "hillshade-highlight-color", nera ? "#e0fbff" : dark ? "#7af6ff" : "#f8fafc");
    map.setPaintProperty("dem-hillshade", "hillshade-shadow-color", nera ? "#020617" : dark ? "#02151c" : "#334155");
    map.setPaintProperty("dem-hillshade", "hillshade-accent-color", nera ? "#22d3ee" : "#e6a31a");
  }
  if (map.getLayer("dem-rim")) {
    map.setLayoutProperty("dem-rim", "visibility", threeD ? "visible" : "none");
    if (nera || mesh) {
      map.setPaintProperty("dem-rim", "hillshade-highlight-color", "#7af6ff");
      map.setPaintProperty("dem-rim", "hillshade-accent-color", "#22d3ee");
      map.setPaintProperty("dem-rim", "hillshade-exaggeration", mesh ? 0.62 : 0.48);
    }
  }
  if (map.getLayer("nera-relief")) {
    map.setLayoutProperty("nera-relief", "visibility", intel ? "visible" : "none");
  }
  if (map.getLayer("nera-mesh")) {
    map.setLayoutProperty("nera-mesh", "visibility", nera || mesh ? "visible" : "none");
    if (nera || mesh) {
      try {
        map.setPaintProperty("nera-mesh", "color-relief-opacity" as never, mesh ? 0.28 : wire ? 0.42 : 0.62);
      } catch {
        // Optional color-relief paint.
      }
    }
  }
  if (map.getLayer("slope-heat")) {
    map.setLayoutProperty("slope-heat", "visibility", intel ? "visible" : "none");
  }
  if (map.getLayer("usgs-contours")) {
    map.setLayoutProperty(
      "usgs-contours",
      "visibility",
      glass || (!nera && options.contoursLayerOn) ? "visible" : "none",
    );
    map.setPaintProperty("usgs-contours", "raster-opacity", glass ? 0.78 : 0.5);
    map.setPaintProperty("usgs-contours", "raster-saturation", glass ? -0.15 : 0);
    map.setPaintProperty("usgs-contours", "raster-contrast", glass ? 0.35 : 0);
  }
  const glassContours = threeD && !wire;
  if (map.getLayer("contours-glow")) {
    map.setLayoutProperty("contours-glow", "visibility", glass ? "visible" : "none");
  }
  if (map.getLayer("contours-minor")) {
    map.setLayoutProperty("contours-minor", "visibility", glassContours ? "visible" : "none");
    map.setPaintProperty("contours-minor", "line-opacity", glass ? 0.9 : intel ? 0.7 : 0.45);
    map.setPaintProperty("contours-minor", "line-width", glass ? 1.05 : 0.7);
    map.setPaintProperty("contours-minor", "line-color", glass ? "#7af6ff" : "#67e8f9");
  }
  if (map.getLayer("contours-major")) {
    map.setLayoutProperty("contours-major", "visibility", glassContours ? "visible" : "none");
    map.setPaintProperty("contours-major", "line-opacity", glass ? 0.98 : intel ? 0.92 : 0.78);
    map.setPaintProperty("contours-major", "line-width", glass ? 1.85 : 1.35);
    map.setPaintProperty("contours-major", "line-color", glass ? "#f8fafc" : "#e6a31a");
  }
  if (map.getLayer("nera-wrap-glow")) {
    map.setLayoutProperty("nera-wrap-glow", "visibility", glass ? "visible" : "none");
  }
  if (map.getLayer("nera-wrap-minor")) {
    map.setLayoutProperty("nera-wrap-minor", "visibility", glass ? "visible" : "none");
  }
  if (map.getLayer("nera-wrap-major")) {
    map.setLayoutProperty("nera-wrap-major", "visibility", glass ? "visible" : "none");
  }
  if (map.getLayer("nera-rings-glow")) {
    map.setLayoutProperty("nera-rings-glow", "visibility", wire ? "visible" : "none");
  }
  if (map.getLayer("nera-rings-minor")) {
    map.setLayoutProperty("nera-rings-minor", "visibility", wire ? "visible" : "none");
    if (wire) {
      map.setPaintProperty(
        "nera-rings-minor",
        "line-color",
        mesh ? (WIREFRAME_ELEVATION_COLOR as never) : "#22d3ee",
      );
      map.setPaintProperty("nera-rings-minor", "line-opacity", mesh ? 0.88 : 0.78);
      map.setPaintProperty("nera-rings-minor", "line-width", mesh ? 0.85 : 0.7);
    }
  }
  if (map.getLayer("nera-rings-major")) {
    map.setLayoutProperty("nera-rings-major", "visibility", wire ? "visible" : "none");
    if (wire) {
      map.setPaintProperty(
        "nera-rings-major",
        "line-color",
        mesh ? (WIREFRAME_ELEVATION_COLOR as never) : "#e0fbff",
      );
      map.setPaintProperty("nera-rings-major", "line-opacity", mesh ? 0.98 : 0.96);
      map.setPaintProperty("nera-rings-major", "line-width", mesh ? 1.7 : 1.45);
    }
  }
  if (map.getLayer("nera-grid")) {
    map.setLayoutProperty("nera-grid", "visibility", wire ? "visible" : "none");
    if (wire) {
      map.setPaintProperty("nera-grid", "line-opacity", mesh ? 0.42 : 0.28);
      map.setPaintProperty("nera-grid", "line-width", mesh ? 0.7 : 0.55);
    }
  }
  if (map.getLayer("nera-range")) {
    map.setLayoutProperty("nera-range", "visibility", wire ? "visible" : "none");
  }
  restackElevationDrape(map, nera || mesh);
}

const NERA_DRAPE_ORDER = [
  "usgs-3dep-lidar",
  "nera-mesh",
  "dem-hillshade",
  "dem-rim",
  "usgs-contours",
  "contours-glow",
  "nera-wrap-glow",
  "contours-minor",
  "nera-wrap-minor",
  "contours-major",
  "nera-wrap-major",
  "nera-rings-glow",
  "nera-rings-minor",
  "nera-rings-major",
  "nera-grid",
  "nera-range",
] as const;

const PIN_STACK = [
  "waypoints-glow",
  "waypoints",
  "waypoints-hit",
  "waypoints-selected",
  "harvest-heat",
  "harvest-glow",
  "harvest-points",
  "harvest-hit",
  "terrain-features",
] as const;

function restackElevationDrape(map: Map, nera: boolean): void {
  if (!nera) return;
  for (const id of NERA_DRAPE_ORDER) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch {
        // Layer may not be in the current style yet.
      }
    }
  }
  for (const id of PIN_STACK) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch {
        // Pins stay above the Nera drape when present.
      }
    }
  }
}

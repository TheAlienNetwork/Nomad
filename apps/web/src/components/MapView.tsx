"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map, type Marker } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { geodesicCircleRing, OVERLAY_CATALOG, WAYPOINT_TYPE_LABELS } from "@huntos/core";
import type { Track, Waypoint } from "@huntos/core";
import { harvestsToFc, mapMarkWaypoints } from "@/lib/harvest-map";
import { createMapStyle, elevationSky, fieldSky, lightElevationSky, neraSky, OPENFREEMAP_STYLE } from "@/lib/map-style";
import { attachWebWaypointPhoto } from "@/lib/photos";
import { openSheet, useHuntStore, type CameraMode, type LayerState } from "@/lib/store";
import {
  applyElevationSkin,
  applyFpvCamera,
  applyNeraLimits,
  isFpvProgrammaticMove,
  applyTerrainMesh,
  buildNeraGridCollection,
  neraOrbitPitch,
  NERA_WALK_ZOOM,
  ORBIT_PITCH,
  RELIEF_DRAPE_TILES,
  setupContourSource,
  setupNeraContourSource,
  TERRARIUM_PROXY_TILES,
} from "@/lib/terrain-3d";
import {
  buildGpsRangeRingCollection,
  buildGpsRingLabelCollection,
  classifyGpsRingIntel,
  gpsRingSamplePoints,
  type GpsRingSample,
} from "@/lib/gps-rings";

export interface HabitatCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown> | null;
    geometry: { type: string; coordinates: unknown } | null;
  }>;
}

interface MapViewProps {
  onIdentify: (lng: number, lat: number) => void;
  onIntel: (lng: number, lat: number) => void;
  habitat?: HabitatCollection | null;
  terrainFeatures?: HabitatCollection | null;
  huntingUnits?: HabitatCollection | null;
}

function waypointsToFc(waypoints: Waypoint[]): HabitatCollection {
  return {
    type: "FeatureCollection",
    features: mapMarkWaypoints(waypoints).map((waypoint) => ({
      type: "Feature",
      properties: {
        truthLayer: "observed",
        name: waypoint.name,
        type: waypoint.type,
        id: waypoint.id,
        hasPhoto: waypoint.photos[0] ? 1 : 0,
        kind:
          waypoint.type === "sighting" || waypoint.type === "scat"
            ? "observation"
            : "mark",
      },
      geometry: {
        type: "Point",
        coordinates: [waypoint.longitude, waypoint.latitude],
      },
    })),
  };
}

function tracksToFc(tracks: Track[]): HabitatCollection {
  return {
    type: "FeatureCollection",
    features: tracks
      .filter((track) => track.points.length > 1)
      .map((track) => ({
        type: "Feature",
        properties: { truthLayer: "observed", id: track.id, name: track.name },
        geometry: {
          type: "LineString",
          coordinates: track.points.map((point) => [point.longitude, point.latitude]),
        },
      })),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function pinPopupHtml(waypoint: Waypoint): string {
  const photos = waypoint.photos.slice(0, 6);
  const strip = photos.length
    ? `<div class="pin-pop-photos">${photos
        .map((url) => `<img src=${JSON.stringify(url)} alt="" />`)
        .join("")}</div>`
    : "";
  const notes = waypoint.notes?.trim();
  const noteHtml = notes
    ? `<p class="pin-pop-notes">${escapeHtml(notes)}</p>`
    : `<p class="pin-pop-notes is-empty">No description yet.</p>`;
  return `<div class="pin-pop" data-id="${escapeHtml(waypoint.id)}">${strip}<strong class="pin-pop-title">${escapeHtml(waypoint.name)}</strong><p class="pin-pop-meta">${escapeHtml(WAYPOINT_TYPE_LABELS[waypoint.type] ?? waypoint.type)}</p>${noteHtml}<div class="pin-pop-actions"><button type="button" data-act="go">Go</button><button type="button" data-act="photo">Photo</button><button type="button" data-act="edit">Edit</button><button type="button" data-act="close">Close</button></div></div>`;
}

function queryPinId(map: Map, lngLat: { lng: number; lat: number }): string | undefined {
  const point = map.project([lngLat.lng, lngLat.lat]);
  const layers = ["waypoints", "waypoints-glow", "waypoints-hit", "harvest-points", "harvest-glow", "harvest-hit"].filter((id) =>
    map.getLayer(id),
  );
  if (layers.length === 0) return undefined;
  const pad = 14;
  const hits = map.queryRenderedFeatures(
    [
      [point.x - pad, point.y - pad],
      [point.x + pad, point.y + pad],
    ],
    { layers },
  );
  const id = hits[0]?.properties?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function bindPhotoPin(el: HTMLDivElement, waypointId: string): void {
  el.addEventListener("mousedown", (event) => event.stopPropagation());
  el.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    useHuntStore.setState({ selectedWaypointId: waypointId, sheet: "none" });
  });
}

function ensureOverlays(map: Map): void {
  ensureTerrain(map);
  for (const overlay of OVERLAY_CATALOG) {
    for (const tile of overlay.tiles) {
      if (map.getSource(tile.id)) continue;
      map.addSource(tile.id, {
        type: "raster",
        tiles: [`/api/tiles/${tile.id}/{z}/{x}/{y}`],
        tileSize: 256,
        maxzoom: 16,
      });
      map.addLayer({
        id: tile.id,
        type: "raster",
        source: tile.id,
        paint: { "raster-opacity": tile.opacity },
        layout: { visibility: overlay.defaultOn ? "visible" : "none" },
      });
    }
  }
  if (!map.getSource("waypoints")) {
    map.addSource("waypoints", { type: "geojson", data: waypointsToFc([]) as FeatureCollection });
    map.addLayer({
      id: "waypoints-glow",
      type: "circle",
      source: "waypoints",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 10,
        "circle-color": "#fb923c",
        "circle-opacity": 0.25,
      },
    });
    map.addLayer({
      id: "waypoints",
      type: "circle",
      source: "waypoints",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "match",
          ["get", "kind"],
          "observation",
          "#f97316",
          "#e6a31a",
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#1a1208",
      },
    });
    map.addLayer({
      id: "waypoints-hit",
      type: "circle",
      source: "waypoints",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 14,
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
    map.addLayer({
      id: "waypoints-selected",
      type: "circle",
      source: "waypoints",
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-radius": 13,
        "circle-color": "rgba(103,232,249,0.12)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#67e8f9",
      },
    });
  }
  if (!map.getSource("tracks")) {
    map.addSource("tracks", { type: "geojson", data: tracksToFc([]) as FeatureCollection });
    map.addLayer({
      id: "tracks",
      type: "line",
      source: "tracks",
      paint: {
        "line-color": "#fb923c",
        "line-width": 3,
        "line-opacity": 0.85,
      },
    });
  }
  if (!map.getSource("habitat")) {
    map.addSource("habitat", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "habitat",
      type: "circle",
      source: "habitat",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "overall"], 0],
          40,
          7,
          90,
          16,
        ],
        "circle-color": "#c084fc",
        "circle-opacity": 0.42,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#f5d0fe",
        "circle-stroke-opacity": 0.9,
      },
    });
  }
  if (!map.getSource("terrain-features")) {
    map.addSource("terrain-features", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "terrain-features",
      type: "circle",
      source: "terrain-features",
      paint: {
        "circle-radius": 7,
        "circle-color": [
          "match",
          ["get", "kind"],
          "saddle",
          "#fde68a",
          "bench",
          "#86efac",
          "funnel",
          "#67e8f9",
          "pinch",
          "#22d3ee",
          "ridgeline",
          "#fda4af",
          "drainage",
          "#93c5fd",
          "basin",
          "#c4b5fd",
          "cliff",
          "#fb7185",
          "glassing_candidate",
          "#fbbf24",
          "#7dd3fc",
        ],
        "circle-opacity": 0.42,
        "circle-stroke-width": 1.6,
        "circle-stroke-color": "rgba(226,232,240,0.9)",
      },
    });
  }
  if (!map.getSource("hunting-units")) {
    map.addSource("hunting-units", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "hunting-units-fill",
      type: "fill",
      source: "hunting-units",
      paint: {
        "fill-color": "#e6a31a",
        "fill-opacity": 0.14,
      },
      layout: { visibility: "none" },
    });
    map.addLayer({
      id: "hunting-units-line",
      type: "line",
      source: "hunting-units",
      paint: {
        "line-color": "#e6a31a",
        "line-width": 2,
        "line-opacity": 0.9,
      },
      layout: { visibility: "none" },
    });
  }
  if (!map.getSource("gps-accuracy")) {
    map.addSource("gps-accuracy", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "gps-accuracy-fill",
      type: "fill",
      source: "gps-accuracy",
      paint: {
        "fill-color": "#F15A24",
        "fill-opacity": 0.12,
      },
    });
    map.addLayer({
      id: "gps-accuracy-line",
      type: "line",
      source: "gps-accuracy",
      paint: {
        "line-color": "#E8DFD0",
        "line-opacity": 0.22,
        "line-width": 1.2,
      },
    });
  }
  if (!map.getSource("gps-puck")) {
    map.addSource("gps-puck", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  const puckLayer = map.getLayer("gps-puck");
  if (puckLayer && puckLayer.type !== "fill") {
    map.removeLayer("gps-puck");
    if (map.getLayer("gps-puck-core")) map.removeLayer("gps-puck-core");
  }
  if (!map.getLayer("gps-puck")) {
    map.addLayer({
      id: "gps-puck",
      type: "fill",
      source: "gps-puck",
      layout: { visibility: "none" },
      paint: {
        "fill-color": "#f15a24",
        "fill-opacity": 0.92,
      },
    });
  }
  if (!map.getLayer("gps-puck-core")) {
    map.addLayer({
      id: "gps-puck-core",
      type: "line",
      source: "gps-puck",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#E8DFD0",
        "line-width": 1.4,
        "line-opacity": 0.95,
      },
    });
  }
  ensureGpsRangeLayers(map);
  ensureHarvestOverlay(map);
}

function ensureGpsRangeLayers(map: Map): void {
  if (!map.getSource("gps-range")) {
    map.addSource("gps-range", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "gps-range",
      type: "line",
      source: "gps-range",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#E8DFD0",
        "line-width": 1.35,
        "line-opacity": 0.72,
        "line-dasharray": [1.2, 1.4],
      },
    });
  }
  if (!map.getSource("gps-range-marks")) {
    map.addSource("gps-range-marks", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("gps-range-spoke")) {
    map.addLayer({
      id: "gps-range-spoke",
      type: "line",
      source: "gps-range-marks",
      filter: [
        "all",
        ["==", ["geometry-type"], "LineString"],
        ["in", ["get", "kind"], ["literal", ["high", "low"]]],
      ],
      layout: { visibility: "none" },
      paint: {
        "line-color": ["match", ["get", "kind"], "low", "#e6a31a", "#67e8f9"],
        "line-width": 1.05,
        "line-opacity": 0.55,
        "line-dasharray": [0.4, 1.4],
      },
    });
  }
  const leftover = map.getStyle()?.layers ?? [];
  for (const layer of leftover) {
    if (layer.id.startsWith("gps-ring-chip") || (layer.type === "circle" && layer.source === "gps-range-marks")) {
      map.removeLayer(layer.id);
    }
  }
  const labelField: maplibregl.ExpressionSpecification = ["concat", ["get", "primary"], "\n", ["get", "unit"]];
  const labelColor: maplibregl.ExpressionSpecification = [
    "match",
    ["get", "kind"],
    "high",
    "#c8f4fb",
    "low",
    "#e6c98a",
    "yards",
    "#8ec9d4",
    "#d4ccc0",
  ];
  const labelOpacity: maplibregl.ExpressionSpecification = ["match", ["get", "kind"], "high", 0.92, "low", 0.86, "yards", 0.7, 0.72];
  if (!map.getLayer("gps-ring-labels")) {
    map.addLayer({
      id: "gps-ring-labels",
      type: "symbol",
      source: "gps-range-marks",
      filter: ["has", "primary"],
      layout: {
        visibility: "none",
        "text-field": labelField,
        "text-size": 11,
        "text-font": ["Open Sans Regular"],
        "text-letter-spacing": 0.06,
        "text-line-height": 1.05,
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-padding": 0,
      },
      paint: {
        "text-color": labelColor,
        "text-opacity": labelOpacity,
        "text-halo-color": "rgba(0, 0, 0, 0)",
        "text-halo-width": 0,
        "text-halo-blur": 0,
      },
    });
    return;
  }
  map.setLayoutProperty("gps-ring-labels", "text-size", 11);
  map.setLayoutProperty("gps-ring-labels", "text-font", ["Open Sans Regular"]);
  map.setLayoutProperty("gps-ring-labels", "text-letter-spacing", 0.06);
  map.setLayoutProperty("gps-ring-labels", "text-field", labelField);
  map.setPaintProperty("gps-ring-labels", "text-color", labelColor);
  map.setPaintProperty("gps-ring-labels", "text-opacity", labelOpacity);
  map.setPaintProperty("gps-ring-labels", "text-halo-color", "rgba(0, 0, 0, 0)");
  map.setPaintProperty("gps-ring-labels", "text-halo-width", 0);
  map.setPaintProperty("gps-ring-labels", "text-halo-blur", 0);
}

function ensureHarvestOverlay(map: Map): void {
  if (!map.getSource("harvests")) {
    map.addSource("harvests", { type: "geojson", data: harvestsToFc([]) as FeatureCollection });
  }
  if (!map.getLayer("harvest-heat")) {
    map.addLayer({
      id: "harvest-heat",
      type: "heatmap",
      source: "harvests",
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 12, 1.2, 14, 1.6],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 24, 12, 42, 14, 64],
        "heatmap-opacity": 0.78,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.12,
          "rgba(255, 80, 0, 0.32)",
          0.35,
          "rgba(239, 68, 68, 0.58)",
          0.65,
          "rgba(220, 38, 38, 0.86)",
          1,
          "rgba(254, 226, 168, 1)",
        ],
      },
    });
  }
  if (!map.getLayer("harvest-glow")) {
    map.addLayer({
      id: "harvest-glow",
      type: "circle",
      source: "harvests",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 16,
        "circle-color": "#ef4444",
        "circle-opacity": 0.28,
      },
    });
  }
  if (!map.getLayer("harvest-points")) {
    map.addLayer({
      id: "harvest-points",
      type: "circle",
      source: "harvests",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 9,
        "circle-color": "#ef4444",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#fff7ed",
      },
    });
    map.addLayer({
      id: "harvest-hit",
      type: "circle",
      source: "harvests",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 16,
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
  }
  if (!map.getLayer("harvest-hit") && map.getSource("harvests")) {
    map.addLayer({
      id: "harvest-hit",
      type: "circle",
      source: "harvests",
      filter: ["!=", ["get", "hasPhoto"], 1],
      paint: {
        "circle-radius": 16,
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
  }
  if (map.getLayer("harvest-heat")) map.moveLayer("harvest-heat");
  if (map.getLayer("harvest-glow")) map.moveLayer("harvest-glow");
  if (map.getLayer("harvest-points")) map.moveLayer("harvest-points");
  if (map.getLayer("harvest-hit")) map.moveLayer("harvest-hit");
}

function ensureTerrain(map: Map): void {
  if (!map.getSource("terrain")) {
    map.addSource("terrain", {
      type: "raster-dem",
      tiles: [TERRARIUM_PROXY_TILES],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution: "Mapzen / Amazon Terrain Tiles",
    });
  }
  if (!map.getSource("hillshade")) {
    map.addSource("hillshade", {
      type: "raster",
      tiles: [RELIEF_DRAPE_TILES],
      tileSize: 256,
      maxzoom: 12,
    });
    map.addLayer({
      id: "hillshade",
      type: "raster",
      source: "hillshade",
      paint: { "raster-opacity": 0.35 },
      layout: { visibility: "none" },
    });
  }
  if (!map.getLayer("dem-hillshade")) {
    map.addLayer({
      id: "dem-hillshade",
      type: "hillshade",
      source: "terrain",
      layout: { visibility: "none" },
      paint: {
        "hillshade-shadow-color": "#02151c",
        "hillshade-highlight-color": "#7af6ff",
        "hillshade-accent-color": "#e6a31a",
        "hillshade-exaggeration": 0.92,
        "hillshade-illumination-direction": 315,
        "hillshade-illumination-anchor": "viewport",
      },
    });
  }
  if (!map.getLayer("dem-rim")) {
    map.addLayer({
      id: "dem-rim",
      type: "hillshade",
      source: "terrain",
      layout: { visibility: "none" },
      paint: {
        "hillshade-shadow-color": "#01060a",
        "hillshade-highlight-color": "#94a3b8",
        "hillshade-accent-color": "#67e8f9",
        "hillshade-exaggeration": 0.35,
        "hillshade-illumination-direction": 135,
        "hillshade-illumination-anchor": "viewport",
      },
    });
  }
  if (!map.getLayer("nera-relief")) {
    try {
      map.addLayer({
        id: "nera-relief",
        type: "color-relief",
        source: "terrain",
        layout: { visibility: "none" },
        paint: {
          "color-relief-color": [
            "interpolate",
            ["linear"],
            ["elevation"],
            0,
            "#020617",
            40,
            "#082f49",
            120,
            "#0e4a5c",
            280,
            "#134e4a",
            600,
            "#1e3a2f",
            1200,
            "#422006",
          ],
          "color-relief-opacity": 0.58,
        },
      } as never);
    } catch {
      // color-relief is optional; hillshade still models the mesh.
    }
  }
  if (!map.getLayer("nera-mesh")) {
    try {
      map.addLayer({
        id: "nera-mesh",
        type: "color-relief",
        source: "terrain",
        layout: { visibility: "none" },
        paint: {
          "color-relief-color": [
            "interpolate",
            ["linear"],
            ["elevation"],
            0,
            "#01040c",
            15,
            "#082f49",
            40,
            "#0e7490",
            80,
            "#22d3ee",
            140,
            "#2dd4bf",
            220,
            "#84cc16",
            400,
            "#f59e0b",
            800,
            "#f97316",
            1400,
            "#fb7185",
            2200,
            "#fff7ed",
          ],
          "color-relief-opacity": 0.62,
        },
      } as never);
    } catch {
      // Heat tint is optional when the runtime lacks color-relief.
    }
  }
  if (!map.getSource("slope-heat")) {
    map.addSource("slope-heat", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "slope-heat",
      type: "heatmap",
      source: "slope-heat",
      layout: { visibility: "none" },
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "slope"], 0, 0, 8, 0.2, 22, 0.75, 40, 1],
        "heatmap-intensity": 0.9,
        "heatmap-radius": 32,
        "heatmap-opacity": 0.7,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(8,47,73,0)",
          0.2,
          "rgba(8,47,73,0.28)",
          0.45,
          "rgba(14,116,144,0.45)",
          0.72,
          "rgba(34,211,238,0.55)",
          1,
          "rgba(245,158,11,0.72)",
        ],
      },
    });
  }
  void setupContourSource().then((contour) => {
    if (!contour || !map.getStyle()) return;
    if (!map.getSource("contours")) {
      map.addSource("contours", {
        type: "vector",
        tiles: [contour.contourProtocolUrl],
        maxzoom: 16,
      });
    }
    if (!map.getLayer("contours-minor")) {
      map.addLayer({
        id: "contours-glow",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#22d3ee",
          "line-width": 3.6,
          "line-opacity": 0.32,
          "line-blur": 2.1,
        },
      });
      map.addLayer({
        id: "contours-minor",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        filter: ["==", ["get", "level"], 0],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#67e8f9",
          "line-width": 0.7,
          "line-opacity": 0.45,
          "line-blur": 0.35,
        },
      });
      map.addLayer({
        id: "contours-major",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        filter: [">=", ["get", "level"], 1],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e6a31a",
          "line-width": 1.35,
          "line-opacity": 0.78,
          "line-blur": 0.2,
        },
      });
    }
    if (!map.getLayer("nera-wrap-glow")) {
      map.addLayer({
        id: "nera-wrap-glow",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#22d3ee",
          "line-width": 4.4,
          "line-opacity": 0.38,
          "line-blur": 2.4,
        },
      });
      map.addLayer({
        id: "nera-wrap-minor",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        filter: ["==", ["get", "level"], 0],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#7af6ff",
          "line-width": 0.85,
          "line-opacity": 0.82,
          "line-blur": 0.25,
        },
      });
      map.addLayer({
        id: "nera-wrap-major",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        filter: [">=", ["get", "level"], 1],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#f8fafc",
          "line-width": 1.7,
          "line-opacity": 0.96,
          "line-blur": 0.15,
        },
      });
    }
    const state = useHuntStore.getState();
    applyTerrainPresentation(map, state.cameraMode, state.terrainExaggeration, state.online);
  });
  void setupNeraContourSource().then((neraUrl) => {
    if (!neraUrl || !map.getStyle()) return;
    if (!map.getSource("nera-rings")) {
      map.addSource("nera-rings", {
        type: "vector",
        tiles: [neraUrl],
        maxzoom: 16,
      });
    }
    if (!map.getLayer("nera-rings-glow")) {
      map.addLayer({
        id: "nera-rings-glow",
        type: "line",
        source: "nera-rings",
        "source-layer": "contours",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#22d3ee",
          "line-width": 3.4,
          "line-opacity": 0.4,
          "line-blur": 2.2,
        },
      });
      map.addLayer({
        id: "nera-rings-minor",
        type: "line",
        source: "nera-rings",
        "source-layer": "contours",
        filter: ["==", ["get", "level"], 0],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#22d3ee",
          "line-width": 0.7,
          "line-opacity": 0.78,
          "line-blur": 0.2,
        },
      });
      map.addLayer({
        id: "nera-rings-major",
        type: "line",
        source: "nera-rings",
        "source-layer": "contours",
        filter: [">=", ["get", "level"], 1],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e0fbff",
          "line-width": 1.45,
          "line-opacity": 0.96,
          "line-blur": 0.12,
        },
      });
    }
    const state = useHuntStore.getState();
    applyTerrainPresentation(map, state.cameraMode, state.terrainExaggeration, state.online);
  });
  ensureNeraGrid(map);
}

function ensureNeraGrid(map: Map): void {
  if (!map.getSource("nera-grid")) {
    map.addSource("nera-grid", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("nera-grid")) {
    map.addLayer({
      id: "nera-grid",
      type: "line",
      source: "nera-grid",
      filter: ["==", ["get", "kind"], "grid"],
      layout: { visibility: "none" },
      paint: {
        "line-color": "#22d3ee",
        "line-width": 0.55,
        "line-opacity": 0.28,
      },
    });
    map.addLayer({
      id: "nera-range",
      type: "line",
      source: "nera-grid",
      filter: ["==", ["get", "kind"], "range"],
      layout: { visibility: "none" },
      paint: {
        "line-color": "#67e8f9",
        "line-width": 1.15,
        "line-opacity": 0.72,
        "line-dasharray": [1.4, 1.1],
      },
    });
  }
}

let lastNeraGridMs = 0;
let lastGpsRingMs = 0;
let lastFpvHeading = 0;
let fpvZoomHoldUntil = 0;
let orbitPitchQueued = false;

function resolveFpvHeading(heading: number | null, map: Map): number {
  if (heading != null && Number.isFinite(heading)) {
    lastFpvHeading = heading;
    return heading;
  }
  return Number.isFinite(lastFpvHeading) && lastFpvHeading !== 0 ? lastFpvHeading : map.getBearing();
}

function refreshNeraGrid(map: Map): void {
  if (!map.getSource("nera-grid")) return;
  const state = useHuntStore.getState();
  const wire =
    Boolean(
      state.cameraMode !== "flat" &&
        state.online &&
        ((state.neraMode && state.neraStyle === "wire") || state.layers.wireframe),
    );
  if (!wire) {
    setSourceData(map, "nera-grid", { type: "FeatureCollection", features: [] });
    return;
  }
  const bounds = map.getBounds();
  const origin =
    gpsOrigin(state.gps.latitude, state.gps.longitude) ?? undefined;
  setSourceData(
    map,
    "nera-grid",
    buildNeraGridCollection({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
      zoom: map.getZoom(),
      origin,
      dense: state.layers.wireframe,
    }),
  );
}

function gpsOrigin(
  latitude?: number,
  longitude?: number,
): { latitude: number; longitude: number } | null {
  if (latitude === undefined || longitude === undefined) return null;
  return { latitude, longitude };
}

function maybeRefreshNeraGrid(map: Map, force = false): void {
  const now = Date.now();
  if (!force && now - lastNeraGridMs < 240) return;
  lastNeraGridMs = now;
  refreshNeraGrid(map);
}

function setGpsMarkVisibility(map: Map, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of ["gps-range-spoke", "gps-ring-labels"] as const) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}

function hideGpsRangeLayers(map: Map): void {
  if (map.getLayer("gps-range")) map.setLayoutProperty("gps-range", "visibility", "none");
  setGpsMarkVisibility(map, false);
}

function refreshGpsRangeRings(map: Map): void {
  const state = useHuntStore.getState();
  const threeD = state.cameraMode !== "flat" && state.online;
  const origin = gpsOrigin(state.gps.latitude, state.gps.longitude);
  if (!threeD || !origin) {
    hideGpsRangeLayers(map);
    if (state.gpsRingIntel != null) useHuntStore.setState({ gpsRingIntel: null });
    return;
  }
  ensureGpsRangeLayers(map);
  setSourceData(map, "gps-range", buildGpsRangeRingCollection(origin));
  if (map.getLayer("gps-range")) {
    map.setLayoutProperty("gps-range", "visibility", "visible");
    map.setPaintProperty("gps-range", "line-opacity", 0.72);
    map.setPaintProperty("gps-range", "line-width", 1.35);
    try {
      map.moveLayer("gps-range");
      if (map.getLayer("gps-puck")) map.moveLayer("gps-puck");
      if (map.getLayer("gps-puck-core")) map.moveLayer("gps-puck-core");
    } catch {
      // Layer order is best-effort after style swaps.
    }
  }
  const gpsElev = map.queryTerrainElevation([origin.longitude, origin.latitude]);
  if (gpsElev == null) {
    setSourceData(map, "gps-range-marks", { type: "FeatureCollection", features: [] });
    setGpsMarkVisibility(map, false);
    return;
  }
  const samples: GpsRingSample[] = gpsRingSamplePoints(origin).map((point) => ({
    ...point,
    elevationMeters: map.queryTerrainElevation([point.longitude, point.latitude]) ?? null,
  }));
  const heading =
    typeof state.gps.heading === "number" && Number.isFinite(state.gps.heading) ? state.gps.heading : map.getBearing();
  const intel = classifyGpsRingIntel(gpsElev, samples);
  setSourceData(map, "gps-range-marks", buildGpsRingLabelCollection(origin, heading, gpsElev, samples, intel));
  setGpsMarkVisibility(map, true);
  if (map.getLayer("gps-ring-labels")) {
    try {
      map.moveLayer("gps-ring-labels");
    } catch {
      // Labels stay readable above the mesh when the move succeeds.
    }
  }
  useHuntStore.setState({ gpsRingIntel: intel, terrainElevationMeters: gpsElev });
}

function maybeRefreshGpsRings(map: Map, force = false): void {
  const now = Date.now();
  if (!force && now - lastGpsRingMs < 240) return;
  lastGpsRingMs = now;
  try {
    refreshGpsRangeRings(map);
  } catch {
    // DEM samples are unavailable until the terrain mesh is ready.
  }
}

function applyTerrainPresentation(
  map: Map,
  mode: CameraMode,
  exaggeration: number,
  online: boolean,
): void {
  const threeD = mode !== "flat" && online;
  const state = useHuntStore.getState();
  const nera = Boolean(state.neraMode && threeD);
  applyElevationSkin(map, threeD, {
    basemap: state.basemap,
    hillshadeLayerOn: state.layers.hillshade,
    mapTheme: state.mapTheme,
    neraMode: state.neraMode,
    neraStyle: state.neraStyle,
    contoursLayerOn: state.layers.contours,
    wireframe: state.layers.wireframe,
  });
  applyNeraLimits(map, nera);
  maybeRefreshNeraGrid(map, true);
  maybeRefreshGpsRings(map, true);
  if (threeD) {
    map.setMaxPitch(85);
    map.dragRotate.enable();
    map.touchPitch.enable();
    try {
      applyTerrainMesh(map, exaggeration);
    } catch {
      // DEM mesh is optional; the elevation skin still replaces the paper map.
    }
    try {
      map.setSky(
        nera ? neraSky() : state.mapTheme === "light" ? lightElevationSky() : elevationSky(),
      );
    } catch {
      map.setSky(fieldSky());
    }
    if (mode === "orbit" && map.getPitch() < 50 && !orbitPitchQueued) {
      orbitPitchQueued = true;
      map.once("idle", () => {
        orbitPitchQueued = false;
        const live = useHuntStore.getState();
        if (live.cameraMode !== "orbit" || !live.online) return;
        const neraNow = Boolean(live.neraMode);
        if (map.getPitch() < 50) {
          map.easeTo({
            pitch: neraNow ? neraOrbitPitch(map.getZoom()) : ORBIT_PITCH,
            duration: 780,
          });
        }
        applyNeraLimits(map, neraNow);
      });
    }
    return;
  }
  map.setTerrain(null);
  map.dragRotate.disable();
  map.touchPitch.disable();
  map.setSky(fieldSky());
  if (map.getPitch() !== 0) {
    map.easeTo({ pitch: 0, duration: 420 });
  }
}

function setSourceData(
  map: Map,
  id: string,
  data: HabitatCollection | ReturnType<typeof harvestsToFc> | FeatureCollection,
): void {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data as FeatureCollection);
}

function applyLayerVisibility(map: Map, layers: LayerState): void {
  const visibility = (visible: boolean) => (visible ? "visible" : "none");
  for (const overlay of OVERLAY_CATALOG) {
    const on = layers[overlay.id];
    for (const tile of overlay.tiles) {
      if (map.getLayer(tile.id)) {
        map.setLayoutProperty(tile.id, "visibility", visibility(on));
      }
    }
  }
  if (map.getLayer("hillshade")) {
    map.setLayoutProperty("hillshade", "visibility", visibility(layers.hillshade));
  }
  if (map.getLayer("waypoints")) {
    map.setLayoutProperty("waypoints", "visibility", visibility(layers.waypoints));
    map.setLayoutProperty("waypoints-glow", "visibility", visibility(layers.waypoints));
    if (map.getLayer("waypoints-hit")) {
      map.setLayoutProperty("waypoints-hit", "visibility", visibility(layers.waypoints));
    }
    if (map.getLayer("waypoints-selected")) {
      map.setLayoutProperty("waypoints-selected", "visibility", visibility(layers.waypoints));
    }
  }
  if (map.getLayer("tracks")) {
    map.setLayoutProperty("tracks", "visibility", visibility(layers.tracks));
  }
  if (map.getLayer("harvest-points")) {
    map.setLayoutProperty("harvest-points", "visibility", visibility(layers.kills));
  }
  if (map.getLayer("harvest-hit")) {
    map.setLayoutProperty("harvest-hit", "visibility", visibility(layers.kills));
  }
  if (map.getLayer("harvest-glow")) {
    map.setLayoutProperty("harvest-glow", "visibility", visibility(layers.kills));
  }
  if (map.getLayer("harvest-heat")) {
    map.setLayoutProperty("harvest-heat", "visibility", visibility(layers.killHeat));
  }
  if (map.getLayer("habitat")) {
    map.setLayoutProperty(
      "habitat",
      "visibility",
      visibility(layers.huntScore || layers.bedding || layers.feeding),
    );
  }
  if (map.getLayer("terrain-features")) {
    map.setLayoutProperty(
      "terrain-features",
      "visibility",
      visibility(layers.terrainFeatures),
    );
  }
  const unitVisibility = visibility(layers.huntingUnits);
  if (map.getLayer("hunting-units-fill")) {
    map.setLayoutProperty("hunting-units-fill", "visibility", unitVisibility);
  }
  if (map.getLayer("hunting-units-line")) {
    map.setLayoutProperty("hunting-units-line", "visibility", unitVisibility);
  }
}

export function MapView({
  onIdentify,
  onIntel,
  habitat,
  terrainFeatures,
  huntingUnits,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const gpsMarkerRef = useRef<Marker | null>(null);
  const photoMarkersRef = useRef<Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const handlers = useRef({ onIdentify, onIntel });
  const skipInitialBasemapReload = useRef(true);
  handlers.current = { onIdentify, onIntel };
  const basemap = useHuntStore((state) => state.basemap);
  const layers = useHuntStore((state) => state.layers);
  const waypoints = useHuntStore((state) => state.waypoints);
  const tracks = useHuntStore((state) => state.tracks);
  const gps = useHuntStore((state) => state.gps);
  const mapTarget = useHuntStore((state) => state.mapTarget);
  const selectedWaypointId = useHuntStore((state) => state.selectedWaypointId);
  const cameraMode = useHuntStore((state) => state.cameraMode);
  const mapTheme = useHuntStore((state) => state.mapTheme);
  const neraMode = useHuntStore((state) => state.neraMode);
  const neraStyle = useHuntStore((state) => state.neraStyle);
  const terrainExaggeration = useHuntStore((state) => state.terrainExaggeration);
  const terrainResult = useHuntStore((state) => state.terrainResult);
  const followGps = useHuntStore((state) => state.followGps);
  const fpvHeadingLock = useHuntStore((state) => state.fpvHeadingLock);
  const online = useHuntStore((state) => state.online);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const startGps = useHuntStore.getState().gps;
    const startCenter: [number, number] =
      startGps.longitude !== undefined && startGps.latitude !== undefined
        ? [startGps.longitude, startGps.latitude]
        : [-95.47, 30.58];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createMapStyle("topo"),
      center: startCenter,
      zoom: startGps.latitude !== undefined ? 14 : 12,
      attributionControl: false,
      maxPitch: 85,
      pitchWithRotate: true,
    });
    map.dragRotate.disable();
    map.touchPitch.disable();
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.on("dragstart", () => {
      gpsMarkerRef.current?.getElement().classList.add("is-dragging");
      const state = useHuntStore.getState();
      if (state.cameraMode === "fpv") {
        useHuntStore.setState({ fpvHeadingLock: false });
      } else if (state.followGps) {
        useHuntStore.setState({ followGps: false });
      }
    });
    map.on("dragend", () => {
      gpsMarkerRef.current?.getElement().classList.remove("is-dragging");
    });
    map.on("load", () => {
      ensureOverlays(map);
      const state = useHuntStore.getState();
      setSourceData(map, "waypoints", waypointsToFc(state.waypoints));
      setSourceData(map, "harvests", harvestsToFc(state.waypoints));
      setSourceData(map, "tracks", tracksToFc(state.tracks));
      applyLayerVisibility(map, state.layers);
      applyTerrainPresentation(map, state.cameraMode, state.terrainExaggeration, state.online);
      useHuntStore.setState({
        mapBounds: {
          west: map.getBounds().getWest(),
          south: map.getBounds().getSouth(),
          east: map.getBounds().getEast(),
          north: map.getBounds().getNorth(),
        },
      });
    });
    map.on("moveend", () => {
      const bounds = map.getBounds();
      useHuntStore.setState({
        mapBounds: {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        },
      });
      maybeRefreshNeraGrid(map);
      maybeRefreshGpsRings(map);
    });
    map.on("zoomstart", () => {
      if (isFpvProgrammaticMove()) return;
      fpvZoomHoldUntil = Number.POSITIVE_INFINITY;
      const state = useHuntStore.getState();
      if (state.cameraMode === "fpv" && state.fpvHeadingLock) {
        useHuntStore.setState({ fpvHeadingLock: false });
      }
    });
    map.on("zoomend", () => {
      if (!isFpvProgrammaticMove()) fpvZoomHoldUntil = Date.now() + 1200;
      const state = useHuntStore.getState();
      const nera = Boolean(state.neraMode && state.cameraMode !== "flat" && state.online);
      applyNeraLimits(map, nera);
      maybeRefreshNeraGrid(map, true);
      maybeRefreshGpsRings(map, true);
    });
    let press: ReturnType<typeof setTimeout> | undefined;
    let longPress = false;
    let dragged = false;
    const startPress = (lngLat: { lng: number; lat: number }) => {
      longPress = false;
      dragged = false;
      press = setTimeout(() => {
        longPress = true;
        handlers.current.onIntel(lngLat.lng, lngLat.lat);
      }, 520);
    };
    map.on("mousedown", (event) => startPress(event.lngLat));
    map.on("touchstart", (event) => {
      const first = event.lngLat;
      startPress(first);
    });
    const cancel = () => {
      if (press) clearTimeout(press);
    };
    const finishPress = (lngLat?: { lng: number; lat: number }) => {
      cancel();
      if (!lngLat || longPress || dragged) return;
      const pinId = queryPinId(map, lngLat);
      if (pinId) {
        useHuntStore.setState({ selectedWaypointId: pinId, sheet: "none" });
        return;
      }
      if (map.getLayer("habitat")) {
        const habitatHits = map.queryRenderedFeatures(map.project([lngLat.lng, lngLat.lat]), {
          layers: ["habitat"],
        });
        const hit = habitatHits[0];
        if (hit?.properties) {
          const reasons = hit.properties.reasons;
          const unavailable = hit.properties.unavailable;
          useHuntStore.setState({
            selectedWaypointId: null,
            selectedScore: {
              cellId: String(hit.properties.cellId ?? ""),
              lng: lngLat.lng,
              lat: lngLat.lat,
              score:
                typeof hit.properties.overall === "number" ? hit.properties.overall : null,
              confidence:
                typeof hit.properties.confidence === "number" ? hit.properties.confidence : 0,
              reasons: Array.isArray(reasons)
                ? reasons.map(String)
                : typeof reasons === "string"
                  ? (() => {
                      try {
                        const parsed = JSON.parse(reasons) as unknown;
                        return Array.isArray(parsed) ? parsed.map(String) : [reasons];
                      } catch {
                        return [reasons];
                      }
                    })()
                  : [],
              unavailable: Array.isArray(unavailable)
                ? unavailable.map(String)
                : typeof unavailable === "string"
                  ? (() => {
                      try {
                        const parsed = JSON.parse(unavailable) as unknown;
                        return Array.isArray(parsed) ? parsed.map(String) : [unavailable];
                      } catch {
                        return [unavailable];
                      }
                    })()
                  : [],
              disclaimer: String(hit.properties.disclaimer ?? ""),
            },
          });
          openSheet("intel");
          return;
        }
      }
      useHuntStore.setState({ selectedWaypointId: null });
      handlers.current.onIdentify(lngLat.lng, lngLat.lat);
    };
    map.on("mouseup", (event) => finishPress(event.lngLat));
    map.on("touchend", (event) => finishPress(event.lngLat));
    map.on("dragstart", () => {
      dragged = true;
      cancel();
    });
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      for (const marker of photoMarkersRef.current) marker.remove();
      photoMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapTarget) return;
    const mode = useHuntStore.getState().cameraMode;
    if (mode === "fpv") {
      if (mapTarget.center) {
        const gps = useHuntStore.getState().gps;
        const heading =
          typeof gps.heading === "number" && Number.isFinite(gps.heading) ? gps.heading : null;
        applyFpvCamera(
          map,
          mapTarget.center.longitude,
          mapTarget.center.latitude,
          resolveFpvHeading(heading, map),
          { resetView: true },
        );
      }
      return;
    }
    const nera = useHuntStore.getState().neraMode;
    const pitch = mode === "orbit" ? (nera ? neraOrbitPitch(NERA_WALK_ZOOM) : ORBIT_PITCH) : 0;
    if (mapTarget.center) {
      map.flyTo({
        center: [mapTarget.center.longitude, mapTarget.center.latitude],
        zoom: mapTarget.placeId === "gps-fix" ? (nera ? NERA_WALK_ZOOM : 14) : 12,
        pitch,
        duration: 1400,
      });
      return;
    }
    map.fitBounds(
      [
        [mapTarget.bounds.west, mapTarget.bounds.south],
        [mapTarget.bounds.east, mapTarget.bounds.north],
      ],
      { padding: 48, maxZoom: 12, duration: 1400 },
    );
  }, [mapTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      ensureOverlays(map);
      const state = useHuntStore.getState();
      setSourceData(map, "waypoints", waypointsToFc(state.waypoints));
      setSourceData(map, "harvests", harvestsToFc(state.waypoints));
      setSourceData(map, "tracks", tracksToFc(state.tracks));
      applyLayerVisibility(map, state.layers);
      applyTerrainPresentation(map, state.cameraMode, state.terrainExaggeration, state.online);
    };
    if (skipInitialBasemapReload.current) {
      skipInitialBasemapReload.current = false;
      if (map.isStyleLoaded()) apply();
      else map.once("load", apply);
      return;
    }
    if (basemap === "streets") {
      map.setStyle(OPENFREEMAP_STYLE);
      map.once("style.load", apply);
    } else {
      map.setStyle(createMapStyle(basemap));
      map.once("style.load", apply);
    }
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      applyTerrainPresentation(map, cameraMode, terrainExaggeration, online);
    };
    if (map.isStyleLoaded()) {
      run();
      return;
    }
    map.once("load", run);
    return () => {
      map.off("load", run);
    };
  }, [terrainExaggeration, online, mapTheme, neraMode, neraStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      applyTerrainPresentation(map, cameraMode, terrainExaggeration, online);
      if (cameraMode === "fpv") {
        const state = useHuntStore.getState().gps;
        if (state.longitude !== undefined && state.latitude !== undefined) {
          const heading =
            typeof state.heading === "number" && Number.isFinite(state.heading) ? state.heading : null;
          const elevation = applyFpvCamera(
            map,
            state.longitude,
            state.latitude,
            resolveFpvHeading(heading, map),
            { resetView: true },
          );
          useHuntStore.setState({ terrainElevationMeters: elevation, followGps: true });
        }
      }
    };
    if (map.isStyleLoaded()) {
      run();
      return;
    }
    map.once("load", run);
    return () => {
      map.off("load", run);
    };
  }, [cameraMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyLayerVisibility(map, layers);
    const state = useHuntStore.getState();
    applyTerrainPresentation(map, state.cameraMode, state.terrainExaggeration, state.online);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setSourceData(map, "waypoints", waypointsToFc(waypoints));
    setSourceData(map, "harvests", harvestsToFc(waypoints));
    setSourceData(map, "tracks", tracksToFc(tracks));
  }, [waypoints, tracks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !habitat) return;
    setSourceData(map, "habitat", habitat);
  }, [habitat]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !terrainFeatures) return;
    setSourceData(map, "terrain-features", terrainFeatures);
  }, [terrainFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("slope-heat")) return;
    const cells = terrainResult?.cells ?? [];
    const data: FeatureCollection = {
      type: "FeatureCollection",
      features: cells
        .filter((cell) => typeof cell.slopeDegrees === "number" && cell.slopeDegrees > 0)
        .map((cell) => ({
          type: "Feature",
          properties: { slope: cell.slopeDegrees },
          geometry: { type: "Point", coordinates: [cell.longitude, cell.latitude] },
        })),
    };
    setSourceData(map, "slope-heat", data);
  }, [terrainResult]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !huntingUnits) return;
    setSourceData(map, "hunting-units", huntingUnits);
  }, [huntingUnits]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hasFix = gps.latitude !== undefined && gps.longitude !== undefined;
    const accuracy =
      typeof gps.accuracy === "number" && gps.accuracy > 8 ? gps.accuracy : 0;
    const ring =
      hasFix && accuracy > 8
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "Polygon" as const,
                  coordinates: [
                    geodesicCircleRing(
                      { latitude: gps.latitude!, longitude: gps.longitude! },
                      accuracy,
                    ),
                  ],
                },
              },
            ],
          }
        : { type: "FeatureCollection" as const, features: [] };
    setSourceData(map, "gps-accuracy", ring);
    setSourceData(
      map,
      "gps-puck",
      hasFix
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "Polygon" as const,
                  coordinates: [
                    geodesicCircleRing(
                      { latitude: gps.latitude!, longitude: gps.longitude! },
                      7,
                    ),
                  ],
                },
              },
            ],
          }
        : { type: "FeatureCollection" as const, features: [] },
    );
    if (map.getLayer("gps-puck")) {
      map.setLayoutProperty("gps-puck", "visibility", hasFix && cameraMode !== "flat" ? "visible" : "none");
    }
    if (map.getLayer("gps-puck-core")) {
      map.setLayoutProperty("gps-puck-core", "visibility", hasFix && cameraMode !== "flat" ? "visible" : "none");
    }
    if (map.getLayer("gps-accuracy-fill")) {
      map.setLayoutProperty("gps-accuracy-fill", "visibility", hasFix && cameraMode === "flat" ? "visible" : "none");
    }
    if (map.getLayer("gps-accuracy-line")) {
      map.setLayoutProperty("gps-accuracy-line", "visibility", hasFix && cameraMode === "flat" ? "visible" : "none");
    }

    if (!hasFix) {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      maybeRefreshGpsRings(map, true);
      return;
    }
    const heading = typeof gps.heading === "number" && Number.isFinite(gps.heading) ? gps.heading : null;
    const stale = gps.source !== "gps";
    const poor = typeof gps.accuracy === "number" && gps.accuracy > 45;
    const fpv = cameraMode === "fpv";
    const el = document.createElement("div");
    el.className = `nomad-gps-puck${stale ? " is-operator" : ""}${poor ? " is-poor" : ""}${heading == null ? " no-heading" : ""}${fpv ? " is-fpv" : ""}`;
    el.innerHTML = `<div class="nomad-gps-wrap" style="transform:rotate(${heading ?? 0}deg)"><div class="nomad-gps-pulse"></div>${heading != null ? '<div class="nomad-gps-chevron"></div>' : ""}<div class="nomad-gps-core"></div></div>`;
    if (!gpsMarkerRef.current) {
      gpsMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([gps.longitude!, gps.latitude!])
        .addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([gps.longitude!, gps.latitude!]);
      gpsMarkerRef.current.getElement().className = el.className;
      gpsMarkerRef.current.getElement().innerHTML = el.innerHTML;
    }
    gpsMarkerRef.current.getElement().style.display = cameraMode === "flat" ? "" : "none";

    const elevation = map.queryTerrainElevation([gps.longitude!, gps.latitude!]);
    if (elevation != null) {
      useHuntStore.setState({ terrainElevationMeters: elevation });
    }
    maybeRefreshNeraGrid(map, true);
    maybeRefreshGpsRings(map, true);

    if (fpv && fpvHeadingLock) {
      if (Date.now() >= fpvZoomHoldUntil) {
        applyFpvCamera(map, gps.longitude!, gps.latitude!, resolveFpvHeading(heading, map));
      }
      return;
    }
    if (followGps && !fpv && Date.now() >= fpvZoomHoldUntil) {
      const nera = useHuntStore.getState().neraMode;
      map.easeTo({
        center: [gps.longitude!, gps.latitude!],
        pitch: cameraMode === "orbit" ? (nera ? neraOrbitPitch(map.getZoom()) : ORBIT_PITCH) : map.getPitch(),
        duration: 420,
      });
    }
  }, [gps, cameraMode, followGps, fpvHeadingLock]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of photoMarkersRef.current) marker.remove();
    photoMarkersRef.current = [];
    for (const waypoint of waypoints) {
      const photo = waypoint.photos[0];
      if (!photo) continue;
      const isKill = waypoint.type === "harvest";
      if (isKill && !layers.kills) continue;
      if (!isKill && !layers.waypoints) continue;
      const el = document.createElement("div");
      el.className = "nomad-photo-pin";
      el.style.backgroundImage = `url(${JSON.stringify(photo)})`;
      bindPhotoPin(el, waypoint.id);
      photoMarkersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([waypoint.longitude, waypoint.latitude])
          .addTo(map),
      );
    }
  }, [waypoints, layers.waypoints, layers.kills]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const waypoint = waypoints.find((item) => item.id === selectedWaypointId);
    if (map.getLayer("waypoints-selected")) {
      map.setFilter("waypoints-selected", ["==", ["get", "id"], waypoint?.id ?? ""]);
    }
    if (!waypoint) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    map.easeTo({
      center: [waypoint.longitude, waypoint.latitude],
      duration: 640,
      pitch: map.getPitch(),
    });
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        className: "pin-pop-wrap",
        maxWidth: "260px",
      });
    }
    const popup = popupRef.current;
    popup.setLngLat([waypoint.longitude, waypoint.latitude]).setHTML(pinPopupHtml(waypoint)).addTo(map);
    const root = popup.getElement();
    root?.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const act = (event.currentTarget as HTMLElement).getAttribute("data-act");
        if (act === "go") {
          const nera = useHuntStore.getState().neraMode;
          map.easeTo({
            center: [waypoint.longitude, waypoint.latitude],
            duration: 700,
            pitch: map.getPitch(),
            zoom: Math.max(map.getZoom(), nera ? NERA_WALK_ZOOM : 14.2),
          });
          return;
        }
        if (act === "photo") {
          void attachWebWaypointPhoto(waypoint.id);
          return;
        }
        if (act === "edit") {
          openSheet("mark");
          return;
        }
        if (act === "close") {
          useHuntStore.setState({ selectedWaypointId: null, sheet: "none" });
        }
      });
    });
  }, [selectedWaypointId, waypoints]);

  return <div ref={containerRef} className="absolute inset-0" />;
}


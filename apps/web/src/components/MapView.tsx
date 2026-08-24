"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { Track, Waypoint } from "@huntos/core";
import { harvestsToFc, mapMarkWaypoints } from "@/lib/harvest-map";
import { createMapStyle, OPENFREEMAP_STYLE } from "@/lib/map-style";
import { openSheet, useHuntStore, type LayerState } from "@/lib/store";

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

function ensureOverlays(map: Map): void {
  if (!map.getSource("padus")) {
    map.addSource("padus", {
      type: "raster",
      tiles: ["/api/tiles/padus/{z}/{x}/{y}"],
      tileSize: 256,
      attribution: "USGS PAD-US 4.1",
      maxzoom: 15,
    });
    map.addLayer({
      id: "padus",
      type: "raster",
      source: "padus",
      paint: { "raster-opacity": 0.55 },
    });
  }
  if (!map.getSource("hillshade")) {
    map.addSource("hillshade", {
      type: "raster",
      tiles: ["/api/tiles/usgs-hillshade/{z}/{x}/{y}"],
      tileSize: 256,
      maxzoom: 15,
    });
    map.addLayer({
      id: "hillshade",
      type: "raster",
      source: "hillshade",
      paint: { "raster-opacity": 0.35 },
      layout: { visibility: "none" },
    });
  }
  if (!map.getSource("waypoints")) {
    map.addSource("waypoints", { type: "geojson", data: waypointsToFc([]) as FeatureCollection });
    map.addLayer({
      id: "waypoints-glow",
      type: "circle",
      source: "waypoints",
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
  }
  if (!map.getSource("harvests")) {
    map.addSource("harvests", { type: "geojson", data: harvestsToFc([]) as FeatureCollection });
    map.addLayer({
      id: "harvest-heat",
      type: "heatmap",
      source: "harvests",
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.55, 14, 1.35],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 18, 14, 44],
        "heatmap-opacity": 0.72,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.15,
          "rgba(255, 80, 0, 0.28)",
          0.4,
          "rgba(239, 68, 68, 0.55)",
          0.7,
          "rgba(220, 38, 38, 0.82)",
          1,
          "rgba(254, 226, 168, 1)",
        ],
      },
    });
    map.addLayer({
      id: "harvest-points",
      type: "circle",
      source: "harvests",
      paint: {
        "circle-radius": 7,
        "circle-color": "#ef4444",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff5f0",
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
  if (!map.getSource("gps")) {
    map.addSource("gps", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "gps-accuracy",
      type: "circle",
      source: "gps",
      paint: {
        "circle-radius": 18,
        "circle-color": "#6fbf73",
        "circle-opacity": 0.15,
      },
    });
    map.addLayer({
      id: "gps",
      type: "circle",
      source: "gps",
      paint: {
        "circle-radius": 6,
        "circle-color": "#e6a31a",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff7d6",
      },
    });
  }
}

function setSourceData(
  map: Map,
  id: string,
  data: HabitatCollection | ReturnType<typeof harvestsToFc>,
): void {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data as FeatureCollection);
}

function applyLayerVisibility(map: Map, layers: LayerState): void {
  const visibility = (visible: boolean) => (visible ? "visible" : "none");
  if (map.getLayer("padus")) {
    map.setLayoutProperty("padus", "visibility", visibility(layers.publicLand));
  }
  if (map.getLayer("hillshade")) {
    map.setLayoutProperty("hillshade", "visibility", visibility(layers.hillshade));
  }
  if (map.getLayer("waypoints")) {
    map.setLayoutProperty("waypoints", "visibility", visibility(layers.waypoints));
    map.setLayoutProperty("waypoints-glow", "visibility", visibility(layers.waypoints));
  }
  if (map.getLayer("tracks")) {
    map.setLayoutProperty("tracks", "visibility", visibility(layers.tracks));
  }
  if (map.getLayer("harvest-points")) {
    map.setLayoutProperty("harvest-points", "visibility", visibility(layers.kills));
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
}

export function MapView({ onIdentify, onIntel, habitat }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const handlers = useRef({ onIdentify, onIntel });
  handlers.current = { onIdentify, onIntel };
  const basemap = useHuntStore((state) => state.basemap);
  const layers = useHuntStore((state) => state.layers);
  const waypoints = useHuntStore((state) => state.waypoints);
  const tracks = useHuntStore((state) => state.tracks);
  const gps = useHuntStore((state) => state.gps);
  const mapTarget = useHuntStore((state) => state.mapTarget);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createMapStyle("topo"),
      center: [-95.47, 30.58],
      zoom: 12,
      attributionControl: { compact: true },
      maxPitch: 0,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.on("load", () => {
      ensureOverlays(map);
      const state = useHuntStore.getState();
      setSourceData(map, "waypoints", waypointsToFc(state.waypoints));
      setSourceData(map, "harvests", harvestsToFc(state.waypoints));
      setSourceData(map, "tracks", tracksToFc(state.tracks));
      applyLayerVisibility(map, state.layers);
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
      if (map.getLayer("harvest-points")) {
        const hits = map.queryRenderedFeatures(map.project([lngLat.lng, lngLat.lat]), {
          layers: ["harvest-points"],
        });
        if (hits.length > 0) {
          openSheet("kill");
          return;
        }
      }
      handlers.current.onIdentify(lngLat.lng, lngLat.lat);
    };
    map.on("mouseup", (event) => finishPress(event.lngLat));
    map.on("touchend", (event) => finishPress(event.lngLat));
    map.on("dragstart", () => {
      dragged = true;
      cancel();
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapTarget) return;
    if (mapTarget.center) {
      map.flyTo({
        center: [mapTarget.center.longitude, mapTarget.center.latitude],
        zoom: 12,
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
    };
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
    if (!map?.isStyleLoaded()) return;
    applyLayerVisibility(map, layers);
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
    if (!map) return;
    const data: HabitatCollection =
      gps.latitude !== undefined && gps.longitude !== undefined
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { source: gps.source },
                geometry: {
                  type: "Point",
                  coordinates: [gps.longitude, gps.latitude],
                },
              },
            ],
          }
        : { type: "FeatureCollection", features: [] };
    setSourceData(map, "gps", data);
  }, [gps]);

  return <div ref={containerRef} className="absolute inset-0" />;
}


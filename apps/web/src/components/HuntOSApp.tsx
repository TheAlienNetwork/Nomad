"use client";

import { useCallback, useEffect, useState } from "react";
import {
  estimateRasterTileCount,
  markPending,
  outgoingQueue,
  pathLengthMeters,
  type HuntArea,
  type IdentifyResult,
  type Track,
  type Waypoint,
  type SpeciesId,
  type WaypointType,
} from "@huntos/core";
import { fetchWeather, identifyLand, runScoutRequest, syncWaypoints } from "@/lib/api";
import {
  allHuntAreas,
  allWaypoints,
  getOrCreateIdentity,
  saveHuntArea,
  saveTrack,
  saveWaypoint,
} from "@/lib/offline";
import { closeSheet, openSheet, useHuntStore } from "@/lib/store";
import {
  AreasSheet,
  Dock,
  DownloadSheet,
  FieldExtras,
  GpsSheet,
  LayersPanel,
  PropertySheet,
  ReturnSheet,
  ScoutSheet,
  TopBar,
  WaypointSheet,
} from "./FieldChrome";
import { MapView, type HabitatCollection } from "./MapView";

export function HuntOSApp() {
  const [habitat, setHabitat] = useState<HabitatCollection | null>(null);
  const [intelPoint, setIntelPoint] = useState<{ lng: number; lat: number }>();
  const userId = useHuntStore((state) => state.userId);
  const waypoints = useHuntStore((state) => state.waypoints);
  const tracks = useHuntStore((state) => state.tracks);
  const gps = useHuntStore((state) => state.gps);
  const fieldMode = useHuntStore((state) => state.fieldMode);
  const identify = useHuntStore((state) => state.identify);
  const mapBounds = useHuntStore((state) => state.mapBounds);
  const scout = useHuntStore((state) => state.scout);
  const weather = useHuntStore((state) => state.weather);

  useEffect(() => {
    const onOnline = () => useHuntStore.setState({ online: navigator.onLine });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    void (async () => {
      const identity = await getOrCreateIdentity();
      const stored = await allWaypoints(identity.id);
      const areas = await allHuntAreas(identity.id);
      useHuntStore.setState({ userId: identity.id, waypoints: stored, huntAreas: areas });
    })();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      useHuntStore.setState({
        gps: { source: "none", error: "Geolocation is not available in this browser." },
      });
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        useHuntStore.setState({
          gps: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ?? undefined,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
            source: "gps",
          },
        });
      },
      (error) => {
        useHuntStore.setState({
          gps: { source: "none", error: error.message },
        });
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  useEffect(() => {
    const point =
      gps.latitude !== undefined && gps.longitude !== undefined
        ? { latitude: gps.latitude, longitude: gps.longitude }
        : { latitude: 30.58, longitude: -95.47 };
    void fetchWeather(point.latitude, point.longitude)
      .then((snapshot) => useHuntStore.setState({ weather: snapshot }))
      .catch(() => undefined);
  }, [gps.latitude, gps.longitude]);

  useEffect(() => {
    if (!userId || !navigator.onLine) return;
    const pending = outgoingQueue(
      waypoints.map((waypoint) => ({
        localId: waypoint.id,
        serverId: waypoint.serverId,
        createdAt: waypoint.createdAt,
        updatedAt: waypoint.updatedAt,
        syncStatus: waypoint.syncStatus,
        version: waypoint.version,
        payload: waypoint,
      })),
    );
    if (pending.length === 0) return;
    void syncWaypoints(userId, pending.map((item) => item.payload))
      .then((synced) => {
        useHuntStore.setState({
          waypoints: waypoints.map((waypoint) => {
            const match = synced.find((item) => item.id === waypoint.id);
            return match ? { ...match, syncStatus: "synced" } : waypoint;
          }),
        });
      })
      .catch(() => undefined);
  }, [userId, waypoints]);

  const runIdentify = useCallback(async (lng: number, lat: number) => {
    setIntelPoint({ lng, lat });
    openSheet("property");
    useHuntStore.setState({
      identify: {
        truthLayer: "authoritative",
        found: false,
        status: "unknown",
        features: [],
        message: "Querying PAD-US…",
        warnings: [],
      },
    });
    try {
      const result = await identifyLand(lng, lat);
      useHuntStore.setState({ identify: result });
    } catch (error) {
      const result: IdentifyResult = {
        truthLayer: "authoritative",
        found: false,
        status: "unknown",
        features: [],
        message:
          error instanceof Error
            ? `Land lookup failed: ${error.message}`
            : "Land lookup failed.",
        warnings: [],
      };
      useHuntStore.setState({ identify: result });
      openSheet("property");
    }
  }, []);

  const currentPoint = (): { latitude: number; longitude: number } | null => {
    if (gps.latitude !== undefined && gps.longitude !== undefined) {
      return { latitude: gps.latitude, longitude: gps.longitude };
    }
    if (intelPoint) return { latitude: intelPoint.lat, longitude: intelPoint.lng };
    if (mapBounds) {
      return {
        latitude: (mapBounds.south + mapBounds.north) / 2,
        longitude: (mapBounds.west + mapBounds.east) / 2,
      };
    }
    return null;
  };

  const createWaypoint = async (input: {
    type: WaypointType;
    name: string;
    notes: string;
    species?: SpeciesId;
  }) => {
    if (!userId) return;
    const point = currentPoint();
    if (!point) return;
    const now = new Date().toISOString();
    const waypoint: Waypoint = {
      id: crypto.randomUUID(),
      userId,
      type: input.type,
      name: input.name,
      notes: input.notes,
      latitude: point.latitude,
      longitude: point.longitude,
      createdAt: now,
      updatedAt: now,
      observedAt: now,
      species: input.species,
      photos: [],
      tags: [],
      visibility: "private",
      syncStatus: "pending",
      version: 1,
    };
    const queued = markPending(
      {
        localId: waypoint.id,
        createdAt: now,
        updatedAt: now,
        syncStatus: "local",
        version: 0,
        payload: waypoint,
      },
      now,
    ).payload;
    await saveWaypoint({ ...queued, syncStatus: "pending" });
    useHuntStore.setState({
      waypoints: [...waypoints, { ...queued, syncStatus: "pending" }],
      truckWaypointId:
        input.type === "truck" ? queued.id : useHuntStore.getState().truckWaypointId,
    });
    closeSheet();
  };

  const startTrack = async () => {
    if (!userId) return;
    const point = currentPoint();
    if (!point) return;
    const now = new Date().toISOString();
    const track: Track = {
      id: crypto.randomUUID(),
      userId,
      name: "Field track",
      startedAt: now,
      status: "recording",
      points: [
        {
          ...point,
          recordedAt: now,
          accuracyM: gps.accuracy,
          altitudeM: gps.altitude,
          speedMps: gps.speed,
          heading: gps.heading,
        },
      ],
      distanceMeters: 0,
      visibility: "private",
      syncStatus: "pending",
      version: 1,
    };
    await saveTrack(track);
    useHuntStore.setState({ tracks: [...tracks, track], activeTrackId: track.id });
  };

  useEffect(() => {
    const active = tracks.find((track) => track.status === "recording");
    if (!active || gps.latitude === undefined || gps.longitude === undefined) return;
    const last = active.points[active.points.length - 1];
    if (
      last &&
      Math.abs(last.latitude - gps.latitude) < 0.00002 &&
      Math.abs(last.longitude - gps.longitude) < 0.00002
    ) {
      return;
    }
    const next: Track = {
      ...active,
      points: [
        ...active.points,
        {
          latitude: gps.latitude,
          longitude: gps.longitude,
          recordedAt: new Date().toISOString(),
          accuracyM: gps.accuracy,
          altitudeM: gps.altitude,
          speedMps: gps.speed,
          heading: gps.heading,
        },
      ],
      distanceMeters: 0,
    };
    next.distanceMeters = pathLengthMeters(next.points);
    void saveTrack(next);
    useHuntStore.setState({
      tracks: tracks.map((track) => (track.id === next.id ? next : track)),
    });
  }, [gps.latitude, gps.longitude, gps.accuracy, gps.altitude, gps.heading, gps.speed, tracks]);

  const downloadArea = async () => {
    if (!mapBounds) return;
    const zooms = [8, 9, 10, 11];
    const total = estimateRasterTileCount(mapBounds, 8, 11);
    let done = 0;
    useHuntStore.setState({
      downloadProgress: { done, total, label: "Caching USGS topo + PAD-US" },
    });
    const nFor = (z: number) => 2 ** z;
    for (const z of zooms) {
      const n = nFor(z);
      const xMin = Math.floor(((mapBounds.west + 180) / 360) * n);
      const xMax = Math.floor(((mapBounds.east + 180) / 360) * n);
      const latToY = (lat: number) =>
        Math.floor(
          ((1 -
            Math.log(
              Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
            ) /
              Math.PI) /
            2) *
            n,
        );
      const yMin = latToY(mapBounds.north);
      const yMax = latToY(mapBounds.south);
      for (let x = xMin; x <= xMax; x += 1) {
        for (let y = yMin; y <= yMax; y += 1) {
          await Promise.all([
            fetch(`/api/tiles/usgs-topo/${z}/${x}/${y}`).catch(() => undefined),
            fetch(`/api/tiles/padus/${z}/${x}/${y}`).catch(() => undefined),
          ]);
          done += 1;
          useHuntStore.setState({
            downloadProgress: { done, total, label: "Caching USGS topo + PAD-US" },
          });
        }
      }
    }
    await fetch(
      `/api/gis/features?west=${mapBounds.west}&south=${mapBounds.south}&east=${mapBounds.east}&north=${mapBounds.north}`,
    ).catch(() => undefined);
  };

  const analyzeScout = async () => {
    if (!mapBounds) return;
    useHuntStore.setState({
      scout: { ...(scout as NonNullable<typeof scout>), stage: "Loading terrain..." },
    });
    const payload = await runScoutRequest({
      species: scout?.species ?? "whitetail",
      period: scout?.period ?? "now",
      ...mapBounds,
      wind:
        weather?.windDirectionFromDegrees !== null &&
        weather?.windDirectionFromDegrees !== undefined &&
        weather.windSpeedMps !== null
          ? {
              directionFromDegrees: weather.windDirectionFromDegrees,
              speedMps: weather.windSpeedMps ?? 0,
              source: weather.source,
              retrievedAt: weather.retrievedAt,
            }
          : null,
    });
    useHuntStore.setState({
      scoutResult: payload,
      layers: { ...useHuntStore.getState().layers, huntScore: true },
    });
    setHabitat(payload.overlay as HabitatCollection);
  };

  const saveArea = async (name: string) => {
    if (!userId || !mapBounds) return;
    const now = new Date().toISOString();
    const area: HuntArea = {
      id: crypto.randomUUID(),
      userId,
      name,
      west: mapBounds.west,
      south: mapBounds.south,
      east: mapBounds.east,
      north: mapBounds.north,
      createdAt: now,
      updatedAt: now,
      visibility: "private",
      syncStatus: "pending",
      version: 1,
    };
    await saveHuntArea(area);
    useHuntStore.setState({
      huntAreas: [...useHuntStore.getState().huntAreas, area],
      activeAreaId: area.id,
    });
  };

  const truck = waypoints.find(
    (waypoint) =>
      waypoint.id === useHuntStore.getState().truckWaypointId || waypoint.type === "truck",
  );

  return (
    <main className={`relative h-dvh w-full overflow-hidden bg-field-ink ${fieldMode ? "field-mode" : ""}`}>
      <MapView
        onIdentify={(lng, lat) => void runIdentify(lng, lat)}
        onIntel={(lng, lat) => {
          setIntelPoint({ lng, lat });
          void runIdentify(lng, lat);
          openSheet("intel");
        }}
        habitat={habitat}
      />
      <div className="pointer-events-none absolute inset-0 reticle" />
      {!fieldMode && <TopBar />}
      {!fieldMode && <FieldExtras />}
      <Dock
        onLocate={() => {
          if (gps.latitude === undefined) openSheet("gps");
        }}
        onWaypoint={() => openSheet("waypoint")}
        onReturn={() => openSheet("return")}
      />
      <LayersPanel />
      <PropertySheet result={identify} coordinate={intelPoint} />
      <WaypointSheet onSave={(input) => void createWaypoint(input)} />
      <ScoutSheet onAnalyze={() => void analyzeScout()} />
      <DownloadSheet onDownload={() => void downloadArea()} />
      <ReturnSheet truck={truck} />
      <AreasSheet onSaveArea={(name) => void saveArea(name)} />
      <GpsSheet
        onStartTrack={() => void startTrack()}
        onPauseTrack={() => {
          useHuntStore.setState({
            tracks: tracks.map((track) =>
              track.status === "recording" ? { ...track, status: "paused" } : track,
            ),
          });
        }}
        onOperatorFix={() => {
          if (!mapBounds) return;
          useHuntStore.setState({
            gps: {
              latitude: (mapBounds.south + mapBounds.north) / 2,
              longitude: (mapBounds.west + mapBounds.east) / 2,
              source: "operator",
              error: "Operator-set map center. This is not a GPS fix.",
            },
          });
        }}
      />
    </main>
  );
}

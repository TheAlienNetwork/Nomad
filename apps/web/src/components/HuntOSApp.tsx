"use client";

import { useCallback, useEffect, useState } from "react";
import {
  estimateRasterTileCount,
  listRasterTiles,
  markPending,
  overlayDefinition,
  packExtentForState,
  sanitizePackSelection,
  defaultPackSelection,
  outgoingQueue,
  pathLengthMeters,
  type HuntArea,
  type IdentifyResult,
  type OverlayId,
  type Track,
  type Waypoint,
  type SpeciesId,
  type WaypointType,
} from "@huntos/core";
import {
  fetchSession,
  fetchWeather,
  identifyLand,
  loginAccount,
  logoutAccount,
  pullWaypoints,
  registerAccount,
  runScoutRequest,
  analyzeTerrainRequest,
  syncWaypoints,
} from "@/lib/api";
import {
  allHuntAreas,
  allWaypoints,
  getOrCreateIdentity,
  saveHuntArea,
  saveTrack,
  saveWaypoint,
} from "@/lib/offline";
import { DEFAULT_FIELD_CENTER } from "@/lib/places";
import { closeSheet, flyToBounds, flyToGpsFix, openSheet, readPersistedHunterState, useHuntStore } from "@/lib/store";
import {
  AccountSheet,
  AreasSheet,
  Dock,
  DownloadSheet,
  FieldExtras,
  GpsSheet,
  KillSheet,
  LayersPanel,
  MarkSheet,
  PropertySheet,
  ReturnSheet,
  ScoutSheet,
  TerrainSheet,
  TerrainHud,
  TopBar,
  WaypointSheet,
} from "./FieldChrome";
import { MapView, type HabitatCollection } from "./MapView";

function mergeWaypoints(local: Waypoint[], remote: Waypoint[]): Waypoint[] {
  const byId = new Map<string, Waypoint>();
  for (const waypoint of local) byId.set(waypoint.id, waypoint);
  for (const waypoint of remote) {
    const existing = byId.get(waypoint.id);
    if (!existing || waypoint.updatedAt >= existing.updatedAt) {
      byId.set(waypoint.id, { ...waypoint, syncStatus: "synced" });
    }
  }
  return [...byId.values()];
}

async function cachePackUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    if (typeof caches !== "undefined") {
      const cache = await caches.open("nomad-field-pack");
      await cache.put(url, response.clone());
    }
    return true;
  } catch {
    return false;
  }
}

export function HuntOSApp() {
  const [habitat, setHabitat] = useState<HabitatCollection | null>(null);
  const [terrainOverlay, setTerrainOverlay] = useState<HabitatCollection | null>(null);
  const [huntingUnits, setHuntingUnits] = useState<HabitatCollection | null>(null);
  const [intelPoint, setIntelPoint] = useState<{ lng: number; lat: number }>();
  const [accountError, setAccountError] = useState<string>();
  const userId = useHuntStore((state) => state.userId);
  const account = useHuntStore((state) => state.account);
  const waypoints = useHuntStore((state) => state.waypoints);
  const tracks = useHuntStore((state) => state.tracks);
  const gps = useHuntStore((state) => state.gps);
  const fieldMode = useHuntStore((state) => state.fieldMode);
  const identify = useHuntStore((state) => state.identify);
  const mapBounds = useHuntStore((state) => state.mapBounds);
  const neraMode = useHuntStore((state) => state.neraMode);
  const neraStyle = useHuntStore((state) => state.neraStyle);
  const wireframe = useHuntStore((state) => state.layers.wireframe);
  const cameraMode = useHuntStore((state) => state.cameraMode);
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
      const session = await fetchSession().catch(() => null);
      const persisted = readPersistedHunterState();
      useHuntStore.setState({
        userId: identity.id,
        account: session,
        waypoints: stored,
        huntAreas: areas,
        hunterState: persisted.hunterState,
        packSelection:
          persisted.packSelection.length > 0
            ? persisted.packSelection
            : persisted.hunterState
              ? defaultPackSelection(persisted.hunterState)
              : [],
      });
    })();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);

  const fpvWatch = cameraMode === "fpv";
  useEffect(() => {
    if (!navigator.geolocation) {
      useHuntStore.setState({
        gps: { source: "none", error: "Geolocation is not available in this browser." },
      });
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          source: "gps" as const,
        };
        const state = useHuntStore.getState();
        useHuntStore.setState({ gps: next });
        if (!state.firstFixFlown) {
          useHuntStore.setState({ firstFixFlown: true });
          flyToGpsFix(next.latitude, next.longitude);
        }
      },
      (error) => {
        useHuntStore.setState({
          gps: { source: "none", error: error.message },
        });
      },
      { enableHighAccuracy: true, maximumAge: fpvWatch ? 1_000 : 5_000, timeout: 12_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [fpvWatch]);

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
    if (!userId || !account || !navigator.onLine) return;
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
    void syncWaypoints(pending.map((item) => item.payload))
      .then((synced) => {
        useHuntStore.setState({
          waypoints: waypoints.map((waypoint) => {
            const match = synced.find((item) => item.id === waypoint.id);
            return match ? { ...match, syncStatus: "synced" } : waypoint;
          }),
        });
      })
      .catch(() => undefined);
  }, [account, userId, waypoints]);

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
    return DEFAULT_FIELD_CENTER;
  };

  const createWaypoint = async (input: {
    type: WaypointType;
    name: string;
    notes: string;
    species?: SpeciesId;
    photos?: string[];
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
      photos: (input.photos ?? []).slice(0, 6),
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
    const current = useHuntStore.getState();
    useHuntStore.setState({
      waypoints: [...waypoints, { ...queued, syncStatus: "pending" }],
      selectedWaypointId: queued.id,
      truckWaypointId: input.type === "truck" ? queued.id : current.truckWaypointId,
      draftKillSpecies: input.species ?? current.draftKillSpecies,
      layers:
        input.type === "harvest"
          ? { ...current.layers, kills: true, killHeat: true }
          : current.layers,
    });
    flyToBounds(
      queued.id,
      {
        west: point.longitude - 0.01,
        south: point.latitude - 0.01,
        east: point.longitude + 0.01,
        north: point.latitude + 0.01,
      },
      point,
    );
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
      downloadProgress: { done, total, label: "Caching USGS topo + PAD-US + TPWD hunts" },
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
            fetch(`/api/tiles/public-hunt/${z}/${x}/${y}`).catch(() => undefined),
          ]);
          done += 1;
          useHuntStore.setState({
            downloadProgress: { done, total, label: "Caching USGS topo + PAD-US + TPWD hunts" },
          });
        }
      }
    }
    await fetch(
      `/api/gis/features?west=${mapBounds.west}&south=${mapBounds.south}&east=${mapBounds.east}&north=${mapBounds.north}`,
    ).catch(() => undefined);
  };

  const downloadStatePack = async () => {
    const state = useHuntStore.getState();
    const code = state.hunterState;
    const extent = packExtentForState(code);
    const ids = sanitizePackSelection(code, state.packSelection);
    if (!extent || ids.length === 0) return;
    let cached: OverlayId[] = [...state.packCachedIds];
    for (const id of ids) {
      const overlay = overlayDefinition(id);
      let ok = false;
      if (overlay.cacheMode === "vector") {
        useHuntStore.setState({
          packStatus: { overlayId: id, done: 0, total: 1, label: overlay.label },
        });
        ok = await cachePackUrl(
          `/api/gis/features?overlay=${id}&state=${code}&west=${extent.west}&south=${extent.south}&east=${extent.east}&north=${extent.north}`,
        );
      } else {
        const tiles = listRasterTiles(extent, 7, 10);
        let done = 0;
        const total = tiles.length * overlay.tiles.length;
        for (const tile of tiles) {
          const results = await Promise.all(
            overlay.tiles.map((spec) =>
              cachePackUrl(`/api/tiles/${spec.id}/${tile.z}/${tile.x}/${tile.y}`),
            ),
          );
          if (results.some(Boolean)) ok = true;
          done += overlay.tiles.length;
          useHuntStore.setState({
            packStatus: { overlayId: id, done, total, label: overlay.label },
          });
        }
      }
      if (ok && !cached.includes(id)) cached = [...cached, id];
      useHuntStore.setState({ packCachedIds: cached });
    }
    useHuntStore.setState({
      packLastDownloaded: new Date().toISOString(),
      packStatus: undefined,
    });
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
      layers: {
        ...useHuntStore.getState().layers,
        huntScore: true,
        terrainFeatures: Boolean(payload.featureOverlay),
        huntingUnits: Boolean(
          payload.unitOverlay &&
            (payload.unitOverlay as HabitatCollection).features?.length,
        ),
      },
    });
    setHabitat(payload.overlay as HabitatCollection);
    if (payload.featureOverlay) {
      setTerrainOverlay(payload.featureOverlay as HabitatCollection);
    }
    if (payload.unitOverlay) {
      setHuntingUnits(payload.unitOverlay as HabitatCollection);
    }
  };

  const analyzeTerrain = useCallback(async () => {
    if (!mapBounds) return;
    const payload = (await analyzeTerrainRequest(mapBounds)) as {
      overlay?: HabitatCollection;
      features?: Array<{
        kind: string;
        label: string;
        reasons: string[];
        confidence: number;
      }>;
      cells?: Array<{
        center?: { longitude: number; latitude: number };
        slopeDegrees?: number | null;
        elevationMeters?: number | null;
        terrainPosition?: string;
      }>;
    };
    useHuntStore.setState({
      terrainResult: {
        features: payload.features ?? [],
        cells: (payload.cells ?? [])
          .filter((cell) => cell.center)
          .map((cell) => ({
            longitude: cell.center!.longitude,
            latitude: cell.center!.latitude,
            slopeDegrees: cell.slopeDegrees ?? null,
            elevationMeters: cell.elevationMeters ?? null,
            terrainPosition: cell.terrainPosition,
          })),
      },
      layers: { ...useHuntStore.getState().layers, terrainFeatures: true },
    });
    if (payload.overlay) setTerrainOverlay(payload.overlay);
  }, [mapBounds]);

  useEffect(() => {
    if (!mapBounds) return;
    if (cameraMode === "flat" && !neraMode) return;
    const follow = useHuntStore.getState().followGps;
    if (cameraMode === "fpv" && follow) return;
    const timer = window.setTimeout(() => {
      void analyzeTerrain();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [neraMode, cameraMode, mapBounds, analyzeTerrain]);

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
    <main className={`relative h-dvh w-full overflow-hidden bg-field-ink ${fieldMode ? "field-mode" : ""} ${neraMode ? "nera-mode" : ""} ${neraMode && neraStyle === "wire" ? "nera-wire" : ""} ${wireframe ? "wireframe-mesh" : ""}`}>
      <MapView
        onIdentify={(lng, lat) => void runIdentify(lng, lat)}
        onIntel={(lng, lat) => {
          setIntelPoint({ lng, lat });
          void runIdentify(lng, lat);
          openSheet("intel");
        }}
        habitat={habitat}
        terrainFeatures={terrainOverlay}
        huntingUnits={huntingUnits}
      />
      {!neraMode ? <div className="pointer-events-none absolute inset-0 reticle" /> : null}
      {neraMode ? <div className="nera-frame" aria-hidden="true" /> : null}
      <TerrainHud onScan={() => void analyzeTerrain()} />
      {!fieldMode && <TopBar />}
      {!fieldMode && <FieldExtras />}
      <Dock
        onLocate={() => {
          const state = useHuntStore.getState();
          if (gps.latitude === undefined || gps.longitude === undefined) {
            openSheet("gps");
            return;
          }
          if (state.cameraMode === "fpv") {
            useHuntStore.setState({ fpvHeadingLock: true, followGps: true });
            flyToGpsFix(gps.latitude, gps.longitude);
            return;
          }
          const next = !state.followGps;
          useHuntStore.setState({ followGps: next });
          if (next) flyToGpsFix(gps.latitude, gps.longitude);
        }}
        onWaypoint={() => {
          const selected = useHuntStore.getState().selectedWaypointId;
          openSheet(selected ? "mark" : "waypoint");
        }}
        onReturn={() => openSheet("return")}
        onKill={() => openSheet("kill")}
      />
      <LayersPanel />
      <PropertySheet result={identify} coordinate={intelPoint} />
      <WaypointSheet onSave={(input) => void createWaypoint(input)} />
      <MarkSheet />
      <KillSheet
        onDrop={(species) =>
          void createWaypoint({
            type: "harvest",
            name: "Kill",
            notes: "",
            species,
          })
        }
      />
      <ScoutSheet onAnalyze={() => void analyzeScout()} />
      <TerrainSheet onAnalyze={() => void analyzeTerrain()} />
      <DownloadSheet onDownload={() => void downloadArea()} />
      <ReturnSheet truck={truck} />
      <AreasSheet onSaveArea={(name) => void saveArea(name)} />
      <AccountSheet
        error={accountError}
        onDownloadPack={() => void downloadStatePack()}
        onLogin={(email, password) => {
          setAccountError(undefined);
          void loginAccount(email, password)
            .then(async (user) => {
              const remote = await pullWaypoints();
              useHuntStore.setState({
                account: user,
                waypoints: mergeWaypoints(useHuntStore.getState().waypoints, remote),
              });
              closeSheet();
            })
            .catch((error: unknown) =>
              setAccountError(error instanceof Error ? error.message : "Login failed."),
            );
        }}
        onRegister={(email, password) => {
          setAccountError(undefined);
          void registerAccount(email, password)
            .then((user) => {
              useHuntStore.setState({ account: user });
              closeSheet();
            })
            .catch((error: unknown) =>
              setAccountError(error instanceof Error ? error.message : "Registration failed."),
            );
        }}
        onLogout={() => {
          void logoutAccount().then(() => {
            useHuntStore.setState({ account: null });
          });
        }}
      />
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
          const latitude = (mapBounds.south + mapBounds.north) / 2;
          const longitude = (mapBounds.west + mapBounds.east) / 2;
          useHuntStore.setState({
            gps: {
              latitude,
              longitude,
              source: "operator",
              error: "Operator-set map center. This is not a GPS fix.",
            },
            firstFixFlown: true,
          });
          flyToGpsFix(latitude, longitude);
        }}
      />
    </main>
  );
}

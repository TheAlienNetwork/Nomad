import {
  harvestHeatmap,
  harvestLocations,
  OVERLAY_CATALOG,
  radarTileTemplate,
  WAYPOINT_TYPE_LABELS,
} from '@huntos/core';
import * as Haptics from 'expo-haptics';
import { useMemo, useSyncExternalStore } from 'react';

import {
  useFieldStore,
  windWedgeRing,
  type BasemapId,
  type FieldState,
  type GpsRingIntel,
  type GpsRingKind,
  type RecoveryKind,
  type ScoutColor,
} from '@/src/store';
import { attachPickedWaypointPhoto } from '@/src/waypoint-photo';

const MAX_PIN_PHOTOS = 6;

export type MapBridgeState = {
  flyRequestId?: string;
  flyTo?: { latitude: number; longitude: number; zoom?: number };
  basemap: BasemapId;
  overlayFlags: Record<string, boolean>;
  overlayCatalog: Array<{
    id: string;
    group: string;
    tiles: Array<{
      id: string;
      protocol: string;
      mapServer: string;
      layerIdentifier: string;
      layerDefs?: Record<string, string>;
      dynamicLayers?: unknown;
      wmsLayer?: string;
      renderingRule?: string;
      opacity: number;
    }>;
  }>;
  publicLandOpacity: number;
  showWaypoints: boolean;
  showTracks: boolean;
  showKills: boolean;
  showKillHeat: boolean;
  waypoints: Array<{
    id: string;
    name: string;
    type: string;
    typeLabel: string;
    notes?: string;
    latitude: number;
    longitude: number;
    photo?: string;
    photos: string[];
  }>;
  selectedWaypointId?: string | null;
  plannedHunts: Array<{
    id: string;
    title: string;
    latitude: number;
    longitude: number;
  }>;
  track: Array<{ latitude: number; longitude: number }>;
  pastTracks: Array<Array<{ latitude: number; longitude: number }>>;
  killHeat: Array<{ latitude: number; longitude: number; count: number }>;
  gps?: {
    latitude: number;
    longitude: number;
    heading?: number | null;
    accuracy?: number | null;
    source?: string;
  };
  returnLine?: Array<{ latitude: number; longitude: number }>;
  showHuntScore?: boolean;
  showBedding?: boolean;
  showFeeding?: boolean;
  showHuntUnits?: boolean;
  showTerrainFeatures?: boolean;
  scoreOverlay?: Array<{
    latitude: number;
    longitude: number;
    overall: number | null;
    bedding: number | null;
    feeding: number | null;
    reasons: string[];
  }>;
  unitOverlay?: Array<{
    id: string;
    label: string;
    points: Array<{ latitude: number; longitude: number }>;
  }>;
  terrainOverlay?: Array<{
    latitude: number;
    longitude: number;
    kind: string;
    label: string;
  }>;
  showScoutAreas?: boolean;
  selectedScoutId?: string | null;
  scoutAreas?: Array<{
    id: string;
    name: string;
    color: ScoutColor;
    radiusMeters: number;
    points: Array<{ id: string; latitude: number; longitude: number }>;
  }>;
  hillshade?: boolean;
  wireframe?: boolean;
  radar?: {
    visible: boolean;
    url?: string;
  };
  windCone?: Array<{ latitude: number; longitude: number }>;
  windClass?: string;
  windTarget?: { latitude: number; longitude: number };
  measure?: Array<{ latitude: number; longitude: number }>;
  measureClosed?: boolean;
  recoveryMarks?: Array<{
    kind: RecoveryKind;
    latitude: number;
    longitude: number;
  }>;
  recoveryTrack?: Array<{ latitude: number; longitude: number }>;
  losOverlay?: Array<{
    latitude: number;
    longitude: number;
    visible: boolean;
  }>;
  showLos?: boolean;
  cachedTileSlugs: string[];
  rangeRings?: boolean;
  compassRay?: boolean;
  showGrid?: boolean;
  headingUp?: boolean;
  cameraMode?: 'flat' | 'orbit' | 'fpv';
  mapTheme?: 'dark' | 'light';
  neraMode?: boolean;
  neraStyle?: 'glass' | 'wire';
  slopeHeat?: Array<{ latitude: number; longitude: number; slopeDegrees: number }>;
  terrainExaggeration?: number;
  followGps?: boolean;
  fpvHeadingLock?: boolean;
  online?: boolean;
  peekBasemap?: BasemapId | null;
    radarOpacity?: number;
    hillshadeOpacity?: number;
    scoreOpacity?: number;
    drawRing?: Array<{ latitude: number; longitude: number }>;
    huntAreas?: Array<{
      id: string;
      name: string;
      west: number;
      south: number;
      east: number;
      north: number;
      ring?: Array<{ latitude: number; longitude: number }>;
    }>;
  showMemories?: boolean;
  selectedMemoryId?: string | null;
  memories?: Array<{
    id: string;
    uri: string;
    latitude: number;
    longitude: number;
    caption?: string;
    takenAt?: string;
    placeLabel?: string;
  }>;
};

export type MapBridgeEvent =
  | { type: 'ready' }
  | { type: 'tap'; longitude: number; latitude: number }
  | { type: 'longpress'; longitude: number; latitude: number }
  | { type: 'plan'; id: string }
  | { type: 'waypoint'; id: string }
  | { type: 'waypointphoto'; id: string; source?: 'camera' | 'library' }
  | { type: 'waypointedit'; id: string }
  | { type: 'waypointgo'; id: string }
  | { type: 'waypointclose'; id: string }
  | { type: 'memory'; id: string }
  | { type: 'memorygo'; id: string }
  | { type: 'memoryclose'; id: string }
  | { type: 'radius'; id: string }
  | { type: 'scoutmove'; id: string; dLat: number; dLng: number }
  | { type: 'waypointmove'; id: string; latitude: number; longitude: number }
  | { type: 'northup' }
  | { type: 'unfollow' }
  | { type: 'fpvunlock' }
  | { type: 'ringintel'; intel: GpsRingIntel | null }
  | { type: 'bounds'; west: number; south: number; east: number; north: number };

type BridgeSources = {
  mapTarget: FieldState['mapTarget'];
  basemap: FieldState['basemap'];
  layers: FieldState['layers'];
  publicLandOpacity: number;
  waypoints: FieldState['waypoints'];
  huntPlans: FieldState['huntPlans'];
  hunts: FieldState['hunts'];
  tracks: FieldState['tracks'];
  activeHuntId: FieldState['activeHuntId'];
  gps: FieldState['gps'];
  returnLine: FieldState['returnLine'];
  scoreOverlay: FieldState['scoreOverlay'];
  unitOverlay: FieldState['unitOverlay'];
  terrainOverlay: FieldState['terrainOverlay'];
  scoutAreas: FieldState['scoutAreas'];
  selectedScoutId: FieldState['selectedScoutId'];
  selectedWaypointId: FieldState['selectedWaypointId'];
  selectedMemoryId: FieldState['selectedMemoryId'];
  memories: FieldState['memories'];
  online: FieldState['online'];
  radar: FieldState['radar'];
  radarIndex: number;
  windEval: FieldState['windEval'];
  windTargetId: FieldState['windTargetId'];
  measurePoints: FieldState['measurePoints'];
  recovery: FieldState['recovery'];
  losOverlay: FieldState['losOverlay'];
  packCachedIds: FieldState['packCachedIds'];
  radarOpacity: FieldState['radarOpacity'];
  hillshadeOpacity: FieldState['hillshadeOpacity'];
  scoreOpacity: FieldState['scoreOpacity'];
  headingUp: FieldState['headingUp'];
  cameraMode: FieldState['cameraMode'];
  mapTheme: FieldState['mapTheme'];
  neraMode: FieldState['neraMode'];
  neraStyle: FieldState['neraStyle'];
  slopeHeat: FieldState['slopeHeat'];
  terrainExaggeration: number;
  followGps: FieldState['followGps'];
  fpvHeadingLock: FieldState['fpvHeadingLock'];
  peekBasemap: FieldState['peekBasemap'];
  drawRing: FieldState['drawRing'];
  huntAreas: FieldState['huntAreas'];
};

function selectBridgeSources(state: FieldState): BridgeSources {
  return {
    mapTarget: state.mapTarget,
    basemap: state.basemap,
    layers: state.layers,
    publicLandOpacity: state.publicLandOpacity,
    waypoints: state.waypoints,
    huntPlans: state.huntPlans,
    hunts: state.hunts,
    tracks: state.tracks,
    activeHuntId: state.activeHuntId,
    gps: state.gps,
    returnLine: state.returnLine,
    scoreOverlay: state.scoreOverlay,
    unitOverlay: state.unitOverlay,
    terrainOverlay: state.terrainOverlay,
    scoutAreas: state.scoutAreas,
    selectedScoutId: state.selectedScoutId,
    selectedWaypointId: state.selectedWaypointId,
    selectedMemoryId: state.selectedMemoryId,
    memories: state.memories,
    online: state.online,
    radar: state.radar,
    radarIndex: state.radarIndex,
    windEval: state.windEval,
    windTargetId: state.windTargetId,
    measurePoints: state.measurePoints,
    recovery: state.recovery,
    losOverlay: state.losOverlay,
    packCachedIds: state.packCachedIds,
    radarOpacity: state.radarOpacity,
    hillshadeOpacity: state.hillshadeOpacity,
    scoreOpacity: state.scoreOpacity,
    headingUp: state.headingUp,
    cameraMode: state.cameraMode,
    mapTheme: state.mapTheme,
    neraMode: state.neraMode,
    neraStyle: state.neraStyle,
    slopeHeat: state.slopeHeat,
    terrainExaggeration: state.terrainExaggeration,
    followGps: state.followGps,
    fpvHeadingLock: state.fpvHeadingLock,
    peekBasemap: state.peekBasemap,
    drawRing: state.drawRing,
    huntAreas: state.huntAreas,
  };
}

function sameSources(left: BridgeSources, right: BridgeSources): boolean {
  return (
    left.mapTarget === right.mapTarget &&
    left.basemap === right.basemap &&
    left.layers === right.layers &&
    left.publicLandOpacity === right.publicLandOpacity &&
    left.waypoints === right.waypoints &&
    left.huntPlans === right.huntPlans &&
    left.hunts === right.hunts &&
    left.tracks === right.tracks &&
    left.activeHuntId === right.activeHuntId &&
    left.gps === right.gps &&
    left.returnLine === right.returnLine &&
    left.scoreOverlay === right.scoreOverlay &&
    left.unitOverlay === right.unitOverlay &&
    left.terrainOverlay === right.terrainOverlay &&
    left.scoutAreas === right.scoutAreas &&
    left.selectedScoutId === right.selectedScoutId &&
    left.selectedWaypointId === right.selectedWaypointId &&
    left.selectedMemoryId === right.selectedMemoryId &&
    left.memories === right.memories &&
    left.online === right.online &&
    left.radar === right.radar &&
    left.radarIndex === right.radarIndex &&
    left.windEval === right.windEval &&
    left.windTargetId === right.windTargetId &&
    left.measurePoints === right.measurePoints &&
    left.recovery === right.recovery &&
    left.losOverlay === right.losOverlay &&
    left.packCachedIds === right.packCachedIds &&
    left.radarOpacity === right.radarOpacity &&
    left.hillshadeOpacity === right.hillshadeOpacity &&
    left.scoreOpacity === right.scoreOpacity &&
    left.headingUp === right.headingUp &&
    left.cameraMode === right.cameraMode &&
    left.mapTheme === right.mapTheme &&
    left.neraMode === right.neraMode &&
    left.neraStyle === right.neraStyle &&
    left.slopeHeat === right.slopeHeat &&
    left.terrainExaggeration === right.terrainExaggeration &&
    left.followGps === right.followGps &&
    left.fpvHeadingLock === right.fpvHeadingLock &&
    left.peekBasemap === right.peekBasemap &&
    left.drawRing === right.drawRing &&
    left.huntAreas === right.huntAreas
  );
}

function liveTrack(sources: BridgeSources) {
  const hunt = (sources.hunts ?? []).find((item) => item.id === sources.activeHuntId);
  return (sources.tracks ?? []).find((track) => track.id === hunt?.trackId);
}

export function buildBridgeState(state: BridgeSources): MapBridgeState {
  const current = liveTrack(state);
  const kills =
    typeof harvestLocations === 'function' ? harvestLocations(state.waypoints ?? []) : [];
  const cells = typeof harvestHeatmap === 'function' ? harvestHeatmap(kills) : [];
  return {
    flyRequestId: state.mapTarget?.requestId,
    flyTo: state.mapTarget,
    basemap: state.basemap,
    overlayFlags: Object.fromEntries(OVERLAY_CATALOG.map((item) => [item.id, Boolean(state.layers?.[item.id])])),
    overlayCatalog: OVERLAY_CATALOG.map((item) => ({
      id: item.id,
      group: item.group,
      tiles: item.tiles.map((tile) => ({
        id: tile.id,
        protocol: tile.protocol,
        mapServer: tile.mapServer,
        layerIdentifier: tile.layerIdentifier,
        layerDefs: tile.layerDefs,
        dynamicLayers: tile.dynamicLayers,
        wmsLayer: tile.wmsLayer,
        renderingRule: tile.renderingRule,
        opacity: tile.opacity,
      })),
    })),
    publicLandOpacity: state.publicLandOpacity,
    showWaypoints: state.layers.waypoints,
    showTracks: state.layers.tracks,
    showKills: state.layers.kills,
    showKillHeat: state.layers.killHeat,
    waypoints: (state.waypoints ?? []).map((point) => {
      const photos = (point.photos ?? []).slice(0, MAX_PIN_PHOTOS);
      return {
        id: point.id,
        name: point.name,
        type: point.type,
        typeLabel: WAYPOINT_TYPE_LABELS[point.type] ?? point.type,
        notes: point.notes,
        latitude: point.latitude,
        longitude: point.longitude,
        photo: photos[0],
        photos,
      };
    }),
    selectedWaypointId: state.selectedWaypointId,
    showMemories: Boolean(state.layers.memories),
    selectedMemoryId: state.selectedMemoryId,
    memories: (state.memories ?? []).flatMap((item) => {
      if (item.latitude == null || item.longitude == null || !item.uri) return [];
      return [
        {
          id: item.id,
          uri: item.uri,
          latitude: item.latitude,
          longitude: item.longitude,
          caption: item.caption,
          takenAt: item.takenAt,
          placeLabel: item.placeLabel,
        },
      ];
    }),
    plannedHunts: (state.huntPlans ?? []).map((plan) => ({
      id: plan.id,
      title: plan.title,
      latitude: plan.latitude,
      longitude: plan.longitude,
    })),
    track: (current?.points ?? []).map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    pastTracks: (state.tracks ?? [])
      .filter((track) => track.id !== current?.id && track.points.length > 1)
      .map((track) =>
        track.points.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        })),
      ),
    killHeat: cells.map((cell) => ({
      latitude: cell.center.latitude,
      longitude: cell.center.longitude,
      count: cell.count,
    })),
    gps:
      state.gps.latitude != null && state.gps.longitude != null
        ? {
            latitude: state.gps.latitude,
            longitude: state.gps.longitude,
            heading: state.gps.heading,
            accuracy: state.gps.accuracy,
            source: state.gps.source,
          }
        : undefined,
    returnLine: state.returnLine,
    showHuntScore: state.layers?.huntScore,
    showBedding: state.layers?.bedding,
    showFeeding: state.layers?.feeding,
    showHuntUnits: state.layers?.huntingUnits,
    showTerrainFeatures: state.layers?.terrainFeatures,
    scoreOverlay: state.scoreOverlay,
    unitOverlay: state.unitOverlay,
    terrainOverlay: state.terrainOverlay,
    showScoutAreas: state.layers?.scoutAreas !== false,
    selectedScoutId: state.selectedScoutId,
    scoutAreas: (state.scoutAreas ?? []).map((area) => ({
      id: area.id,
      name: area.name,
      color: area.color,
      radiusMeters: area.radiusMeters,
      points: area.points,
    })),
    hillshade: state.layers?.hillshade,
    wireframe: Boolean(state.layers?.wireframe),
    radar: radarBridge(state),
    ...windBridge(state),
    measure: state.measurePoints,
    measureClosed: (state.measurePoints?.length ?? 0) >= 3,
    recoveryMarks: state.recovery?.marks,
    recoveryTrack: (state.recovery?.track ?? []).map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    losOverlay: state.losOverlay,
    showLos: state.layers?.los,
    cachedTileSlugs: (state.packCachedIds ?? []).flatMap((id) => {
      const entry = OVERLAY_CATALOG.find((item) => item.id === id);
      return entry ? entry.tiles.map((tile) => tile.id) : [];
    }),
    rangeRings: state.layers?.rangeRings !== false,
    compassRay: Boolean(state.layers?.compassRay || state.headingUp),
    showGrid: Boolean(state.layers?.grid),
    headingUp: state.headingUp,
    cameraMode: state.cameraMode,
    mapTheme: state.mapTheme,
    neraMode: state.neraMode,
    neraStyle: state.neraStyle,
    slopeHeat: state.slopeHeat,
    terrainExaggeration: state.terrainExaggeration,
    followGps: state.followGps,
    fpvHeadingLock: state.fpvHeadingLock,
    peekBasemap: state.peekBasemap,
    hillshadeOpacity: state.hillshadeOpacity,
    scoreOpacity: state.scoreOpacity,
    online: state.online,
    drawRing: state.drawRing,
    huntAreas: (state.huntAreas ?? []).map((area) => ({
      id: area.id,
      name: area.name,
      west: area.west,
      south: area.south,
      east: area.east,
      north: area.north,
      ring: area.ring,
    })),
  };
}

function radarBridge(state: BridgeSources): MapBridgeState['radar'] {
  const frame = state.radar?.frames[state.radarIndex];
  const visible = Boolean(state.online && state.layers?.radar && frame && state.radar);
  return {
    visible,
    url:
      visible && state.radar && frame
        ? radarTileTemplate(state.radar.host, frame.path)
        : undefined,
  };
}

function windBridge(state: BridgeSources): Pick<MapBridgeState, 'windCone' | 'windClass' | 'windTarget'> {
  if (!state.layers?.windCone || !state.windEval || state.windEval.classification === 'unknown') {
    return {};
  }
  const latitude = state.gps.latitude;
  const longitude = state.gps.longitude;
  if (latitude == null || longitude == null) return {};
  const origin = { latitude, longitude };
  const mark = (state.waypoints ?? []).find((item) => item.id === state.windTargetId);
  return {
    windCone: windWedgeRing(origin, state.windEval.windFrom),
    windClass: state.windEval.classification,
    windTarget: mark
      ? { latitude: mark.latitude, longitude: mark.longitude }
      : undefined,
  };
}

let cachedSources: BridgeSources | undefined;

function getBridgeSources(): BridgeSources {
  const next = selectBridgeSources(useFieldStore.getState());
  if (cachedSources && sameSources(cachedSources, next)) return cachedSources;
  cachedSources = next;
  return next;
}

function heavyBridgeSignature(sources: BridgeSources): string {
  const waypointIds = (sources.waypoints ?? []).map((point) => point.id).join(',');
  const planIds = (sources.huntPlans ?? []).map((plan) => plan.id).join(',');
  const huntIds = (sources.hunts ?? []).map((hunt) => hunt.id).join(',');
  const trackLens = (sources.tracks ?? []).map((track) => `${track.id}:${track.points.length}`).join(',');
  return [
    sources.mapTarget?.requestId ?? '',
    waypointIds,
    planIds,
    huntIds,
    trackLens,
    sources.activeHuntId ?? '',
    sources.gps.latitude ?? '',
    sources.gps.longitude ?? '',
    sources.gps.heading ?? '',
    sources.gps.accuracy ?? '',
    sources.returnLine?.length ?? 0,
    sources.scoreOverlay ? 1 : 0,
    sources.unitOverlay ? 1 : 0,
    sources.terrainOverlay ? 1 : 0,
    (sources.scoutAreas ?? []).map((area) => area.id).join(','),
    sources.selectedScoutId ?? '',
    sources.selectedWaypointId ?? '',
    sources.selectedMemoryId ?? '',
    (sources.memories ?? []).map((item) => item.id).join(','),
    sources.online ? 1 : 0,
    sources.mapTheme,
    sources.neraMode ? 1 : 0,
    sources.neraStyle,
    sources.slopeHeat?.length ?? 0,
    sources.radar?.host ?? '',
    sources.radarIndex,
    sources.windEval?.classification ?? '',
    sources.windTargetId ?? '',
    sources.measurePoints?.length ?? 0,
    sources.recovery?.marks?.length ?? 0,
    sources.losOverlay ? 1 : 0,
    (sources.packCachedIds ?? []).join(','),
    sources.drawRing?.length ?? 0,
    (sources.huntAreas ?? []).map((area) => area.id).join(','),
  ].join('|');
}

export type LayersBridgePatch = {
  type: 'layers';
  basemap: BasemapId;
  peekBasemap: BasemapId | null;
  overlayFlags: Record<string, boolean>;
  publicLandOpacity: number;
  hillshade: boolean;
  hillshadeOpacity: number;
  wireframe: boolean;
  radarOpacity: number;
  scoreOpacity: number;
  rangeRings: boolean;
  compassRay: boolean;
  showGrid: boolean;
  headingUp: boolean;
  cameraMode: 'flat' | 'orbit' | 'fpv';
  mapTheme: 'dark' | 'light';
  neraMode: boolean;
  neraStyle: 'glass' | 'wire';
  terrainExaggeration: number;
  followGps: boolean;
  fpvHeadingLock: boolean;
  showWaypoints: boolean;
  showTracks: boolean;
  showKills: boolean;
  showKillHeat: boolean;
  showHuntScore: boolean;
  showBedding: boolean;
  showFeeding: boolean;
  showHuntUnits: boolean;
  showTerrainFeatures: boolean;
  showScoutAreas: boolean;
  showLos: boolean;
  showMemories: boolean;
};

export function buildLayersPatch(state: BridgeSources): LayersBridgePatch {
  return {
    type: 'layers',
    basemap: state.basemap,
    peekBasemap: state.peekBasemap,
    overlayFlags: Object.fromEntries(
      OVERLAY_CATALOG.map((item) => [item.id, Boolean(state.layers?.[item.id])]),
    ),
    publicLandOpacity: state.publicLandOpacity,
    hillshade: Boolean(state.layers?.hillshade),
    hillshadeOpacity: state.hillshadeOpacity,
    wireframe: Boolean(state.layers?.wireframe),
    radarOpacity: state.radarOpacity,
    scoreOpacity: state.scoreOpacity,
    rangeRings: state.layers?.rangeRings !== false,
    compassRay: Boolean(state.layers?.compassRay || state.headingUp),
    showGrid: Boolean(state.layers?.grid),
    headingUp: state.headingUp,
    cameraMode: state.cameraMode,
    mapTheme: state.mapTheme,
    neraMode: state.neraMode,
    neraStyle: state.neraStyle ?? 'wire',
    terrainExaggeration: state.terrainExaggeration,
    followGps: state.followGps,
    fpvHeadingLock: state.fpvHeadingLock,
    showWaypoints: Boolean(state.layers.waypoints),
    showTracks: Boolean(state.layers.tracks),
    showKills: Boolean(state.layers.kills),
    showKillHeat: Boolean(state.layers.killHeat),
    showHuntScore: Boolean(state.layers?.huntScore),
    showBedding: Boolean(state.layers?.bedding),
    showFeeding: Boolean(state.layers?.feeding),
    showHuntUnits: Boolean(state.layers?.huntingUnits),
    showTerrainFeatures: Boolean(state.layers?.terrainFeatures),
    showScoutAreas: state.layers?.scoutAreas !== false,
    showLos: Boolean(state.layers?.los),
    showMemories: Boolean(state.layers?.memories),
  };
}

export function useMapBridgeInjection(): {
  body: string;
  layersBody: string;
  heavyKey: string;
} {
  const sources = useSyncExternalStore(useFieldStore.subscribe, getBridgeSources, getBridgeSources);
  return useMemo(
    () => ({
      body: JSON.stringify(buildBridgeState(sources)),
      layersBody: JSON.stringify(buildLayersPatch(sources)),
      heavyKey: heavyBridgeSignature(sources),
    }),
    [sources],
  );
}

export function useMapBridgePayload(): string {
  const sources = useSyncExternalStore(useFieldStore.subscribe, getBridgeSources, getBridgeSources);
  return useMemo(() => JSON.stringify(buildBridgeState(sources)), [sources]);
}

export function useMapBridgeLayersPayload(): string {
  const sources = useSyncExternalStore(useFieldStore.subscribe, getBridgeSources, getBridgeSources);
  return useMemo(() => JSON.stringify(buildLayersPatch(sources)), [sources]);
}

export function dispatchMapEvent(raw: string): void {
  const message = parseMapEvent(raw);
  if (!message) return;
  const store = useFieldStore.getState();
  switch (message.type) {
    case 'ready':
      return;
    case 'tap':
      if (store.measureMode || store.drawMode) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      void store.handleMapTap(message.longitude, message.latitude);
      return;
    case 'longpress':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      store.handleMapLongPress(message.longitude, message.latitude);
      return;
    case 'northup':
      store.setHeadingUp(false);
      return;
    case 'unfollow':
      store.setFollowGps(false);
      return;
    case 'fpvunlock':
      store.setFpvHeadingLock(false);
      return;
    case 'ringintel':
      useFieldStore.setState({ gpsRingIntel: message.intel });
      return;
    case 'plan':
      store.openPlannedHunt(message.id);
      return;
    case 'waypoint': {
      if (store.measureMode) {
        const mark = store.waypoints.find((item) => item.id === message.id);
        if (mark) store.addMeasurePoint(mark.latitude, mark.longitude);
        return;
      }
      useFieldStore.setState({ selectedWaypointId: message.id, selectedMemoryId: null, sheet: 'none' });
      return;
    }
    case 'waypointphoto':
      void attachPickedWaypointPhoto(message.id, message.source === 'camera');
      return;
    case 'waypointedit':
      store.openWaypoint(message.id);
      return;
    case 'waypointgo': {
      const mark = store.waypoints.find((item) => item.id === message.id);
      if (mark) store.requestFlyTo(mark.latitude, mark.longitude, store.neraMode ? 16.5 : 14.2);
      return;
    }
    case 'waypointclose':
      useFieldStore.setState({ selectedWaypointId: null });
      return;
    case 'memory':
      store.selectMemory(message.id);
      return;
    case 'memorygo': {
      const memory = store.memories.find((item) => item.id === message.id);
      if (memory?.latitude != null && memory.longitude != null) {
        store.requestFlyTo(memory.latitude, memory.longitude, 15);
      }
      return;
    }
    case 'memoryclose':
      store.selectMemory(null);
      return;
    case 'radius':
      store.openScoutArea(message.id);
      return;
    case 'scoutmove':
      store.moveScoutArea(message.id, message.dLat, message.dLng);
      return;
    case 'waypointmove':
      store.updateWaypoint(message.id, { latitude: message.latitude, longitude: message.longitude });
      return;
    case 'bounds':
      store.setMapBounds({
        west: message.west,
        south: message.south,
        east: message.east,
        north: message.north,
      });
      return;
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

export function parseMapEvent(raw: string): MapBridgeEvent | null {
  try {
    const data = JSON.parse(raw) as MapBridgeEvent;
    if (data.type === 'ready' || data.type === 'northup' || data.type === 'unfollow' || data.type === 'fpvunlock') {
      return data;
    }
    if (
      (data.type === 'plan' ||
        data.type === 'radius' ||
        data.type === 'waypoint' ||
        data.type === 'waypointedit' ||
        data.type === 'waypointgo' ||
        data.type === 'waypointclose' ||
        data.type === 'memory' ||
        data.type === 'memorygo' ||
        data.type === 'memoryclose') &&
      typeof data.id === 'string' &&
      data.id.length > 0
    ) {
      return data;
    }
    if (data.type === 'waypointphoto' && typeof data.id === 'string' && data.id.length > 0) {
      return {
        type: 'waypointphoto',
        id: data.id,
        source: data.source === 'camera' ? 'camera' : 'library',
      };
    }
    if (
      data.type === 'waypointmove' &&
      typeof data.id === 'string' &&
      data.id.length > 0 &&
      Number.isFinite(data.latitude) &&
      Number.isFinite(data.longitude)
    ) {
      return data;
    }
    if (
      data.type === 'scoutmove' &&
      typeof data.id === 'string' &&
      data.id.length > 0 &&
      Number.isFinite(data.dLat) &&
      Number.isFinite(data.dLng)
    ) {
      return data;
    }
    if (
      (data.type === 'tap' || data.type === 'longpress') &&
      Number.isFinite(data.longitude) &&
      Number.isFinite(data.latitude)
    ) {
      return data;
    }
    if (
      data.type === 'bounds' &&
      Number.isFinite(data.west) &&
      Number.isFinite(data.south) &&
      Number.isFinite(data.east) &&
      Number.isFinite(data.north)
    ) {
      return data;
    }
    if (data.type === 'ringintel') {
      const kind = (data as { kind?: unknown }).kind;
      if (kind === 'none') return { type: 'ringintel', intel: null };
      if (kind === 'high' || kind === 'low' || kind === 'level') {
        const parsedKind: GpsRingKind = kind;
        const deltaFt = (data as { deltaFt?: unknown }).deltaFt;
        const bearing = (data as { bearing?: unknown }).bearing;
        const label = (data as { label?: unknown }).label;
        if (typeof deltaFt === 'number' && Number.isFinite(deltaFt) && typeof bearing === 'number' && Number.isFinite(bearing) && typeof label === 'string') {
          return {
            type: 'ringintel',
            intel: { kind: parsedKind, deltaFt, bearing, label },
          };
        }
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

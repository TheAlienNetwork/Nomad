import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultOverlayLayerFlags,
  defaultPackSelection,
  destinationPoint,
  evaluateLineOfSight,
  evaluateWind,
  glassingRayPoints,
  GLASSING_LOS_DISCLAIMER,
  haversineMeters,
  initialBearingDegrees,
  pathLengthMeters,
  polygonAreaAcres,
  returnToTruck,
  stopRecordingTrack,
  summarizeHourlyActivity,
  summarizeWindSightings,
  whatIfWind,
  WAYPOINT_TYPE_LABELS,
  type BoundingBox,
  type HuntArea,
  type HuntSession,
  type IdentifyResult,
  type LonLat,
  type OverlayId,
  type OverlayLayerFlags,
  type GeoJsonFeatureCollection,
  type RadarCatalog,
  type RouteOption,
  type SpeciesId,
  type Track,
  type TrackPoint,
  type TrailCamera,
  type Waypoint,
  type WaypointType,
  type WeatherSnapshot,
  type WindEvaluation,
} from '@huntos/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { huntArea, packList } from '@/constants/sample-data';

import { fetchElevationSamples, fetchIdentify, fetchRadarCatalog, fetchScout, fetchTerrainAnalyze, fetchWeather } from './api';
import { asGearGroup, groupForGearName, isEssentialGearName, type GearGroup } from './gear-suggestions';
import { newId } from './ids';

export type BasemapId = 'satellite' | 'topo' | 'hybrid' | 'streets' | 'naip' | 'relief';
export type CameraMode = 'flat' | 'orbit' | 'fpv';
export type MapTheme = 'dark' | 'light';
export type NeraStyle = 'glass' | 'wire';
export type GpsRingKind = 'high' | 'low' | 'level';
export type GpsRingIntel = {
  kind: GpsRingKind;
  deltaFt: number;
  bearing: number;
  label: string;
};
export const DEFAULT_TERRAIN_EXAGGERATION = 3.2;
export type SheetId =
  | 'none'
  | 'layers'
  | 'waypoint'
  | 'property'
  | 'return'
  | 'scout'
  | 'terrain'
  | 'plan'
  | 'planned'
  | 'place'
  | 'radius'
  | 'mark'
  | 'weather'
  | 'wind'
  | 'areas'
  | 'recovery';

export type LayerState = OverlayLayerFlags & {
  waypoints: boolean;
  tracks: boolean;
  kills: boolean;
  killHeat: boolean;
  huntScore: boolean;
  terrainFeatures: boolean;
  bedding: boolean;
  feeding: boolean;
  scoutAreas: boolean;
  hillshade: boolean;
  wireframe: boolean;
  radar: boolean;
  windCone: boolean;
  los: boolean;
  rangeRings: boolean;
  compassRay: boolean;
  grid: boolean;
  memories: boolean;
};

export type ScoutColor = 'rust' | 'gold' | 'teal' | 'violet';

export type ScoutPoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type ScoutArea = {
  id: string;
  name: string;
  color: ScoutColor;
  radiusMeters: number;
  points: ScoutPoint[];
  updatedAt: string;
};

export type FieldCamera = TrailCamera & {
  waypointId?: string;
  updatedAt: string;
};

export type RecoveryKind = 'shot' | 'blood' | 'hair' | 'last_seen' | 'find';

export type RecoveryMark = {
  id: string;
  kind: RecoveryKind;
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export type RecoverySession = {
  id: string;
  harvestWaypointId?: string;
  startedAt: string;
  endedAt?: string;
  dropKind: RecoveryKind;
  marks: RecoveryMark[];
  track: TrackPoint[];
};

export type LosOverlayPoint = {
  latitude: number;
  longitude: number;
  visible: boolean;
  elevationMeters: number;
};

export type MeasureResult = {
  yards: number;
  bearing?: string;
  acres?: number;
};

export type JournalStyle = 'field' | 'memoir';
export type InkColor = 'walnut' | 'black' | 'rust' | 'blue' | 'green' | 'sepia' | 'pencil';
export type PageFont = 'serif' | 'serifAlt' | 'sans' | 'mono' | 'script' | 'slab';
export type NoteScale = 'small' | 'body' | 'large';

export type GearItem = {
  id: string;
  name: string;
  packed: boolean;
  sort: number;
  group?: GearGroup;
  essential?: boolean;
  updatedAt: string;
};

export type MemoirReadTheme = 'paper' | 'night';

export type MemoryPhoto = {
  id: string;
  uri: string;
  storagePath?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  takenAt: string;
  placeLabel?: string;
  width?: number;
  height?: number;
  updatedAt: string;
};

export type PageSketch = {
  id: string;
  pageId: string;
  uri: string;
  sourceUri?: string;
  sketched?: boolean;
  storagePath?: string;
  caption?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  rotate?: number;
  updatedAt: string;
};

export type MemoirPage = {
  areaName: string;
  notes: string;
  inkColor?: InkColor;
  fontFamily?: PageFont;
  typeScale?: NoteScale;
  updatedAt?: string;
};

export type HuntPlan = {
  id: string;
  title: string;
  plannedAt: string;
  species?: SpeciesId;
  latitude: number;
  longitude: number;
  notes: string;
  inkColor?: InkColor;
  fontFamily?: PageFont;
  typeScale?: NoteScale;
  updatedAt?: string;
};

export type JournalNoteKind = 'note' | 'title';

export type JournalNote = {
  id: string;
  title: string;
  notes: string;
  kind?: JournalNoteKind;
  author?: string;
  coverUri?: string;
  coverPhotoUri?: string;
  coverSketch?: boolean;
  coverStoragePath?: string;
  coverX?: number;
  coverY?: number;
  coverWidth?: number;
  coverHeight?: number;
  createdAt: string;
  updatedAt?: string;
  inkColor?: InkColor;
  fontFamily?: PageFont;
  typeScale?: NoteScale;
};

export type GpsState = {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  heading?: number | null;
  altitude?: number | null;
  source: 'gps' | 'operator' | 'none';
  error?: string;
};

export type MapTarget = {
  requestId: string;
  latitude: number;
  longitude: number;
  zoom?: number;
};

const LOCAL_USER = 'local-hunter';

export type ScoreOverlayPoint = {
  latitude: number;
  longitude: number;
  overall: number | null;
  bedding: number | null;
  feeding: number | null;
  reasons: string[];
  unavailable: string[];
  disclaimer: string;
};

export type UnitOverlayRing = {
  id: string;
  label: string;
  points: Array<{ latitude: number; longitude: number }>;
};

export type TerrainOverlayPoint = {
  latitude: number;
  longitude: number;
  kind: string;
  label: string;
  reasons: string[];
  confidence: number;
};

export type SlopeHeatPoint = {
  latitude: number;
  longitude: number;
  slopeDegrees: number;
};

function viewportBounds(state: {
  mapBounds?: BoundingBox;
  gps: GpsState;
  tapPoint?: { latitude: number; longitude: number };
}): BoundingBox {
  if (state.mapBounds) return state.mapBounds;
  const latitude = state.gps.latitude ?? state.tapPoint?.latitude ?? huntArea.latitude;
  const longitude = state.gps.longitude ?? state.tapPoint?.longitude ?? huntArea.longitude;
  return {
    west: longitude - 0.05,
    south: latitude - 0.04,
    east: longitude + 0.05,
    north: latitude + 0.04,
  };
}

const defaultLayers = (): LayerState => ({
  ...defaultOverlayLayerFlags(),
  waypoints: true,
  tracks: true,
  kills: true,
  killHeat: false,
  huntScore: false,
  terrainFeatures: false,
  bedding: false,
  feeding: false,
  scoutAreas: true,
  hillshade: false,
  wireframe: false,
  radar: false,
  windCone: false,
  los: false,
  rangeRings: true,
  compassRay: false,
  grid: false,
  memories: false,
});

export function seedGear(): GearItem[] {
  return [];
}

export function isSeedGear(gear: unknown): boolean {
  if (!Array.isArray(gear) || gear.length !== packList.length) return false;
  const expected = new Map(packList.map((item) => [item.id, item.name]));
  return gear.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const id = String((item as { id?: unknown }).id ?? '');
    const name = String((item as { name?: unknown }).name ?? '');
    return expected.get(id) === name;
  });
}

export function stripSeedGear<T extends { id: string; name: string }>(gear: T[]): T[] {
  const expected = new Map(packList.map((item) => [item.id, item.name]));
  return gear.filter((item) => expected.get(item.id) !== item.name);
}

function nowIso(): string {
  return new Date().toISOString();
}

function newestTitleNote(notes: JournalNote[]): JournalNote | undefined {
  return notes
    .filter((note) => note.kind === 'title')
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))[0];
}

function newestTitleAuthor(notes: JournalNote[]): string | undefined {
  const named = notes.find((note) => note.kind === 'title' && Boolean(note.author?.trim()));
  const trimmed = named?.author?.trim();
  return trimmed ? trimmed : undefined;
}

function currentWindEval(state: {
  gps: GpsState;
  tapPoint?: { latitude: number; longitude: number };
  waypoints: Waypoint[];
  windTargetId: string | null;
  windWhatIfDegrees: number | null;
  weather?: WeatherSnapshot;
}): WindEvaluation | undefined {
  const latitude = state.gps.latitude ?? state.tapPoint?.latitude;
  const longitude = state.gps.longitude ?? state.tapPoint?.longitude;
  if (latitude == null || longitude == null) return undefined;
  const origin = { latitude, longitude };
  const mark = state.waypoints.find((item) => item.id === state.windTargetId);
  const target = mark
    ? { latitude: mark.latitude, longitude: mark.longitude }
    : destinationPoint(origin, 0, 250);
  if (state.windWhatIfDegrees != null) {
    return whatIfWind(origin, target, state.windWhatIfDegrees, state.weather?.windSpeedMps ?? 3);
  }
  if (
    state.weather?.windDirectionFromDegrees == null ||
    state.weather.windSpeedMps == null
  ) {
    return evaluateWind(origin, target, null);
  }
  return evaluateWind(origin, target, {
    directionFromDegrees: state.weather.windDirectionFromDegrees,
    speedMps: state.weather.windSpeedMps,
    source: state.weather.source,
    retrievedAt: state.weather.retrievedAt,
  });
}

function windWedge(
  origin: LonLat,
  fromDegrees: number,
  meters = 480,
): LonLat[] {
  const toward = fromDegrees + 180;
  const points: LonLat[] = [origin];
  for (let angle = toward - 28; angle <= toward + 28; angle += 7) {
    points.push(destinationPoint(origin, angle, meters));
  }
  points.push(origin);
  return points;
}

function measureSummary(points: LonLat[]): MeasureResult | undefined {
  if (points.length < 2) return undefined;
  if (points.length === 2) {
    const from = points[0];
    const to = points[1];
    if (!from || !to) return undefined;
    return {
      yards: haversineMeters(from, to) / 0.9144,
      bearing: `${Math.round(initialBearingDegrees(from, to))}°`,
    };
  }
  const ring: Array<readonly [number, number]> = [
    ...points.map((point) => [point.longitude, point.latitude] as const),
    [points[0]!.longitude, points[0]!.latitude] as const,
  ];
  const length = pathLengthMeters([...points, points[0]!]);
  return {
    yards: length / 0.9144,
    acres: polygonAreaAcres(ring),
  };
}

const SEED_TRUCK_ID = 'seed-truck';

function isDataUri(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

function withoutDataUriSketches(value: unknown): Record<string, PageSketch[]> {
  if (!value || typeof value !== 'object') return {};
  const next: Record<string, PageSketch[]> = {};
  for (const [pageId, sketches] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(sketches)) continue;
    const kept: PageSketch[] = [];
    for (const item of sketches) {
      if (!item || typeof item !== 'object' || !('uri' in item)) continue;
      const sketch = item as PageSketch;
      if (!sketch.uri || isDataUri(sketch.uri)) continue;
      kept.push({
        ...sketch,
        sourceUri: isDataUri(sketch.sourceUri) ? undefined : sketch.sourceUri,
      });
    }
    if (kept.length > 0) next[pageId] = kept;
  }
  return next;
}

function withoutDataUriMemories(value: unknown): MemoryPhoto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('uri' in item) || !('id' in item)) return [];
    const memory = item as MemoryPhoto;
    if (!memory.uri || isDataUri(memory.uri)) return [];
    return [memory];
  });
}

function withGearMeta(gear: unknown): GearItem[] {
  if (!Array.isArray(gear)) return [];
  return gear.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('id' in item) || !('name' in item)) return [];
    const row = item as GearItem;
    return [
      {
        ...row,
        packed: row.packed === true,
        group: asGearGroup(row.group) === 'Custom' ? groupForGearName(row.name) : asGearGroup(row.group),
        essential: row.essential ?? isEssentialGearName(row.name),
      },
    ];
  });
}

function withoutDataUriNotes(value: unknown): JournalNote[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return item as JournalNote;
    const note = item as JournalNote;
    return {
      ...note,
      coverUri: isDataUri(note.coverUri) ? undefined : note.coverUri,
      coverPhotoUri: isDataUri(note.coverPhotoUri) ? undefined : note.coverPhotoUri,
    };
  });
}

function withoutSeedTruck(waypoints: unknown): Waypoint[] {
  if (!Array.isArray(waypoints)) return [];
  return waypoints.filter((item): item is Waypoint => {
    if (!item || typeof item !== 'object' || !('id' in item)) return false;
    return String((item as { id: unknown }).id) !== SEED_TRUCK_ID;
  });
}

export type FieldState = {
  hydrated: boolean;
  userId: string;
  cloudUserId: string | null;
  online: boolean;
  hunts: HuntSession[];
  tracks: Track[];
  waypoints: Waypoint[];
  memoirPages: Record<string, MemoirPage>;
  journalNotes: JournalNote[];
  huntPlans: HuntPlan[];
  gear: GearItem[];
  memories: MemoryPhoto[];
  pageSketches: Record<string, PageSketch[]>;
  journalStyle: JournalStyle;
  memoirReadTheme: MemoirReadTheme;
  fieldRuled: boolean;
  bookmarkedPageIds: string[];
  hiddenMemoirIds: string[];
  hunterState: string | null;
  packSelection: OverlayId[];
  packCachedIds: OverlayId[];
  packStatus?: { overlayId: OverlayId; done: number; total: number; label: string };
  packLastDownloaded?: string;
  basemapCachedSlug?: string;
  basemapCachedAt?: string;
  cachedOverlayGeoJson: Record<string, GeoJsonFeatureCollection>;
  profilePhotoUri?: string;
  profileStoragePath?: string;
  selectedPlanId: string | null;
  selectedWaypointId: string | null;
  selectedMemoryId: string | null;
  followGps: boolean;
  firstFixFlown: boolean;
  cameraMode: CameraMode;
  mapTheme: MapTheme;
  neraMode: boolean;
  neraStyle: NeraStyle;
  terrainExaggeration: number;
  fpvHeadingLock: boolean;
  gpsRingIntel: GpsRingIntel | null;
  publicLandOpacity: number;
  radarOpacity: number;
  hillshadeOpacity: number;
  scoreOpacity: number;
  headingUp: boolean;
  peekBasemap: BasemapId | null;
  drawMode: boolean;
  drawRing: Array<{ latitude: number; longitude: number }>;
  activeHuntId: string | null;
  truckWaypointId: string | null;
  basemap: BasemapId;
  layers: LayerState;
  sheet: SheetId;
  gps: GpsState;
  weather?: WeatherSnapshot;
  identify?: IdentifyResult;
  tapPoint?: { latitude: number; longitude: number };
  draftWaypointType: WaypointType;
  mapTarget?: MapTarget;
  mapBounds?: BoundingBox;
  returnRoutes: RouteOption[];
  returnLine?: { latitude: number; longitude: number }[];
  scoutMessage?: string;
  scoreOverlay: ScoreOverlayPoint[];
  unitOverlay: UnitOverlayRing[];
  terrainOverlay: TerrainOverlayPoint[];
  slopeHeat: SlopeHeatPoint[];
  scoutAreas: ScoutArea[];
  selectedScoutId: string | null;
  radiusMode: boolean;
  huntAreas: HuntArea[];
  selectedHuntAreaId: string | null;
  trailCameras: FieldCamera[];
  radar?: RadarCatalog;
  radarIndex: number;
  radarPlaying: boolean;
  windWhatIfDegrees: number | null;
  windTargetId: string | null;
  windEval?: WindEvaluation;
  measureMode: boolean;
  measurePoints: LonLat[];
  recovery?: RecoverySession;
  losOverlay: LosOverlayPoint[];
  losDisclaimer?: string;
  glassingBearing: number;
  startHunt: (input?: { species?: SpeciesId }) => void;
  openPlannedHunt: (planId: string) => void;
  endHunt: () => void;
  appendGps: (point: TrackPoint & { source: 'gps' | 'operator' }) => void;
  setGpsError: (error: string) => void;
  setOnline: (online: boolean) => void;
  openSheet: (sheet: SheetId) => void;
  closeSheet: () => void;
  setBasemap: (basemap: BasemapId) => void;
  toggleLayer: (key: keyof LayerState) => void;
  setHunterState: (code: string | null) => void;
  setPackSelection: (ids: OverlayId[]) => void;
  setProfilePhoto: (input: { uri?: string; storagePath?: string }) => void;
  setDraftWaypointType: (type: WaypointType) => void;
  addWaypoint: (input: {
    type: WaypointType;
    name: string;
    notes?: string;
    species?: SpeciesId;
    photos?: string[];
  }) => void;
  updateWaypoint: (
    id: string,
    patch: Partial<Pick<Waypoint, 'name' | 'notes' | 'type' | 'species' | 'photos' | 'latitude' | 'longitude'>>,
  ) => void;
  deleteWaypoint: (id: string) => void;
  openWaypoint: (id: string) => void;
  parkHere: () => void;
  setMemoirNotes: (huntId: string, notes: string) => void;
  setMemoirStyle: (
    huntId: string,
    patch: Partial<Pick<MemoirPage, 'inkColor' | 'fontFamily' | 'typeScale' | 'areaName'>>,
  ) => void;
  addJournalNote: () => string;
  addTitlePage: () => string;
  ensureTitlePage: () => string;
  removeJournalNote: (id: string) => void;
  toggleBookmark: (pageId: string) => void;
  hideMemoirPage: (pageId: string) => void;
  setJournalNote: (
    id: string,
    patch: Partial<
      Pick<
        JournalNote,
        | 'title'
        | 'notes'
        | 'author'
        | 'inkColor'
        | 'fontFamily'
        | 'typeScale'
        | 'coverUri'
        | 'coverPhotoUri'
        | 'coverSketch'
        | 'coverStoragePath'
        | 'coverX'
        | 'coverY'
        | 'coverWidth'
        | 'coverHeight'
      >
    >,
  ) => void;
  setHuntPlanNotes: (planId: string, notes: string) => void;
  setHuntPlanStyle: (
    planId: string,
    patch: Partial<Pick<HuntPlan, 'title' | 'inkColor' | 'fontFamily' | 'typeScale'>>,
  ) => void;
  setJournalStyle: (style: JournalStyle) => void;
  setMemoirReadTheme: (theme: MemoirReadTheme) => void;
  setFieldRuled: (ruled: boolean) => void;
  toggleGear: (id: string) => void;
  addGear: (name: string, opts?: { group?: GearGroup; essential?: boolean }) => void;
  addGearItems: (items: Array<{ name: string; group?: GearGroup; essential?: boolean }>) => void;
  removeGear: (id: string) => void;
  clearGear: () => void;
  applyGearTemplate: () => void;
  unpackAllGear: () => void;
  addMemory: (memory: MemoryPhoto) => void;
  updateMemory: (id: string, patch: Partial<Omit<MemoryPhoto, 'id'>>) => void;
  removeMemory: (id: string) => void;
  selectMemory: (id: string | null) => void;
  showMemoryOnMap: (id: string) => void;
  addPageSketch: (sketch: PageSketch) => void;
  updatePageSketch: (
    pageId: string,
    id: string,
    patch: Partial<
      Pick<PageSketch, 'uri' | 'sourceUri' | 'sketched' | 'caption' | 'x' | 'y' | 'width' | 'height' | 'z' | 'rotate'>
    >,
  ) => void;
  removePageSketch: (pageId: string, id: string) => void;
  markFirstFixFlown: () => void;
  addHuntPlan: (input: { title: string; plannedAt: string; species?: SpeciesId; notes?: string }) => void;
  startHuntFromPlan: (planId: string) => void;
  deleteHuntPlan: (planId: string) => void;
  setFollowGps: (follow: boolean) => void;
  setCameraMode: (mode: CameraMode) => void;
  setMapTheme: (theme: MapTheme) => void;
  setNeraMode: (on: boolean) => void;
  setNeraStyle: (style: NeraStyle) => void;
  setTerrainExaggeration: (value: number) => void;
  setFpvHeadingLock: (on: boolean) => void;
  setPublicLandOpacity: (opacity: number) => void;
  setRadarOpacity: (opacity: number) => void;
  setHillshadeOpacity: (opacity: number) => void;
  setScoreOpacity: (opacity: number) => void;
  setHeadingUp: (on: boolean) => void;
  setPeekBasemap: (id: BasemapId | null) => void;
  setDrawMode: (on: boolean) => void;
  addDrawVertex: (latitude: number, longitude: number) => void;
  undoDrawVertex: () => void;
  saveDrawnArea: (name: string) => void;
  locate: (coords: { latitude: number; longitude: number; accuracy?: number | null; heading?: number | null }) => void;
  requestFlyTo: (latitude: number, longitude: number, zoom?: number) => void;
  handleMapTap: (longitude: number, latitude: number) => Promise<void>;
  handleMapLongPress: (longitude: number, latitude: number) => void;
  beginWaypointAtTap: () => void;
  beginIdentifyAtTap: () => Promise<void>;
  beginScoutRadiusAtTap: () => void;
  setRadiusMode: (on: boolean) => void;
  addScoutPoint: (latitude: number, longitude: number) => void;
  removeScoutPoint: (areaId: string, pointId: string) => void;
  setScoutName: (id: string, name: string) => void;
  setScoutColor: (id: string, color: ScoutColor) => void;
  setScoutRadius: (id: string, radiusMeters: number) => void;
  openScoutArea: (id: string) => void;
  deleteScoutArea: (id: string) => void;
  dismissScoutEdit: () => void;
  moveScoutArea: (id: string, dLat: number, dLng: number) => void;
  refreshWeather: (latitude: number, longitude: number) => Promise<void>;
  computeReturn: () => void;
  setMapBounds: (bounds: BoundingBox) => void;
  runScout: () => Promise<void>;
  runTerrainAnalyze: (opts?: { silent?: boolean }) => Promise<void>;
  openWeather: () => Promise<void>;
  loadRadar: () => Promise<void>;
  setRadarIndex: (index: number) => void;
  setRadarPlaying: (playing: boolean) => void;
  setWindWhatIf: (degrees: number | null) => void;
  setWindTarget: (waypointId: string | null) => void;
  setMeasureMode: (on: boolean) => void;
  addMeasurePoint: (latitude: number, longitude: number) => void;
  clearMeasure: () => void;
  saveHuntArea: (name: string) => void;
  jumpHuntArea: (id: string) => void;
  deleteHuntArea: (id: string) => void;
  checkInCamera: (waypointId: string, photo?: string) => void;
  attachWaypointPhoto: (id: string, uri: string) => void;
  removeWaypointPhoto: (id: string, index: number) => void;
  startRecovery: (harvestWaypointId?: string) => void;
  setRecoveryKind: (kind: RecoveryKind) => void;
  addRecoveryMark: (latitude: number, longitude: number) => void;
  endRecovery: () => void;
  runGlassingLos: (waypointId: string, bearingDegrees: number) => Promise<void>;
  setGlassingBearing: (degrees: number) => void;
};

export const useFieldStore = create<FieldState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      userId: LOCAL_USER,
      cloudUserId: null,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      hunts: [],
      tracks: [],
      waypoints: [],
      memoirPages: {},
      journalNotes: [],
      huntPlans: [],
      gear: [],
      memories: [],
      pageSketches: {},
      journalStyle: 'memoir',
      memoirReadTheme: 'paper',
      fieldRuled: true,
      bookmarkedPageIds: [],
      hiddenMemoirIds: [],
      hunterState: null,
      packSelection: [],
      packCachedIds: [],
      basemapCachedSlug: undefined,
      basemapCachedAt: undefined,
      cachedOverlayGeoJson: {},
      profilePhotoUri: undefined,
      profileStoragePath: undefined,
      selectedPlanId: null,
      selectedWaypointId: null,
      selectedMemoryId: null,
      followGps: false,
      firstFixFlown: false,
      cameraMode: 'orbit',
      mapTheme: 'dark',
      neraMode: true,
      neraStyle: 'wire',
      terrainExaggeration: DEFAULT_TERRAIN_EXAGGERATION,
      fpvHeadingLock: true,
      gpsRingIntel: null,
      publicLandOpacity: 0.58,
      radarOpacity: 0.58,
      hillshadeOpacity: 0.42,
      scoreOpacity: 0.72,
      headingUp: false,
      peekBasemap: null,
      drawMode: false,
      drawRing: [],
      activeHuntId: null,
      truckWaypointId: null,
      basemap: 'hybrid',
      layers: defaultLayers(),
      sheet: 'none',
      gps: { source: 'none' },
      draftWaypointType: 'stand',
      returnRoutes: [],
      scoreOverlay: [],
      unitOverlay: [],
      terrainOverlay: [],
      slopeHeat: [],
      scoutAreas: [],
      selectedScoutId: null,
      radiusMode: false,
      huntAreas: [],
      selectedHuntAreaId: null,
      trailCameras: [],
      radarIndex: 0,
      radarPlaying: false,
      windWhatIfDegrees: null,
      windTargetId: null,
      measureMode: false,
      measurePoints: [],
      losOverlay: [],
      glassingBearing: 0,
      startHunt: (input) => {
        const state = get();
        if (state.activeHuntId) return;
        const startedAt = nowIso();
        const huntId = newId();
        const trackId = newId();
        const hunt: HuntSession = {
          id: huntId,
          userId: state.userId,
          species: input?.species,
          startedAt,
          trackId,
          visibility: 'private',
          syncStatus: 'pending',
          version: 1,
        };
        const track: Track = {
          id: trackId,
          userId: state.userId,
          huntId,
          name: 'Live track',
          startedAt,
          status: 'recording',
          points: [],
          distanceMeters: 0,
          visibility: 'private',
          syncStatus: 'pending',
          version: 1,
        };
        const gps = state.gps;
        if (gps.latitude != null && gps.longitude != null) {
          track.points.push({
            longitude: gps.longitude,
            latitude: gps.latitude,
            recordedAt: startedAt,
            accuracyM: gps.accuracy,
            heading: gps.heading,
          });
        }
        const area = state.huntAreas.find((item) => item.id === state.selectedHuntAreaId);
        const areaName = area?.name ?? huntArea.name;
        set({
          activeHuntId: huntId,
          hunts: [{ ...hunt, areaId: area?.id }, ...state.hunts],
          tracks: [track, ...state.tracks],
          memoirPages: {
            ...state.memoirPages,
            [huntId]: { areaName, notes: '', updatedAt: startedAt },
          },
        });
      },
      endHunt: () => {
        const state = get();
        const huntId = state.activeHuntId;
        if (!huntId) return;
        const endedAt = nowIso();
        const hunt = state.hunts.find((item) => item.id === huntId);
        const track = state.tracks.find((item) => item.id === hunt?.trackId);
        const stopped = track ? stopRecordingTrack(track, endedAt) : undefined;
        set({
          activeHuntId: null,
          hunts: state.hunts.map((item) =>
            item.id === huntId
              ? {
                  ...item,
                  endedAt,
                  distanceMeters: stopped?.distanceMeters ?? 0,
                  syncStatus: 'pending',
                  version: item.version + 1,
                }
              : item,
          ),
          tracks: stopped
            ? state.tracks.map((item) => (item.id === stopped.id ? stopped : item))
            : state.tracks,
          returnLine: undefined,
        });
      },
      appendGps: (point) => {
        const state = get();
        const nextGps: GpsState = {
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracyM,
          heading: point.heading,
          altitude: point.altitudeM,
          source: point.source,
        };
        const hunt = state.hunts.find((item) => item.id === state.activeHuntId);
        const trackId = hunt?.trackId;
        if (state.followGps && nextGps.latitude != null && nextGps.longitude != null && state.cameraMode !== 'fpv') {
          get().requestFlyTo(nextGps.latitude, nextGps.longitude);
        }
        const recovery = state.recovery;
        const nextRecovery =
          recovery && !recovery.endedAt
            ? {
                ...recovery,
                track: [...recovery.track, point],
              }
            : recovery;
        if (!trackId) {
          set({ gps: nextGps, recovery: nextRecovery });
          return;
        }
        set({
          gps: nextGps,
          recovery: nextRecovery,
          tracks: state.tracks.map((track) => {
            if (track.id !== trackId || track.status !== 'recording') return track;
            const last = track.points[track.points.length - 1];
            if (
              last &&
              pathLengthMeters([last, point]) < 6 &&
              Date.parse(point.recordedAt) - Date.parse(last.recordedAt) < 3000
            ) {
              return track;
            }
            const points = [...track.points, point];
            return {
              ...track,
              points,
              distanceMeters: pathLengthMeters(points),
              version: track.version + 1,
            };
          }),
        });
      },
      setGpsError: (error) => {
        set({ gps: { ...get().gps, error, source: get().gps.latitude != null ? get().gps.source : 'none' } });
      },
      setOnline: (online) => set({ online }),
      openSheet: (sheet) => set({ sheet }),
      closeSheet: () => set({ sheet: 'none' }),
      setBasemap: (basemap) => set({ basemap }),
      toggleLayer: (key) => {
        const layers = get().layers;
        const next = !layers[key];
        set({ layers: { ...layers, [key]: next } });
        if (key === 'wireframe' && next && get().cameraMode === 'flat') {
          get().setCameraMode('orbit');
        }
        if (key === 'radar' && next) {
          void get().loadRadar();
        }
      },
      setHunterState: (code) =>
        set({
          hunterState: code,
          packSelection: code ? defaultPackSelection(code, get().layers) : [],
        }),
      setPackSelection: (ids) => set({ packSelection: ids }),
      setProfilePhoto: ({ uri, storagePath }) =>
        set({
          profilePhotoUri: uri,
          profileStoragePath: storagePath ?? get().profileStoragePath,
        }),
      setDraftWaypointType: (type) => set({ draftWaypointType: type }),
      addWaypoint: ({ type, name, notes, species, photos }) => {
        const state = get();
        const latitude = state.tapPoint?.latitude ?? state.gps.latitude;
        const longitude = state.tapPoint?.longitude ?? state.gps.longitude;
        if (latitude == null || longitude == null) {
          set({ sheet: 'waypoint' });
          return;
        }
        const at = nowIso();
        const waypoint: Waypoint = {
          id: newId(),
          userId: state.userId,
          type,
          name: name.trim() || type,
          notes,
          species,
          latitude,
          longitude,
          createdAt: at,
          updatedAt: at,
          observedAt: at,
          photos: (photos ?? []).slice(0, 6),
          tags: [
            ...(state.activeHuntId ? [`hunt:${state.activeHuntId}`] : []),
            ...(typeof state.weather?.windDirectionFromDegrees === 'number'
              ? [`wind:${Math.round(state.weather.windDirectionFromDegrees)}`]
              : []),
          ],
          visibility: 'private',
          syncStatus: 'pending',
          version: 1,
        };
        const camera: FieldCamera | undefined =
          type === 'trail_camera'
            ? {
                id: newId(),
                userId: state.userId,
                waypointId: waypoint.id,
                name: waypoint.name,
                latitude,
                longitude,
                installedAt: at,
                lastChecked: at,
                status: 'active',
                notes,
                photos: [],
                visibility: 'private',
                syncStatus: 'pending',
                version: 1,
                updatedAt: at,
              }
            : undefined;
        if (camera) waypoint.tags = [...waypoint.tags, `camera:${camera.id}`];
        set({
          waypoints: [...state.waypoints, waypoint],
          trailCameras: camera ? [camera, ...state.trailCameras] : state.trailCameras,
          truckWaypointId: type === 'truck' ? waypoint.id : state.truckWaypointId,
          sheet: 'none',
          selectedWaypointId: waypoint.id,
          selectedMemoryId: null,
        });
      },
      updateWaypoint: (id, patch) => {
        const at = nowIso();
        set({
          waypoints: get().waypoints.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                  name: patch.name != null ? patch.name.trim() || item.name : item.name,
                  updatedAt: at,
                  version: item.version + 1,
                  syncStatus: 'pending',
                }
              : item,
          ),
        });
      },
      deleteWaypoint: (id) => {
        const state = get();
        set({
          waypoints: state.waypoints.filter((item) => item.id !== id),
          trailCameras: state.trailCameras.filter((item) => item.waypointId !== id),
          truckWaypointId: state.truckWaypointId === id ? null : state.truckWaypointId,
          selectedWaypointId: state.selectedWaypointId === id ? null : state.selectedWaypointId,
          windTargetId: state.windTargetId === id ? null : state.windTargetId,
          sheet: state.sheet === 'mark' ? 'none' : state.sheet,
        });
      },
      openWaypoint: (id) => {
        const mark = get().waypoints.find((item) => item.id === id);
        if (!mark) return;
        set({
          selectedWaypointId: id,
          selectedMemoryId: null,
          tapPoint: { latitude: mark.latitude, longitude: mark.longitude },
          sheet: 'mark',
          radiusMode: false,
        });
      },
      parkHere: () => {
        const state = get();
        const latitude = state.gps.latitude ?? state.tapPoint?.latitude;
        const longitude = state.gps.longitude ?? state.tapPoint?.longitude;
        if (latitude == null || longitude == null) {
          set({ sheet: 'place' });
          return;
        }
        const at = nowIso();
        const existing =
          state.waypoints.find((item) => item.id === state.truckWaypointId) ??
          state.waypoints.find((item) => item.type === 'truck');
        if (existing) {
          set({
            waypoints: state.waypoints.map((item) =>
              item.id === existing.id
                ? {
                    ...item,
                    type: 'truck',
                    latitude,
                    longitude,
                    updatedAt: at,
                    observedAt: at,
                    version: item.version + 1,
                    syncStatus: 'pending',
                  }
                : item,
            ),
            truckWaypointId: existing.id,
            selectedWaypointId: existing.id,
            sheet: 'none',
          });
          get().requestFlyTo(latitude, longitude, 15);
          return;
        }
        const waypoint: Waypoint = {
          id: newId(),
          userId: state.userId,
          type: 'truck',
          name: 'Truck',
          notes: 'Parked',
          latitude,
          longitude,
          createdAt: at,
          updatedAt: at,
          observedAt: at,
          photos: [],
          tags: [],
          visibility: 'private',
          syncStatus: 'pending',
          version: 1,
        };
        set({
          waypoints: [...state.waypoints, waypoint],
          truckWaypointId: waypoint.id,
          selectedWaypointId: waypoint.id,
          selectedMemoryId: null,
          sheet: 'none',
        });
        get().requestFlyTo(latitude, longitude, 15);
      },
      setMemoirNotes: (huntId, notes) => {
        const pages = get().memoirPages;
        const current = pages[huntId] ?? { areaName: huntArea.name, notes: '' };
        set({ memoirPages: { ...pages, [huntId]: { ...current, notes, updatedAt: nowIso() } } });
      },
      setMemoirStyle: (huntId, patch) => {
        const pages = get().memoirPages;
        const current = pages[huntId] ?? { areaName: huntArea.name, notes: '' };
        set({ memoirPages: { ...pages, [huntId]: { ...current, ...patch, updatedAt: nowIso() } } });
      },
      setJournalStyle: (style) => set({ journalStyle: style }),
      setMemoirReadTheme: (theme) => set({ memoirReadTheme: theme }),
      setFieldRuled: (ruled) => set({ fieldRuled: ruled }),
      toggleGear: (id) => {
        set({
          gear: get().gear.map((item) =>
            item.id === id ? { ...item, packed: !item.packed, updatedAt: nowIso() } : item,
          ),
        });
      },
      addGear: (name, opts) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const gear = get().gear;
        if (gear.some((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase())) return;
        set({
          gear: [
            ...gear,
            {
              id: newId(),
              name: trimmed,
              packed: false,
              sort: gear.length,
              group: opts?.group ?? groupForGearName(trimmed),
              essential: opts?.essential ?? isEssentialGearName(trimmed),
              updatedAt: nowIso(),
            },
          ],
        });
      },
      addGearItems: (items) => {
        if (items.length === 0) return;
        const gear = get().gear;
        const existing = new Set(gear.map((item) => item.name.trim().toLowerCase()));
        const at = nowIso();
        const extras = items.filter((item) => {
          const name = item.name.trim();
          if (!name) return false;
          if (existing.has(name.toLowerCase())) return false;
          existing.add(name.toLowerCase());
          return true;
        });
        if (extras.length === 0) return;
        set({
          gear: [
            ...gear,
            ...extras.map((item, index) => {
              const name = item.name.trim();
              return {
                id: newId(),
                name,
                packed: false,
                sort: gear.length + index,
                group: item.group ?? groupForGearName(name),
                essential: item.essential ?? isEssentialGearName(name),
                updatedAt: at,
              };
            }),
          ],
        });
      },
      removeGear: (id) => {
        set({ gear: get().gear.filter((item) => item.id !== id) });
      },
      clearGear: () => {
        set({ gear: [] });
      },
      applyGearTemplate: () => {
        const current = get().gear;
        const existing = new Set(current.map((item) => item.name.trim().toLowerCase()));
        const at = nowIso();
        const extras = packList.filter((item) => !existing.has(item.name.trim().toLowerCase()));
        if (extras.length === 0) return;
        set({
          gear: [
            ...current,
            ...extras.map((item, index) => ({
              id: newId(),
              name: item.name,
              packed: false,
              sort: current.length + index,
              group: groupForGearName(item.name),
              essential: isEssentialGearName(item.name),
              updatedAt: at,
            })),
          ],
        });
      },
      unpackAllGear: () => {
        const at = nowIso();
        set({
          gear: get().gear.map((item) =>
            item.packed ? { ...item, packed: false, updatedAt: at } : item,
          ),
        });
      },
      addMemory: (memory) => {
        set({ memories: [memory, ...get().memories.filter((item) => item.id !== memory.id)] });
      },
      updateMemory: (id, patch) => {
        set({
          memories: get().memories.map((item) =>
            item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item,
          ),
        });
      },
      removeMemory: (id) => {
        const selected = get().selectedMemoryId === id ? null : get().selectedMemoryId;
        set({
          memories: get().memories.filter((item) => item.id !== id),
          selectedMemoryId: selected,
        });
      },
      selectMemory: (id) => {
        set({ selectedMemoryId: id, selectedWaypointId: id ? null : get().selectedWaypointId });
      },
      showMemoryOnMap: (id) => {
        const memory = get().memories.find((item) => item.id === id);
        if (!memory || memory.latitude == null || memory.longitude == null) return;
        set({
          layers: { ...get().layers, memories: true },
          selectedMemoryId: id,
          selectedWaypointId: null,
        });
        get().requestFlyTo(memory.latitude, memory.longitude, 15);
      },
      addPageSketch: (sketch) => {
        const current = get().pageSketches[sketch.pageId] ?? [];
        set({
          pageSketches: {
            ...get().pageSketches,
            [sketch.pageId]: [...current, { ...sketch, updatedAt: sketch.updatedAt ?? nowIso() }],
          },
        });
      },
      updatePageSketch: (pageId, id, patch) => {
        set({
          pageSketches: {
            ...get().pageSketches,
            [pageId]: (get().pageSketches[pageId] ?? []).map((item) =>
              item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item,
            ),
          },
        });
      },
      removePageSketch: (pageId, id) => {
        set({
          pageSketches: {
            ...get().pageSketches,
            [pageId]: (get().pageSketches[pageId] ?? []).filter((item) => item.id !== id),
          },
        });
      },
      markFirstFixFlown: () => set({ firstFixFlown: true }),
      setHuntPlanStyle: (planId, patch) => {
        set({
          huntPlans: get().huntPlans.map((plan) =>
            plan.id === planId ? { ...plan, ...patch, updatedAt: nowIso() } : plan,
          ),
        });
      },
      addJournalNote: () => {
        const id = newId();
        const at = nowIso();
        const note: JournalNote = {
          id,
          kind: 'note',
          title: 'Field note',
          notes: '',
          createdAt: at,
          updatedAt: at,
        };
        set({ journalNotes: [note, ...get().journalNotes] });
        return id;
      },
      addTitlePage: () => {
        const id = newId();
        const at = nowIso();
        const page: JournalNote = {
          id,
          kind: 'title',
          title: '',
          notes: '',
          author: newestTitleAuthor(get().journalNotes),
          createdAt: at,
          updatedAt: at,
        };
        set({ journalNotes: [page, ...get().journalNotes] });
        return id;
      },
      ensureTitlePage: () => {
        const existing = newestTitleNote(get().journalNotes);
        if (existing) return existing.id;
        return get().addTitlePage();
      },
      removeJournalNote: (id) => {
        const pageId = `note:${id}`;
        set({
          journalNotes: get().journalNotes.filter((note) => note.id !== id),
          bookmarkedPageIds: get().bookmarkedPageIds.filter((item) => item !== pageId),
        });
      },
      toggleBookmark: (pageId) => {
        const ids = get().bookmarkedPageIds;
        set({
          bookmarkedPageIds: ids.includes(pageId)
            ? ids.filter((id) => id !== pageId)
            : [...ids, pageId],
        });
      },
      hideMemoirPage: (pageId) => {
        if (get().hiddenMemoirIds.includes(pageId)) return;
        set({
          hiddenMemoirIds: [...get().hiddenMemoirIds, pageId],
          bookmarkedPageIds: get().bookmarkedPageIds.filter((id) => id !== pageId),
        });
      },
      setJournalNote: (id, patch) => {
        set({
          journalNotes: get().journalNotes.map((note) =>
            note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note,
          ),
        });
      },
      setHuntPlanNotes: (planId, notes) => {
        set({
          huntPlans: get().huntPlans.map((plan) =>
            plan.id === planId ? { ...plan, notes, updatedAt: nowIso() } : plan,
          ),
        });
      },
      addHuntPlan: ({ title, plannedAt, species, notes }) => {
        const state = get();
        const latitude = state.tapPoint?.latitude ?? state.gps.latitude ?? huntArea.latitude;
        const longitude = state.tapPoint?.longitude ?? state.gps.longitude ?? huntArea.longitude;
        const plan: HuntPlan = {
          id: newId(),
          title: title.trim() || 'Planned hunt',
          plannedAt,
          species,
          latitude,
          longitude,
          notes: notes ?? '',
          updatedAt: nowIso(),
        };
        set({
          huntPlans: [plan, ...state.huntPlans],
          sheet: 'none',
        });
      },
      startHuntFromPlan: (planId) => {
        const plan = get().huntPlans.find((item) => item.id === planId);
        if (!plan) return;
        get().requestFlyTo(plan.latitude, plan.longitude, 14);
        get().startHunt({ species: plan.species });
        set({
          huntPlans: get().huntPlans.filter((item) => item.id !== planId),
          bookmarkedPageIds: get().bookmarkedPageIds.filter((item) => item !== `plan:${planId}`),
          selectedPlanId: null,
          sheet: 'none',
        });
      },
      openPlannedHunt: (planId) => {
        const plan = get().huntPlans.find((item) => item.id === planId);
        if (!plan) return;
        set({ selectedPlanId: planId, sheet: 'planned' });
      },
      deleteHuntPlan: (planId) => {
        set({
          huntPlans: get().huntPlans.filter((item) => item.id !== planId),
          bookmarkedPageIds: get().bookmarkedPageIds.filter((item) => item !== `plan:${planId}`),
          selectedPlanId: null,
          sheet: 'none',
        });
      },
      setFollowGps: (follow) => set({ followGps: follow }),
      setCameraMode: (mode) => {
        if (mode !== 'flat' && !get().online) {
          set({ cameraMode: 'flat', followGps: false });
          return;
        }
        set({
          cameraMode: mode,
          followGps: mode === 'fpv' ? true : get().followGps,
          fpvHeadingLock: mode === 'fpv' ? true : get().fpvHeadingLock,
        });
      },
      setMapTheme: (theme) => set({ mapTheme: theme }),
      setNeraMode: (on) => {
        if (!on) {
          set({ neraMode: false });
          return;
        }
        set({ neraMode: true });
        if (get().cameraMode === 'flat') get().setCameraMode('orbit');
      },
      setNeraStyle: (style) => {
        switch (style) {
          case 'glass':
          case 'wire':
            set({ neraStyle: style, neraMode: true });
            if (get().cameraMode === 'flat') get().setCameraMode('orbit');
            return;
          default: {
            const _exhausted: never = style;
            return _exhausted;
          }
        }
      },
      setTerrainExaggeration: (value) =>
        set({
          terrainExaggeration: Math.min(6, Math.max(1.6, Number.isFinite(value) ? value : DEFAULT_TERRAIN_EXAGGERATION)),
        }),
      setFpvHeadingLock: (on) => set({ fpvHeadingLock: on }),
      setPublicLandOpacity: (opacity) => set({ publicLandOpacity: Math.min(1, Math.max(0.15, opacity)) }),
      setRadarOpacity: (opacity) => set({ radarOpacity: Math.min(1, Math.max(0.15, opacity)) }),
      setHillshadeOpacity: (opacity) => set({ hillshadeOpacity: Math.min(1, Math.max(0.1, opacity)) }),
      setScoreOpacity: (opacity) => set({ scoreOpacity: Math.min(1, Math.max(0.15, opacity)) }),
      setHeadingUp: (on) => set({ headingUp: on }),
      setPeekBasemap: (id) => set({ peekBasemap: id }),
      setDrawMode: (on) =>
        set({
          drawMode: on,
          drawRing: on ? get().drawRing : [],
          measureMode: on ? false : get().measureMode,
          radiusMode: on ? false : get().radiusMode,
          sheet: on ? 'none' : get().sheet,
        }),
      addDrawVertex: (latitude, longitude) => {
        set({ drawRing: [...get().drawRing, { latitude, longitude }] });
      },
      undoDrawVertex: () => {
        set({ drawRing: get().drawRing.slice(0, -1) });
      },
      saveDrawnArea: (name) => {
        const ring = get().drawRing;
        if (ring.length < 3) return;
        const lats = ring.map((point) => point.latitude);
        const lngs = ring.map((point) => point.longitude);
        const at = nowIso();
        const area: HuntArea = {
          id: newId(),
          userId: get().userId,
          name: name.trim() || 'Hunt area',
          west: Math.min(...lngs),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          north: Math.max(...lats),
          ring: ring.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
          createdAt: at,
          updatedAt: at,
          visibility: 'private',
          syncStatus: 'pending',
          version: 1,
        };
        set({
          huntAreas: [area, ...get().huntAreas],
          selectedHuntAreaId: area.id,
          drawMode: false,
          drawRing: [],
          sheet: 'areas',
        });
      },
      locate: (coords) => {
        get().appendGps({
          longitude: coords.longitude,
          latitude: coords.latitude,
          recordedAt: nowIso(),
          accuracyM: coords.accuracy,
          heading: coords.heading,
          source: 'gps',
        });
        get().requestFlyTo(coords.latitude, coords.longitude, 15);
        set({ followGps: true });
        void get().refreshWeather(coords.latitude, coords.longitude);
      },
      requestFlyTo: (latitude, longitude, zoom) => {
        set({
          mapTarget: { requestId: newId(), latitude, longitude, zoom },
        });
      },
      handleMapTap: async (longitude, latitude) => {
        const state = get();
        if (state.drawMode) {
          get().addDrawVertex(latitude, longitude);
          return;
        }
        if (state.measureMode) {
          get().addMeasurePoint(latitude, longitude);
          return;
        }
        if (state.recovery && !state.recovery.endedAt) {
          get().addRecoveryMark(latitude, longitude);
          return;
        }
        if (state.radiusMode) {
          get().addScoutPoint(latitude, longitude);
          return;
        }
        set({
          tapPoint: { latitude, longitude },
          sheet: 'property',
          identify: undefined,
          selectedWaypointId: null,
        });
        const result = await fetchIdentify(longitude, latitude, {
          stateCode: get().hunterState,
        });
        if (get().sheet === 'property') set({ identify: result });
      },
      handleMapLongPress: (longitude, latitude) => {
        const draft = get().draftWaypointType;
        set({ tapPoint: { latitude, longitude }, identify: undefined });
        get().addWaypoint({ type: draft, name: WAYPOINT_TYPE_LABELS[draft] ?? draft });
      },
      beginWaypointAtTap: () => {
        const point = get().tapPoint;
        if (!point) {
          set({ sheet: 'waypoint' });
          return;
        }
        set({ sheet: 'waypoint', draftWaypointType: 'stand' });
      },
      beginIdentifyAtTap: async () => {
        const point = get().tapPoint;
        set({ sheet: 'property', identify: undefined });
        if (!point) return;
        const result = await fetchIdentify(point.longitude, point.latitude, {
          stateCode: get().hunterState,
        });
        set({ identify: result });
      },
      beginScoutRadiusAtTap: () => {
        const point = get().tapPoint;
        if (point) {
          get().addScoutPoint(point.latitude, point.longitude);
          return;
        }
        set({ radiusMode: true, sheet: 'none' });
      },
      setRadiusMode: (on) => {
        set({
          radiusMode: on,
          sheet: get().sheet === 'radius' ? 'none' : get().sheet,
        });
      },
      addScoutPoint: (latitude, longitude) => {
        const state = get();
        const at = nowIso();
        const id = newId();
        const last = state.scoutAreas[0];
        const area: ScoutArea = {
          id,
          name: `Scout ${state.scoutAreas.length + 1}`,
          color: last?.color ?? 'rust',
          radiusMeters: last?.radiusMeters ?? 183,
          points: [{ id: newId(), latitude, longitude }],
          updatedAt: at,
        };
        set({
          scoutAreas: [area, ...state.scoutAreas],
          selectedScoutId: id,
          tapPoint: { latitude, longitude },
          radiusMode: true,
          sheet: 'none',
        });
      },
      removeScoutPoint: (areaId, pointId) => {
        set({
          scoutAreas: get().scoutAreas.map((area) =>
            area.id === areaId
              ? {
                  ...area,
                  points: area.points.filter((point) => point.id !== pointId),
                  updatedAt: nowIso(),
                }
              : area,
          ),
        });
      },
      setScoutName: (id, name) => {
        set({
          scoutAreas: get().scoutAreas.map((area) =>
            area.id === id ? { ...area, name: name.trim() || area.name, updatedAt: nowIso() } : area,
          ),
        });
      },
      setScoutColor: (id, color) => {
        set({
          scoutAreas: get().scoutAreas.map((area) =>
            area.id === id ? { ...area, color, updatedAt: nowIso() } : area,
          ),
        });
      },
      setScoutRadius: (id, radiusMeters) => {
        set({
          scoutAreas: get().scoutAreas.map((area) =>
            area.id === id ? { ...area, radiusMeters, updatedAt: nowIso() } : area,
          ),
        });
      },
      openScoutArea: (id) => {
        set({ selectedScoutId: id, radiusMode: false, sheet: 'none' });
      },
      deleteScoutArea: (id) => {
        const rest = get().scoutAreas.filter((area) => area.id !== id);
        set({
          scoutAreas: rest,
          selectedScoutId: null,
          radiusMode: get().radiusMode,
          sheet: get().sheet === 'radius' ? 'none' : get().sheet,
        });
      },
      dismissScoutEdit: () => {
        set({
          selectedScoutId: null,
          radiusMode: false,
          sheet: get().sheet === 'radius' ? 'none' : get().sheet,
        });
      },
      moveScoutArea: (id, dLat, dLng) => {
        if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) return;
        if (dLat === 0 && dLng === 0) return;
        set({
          scoutAreas: get().scoutAreas.map((area) =>
            area.id === id
              ? {
                  ...area,
                  points: area.points.map((point) => ({
                    ...point,
                    latitude: point.latitude + dLat,
                    longitude: point.longitude + dLng,
                  })),
                  updatedAt: nowIso(),
                }
              : area,
          ),
        });
      },
      refreshWeather: async (latitude, longitude) => {
        const weather = await fetchWeather(latitude, longitude);
        if (weather) {
          const state = get();
          set({
            weather,
            windEval: currentWindEval({ ...state, weather }),
          });
        }
      },
      computeReturn: () => {
        const state = get();
        const from = {
          latitude: state.gps.latitude ?? state.tapPoint?.latitude ?? huntArea.latitude,
          longitude: state.gps.longitude ?? state.tapPoint?.longitude ?? huntArea.longitude,
        };
        const truck = state.waypoints.find((item) => item.id === state.truckWaypointId);
        const hunt = state.hunts.find((item) => item.id === state.activeHuntId);
        const track = state.tracks.find((item) => item.id === hunt?.trackId);
        const routes = returnToTruck({
          from,
          truck: truck
            ? { latitude: truck.latitude, longitude: truck.longitude }
            : null,
          breadcrumbs: track?.points,
        });
        set({
          sheet: 'return',
          returnRoutes: routes,
          returnLine: routes[0]?.points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        });
      },
      setMapBounds: (bounds) => {
        const current = get().mapBounds;
        if (
          current &&
          current.west === bounds.west &&
          current.south === bounds.south &&
          current.east === bounds.east &&
          current.north === bounds.north
        ) {
          return;
        }
        set({ mapBounds: bounds });
      },
      runScout: async () => {
        set({ sheet: 'scout', scoutMessage: 'Checking scout…' });
        const result = await fetchScout(viewportBounds(get()));
        const overlay = result.overlay ?? [];
        const units = result.units ?? [];
        set({
          scoutMessage: result.message,
          scoreOverlay: overlay,
          unitOverlay: units,
          terrainOverlay: result.features ?? get().terrainOverlay,
          layers: {
            ...get().layers,
            huntScore: Boolean(result.ok && overlay.length > 0),
            huntingUnits: Boolean(result.ok && units.length > 0) || get().layers.huntingUnits,
            terrainFeatures:
              get().layers.terrainFeatures || Boolean(result.features && result.features.length > 0),
          },
        });
      },
      runTerrainAnalyze: async (opts) => {
        if (!opts?.silent) {
          set({ sheet: 'terrain', scoutMessage: 'Analyzing terrain…' });
        } else {
          set({ scoutMessage: 'Analyzing terrain…' });
        }
        const result = await fetchTerrainAnalyze(viewportBounds(get()));
        set({
          scoutMessage: result.message,
          terrainOverlay: result.features,
          slopeHeat: result.slopeHeat ?? [],
          layers: {
            ...get().layers,
            terrainFeatures: result.ok && result.features.length > 0,
          },
        });
      },
      openWeather: async () => {
        const state = get();
        set({
          sheet: 'weather',
          layers: { ...state.layers, radar: state.online, windCone: true },
        });
        const latitude = state.gps.latitude ?? state.tapPoint?.latitude;
        const longitude = state.gps.longitude ?? state.tapPoint?.longitude;
        if (latitude != null && longitude != null) {
          await get().refreshWeather(latitude, longitude);
        }
        await get().loadRadar();
      },
      loadRadar: async () => {
        if (!get().online) {
          set({ layers: { ...get().layers, radar: false } });
          return;
        }
        if (get().radar && get().layers.radar) return;
        const radar = await fetchRadarCatalog();
        if (!radar) return;
        set({
          radar,
          radarIndex: Math.max(0, radar.nowcastStartIndex - 1),
          layers: { ...get().layers, radar: true },
        });
      },
      setRadarIndex: (index) => {
        const radar = get().radar;
        if (!radar) return;
        set({ radarIndex: Math.min(radar.frames.length - 1, Math.max(0, index)) });
      },
      setRadarPlaying: (playing) => set({ radarPlaying: playing }),
      setWindWhatIf: (degrees) => {
        const state = get();
        set({
          windWhatIfDegrees: degrees,
          windEval: currentWindEval({ ...state, windWhatIfDegrees: degrees }),
          layers: { ...state.layers, windCone: true },
        });
      },
      setWindTarget: (waypointId) => {
        const state = get();
        set({
          windTargetId: waypointId,
          windEval: currentWindEval({ ...state, windTargetId: waypointId }),
        });
      },
      setMeasureMode: (on) => {
        set({
          measureMode: on,
          measurePoints: on ? get().measurePoints : [],
          radiusMode: on ? false : get().radiusMode,
          drawMode: on ? false : get().drawMode,
          sheet: on ? 'none' : get().sheet,
        });
      },
      addMeasurePoint: (latitude, longitude) => {
        set({ measurePoints: [...get().measurePoints, { latitude, longitude }] });
      },
      clearMeasure: () => set({ measurePoints: [], measureMode: false }),
      saveHuntArea: (name) => {
        const state = get();
        const bounds = viewportBounds(state);
        const at = nowIso();
        const area: HuntArea = {
          id: newId(),
          userId: state.userId,
          name: name.trim() || 'Hunt area',
          west: bounds.west,
          south: bounds.south,
          east: bounds.east,
          north: bounds.north,
          createdAt: at,
          updatedAt: at,
          visibility: 'private',
          syncStatus: 'pending',
          version: 1,
        };
        set({
          huntAreas: [area, ...state.huntAreas],
          selectedHuntAreaId: area.id,
          sheet: 'areas',
        });
      },
      jumpHuntArea: (id) => {
        const area = get().huntAreas.find((item) => item.id === id);
        if (!area) return;
        set({ selectedHuntAreaId: id, sheet: 'none' });
        get().requestFlyTo((area.south + area.north) / 2, (area.west + area.east) / 2, 13);
      },
      deleteHuntArea: (id) => {
        set({
          huntAreas: get().huntAreas.filter((item) => item.id !== id),
          selectedHuntAreaId: get().selectedHuntAreaId === id ? null : get().selectedHuntAreaId,
        });
      },
      checkInCamera: (waypointId, photo) => {
        const at = nowIso();
        set({
          trailCameras: get().trailCameras.map((camera) =>
            camera.waypointId === waypointId
              ? {
                  ...camera,
                  lastChecked: at,
                  photos: photo ? [photo, ...camera.photos] : camera.photos,
                  updatedAt: at,
                  version: camera.version + 1,
                  syncStatus: 'pending',
                }
              : camera,
          ),
          waypoints: photo
            ? get().waypoints.map((item) =>
                item.id === waypointId
                  ? {
                      ...item,
                      photos: [photo, ...item.photos],
                      updatedAt: at,
                      version: item.version + 1,
                      syncStatus: 'pending',
                    }
                  : item,
              )
            : get().waypoints,
        });
      },
      attachWaypointPhoto: (id, uri) => {
        const at = nowIso();
        set({
          waypoints: get().waypoints.map((item) =>
            item.id === id
              ? {
                  ...item,
                  photos: [uri, ...item.photos],
                  updatedAt: at,
                  version: item.version + 1,
                  syncStatus: 'pending',
                }
              : item,
          ),
        });
      },
      removeWaypointPhoto: (id, index) => {
        const at = nowIso();
        set({
          waypoints: get().waypoints.map((item) =>
            item.id === id
              ? {
                  ...item,
                  photos: item.photos.filter((_, photoIndex) => photoIndex !== index),
                  updatedAt: at,
                  version: item.version + 1,
                  syncStatus: 'pending',
                }
              : item,
          ),
        });
      },
      startRecovery: (harvestWaypointId) => {
        const harvest = get().waypoints.find((item) => item.id === harvestWaypointId);
        const at = nowIso();
        const shot: RecoveryMark | undefined = harvest
          ? {
              id: newId(),
              kind: 'shot',
              latitude: harvest.latitude,
              longitude: harvest.longitude,
              recordedAt: harvest.observedAt ?? harvest.createdAt,
            }
          : undefined;
        set({
          recovery: {
            id: newId(),
            harvestWaypointId,
            startedAt: at,
            dropKind: 'blood',
            marks: shot ? [shot] : [],
            track: [],
          },
          sheet: 'recovery',
        });
      },
      setRecoveryKind: (kind) => {
        const recovery = get().recovery;
        if (!recovery) return;
        set({ recovery: { ...recovery, dropKind: kind } });
      },
      addRecoveryMark: (latitude, longitude) => {
        const recovery = get().recovery;
        if (!recovery || recovery.endedAt) return;
        const mark: RecoveryMark = {
          id: newId(),
          kind: recovery.dropKind,
          latitude,
          longitude,
          recordedAt: nowIso(),
        };
        set({
          recovery: { ...recovery, marks: [...recovery.marks, mark] },
          sheet: 'recovery',
        });
      },
      endRecovery: () => {
        const recovery = get().recovery;
        if (!recovery) return;
        set({
          recovery: { ...recovery, endedAt: nowIso() },
          sheet: 'none',
        });
      },
      setGlassingBearing: (degrees) => set({ glassingBearing: ((degrees % 360) + 360) % 360 }),
      runGlassingLos: async (waypointId, bearingDegrees) => {
        const mark = get().waypoints.find((item) => item.id === waypointId);
        if (!mark) return;
        const origin = { latitude: mark.latitude, longitude: mark.longitude };
        const points = glassingRayPoints(origin, bearingDegrees, 800, 16);
        const samples = await fetchElevationSamples(points);
        if (samples.length < 3) {
          set({
            losOverlay: [],
            losDisclaimer: 'Line-of-sight unknown — elevation sampling failed.',
            layers: { ...get().layers, los: false },
          });
          return;
        }
        const observerElevation = samples[0]?.elevationMeters ?? 0;
        const cells = evaluateLineOfSight({
          observer: origin,
          observerElevationMeters: observerElevation,
          samples,
        });
        set({
          glassingBearing: bearingDegrees,
          losOverlay: cells.map((cell) => ({
            latitude: cell.latitude,
            longitude: cell.longitude,
            visible: cell.visible,
            elevationMeters: cell.elevationMeters,
          })),
          losDisclaimer: GLASSING_LOS_DISCLAIMER,
          layers: { ...get().layers, los: true },
        });
      },
    }),
    {
      name: 'huntos-field',
      version: 8,
      skipHydration: true,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState, version) => {
        const next = { ...(persistedState as Record<string, unknown>) };
        if (version < 2 && next.basemap === 'hybrid') {
          next.basemap = 'topo';
        }
        if (version < 3 && isSeedGear(next.gear)) {
          next.gear = [];
        }
        if (version < 4) {
          const marks = withoutSeedTruck(next.waypoints);
          next.waypoints = marks;
          const truckId = next.truckWaypointId;
          if (truckId === SEED_TRUCK_ID || !marks.some((item) => item.id === truckId)) {
            const parked = marks.find((item) => item.type === 'truck');
            next.truckWaypointId = parked?.id ?? null;
          }
          if (Array.isArray(next.gear)) {
            next.gear = next.gear.map((item) =>
              item && typeof item === 'object'
                ? { ...(item as Record<string, unknown>), packed: false }
                : item,
            );
          }
        }
        if (version < 5 && isSeedGear(next.gear)) {
          next.gear = [];
        }
        if (version < 6) {
          if (next.pageSketches) next.pageSketches = withoutDataUriSketches(next.pageSketches);
          if (Array.isArray(next.journalNotes)) next.journalNotes = withoutDataUriNotes(next.journalNotes);
        }
        if (version < 7 && next.fieldRuled == null) {
          next.fieldRuled = true;
        }
        if (version < 8) {
          next.gear = withGearMeta(next.gear);
          if (!Array.isArray(next.memories)) next.memories = [];
          if (next.memoirReadTheme !== 'night') next.memoirReadTheme = 'paper';
        }
        return next;
      },
      partialize: (state) => ({
        userId: state.userId,
        cloudUserId: state.cloudUserId,
        hunts: state.hunts,
        tracks: state.tracks,
        waypoints: state.waypoints,
        memoirPages: state.memoirPages,
        journalNotes: withoutDataUriNotes(state.journalNotes),
        huntPlans: state.huntPlans,
        gear: state.gear,
        memories: withoutDataUriMemories(state.memories),
        pageSketches: withoutDataUriSketches(state.pageSketches),
        journalStyle: state.journalStyle,
        memoirReadTheme: state.memoirReadTheme,
        fieldRuled: state.fieldRuled,
        bookmarkedPageIds: state.bookmarkedPageIds,
        hiddenMemoirIds: state.hiddenMemoirIds,
        hunterState: state.hunterState,
        packSelection: state.packSelection,
        packCachedIds: state.packCachedIds,
        packLastDownloaded: state.packLastDownloaded,
        basemapCachedSlug: state.basemapCachedSlug,
        basemapCachedAt: state.basemapCachedAt,
        profilePhotoUri: state.profilePhotoUri,
        profileStoragePath: state.profileStoragePath,
        scoutAreas: state.scoutAreas,
        huntAreas: state.huntAreas,
        trailCameras: state.trailCameras,
        publicLandOpacity: state.publicLandOpacity,
        radarOpacity: state.radarOpacity,
        hillshadeOpacity: state.hillshadeOpacity,
        scoreOpacity: state.scoreOpacity,
        headingUp: state.headingUp,
        activeHuntId: state.activeHuntId,
        truckWaypointId: state.truckWaypointId,
        basemap: state.basemap,
        layers: state.layers,
      }),
      onRehydrateStorage: () => (persisted) => {
        const marks = withoutSeedTruck(persisted?.waypoints);
        const truckId =
          persisted?.truckWaypointId && persisted.truckWaypointId !== SEED_TRUCK_ID
            ? persisted.truckWaypointId
            : marks.find((item) => item.type === 'truck')?.id ?? null;
        useFieldStore.setState({
          hydrated: true,
          hunts: persisted?.hunts ?? [],
          tracks: persisted?.tracks ?? [],
          waypoints: marks,
          journalNotes: persisted?.journalNotes ?? [],
          huntPlans: persisted?.huntPlans ?? [],
          gear: stripSeedGear(withGearMeta(persisted?.gear)),
          memories: withoutDataUriMemories(persisted?.memories),
          pageSketches: persisted?.pageSketches ?? {},
          journalStyle: persisted?.journalStyle ?? 'memoir',
          memoirReadTheme: persisted?.memoirReadTheme === 'night' ? 'night' : 'paper',
          fieldRuled: persisted?.fieldRuled !== false,
          bookmarkedPageIds: Array.isArray(persisted?.bookmarkedPageIds)
            ? persisted.bookmarkedPageIds
            : [],
          hiddenMemoirIds: Array.isArray(persisted?.hiddenMemoirIds)
            ? persisted.hiddenMemoirIds
            : [],
          hunterState: typeof persisted?.hunterState === 'string' ? persisted.hunterState : null,
          packSelection: Array.isArray(persisted?.packSelection) ? persisted.packSelection : [],
          packCachedIds: Array.isArray(persisted?.packCachedIds) ? persisted.packCachedIds : [],
          packLastDownloaded:
            typeof persisted?.packLastDownloaded === 'string' ? persisted.packLastDownloaded : undefined,
          basemapCachedSlug:
            typeof persisted?.basemapCachedSlug === 'string' ? persisted.basemapCachedSlug : undefined,
          basemapCachedAt:
            typeof persisted?.basemapCachedAt === 'string' ? persisted.basemapCachedAt : undefined,
          profilePhotoUri: persisted?.profilePhotoUri,
          profileStoragePath: persisted?.profileStoragePath,
          cloudUserId: persisted?.cloudUserId ?? null,
          scoutAreas: persisted?.scoutAreas ?? [],
          huntAreas: persisted?.huntAreas ?? [],
          trailCameras: persisted?.trailCameras ?? [],
          truckWaypointId: marks.some((item) => item.id === truckId) ? truckId : null,
          layers: { ...defaultLayers(), ...persisted?.layers },
          publicLandOpacity:
            typeof persisted?.publicLandOpacity === 'number' ? persisted.publicLandOpacity : 0.58,
          radarOpacity: typeof persisted?.radarOpacity === 'number' ? persisted.radarOpacity : 0.58,
          hillshadeOpacity:
            typeof persisted?.hillshadeOpacity === 'number' ? persisted.hillshadeOpacity : 0.42,
          scoreOpacity: typeof persisted?.scoreOpacity === 'number' ? persisted.scoreOpacity : 0.72,
          headingUp: persisted?.headingUp === true,
          scoreOverlay: [],
          unitOverlay: [],
          terrainOverlay: [],
          slopeHeat: [],
          losOverlay: [],
        });
      },
    },
  ),
);

export function activeHunt(state: FieldState): HuntSession | undefined {
  return state.hunts.find((hunt) => hunt.id === state.activeHuntId);
}

export function activeTrack(state: FieldState): Track | undefined {
  const hunt = activeHunt(state);
  return state.tracks.find((track) => track.id === hunt?.trackId);
}

export function measureResult(state: FieldState): MeasureResult | undefined {
  return measureSummary(state.measurePoints);
}

export function waypointSightingLine(state: FieldState): string | undefined {
  const observations = state.waypoints.flatMap((point) => {
    const windTag = point.tags.find((tag) => tag.startsWith('wind:'));
    const degrees = windTag ? Number(windTag.slice(5)) : Number.NaN;
    return [
      {
        id: point.id,
        species: point.species,
        observedAt: point.observedAt ?? point.createdAt,
        windDirectionFromDegrees: Number.isFinite(degrees) ? degrees : null,
      },
    ];
  });
  const wind = summarizeWindSightings(observations);
  const hour = summarizeHourlyActivity(observations);
  if (wind) return wind.statement;
  return hour?.statement;
}

export function windWedgeRing(origin: LonLat, fromDegrees: number): LonLat[] {
  return windWedge(origin, fromDegrees);
}

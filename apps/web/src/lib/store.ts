import { create } from "zustand";
import type {
  BoundingBox,
  HuntArea,
  IdentifyResult,
  OverlayId,
  OverlayLayerFlags,
  SpeciesId,
  Track,
  Waypoint,
  WeatherSnapshot,
  WaypointType,
} from "@huntos/core";
import { defaultOverlayLayerFlags, defaultPackSelection, type OverlayPackEstimate } from "@huntos/core";
import type { BasemapId } from "./map-style";
import type { GpsRingIntel } from "./gps-rings";

export type CameraMode = "flat" | "orbit" | "fpv";
export type MapTheme = "dark" | "light";
export type NeraStyle = "glass" | "wire";
export const DEFAULT_TERRAIN_EXAGGERATION = 3.2;

export type SheetId =
  | "none"
  | "layers"
  | "property"
  | "intel"
  | "waypoint"
  | "scout"
  | "download"
  | "areas"
  | "assistant"
  | "gps"
  | "return"
  | "account"
  | "kill"
  | "terrain"
  | "mark";

export interface LayerState extends OverlayLayerFlags {
  hillshade: boolean;
  wireframe: boolean;
  regulations: boolean;
  bedding: boolean;
  feeding: boolean;
  travel: boolean;
  security: boolean;
  huntScore: boolean;
  terrainFeatures: boolean;
  waypoints: boolean;
  cameras: boolean;
  tracks: boolean;
  observations: boolean;
  kills: boolean;
  killHeat: boolean;
}

export interface ScoutDraft {
  species: SpeciesId;
  period: "now" | "morning" | "evening" | "custom";
  area: "visible" | "1mi" | "3mi" | "draw";
  stage: string;
}

export interface AccountUser {
  id: string;
  email: string;
}

export interface AppState {
  userId: string | null;
  account: AccountUser | null;
  online: boolean;
  fieldMode: boolean;
  basemap: BasemapId;
  cameraMode: CameraMode;
  mapTheme: MapTheme;
  neraMode: boolean;
  neraStyle: NeraStyle;
  terrainExaggeration: number;
  followGps: boolean;
  firstFixFlown: boolean;
  fpvHeadingLock: boolean;
  terrainElevationMeters?: number;
  gpsRingIntel: GpsRingIntel | null;
  layers: LayerState;
  sheet: SheetId;
  gps: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    source: "gps" | "operator" | "none";
    error?: string;
  };
  weather?: WeatherSnapshot;
  identify?: IdentifyResult;
  intelPoint?: { lng: number; lat: number };
  draftWaypointType: WaypointType;
  draftKillSpecies: SpeciesId;
  waypoints: Waypoint[];
  selectedWaypointId: string | null;
  tracks: Track[];
  huntAreas: HuntArea[];
  activeAreaId?: string;
  activeTrackId?: string;
  truckWaypointId?: string;
  scout?: ScoutDraft;
  scoutResult?: Record<string, unknown>;
  selectedScore?: {
    cellId: string;
    lng: number;
    lat: number;
    score: number | null;
    confidence: number;
    reasons: string[];
    unavailable: string[];
    disclaimer: string;
  };
  terrainResult?: {
    features: Array<{
      kind: string;
      label: string;
      reasons: string[];
      confidence: number;
    }>;
    cells?: Array<{
      longitude: number;
      latitude: number;
      slopeDegrees: number | null;
      elevationMeters: number | null;
      terrainPosition?: string;
    }>;
  };
  mapBounds?: BoundingBox;
  hunterState: string | null;
  packSelection: OverlayId[];
  packEstimate?: OverlayPackEstimate;
  packStatus?: {
    overlayId: OverlayId;
    done: number;
    total: number;
    label: string;
  };
  packLastDownloaded?: string;
  packCachedIds: OverlayId[];
  downloadProgress?: { done: number; total: number; label: string };
  mapTarget?: {
    requestId: string;
    placeId: string;
    bounds: BoundingBox;
    center?: { latitude: number; longitude: number };
  };
}

export const defaultLayers = (): LayerState => ({
  ...defaultOverlayLayerFlags(),
  hillshade: false,
  wireframe: false,
  regulations: false,
  bedding: false,
  feeding: false,
  travel: false,
  security: false,
  huntScore: false,
  terrainFeatures: false,
  waypoints: true,
  cameras: true,
  tracks: true,
  observations: true,
  kills: true,
  killHeat: true,
});

export const useHuntStore = create<AppState>(() => ({
  userId: null,
  account: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  fieldMode: false,
  basemap: "topo",
  cameraMode: "orbit",
  mapTheme: "dark",
  neraMode: true,
  neraStyle: "wire",
  terrainExaggeration: DEFAULT_TERRAIN_EXAGGERATION,
  followGps: false,
  firstFixFlown: false,
  fpvHeadingLock: true,
  gpsRingIntel: null,
  layers: defaultLayers(),
  sheet: "none",
  gps: { source: "none" },
  hunterState: null,
  packSelection: [],
  packCachedIds: [],
  draftWaypointType: "custom",
  draftKillSpecies: "whitetail",
  waypoints: [],
  selectedWaypointId: null,
  tracks: [],
  huntAreas: [],
  scout: {
    species: "whitetail",
    period: "now",
    area: "visible",
    stage: "species",
  },
}));

export function openSheet(sheet: SheetId): void {
  useHuntStore.setState({ sheet });
}

export function closeSheet(): void {
  useHuntStore.setState({ sheet: "none" });
}

export function persistHunterPack(code: string | null, packSelection: OverlayId[]): void {
  if (typeof localStorage === "undefined") return;
  if (code) localStorage.setItem("nomad-hunter-state", code);
  else localStorage.removeItem("nomad-hunter-state");
  localStorage.setItem("nomad-pack-selection", JSON.stringify(packSelection));
}

export function readPersistedHunterState(): { hunterState: string | null; packSelection: OverlayId[] } {
  if (typeof localStorage === "undefined") return { hunterState: null, packSelection: [] };
  const hunterState = localStorage.getItem("nomad-hunter-state");
  try {
    const raw = localStorage.getItem("nomad-pack-selection");
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const packSelection = Array.isArray(parsed)
      ? parsed.filter((id): id is OverlayId => typeof id === "string")
      : [];
    return { hunterState, packSelection };
  } catch {
    return { hunterState, packSelection: hunterState ? defaultPackSelection(hunterState) : [] };
  }
}

export function setHunterState(code: string | null): void {
  const packSelection = code ? defaultPackSelection(code, useHuntStore.getState().layers) : [];
  persistHunterPack(code, packSelection);
  useHuntStore.setState({ hunterState: code, packSelection });
}

export function setPackSelection(ids: OverlayId[]): void {
  persistHunterPack(useHuntStore.getState().hunterState, ids);
  useHuntStore.setState({ packSelection: ids });
}

export function setMapTheme(theme: MapTheme): void {
  useHuntStore.setState({ mapTheme: theme });
}

export function setNeraMode(on: boolean): void {
  useHuntStore.setState({ neraMode: on });
}

export function setNeraStyle(style: NeraStyle): void {
  switch (style) {
    case "glass":
    case "wire":
      useHuntStore.setState({ neraStyle: style, neraMode: true });
      return;
    default: {
      const _exhausted: never = style;
      return _exhausted;
    }
  }
}

export function setCameraMode(mode: CameraMode): void {
  const state = useHuntStore.getState();
  if (mode !== "flat" && !state.online) {
    useHuntStore.setState({ cameraMode: "flat", followGps: false });
    return;
  }
  useHuntStore.setState({
    cameraMode: mode,
    followGps: mode === "fpv" ? true : state.followGps,
    fpvHeadingLock: mode === "fpv" ? true : state.fpvHeadingLock,
  });
}

export function flyToGpsFix(
  latitude: number,
  longitude: number,
): void {
  flyToBounds(
    "gps-fix",
    {
      west: longitude - 0.03,
      south: latitude - 0.02,
      east: longitude + 0.03,
      north: latitude + 0.02,
    },
    { latitude, longitude },
  );
}

export function flyToBounds(
  placeId: string,
  bounds: BoundingBox,
  center?: { latitude: number; longitude: number },
): void {
  useHuntStore.setState({
    mapTarget: {
      requestId: crypto.randomUUID(),
      placeId,
      bounds,
      center,
    },
  });
}

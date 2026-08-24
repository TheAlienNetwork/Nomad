import { create } from "zustand";
import type {
  BoundingBox,
  HuntArea,
  IdentifyResult,
  SpeciesId,
  Track,
  Waypoint,
  WeatherSnapshot,
  WaypointType,
} from "@huntos/core";
import type { BasemapId } from "./map-style";

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
  | "return";

export interface LayerState {
  publicLand: boolean;
  hillshade: boolean;
  water: boolean;
  landCover: boolean;
  huntingUnits: boolean;
  regulations: boolean;
  bedding: boolean;
  feeding: boolean;
  travel: boolean;
  security: boolean;
  huntScore: boolean;
  waypoints: boolean;
  cameras: boolean;
  tracks: boolean;
  observations: boolean;
}

export interface ScoutDraft {
  species: SpeciesId;
  period: "now" | "morning" | "evening" | "custom";
  area: "visible" | "1mi" | "3mi" | "draw";
  stage: string;
}

export interface AppState {
  userId: string | null;
  online: boolean;
  fieldMode: boolean;
  basemap: BasemapId;
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
  waypoints: Waypoint[];
  tracks: Track[];
  huntAreas: HuntArea[];
  activeAreaId?: string;
  activeTrackId?: string;
  truckWaypointId?: string;
  scout?: ScoutDraft;
  scoutResult?: Record<string, unknown>;
  mapBounds?: BoundingBox;
  downloadProgress?: { done: number; total: number; label: string };
}

export const defaultLayers = (): LayerState => ({
  publicLand: true,
  hillshade: false,
  water: false,
  landCover: false,
  huntingUnits: false,
  regulations: false,
  bedding: false,
  feeding: false,
  travel: false,
  security: false,
  huntScore: false,
  waypoints: true,
  cameras: true,
  tracks: true,
  observations: true,
});

export const useHuntStore = create<AppState>(() => ({
  userId: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  fieldMode: false,
  basemap: "topo",
  layers: defaultLayers(),
  sheet: "none",
  gps: { source: "none" },
  draftWaypointType: "custom",
  waypoints: [],
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

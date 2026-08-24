import type {
  LonLat,
  SpeciesId,
  SyncStatus,
  Visibility,
  WaypointType,
} from "./types";

export interface Waypoint {
  id: string;
  userId: string;
  huntAreaId?: string;
  type: WaypointType;
  name: string;
  notes?: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  createdAt: string;
  updatedAt: string;
  observedAt?: string;
  photos: string[];
  weatherSnapshotId?: string;
  species?: SpeciesId;
  tags: string[];
  visibility: Visibility;
  syncStatus: SyncStatus;
  version: number;
  serverId?: string;
}

export interface HuntArea {
  id: string;
  userId: string;
  name: string;
  notes?: string;
  west: number;
  south: number;
  east: number;
  north: number;
  createdAt: string;
  updatedAt: string;
  visibility: Visibility;
  syncStatus: SyncStatus;
  version: number;
}

export interface TrackPoint extends LonLat {
  recordedAt: string;
  accuracyM?: number | null;
  altitudeM?: number | null;
  speedMps?: number | null;
  heading?: number | null;
}

export interface Track {
  id: string;
  userId: string;
  huntId?: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  status: "recording" | "paused" | "stopped";
  points: TrackPoint[];
  distanceMeters: number;
  visibility: Visibility;
  syncStatus: SyncStatus;
  version: number;
}

export interface HuntSession {
  id: string;
  userId: string;
  species?: SpeciesId;
  startedAt: string;
  endedAt?: string;
  areaId?: string;
  trackId?: string;
  distanceMeters?: number;
  notes?: string;
  visibility: Visibility;
  syncStatus: SyncStatus;
  version: number;
}

export interface Observation {
  id: string;
  userId: string;
  huntId?: string;
  waypointId?: string;
  species?: SpeciesId;
  notes?: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
  visibility: Visibility;
  syncStatus: SyncStatus;
  version: number;
}

export interface TrailCamera {
  id: string;
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  installedAt?: string;
  lastChecked?: string;
  status: "active" | "inactive" | "unknown";
  notes?: string;
  photos: string[];
  visibility: Visibility;
  syncStatus: SyncStatus;
  version: number;
}

export interface OfflineRegion {
  id: string;
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
  minZoom: number;
  maxZoom: number;
  estimatedBytes?: number;
  downloadedBytes?: number;
  lastUpdate?: string;
  datasetVersions: Record<string, string | undefined>;
  status: "queued" | "downloading" | "ready" | "error";
}

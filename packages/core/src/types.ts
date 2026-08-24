export type TruthLayer = "authoritative" | "observed" | "inferred";

export type DatasetStatus =
  | "healthy"
  | "warning"
  | "error"
  | "disabled"
  | "unconfigured"
  | "unknown";

export type ServiceType =
  | "arcgis-featureserver"
  | "arcgis-mapserver"
  | "geojson"
  | "wfs"
  | "shapefile"
  | "geopackage"
  | "pmtiles"
  | "vector-tiles"
  | "xyz-raster"
  | "open-meteo";

export type Visibility = "private" | "hunting_party" | "shared";

export type SyncStatus =
  | "local"
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export type WaypointType =
  | "stand"
  | "blind"
  | "truck"
  | "camp"
  | "trail_camera"
  | "scrape"
  | "rub"
  | "bedding"
  | "food"
  | "water"
  | "track"
  | "sighting"
  | "scat"
  | "harvest"
  | "trailhead"
  | "gate"
  | "hazard"
  | "custom";

export type SpeciesId = "whitetail" | "mule_deer" | "elk" | "turkey";

export type PublicAccessCode = "open" | "restricted" | "closed" | "unknown";

export type WindClass = "favorable" | "marginal" | "unfavorable" | "unknown";

export type LegalConfidence = "authoritative" | "incomplete" | "unavailable";

export interface LonLat {
  longitude: number;
  latitude: number;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Provenance {
  datasetId: string;
  name: string;
  agency: string;
  sourceUrl: string;
  sourceIdentifier?: string;
  version?: string;
  retrievedAt: string;
  effectiveDate?: string;
  lastVerifiedAt?: string;
  license?: string;
  attribution: string;
  jurisdiction?: string;
}

export interface DatasetRecord {
  datasetId: string;
  name: string;
  agency: string;
  jurisdiction: string;
  species?: string;
  dataType: string;
  sourceUrl: string;
  serviceType: ServiceType;
  layerIdentifier?: string;
  version?: string;
  effectiveDate?: string;
  retrievedAt?: string;
  lastVerifiedAt?: string;
  license?: string;
  attribution: string;
  status: DatasetStatus;
  enabled: boolean;
  notes?: string;
}

export interface MissingEvidence {
  factor: string;
  reason: string;
}

export interface Uncertainty {
  confidence: number;
  missing: MissingEvidence[];
  warnings: string[];
}

export const BOUNDARY_CONFIDENCE_WARNING =
  "Boundary information may be incomplete or outdated. Verify access and posted property boundaries before entering. GIS lines do not override signs, fences, landowner instructions, official regulations, or current agency closures.";

export const VERIFY_REGULATION_WARNING =
  "Verify with the state wildlife agency before hunting.";

export const WAYPOINT_TYPES: readonly WaypointType[] = [
  "stand",
  "blind",
  "truck",
  "camp",
  "trail_camera",
  "scrape",
  "rub",
  "bedding",
  "food",
  "water",
  "track",
  "sighting",
  "scat",
  "harvest",
  "trailhead",
  "gate",
  "hazard",
  "custom",
] as const;

export const WAYPOINT_TYPE_LABELS: Record<WaypointType, string> = {
  stand: "Stand",
  blind: "Blind",
  truck: "Truck",
  camp: "Camp",
  trail_camera: "Trail camera",
  scrape: "Scrape",
  rub: "Rub",
  bedding: "Bedding",
  food: "Food",
  water: "Water",
  track: "Track",
  sighting: "Sighting",
  scat: "Scat",
  harvest: "Harvest",
  trailhead: "Trailhead",
  gate: "Gate",
  hazard: "Hazard",
  custom: "Custom",
};

export const OBSERVATION_WAYPOINT_TYPES: readonly WaypointType[] = [
  "sighting",
  "scat",
  "scrape",
  "rub",
  "track",
  "harvest",
];

export const SPECIES: readonly SpeciesId[] = [
  "whitetail",
  "mule_deer",
  "elk",
  "turkey",
] as const;

export const SPECIES_LABELS: Record<SpeciesId, string> = {
  whitetail: "Whitetail",
  mule_deer: "Mule deer",
  elk: "Elk",
  turkey: "Turkey",
};

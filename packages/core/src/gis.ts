import { pointInPolygon } from "./geo";
import {
  BOUNDARY_CONFIDENCE_WARNING,
  type BoundingBox,
  type DatasetRecord,
  type LonLat,
  type Provenance,
  type PublicAccessCode,
  type TruthLayer,
} from "./types";

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface GeoJsonFeature {
  type: "Feature";
  id?: string | number;
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown> | null;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface NormalizedPublicLandProperties {
  truthLayer: TruthLayer;
  name?: string;
  manager?: string;
  managerType?: string;
  localManager?: string;
  designation?: string;
  access: PublicAccessCode;
  accessRaw?: string;
  state?: string;
  sourceDataset?: string;
  sourceDate?: string;
  legalConfidence: "authoritative" | "incomplete" | "unavailable";
  boundaryWarning: string;
}

export interface IdentifyResult {
  truthLayer: "authoritative";
  found: boolean;
  status: "public" | "unknown";
  features: Array<{
    properties: NormalizedPublicLandProperties;
    provenance: Provenance;
    geometry: GeoJsonGeometry | null;
  }>;
  message: string;
  warnings: string[];
}

export interface GISProvider {
  id: string;
  name: string;
  agency?: string;
  getMetadata(): Promise<DatasetRecord>;
  getFeatures(bounds: BoundingBox): Promise<GeoJsonFeatureCollection>;
  identify?(point: LonLat): Promise<IdentifyResult>;
  refresh?(): Promise<void>;
}

const PADUS_ACCESS: Record<string, PublicAccessCode> = {
  OA: "open",
  RA: "restricted",
  XA: "closed",
  UK: "unknown",
};

export function mapPadusAccess(raw: unknown): PublicAccessCode {
  if (typeof raw !== "string") return "unknown";
  return PADUS_ACCESS[raw.toUpperCase()] ?? "unknown";
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function normalizePadusFeature(
  feature: GeoJsonFeature,
  provenance: Provenance,
): GeoJsonFeature {
  const props = feature.properties ?? {};
  const accessRaw = asString(props.Pub_Access);
  const normalized: NormalizedPublicLandProperties = {
    truthLayer: "authoritative",
    name: asString(props.Unit_Nm) ?? asString(props.Loc_Nm),
    manager: asString(props.Mang_Name),
    managerType: asString(props.Mang_Type),
    localManager: asString(props.Loc_Mang),
    designation: asString(props.Des_Tp),
    access: mapPadusAccess(accessRaw),
    accessRaw,
    state: asString(props.State_Nm),
    sourceDataset: asString(props.GIS_Src) ?? asString(props.Agg_Src),
    sourceDate: asString(props.Src_Date),
    legalConfidence: "authoritative",
    boundaryWarning: BOUNDARY_CONFIDENCE_WARNING,
  };
  return {
    type: "Feature",
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      ...props,
      ...normalized,
      provenance,
    },
  };
}

export function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function geometryContainsPoint(
  geometry: GeoJsonGeometry | null,
  point: LonLat,
): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(
      point,
      geometry.coordinates as ReadonlyArray<
        ReadonlyArray<readonly [number, number]>
      >,
    );
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as ReadonlyArray<
      ReadonlyArray<ReadonlyArray<readonly [number, number]>>
    >;
    return polygons.some((polygon) => pointInPolygon(point, polygon));
  }
  return false;
}

export function identifyFromCollection(
  collection: GeoJsonFeatureCollection,
  point: LonLat,
  provenance: Provenance,
): IdentifyResult {
  const hits = collection.features.filter((feature) =>
    geometryContainsPoint(feature.geometry, point),
  );
  if (hits.length === 0) {
    return {
      truthLayer: "authoritative",
      found: false,
      status: "unknown",
      features: [],
      message:
        "No authoritative public-land record intersects this location in the configured datasets. Absence of a record does not mean the land is private, public, or huntable.",
      warnings: [BOUNDARY_CONFIDENCE_WARNING],
    };
  }
  return {
    truthLayer: "authoritative",
    found: true,
    status: "public",
    features: hits.map((feature) => ({
      properties: feature.properties as unknown as NormalizedPublicLandProperties,
      provenance:
        (feature.properties?.provenance as Provenance | undefined) ?? provenance,
      geometry: feature.geometry,
    })),
    message: "Authoritative public-land record found. Confirm on the ground.",
    warnings: [BOUNDARY_CONFIDENCE_WARNING],
  };
}

export function unavailableIdentify(reason: string): IdentifyResult {
  return {
    truthLayer: "authoritative",
    found: false,
    status: "unknown",
    features: [],
    message: reason,
    warnings: [BOUNDARY_CONFIDENCE_WARNING],
  };
}

export interface ArcgisQueryOptions {
  sourceUrl: string;
  layerIdentifier?: string;
  bounds?: BoundingBox;
  point?: LonLat;
  outFields?: string;
  returnGeometry?: boolean;
  maxAllowableOffset?: number;
  resultRecordCount?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function arcgisQueryUrl(options: ArcgisQueryOptions): string {
  const layer = options.layerIdentifier ?? "0";
  const base = options.sourceUrl.replace(/\/+$/, "");
  const queryBase = /\/(MapServer|FeatureServer)\/\d+$/i.test(base)
    ? `${base}/query`
    : `${base}/${layer}/query`;
  const params = new URLSearchParams({
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: options.outFields ?? "*",
    returnGeometry: String(options.returnGeometry ?? true),
    f: "geojson",
    resultRecordCount: String(options.resultRecordCount ?? 200),
  });
  if (options.maxAllowableOffset !== undefined) {
    params.set("maxAllowableOffset", String(options.maxAllowableOffset));
  }
  if (options.bounds) {
    params.set(
      "geometry",
      `${options.bounds.west},${options.bounds.south},${options.bounds.east},${options.bounds.north}`,
    );
    params.set("geometryType", "esriGeometryEnvelope");
  } else if (options.point) {
    params.set(
      "geometry",
      `${options.point.longitude},${options.point.latitude}`,
    );
    params.set("geometryType", "esriGeometryPoint");
  } else {
    throw new Error("ArcGIS query requires bounds or a point.");
  }
  return `${queryBase}?${params.toString()}`;
}

export async function queryArcgisGeoJson(
  options: ArcgisQueryOptions,
): Promise<GeoJsonFeatureCollection> {
  const url = arcgisQueryUrl(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 35_000,
  );
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `GIS source returned HTTP ${response.status} for ${options.sourceUrl}`,
      );
    }
    const payload = (await response.json()) as
      | GeoJsonFeatureCollection
      | { error?: { message?: string } };
    if ("error" in payload && payload.error) {
      throw new Error(
        payload.error.message ?? "GIS source rejected the query.",
      );
    }
    if (
      !payload ||
      (payload as GeoJsonFeatureCollection).type !== "FeatureCollection"
    ) {
      throw new Error("GIS source did not return a GeoJSON FeatureCollection.");
    }
    return payload as GeoJsonFeatureCollection;
  } finally {
    clearTimeout(timer);
  }
}

export function createArcgisProvider(record: DatasetRecord): GISProvider {
  return {
    id: record.datasetId,
    name: record.name,
    agency: record.agency,
    async getMetadata() {
      return record;
    },
    async getFeatures(bounds) {
      if (!record.enabled || !record.sourceUrl) {
        throw new GisUnavailableError(
          record.datasetId,
          "Dataset is disabled or has no configured source URL.",
        );
      }
      const raw = await queryArcgisGeoJson({
        sourceUrl: record.sourceUrl,
        layerIdentifier: record.layerIdentifier,
        bounds,
        outFields:
          "Unit_Nm,Loc_Nm,Mang_Name,Mang_Type,Loc_Mang,Des_Tp,Pub_Access,State_Nm,GIS_Src,Src_Date,Agg_Src,GIS_Acres",
        maxAllowableOffset: 0.0003,
        resultRecordCount: 250,
      });
      const provenance = provenanceFromRecord(record, new Date().toISOString());
      return {
        type: "FeatureCollection",
        features: raw.features.map((feature) =>
          normalizePadusFeature(feature, provenance),
        ),
      };
    },
    async identify(point) {
      if (!record.enabled || !record.sourceUrl) {
        return unavailableIdentify(
          "Public-land dataset is not configured. Land status cannot be determined.",
        );
      }
      try {
        const pad = 0.008;
        const raw = await queryArcgisGeoJson({
          sourceUrl: record.sourceUrl,
          layerIdentifier: record.layerIdentifier,
          bounds: {
            west: point.longitude - pad,
            south: point.latitude - pad,
            east: point.longitude + pad,
            north: point.latitude + pad,
          },
          returnGeometry: true,
          resultRecordCount: 15,
          timeoutMs: 35_000,
        });
        const provenance = provenanceFromRecord(
          record,
          new Date().toISOString(),
        );
        const normalized = {
          type: "FeatureCollection" as const,
          features: raw.features.map((feature) =>
            normalizePadusFeature(feature, provenance),
          ),
        };
        const exact = identifyFromCollection(normalized, point, provenance);
        if (exact.found || normalized.features.length === 0) return exact;
        return {
          truthLayer: "authoritative",
          found: false,
          status: "unknown",
          features: normalized.features.map((feature) => ({
            properties:
              feature.properties as unknown as NormalizedPublicLandProperties,
            provenance:
              (feature.properties?.provenance as Provenance | undefined) ??
              provenance,
            geometry: feature.geometry,
          })),
          message:
            "No authoritative polygon contains this exact point. Nearby PAD-US records are listed for context only and do not establish access.",
          warnings: [BOUNDARY_CONFIDENCE_WARNING],
        };
      } catch (error) {
        return unavailableIdentify(
          error instanceof Error
            ? `Authoritative land lookup failed: ${error.message}`
            : "Authoritative land lookup failed.",
        );
      }
    },
  };
}

export function createGeoJsonProvider(
  record: DatasetRecord,
  collection: GeoJsonFeatureCollection,
): GISProvider {
  const provenance = provenanceFromRecord(
    record,
    record.retrievedAt ?? new Date().toISOString(),
  );
  const normalized: GeoJsonFeatureCollection = {
    type: "FeatureCollection",
    features: collection.features.map((feature) =>
      normalizePadusFeature(feature, provenance),
    ),
  };
  return {
    id: record.datasetId,
    name: record.name,
    agency: record.agency,
    async getMetadata() {
      return record;
    },
    async getFeatures() {
      return normalized;
    },
    async identify(point) {
      return identifyFromCollection(normalized, point, provenance);
    },
  };
}

export function provenanceFromRecord(
  record: DatasetRecord,
  retrievedAt: string,
): Provenance {
  return {
    datasetId: record.datasetId,
    name: record.name,
    agency: record.agency,
    sourceUrl: record.sourceUrl,
    sourceIdentifier: record.layerIdentifier,
    version: record.version,
    retrievedAt,
    effectiveDate: record.effectiveDate,
    lastVerifiedAt: record.lastVerifiedAt,
    license: record.license,
    attribution: record.attribution,
    jurisdiction: record.jurisdiction,
  };
}

export class GisUnavailableError extends Error {
  readonly datasetId: string;
  readonly truthLayer = "authoritative" as const;

  constructor(datasetId: string, message: string) {
    super(message);
    this.name = "GisUnavailableError";
    this.datasetId = datasetId;
  }
}

export function assertNoFabricatedLegalStatus(result: IdentifyResult): void {
  if (!result.found && result.status !== "unknown") {
    throw new Error(
      "AI safety: unidentified locations must remain status=unknown.",
    );
  }
  if (result.status === "public" && result.features.length === 0) {
    throw new Error(
      "AI safety: public status requires at least one authoritative feature.",
    );
  }
}

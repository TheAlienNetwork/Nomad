import type { BoundingBox, GeoJsonFeatureCollection } from "@huntos/core";
import { emptyFeatureCollection, queryArcgisGeoJson, type DatasetRecord } from "@huntos/core";

type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 10 * 60 * 1000;

export function boundsCacheKey(prefix: string, bounds: BoundingBox, extra = ""): string {
  const round = (value: number) => value.toFixed(3);
  return `${prefix}:${round(bounds.west)}:${round(bounds.south)}:${round(bounds.east)}:${round(bounds.north)}:${extra}`;
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T): void {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export async function queryOptionalGis(
  record: DatasetRecord | undefined,
  bounds: BoundingBox,
  extras: { resultRecordCount?: number | null; layerIdentifier?: string } = {},
): Promise<GeoJsonFeatureCollection | null> {
  if (!record?.enabled || !record.sourceUrl) return null;
  const layer = extras.layerIdentifier ?? record.layerIdentifier ?? "";
  const key = boundsCacheKey(`gis:${record.datasetId}`, bounds, layer);
  const cached = cacheGet<GeoJsonFeatureCollection>(key);
  if (cached) return cached;
  try {
    const collection = await queryArcgisGeoJson({
      sourceUrl: record.sourceUrl,
      layerIdentifier: extras.layerIdentifier ?? record.layerIdentifier,
      bounds,
      outFields: "*",
      returnGeometry: true,
      resultRecordCount: extras.resultRecordCount === undefined ? 120 : extras.resultRecordCount,
      timeoutMs: 15_000,
    });
    cacheSet(key, collection);
    return collection;
  } catch {
    return null;
  }
}

export function mergeFeatureCollections(
  collections: Array<GeoJsonFeatureCollection | null>,
): GeoJsonFeatureCollection {
  const features = collections.flatMap((item) => item?.features ?? []);
  if (features.length === 0) return emptyFeatureCollection();
  return { type: "FeatureCollection", features };
}

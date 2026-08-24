import {
  applyEnvOverrides,
  DATASET_REGISTRY,
  type DatasetRecord,
  type DatasetStatus,
} from "@huntos/core";

const overrides = new Map<string, Partial<DatasetRecord>>();
const health = new Map<
  string,
  { lastCheckedAt?: string; lastError?: string; featureCount?: number }
>();

export function listDatasets(): DatasetRecord[] {
  return applyEnvOverrides(DATASET_REGISTRY, process.env).map((record) => {
    const extra = overrides.get(record.datasetId);
    const check = health.get(record.datasetId);
    return {
      ...record,
      ...extra,
      lastVerifiedAt: check?.lastCheckedAt ?? record.lastVerifiedAt,
      status: extra?.status ?? record.status,
    };
  });
}

export function updateDataset(
  datasetId: string,
  patch: Partial<Pick<DatasetRecord, "enabled" | "sourceUrl" | "status">>,
): DatasetRecord | undefined {
  const current = listDatasets().find((item) => item.datasetId === datasetId);
  if (!current) return undefined;
  overrides.set(datasetId, { ...overrides.get(datasetId), ...patch });
  return listDatasets().find((item) => item.datasetId === datasetId);
}

export function recordHealth(
  datasetId: string,
  status: DatasetStatus,
  details: { lastError?: string; featureCount?: number } = {},
): void {
  health.set(datasetId, {
    lastCheckedAt: new Date().toISOString(),
    lastError: details.lastError,
    featureCount: details.featureCount,
  });
  const prev = overrides.get(datasetId) ?? {};
  overrides.set(datasetId, { ...prev, status });
}

export function getHealth(datasetId: string) {
  return health.get(datasetId);
}

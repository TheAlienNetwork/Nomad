import type { SyncStatus } from "./types";

export interface SyncRecord<T> {
  localId: string;
  serverId?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  version: number;
  payload: T;
  lastError?: string;
}

export interface SyncMutation<T> {
  localId: string;
  op: "upsert" | "delete";
  payload: T;
  updatedAt: string;
  version: number;
}

export function markPending<T>(record: SyncRecord<T>, now: string): SyncRecord<T> {
  return {
    ...record,
    updatedAt: now,
    version: record.version + 1,
    syncStatus: "pending",
  };
}

export function markSyncing<T>(record: SyncRecord<T>): SyncRecord<T> {
  return { ...record, syncStatus: "syncing" };
}

export function markSynced<T>(
  record: SyncRecord<T>,
  serverId: string,
  now: string,
): SyncRecord<T> {
  return {
    ...record,
    serverId,
    updatedAt: now,
    syncStatus: "synced",
    lastError: undefined,
  };
}

export function markFailed<T>(record: SyncRecord<T>, error: string): SyncRecord<T> {
  return { ...record, syncStatus: "failed", lastError: error };
}

export function markConflict<T>(record: SyncRecord<T>, error: string): SyncRecord<T> {
  return { ...record, syncStatus: "conflict", lastError: error };
}

export function retryDelayMs(attempt: number): number {
  const capped = Math.min(6, Math.max(0, attempt));
  return Math.round(1000 * 2 ** capped);
}

export function shouldRetry(status: SyncStatus, attempt: number): boolean {
  if (status === "conflict" || status === "synced") return false;
  return attempt < 8;
}

export function mergeForSync<T extends { updatedAt: string; version: number }>(
  local: T,
  remote: T,
): { winner: T; status: Extract<SyncStatus, "synced" | "conflict"> } {
  if (remote.version === local.version && remote.updatedAt === local.updatedAt) {
    return { winner: remote, status: "synced" };
  }
  if (remote.version > local.version) {
    return { winner: remote, status: "conflict" };
  }
  if (local.version > remote.version) {
    return { winner: local, status: "synced" };
  }
  return {
    winner: local.updatedAt >= remote.updatedAt ? local : remote,
    status: "conflict",
  };
}

export function outgoingQueue<T>(
  records: Array<SyncRecord<T>>,
): Array<SyncMutation<T>> {
  return records
    .filter((record) => record.syncStatus === "pending" || record.syncStatus === "failed")
    .map((record) => ({
      localId: record.localId,
      op: "upsert" as const,
      payload: record.payload,
      updatedAt: record.updatedAt,
      version: record.version,
    }));
}

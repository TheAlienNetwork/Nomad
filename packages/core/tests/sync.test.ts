import { describe, expect, it } from "vitest";
import {
  markFailed,
  markPending,
  markSynced,
  mergeForSync,
  outgoingQueue,
  retryDelayMs,
  shouldRetry,
} from "../src/sync";

describe("offline sync", () => {
  it("queues pending and failed records and never drops them", () => {
    const pending = markPending(
      {
        localId: "wp-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        syncStatus: "local",
        version: 1,
        payload: { name: "Truck" },
      },
      "2026-01-01T01:00:00.000Z",
    );
    const failed = markFailed(pending, "offline");
    const queue = outgoingQueue([pending, failed]);
    expect(queue).toHaveLength(2);
    expect(failed.payload).toEqual({ name: "Truck" });
  });

  it("retries failed syncs with backoff and keeps conflicted field data", () => {
    expect(shouldRetry("failed", 2)).toBe(true);
    expect(shouldRetry("conflict", 1)).toBe(false);
    expect(retryDelayMs(3)).toBe(8000);
    const merged = mergeForSync(
      { updatedAt: "2026-01-01T02:00:00.000Z", version: 2 },
      { updatedAt: "2026-01-01T03:00:00.000Z", version: 3 },
    );
    expect(merged.status).toBe("conflict");
    expect(merged.winner.version).toBe(3);
  });

  it("marks a successful upload as synced", () => {
    const synced = markSynced(
      {
        localId: "wp-1",
        createdAt: "t",
        updatedAt: "t",
        syncStatus: "syncing",
        version: 1,
        payload: { name: "Stand" },
      },
      "server-1",
      "2026-01-01T04:00:00.000Z",
    );
    expect(synced.syncStatus).toBe("synced");
    expect(synced.serverId).toBe("server-1");
  });
});

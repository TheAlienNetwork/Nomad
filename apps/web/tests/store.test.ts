import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("durable waypoint store", () => {
  afterEach(() => {
    delete process.env.HUNTOS_DATA_FILE;
  });

  it("keeps waypoints after a reload and forces private visibility", async () => {
    process.env.HUNTOS_DATA_FILE = join(mkdtempSync(join(tmpdir(), "huntos-")), "store.json");
    vi.resetModules();
    const { upsertWaypoint, listWaypoints } = await import("../src/server/store");
    const stored = await upsertWaypoint("user-1", {
      id: "wp-scat",
      userId: "ignored",
      type: "scat",
      name: "Fresh pile",
      latitude: 31.32,
      longitude: -95.15,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      photos: [],
      tags: [],
      visibility: "shared",
      syncStatus: "pending",
      version: 1,
    });
    expect(stored.visibility).toBe("private");
    expect(stored.userId).toBe("user-1");
    const listed = await listWaypoints("user-1");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Fresh pile");
  });
});

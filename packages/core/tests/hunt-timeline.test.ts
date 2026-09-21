import { describe, expect, it } from "vitest";
import { pathLengthMeters } from "../src/geo";
import {
  buildHuntTimeline,
  stopRecordingTrack,
} from "../src/hunt-timeline";
import type { HuntSession, Track, Waypoint } from "../src/entities";

const session: HuntSession = {
  id: "hunt-1",
  userId: "local-hunter",
  startedAt: "2026-08-24T05:22:00.000Z",
  endedAt: "2026-08-24T08:04:00.000Z",
  trackId: "track-1",
  visibility: "private",
  syncStatus: "pending",
  version: 1,
};

const scrape: Waypoint = {
  id: "wp-1",
  userId: "local-hunter",
  type: "scrape",
  name: "Oak scrape",
  latitude: 41.68,
  longitude: -79.15,
  createdAt: "2026-08-24T05:47:00.000Z",
  updatedAt: "2026-08-24T05:47:00.000Z",
  observedAt: "2026-08-24T05:47:00.000Z",
  photos: [],
  tags: [],
  visibility: "private",
  syncStatus: "pending",
  version: 1,
};

describe("hunt timeline", () => {
  it("builds a timestamped timeline from the session and waypoints", () => {
    const events = buildHuntTimeline(session, [scrape], { timeZone: "UTC" });
    expect(events.map((event) => event.label)).toEqual([
      "05:22 — Hunt started",
      "05:47 — Scrape recorded: Oak scrape",
      "08:04 — Hunt ended",
    ]);
  });

  it("ignores waypoints outside the hunt window", () => {
    const earlier: Waypoint = {
      ...scrape,
      id: "wp-old",
      observedAt: "2026-08-23T12:00:00.000Z",
      createdAt: "2026-08-23T12:00:00.000Z",
    };
    const events = buildHuntTimeline(session, [earlier], { timeZone: "UTC" });
    expect(events).toHaveLength(2);
    expect(events.some((event) => event.label.includes("Scrape"))).toBe(false);
  });
});

describe("track distance", () => {
  it("writes path length when a recording track is stopped", () => {
    const points = [
      { longitude: -79.15, latitude: 41.68, recordedAt: "2026-08-24T05:22:00.000Z" },
      { longitude: -79.14, latitude: 41.69, recordedAt: "2026-08-24T05:40:00.000Z" },
    ];
    const track: Track = {
      id: "track-1",
      userId: "local-hunter",
      huntId: "hunt-1",
      name: "Live track",
      startedAt: "2026-08-24T05:22:00.000Z",
      status: "recording",
      points,
      distanceMeters: 0,
      visibility: "private",
      syncStatus: "local",
      version: 1,
    };
    const stopped = stopRecordingTrack(track, "2026-08-24T08:04:00.000Z");
    expect(stopped.status).toBe("stopped");
    expect(stopped.distanceMeters).toBeCloseTo(pathLengthMeters(points), 5);
    expect(stopped.distanceMeters).toBeGreaterThan(1000);
  });
});

import Dexie, { type Table } from "dexie";
import type { HuntArea, OfflineRegion, Track, Waypoint } from "@huntos/core";

export interface LocalIdentity {
  id: string;
  createdAt: string;
  provider: "local";
}

class HuntOSDatabase extends Dexie {
  waypoints!: Table<Waypoint, string>;
  tracks!: Table<Track, string>;
  huntAreas!: Table<HuntArea, string>;
  offlineRegions!: Table<OfflineRegion, string>;
  identity!: Table<LocalIdentity, string>;

  constructor() {
    super("huntos");
    this.version(1).stores({
      waypoints: "id, userId, type, syncStatus, updatedAt",
      tracks: "id, userId, status, updatedAt",
      huntAreas: "id, userId, updatedAt",
      offlineRegions: "id, status",
      identity: "id",
    });
  }
}

export const db = new HuntOSDatabase();

export async function getOrCreateIdentity(): Promise<LocalIdentity> {
  const existing = await db.identity.toCollection().first();
  if (existing) return existing;
  const created: LocalIdentity = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    provider: "local",
  };
  await db.identity.put(created);
  return created;
}

export async function saveWaypoint(waypoint: Waypoint): Promise<void> {
  await db.waypoints.put(waypoint);
}

export async function allWaypoints(userId: string): Promise<Waypoint[]> {
  return db.waypoints.where("userId").equals(userId).toArray();
}

export async function saveTrack(track: Track): Promise<void> {
  await db.tracks.put(track);
}

export async function saveHuntArea(area: HuntArea): Promise<void> {
  await db.huntAreas.put(area);
}

export async function allHuntAreas(userId: string): Promise<HuntArea[]> {
  return db.huntAreas.where("userId").equals(userId).toArray();
}

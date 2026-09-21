import type { Waypoint } from "@huntos/core";

const waypoints = new Map<string, Waypoint[]>();

export function listWaypoints(userId: string): Waypoint[] {
  return waypoints.get(userId) ?? [];
}

export function upsertWaypoint(userId: string, waypoint: Waypoint): Waypoint {
  const existing = listWaypoints(userId);
  const index = existing.findIndex(
    (item) => item.id === waypoint.id || item.serverId === waypoint.id,
  );
  const stored: Waypoint = {
    ...waypoint,
    serverId: waypoint.serverId ?? waypoint.id,
    syncStatus: "synced",
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) {
    existing[index] = stored;
  } else {
    existing.push(stored);
  }
  waypoints.set(userId, existing);
  return stored;
}

export function replaceAll(userId: string, items: Waypoint[]): Waypoint[] {
  const stored = items.map((item) => upsertWaypoint(userId, item));
  return stored;
}

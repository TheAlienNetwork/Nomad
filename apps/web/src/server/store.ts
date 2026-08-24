import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HuntArea, Waypoint } from "@huntos/core";
import { WAYPOINT_TYPES } from "@huntos/core";
import { dataFilePath } from "./env";

export interface StoredUser {
  id: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  expiresAt: string;
}

interface StoreFile {
  users: StoredUser[];
  sessions: StoredSession[];
  waypoints: Waypoint[];
  huntAreas: HuntArea[];
}

const empty = (): StoreFile => ({
  users: [],
  sessions: [],
  waypoints: [],
  huntAreas: [],
});

let cache: StoreFile | null = null;
let writing: Promise<void> = Promise.resolve();

function load(): StoreFile {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(dataFilePath(), "utf8")) as StoreFile;
    cache.users ??= [];
    cache.sessions ??= [];
    cache.waypoints ??= [];
    cache.huntAreas ??= [];
    return cache;
  } catch {
    cache = empty();
    return cache;
  }
}

function persist(next: StoreFile): void {
  cache = next;
  const path = dataFilePath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(next), "utf8");
  renameSync(tmp, path);
}

async function update<T>(fn: (store: StoreFile) => T): Promise<T> {
  const run = writing.then(() => {
    const store = load();
    const result = fn(store);
    persist(store);
    return result;
  });
  writing = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function persistenceMode(): "file" {
  return "file";
}

export async function createUser(user: StoredUser): Promise<StoredUser> {
  return update((store) => {
    if (store.users.some((item) => item.email === user.email)) {
      throw new Error("An account with that email already exists.");
    }
    store.users.push(user);
    return user;
  });
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  return load().users.find((user) => user.email === email);
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  return load().users.find((user) => user.id === id);
}

export async function createSession(session: StoredSession): Promise<StoredSession> {
  return update((store) => {
    store.sessions = store.sessions.filter(
      (item) => item.expiresAt > new Date().toISOString(),
    );
    store.sessions.push(session);
    return session;
  });
}

export async function getSession(id: string): Promise<StoredSession | undefined> {
  const session = load().sessions.find((item) => item.id === id);
  if (!session || session.expiresAt <= new Date().toISOString()) return undefined;
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await update((store) => {
    store.sessions = store.sessions.filter((item) => item.id !== id);
  });
}

export function isWaypointType(value: string): boolean {
  return (WAYPOINT_TYPES as readonly string[]).includes(value);
}

export function sanitizeWaypoint(userId: string, waypoint: Waypoint): Waypoint {
  if (
    !Number.isFinite(waypoint.latitude) ||
    !Number.isFinite(waypoint.longitude) ||
    waypoint.latitude < -90 ||
    waypoint.latitude > 90 ||
    waypoint.longitude < -180 ||
    waypoint.longitude > 180
  ) {
    throw new Error("Waypoint coordinates are invalid.");
  }
  if (!isWaypointType(waypoint.type)) {
    throw new Error("Unknown waypoint type.");
  }
  return {
    ...waypoint,
    userId,
    name: waypoint.name.slice(0, 80),
    notes: waypoint.notes?.slice(0, 2000),
    visibility: "private",
    serverId: waypoint.serverId ?? waypoint.id,
    syncStatus: "synced",
    updatedAt: new Date().toISOString(),
  };
}

export async function listWaypoints(userId: string): Promise<Waypoint[]> {
  return load().waypoints.filter((item) => item.userId === userId);
}

export async function upsertWaypoint(
  userId: string,
  waypoint: Waypoint,
): Promise<Waypoint> {
  return update((store) => {
    const stored = sanitizeWaypoint(userId, waypoint);
    const index = store.waypoints.findIndex(
      (item) => item.id === stored.id || item.serverId === stored.id,
    );
    if (index >= 0) store.waypoints[index] = stored;
    else store.waypoints.push(stored);
    return stored;
  });
}

export async function replaceWaypoints(
  userId: string,
  waypoints: Waypoint[],
): Promise<Waypoint[]> {
  const stored: Waypoint[] = [];
  for (const waypoint of waypoints) {
    stored.push(await upsertWaypoint(userId, waypoint));
  }
  return stored;
}

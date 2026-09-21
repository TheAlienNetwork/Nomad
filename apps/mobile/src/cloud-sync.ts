import { useEffect, useSyncExternalStore } from 'react';
import type {
  HuntArea,
  HuntSession,
  SpeciesId,
  Track,
  TrackPoint,
  Waypoint,
  WaypointType,
} from '@huntos/core';

import {
  readSession,
  restDelete,
  restDeleteMissing,
  restDeleteOwned,
  restSelect,
  restSelectOptional,
  restUpsert,
  signInWithPassword,
  signOutSession,
  signUpWithPassword,
  signedSketchUrl,
  supabaseConfigured,
  uploadSketch,
  type CloudSession,
} from './supabase';
import {
  useFieldStore,
  isSeedGear,
  stripSeedGear,
  type BasemapId,
  type FieldCamera,
  type GearItem,
  type HuntPlan,
  type JournalNote,
  type LayerState,
  type MemoirPage,
  type MemoryPhoto,
  type PageSketch,
  type ScoutArea,
  type ScoutColor,
  type ScoutPoint,
} from './store';
import { isUsStateCode } from './state-hunting';
import { asGearGroup, groupForGearName, isEssentialGearName } from './gear-suggestions';

const MARK_CONFLICT = 'user_id,id';
const SEED_TRUCK_ID = 'seed-truck';

export type SessionView = {
  email: string | null;
  configured: boolean;
  ready: boolean;
};

const emptySession = (): SessionView => ({
  email: null,
  configured: supabaseConfigured(),
  ready: false,
});

let applyingRemote = false;
let allowRemoteDeletes = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let sessionView: SessionView = emptySession();
const sessionListeners = new Set<() => void>();
let authStarted = false;

function emitSession(): void {
  for (const listener of sessionListeners) listener();
}

function setSessionView(next: SessionView): void {
  sessionView = next;
  emitSession();
}

function startAuthListener(): void {
  if (authStarted) return;
  authStarted = true;
  void (async () => {
    if (!supabaseConfigured()) {
      setSessionView({ email: null, configured: false, ready: true });
      return;
    }
    try {
      const session = await readSession();
      setSessionView({
        email: session?.user.email ?? null,
        configured: true,
        ready: true,
      });
    } catch {
      setSessionView({ email: null, configured: true, ready: true });
    }
  })();
}

function applySession(session: CloudSession | null): void {
  setSessionView({
    email: session?.user.email ?? null,
    configured: supabaseConfigured(),
    ready: true,
  });
}

function isNewer(remote?: string | null, local?: string | null): boolean {
  return Date.parse(remote ?? '') > Date.parse(local ?? '');
}

export function useCloudSession(): SessionView {
  return useSyncExternalStore(
    (listener) => {
      startAuthListener();
      sessionListeners.add(listener);
      return () => {
        sessionListeners.delete(listener);
      };
    },
    () => sessionView,
    emptySession,
  );
}

async function waitForHydrate(): Promise<void> {
  if (useFieldStore.persist.hasHydrated()) return;
  await useFieldStore.persist.rehydrate();
}

export function useCloudSync(): void {
  const session = useCloudSession();
  const hydrated = useFieldStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated || !session.ready || !session.email) return;
    void pullRemote();
  }, [hydrated, session.ready, session.email]);

  useEffect(() => {
    if (!supabaseConfigured() || !hydrated) return;
    if (typeof useFieldStore.subscribe !== 'function') return;
    let lastKey = '';
    const unsub = useFieldStore.subscribe((state) => {
      if (applyingRemote) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const key = JSON.stringify({
        gear: state.gear,
        memories: state.memories,
        journalNotes: state.journalNotes,
        huntPlans: state.huntPlans,
        memoirPages: state.memoirPages,
        pageSketches: state.pageSketches,
        journalStyle: state.journalStyle,
        bookmarkedPageIds: state.bookmarkedPageIds,
        hiddenMemoirIds: state.hiddenMemoirIds,
        waypoints: state.waypoints,
        hunts: state.hunts,
        tracks: state.tracks,
        scoutAreas: state.scoutAreas,
        basemap: state.basemap,
        layers: state.layers,
        truckWaypointId: state.truckWaypointId,
        publicLandOpacity: state.publicLandOpacity,
        activeHuntId: state.activeHuntId,
      });
      if (key === lastKey) return;
      lastKey = key;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void pushRemote();
      }, 900);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [hydrated]);
}

export async function signIn(email: string, password: string): Promise<void> {
  const session = await signInWithPassword(email, password);
  applySession(session);
  await pullRemote();
}

export async function signUp(email: string, password: string): Promise<CloudSession | null> {
  const session = await signUpWithPassword(email, password);
  if (session) {
    applySession(session);
    await pullRemote();
    return session;
  }
  applySession(null);
  return null;
}

export async function deleteCloudSketch(id: string): Promise<void> {
  try {
    await restDelete('nomad_page_sketches', id);
  } catch {
    // Offline or unsigned-in — local remove still stands.
  }
}

export async function deleteCloudMemory(id: string): Promise<void> {
  try {
    await restDelete('nomad_memories', id);
  } catch {
    // Offline or unsigned-in — local remove still stands.
  }
}

export async function deleteCloudNote(id: string): Promise<void> {
  try {
    await restDelete('nomad_journal_notes', id);
  } catch {
    // Offline or unsigned-in — local remove still stands.
  }
}

export async function deleteCloudPlan(id: string): Promise<void> {
  try {
    await restDelete('nomad_hunt_plans', id);
  } catch {
    // Offline or unsigned-in — local remove still stands.
  }
}

export async function signOut(): Promise<void> {
  await signOutSession();
  allowRemoteDeletes = false;
  applySession(null);
}

export async function pullRemote(): Promise<void> {
  if (!supabaseConfigured()) return;
  await waitForHydrate();
  const session = await readSession();
  if (!session) return;
  const userId = session.user.id;

  try {
    const [gear, notes, plans, pages, prefs, sketches, waypoints, hunts, tracks, scouts, areas, cameras, memories] =
      await Promise.all([
        restSelect<RemoteGear>('nomad_gear', userId),
        restSelect<RemoteNote>('nomad_journal_notes', userId),
        restSelect<RemotePlan>('nomad_hunt_plans', userId),
        restSelect<RemotePage>('nomad_memoir_pages', userId),
        restSelect<RemotePref>('nomad_user_prefs', userId),
        restSelect<RemoteSketch>('nomad_page_sketches', userId),
        restSelectOptional<RemoteWaypoint>('nomad_waypoints', userId),
        restSelectOptional<RemoteHunt>('nomad_hunts', userId),
        restSelectOptional<RemoteTrack>('nomad_tracks', userId),
        restSelectOptional<RemoteScout>('nomad_scout_areas', userId),
        restSelectOptional<RemoteHuntArea>('nomad_hunt_areas', userId),
        restSelectOptional<RemoteCamera>('nomad_trail_cameras', userId),
        restSelectOptional<RemoteMemory>('nomad_memories', userId),
      ]);
    const state = useFieldStore.getState();
    const replaceMarks = Boolean(state.cloudUserId && state.cloudUserId !== userId);
    const pref = prefs[0];
    const mergedGear = mergeGear(state.gear ?? [], gear);
    const cleanedGear = stripSeedGear(mergedGear);
    applyingRemote = true;
    try {
      const nextHunts =
        hunts === undefined
          ? state.hunts
          : mergeHunts(state.hunts ?? [], hunts, userId, replaceMarks);
      const extras = pref?.extras;
      useFieldStore.setState({
        cloudUserId: userId,
        gear: cleanedGear,
        journalNotes: await resolveCoverPhotos(mergeNotes(state.journalNotes ?? [], notes), userId),
        huntPlans: mergePlans(state.huntPlans ?? [], plans),
        memoirPages: mergePages(state.memoirPages ?? {}, pages),
        pageSketches: await mergeSketches(state.pageSketches ?? {}, sketches),
        journalStyle:
          pref?.journal_style === 'field' || pref?.journal_style === 'memoir'
            ? pref.journal_style
            : state.journalStyle,
        bookmarkedPageIds: asStringArray(extras?.bookmarkedPageIds) ?? state.bookmarkedPageIds,
        hiddenMemoirIds: asStringArray(extras?.hiddenMemoirIds) ?? state.hiddenMemoirIds,
        hunterState: asStateCode(extras?.hunterState) ?? state.hunterState,
        profileStoragePath: asOptionalString(extras?.profilePhotoPath) ?? state.profileStoragePath,
        profilePhotoUri: await resolveProfilePhoto(
          asOptionalString(extras?.profilePhotoPath) ?? state.profileStoragePath,
          state.profilePhotoUri,
        ),
        waypoints:
          waypoints === undefined
            ? state.waypoints
            : await resolveWaypointPhotos(
                mergeWaypoints(state.waypoints ?? [], waypoints, userId, replaceMarks),
                userId,
              ),
        hunts: nextHunts,
        tracks:
          tracks === undefined
            ? state.tracks
            : mergeTracks(state.tracks ?? [], tracks, userId, replaceMarks),
        scoutAreas:
          scouts === undefined
            ? state.scoutAreas
            : mergeScouts(state.scoutAreas ?? [], scouts, replaceMarks),
        huntAreas:
          areas === undefined
            ? state.huntAreas
            : mergeHuntAreas(state.huntAreas ?? [], areas, userId, replaceMarks),
        trailCameras:
          cameras === undefined
            ? state.trailCameras
            : mergeCameras(state.trailCameras ?? [], cameras, userId, replaceMarks),
        memories:
          memories === undefined
            ? state.memories
            : await mergeMemories(state.memories ?? [], memories),
        activeHuntId: replaceMarks
          ? (nextHunts.find((hunt) => !hunt.endedAt)?.id ?? null)
          : state.activeHuntId,
        basemap: asBasemap(pref?.basemap) ?? state.basemap,
        layers: mergeLayers(state.layers, pref?.layers),
        truckWaypointId: pref?.truck_waypoint_id ?? state.truckWaypointId,
        publicLandOpacity:
          typeof pref?.public_land_opacity === 'number'
            ? pref.public_land_opacity
            : state.publicLandOpacity,
      });
      allowRemoteDeletes = waypoints !== undefined;
    } finally {
      applyingRemote = false;
    }
    if (cleanedGear.length !== mergedGear.length || isSeedGear(mergedGear)) {
      try {
        await Promise.all(
          mergedGear
            .filter((item) => !cleanedGear.some((row) => row.id === item.id))
            .map((item) => restDeleteOwned('nomad_gear', userId, item.id)),
        );
      } catch (error) {
        console.warn('Seed kit delete skipped:', error instanceof Error ? error.message : error);
      }
    }
    await pushRemote();
  } catch (error) {
    console.warn('Nomad cloud pull skipped:', error instanceof Error ? error.message : error);
  }
}

export async function pushRemote(): Promise<void> {
  if (!supabaseConfigured()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const session = await readSession();
  if (!session) return;
  const userId = session.user.id;
  const state = useFieldStore.getState();

  const gearRows = (state.gear ?? []).map((item) => ({
    id: item.id,
    user_id: userId,
    name: item.name,
    packed: item.packed,
    sort: item.sort,
    kit_group: item.group ?? groupForGearName(item.name),
    essential: item.essential ?? isEssentialGearName(item.name),
    updated_at: item.updatedAt,
  }));
  const noteRows = (state.journalNotes ?? []).map((note) => ({
    id: note.id,
    user_id: userId,
    title: note.title,
    notes: note.notes,
    created_at: note.createdAt,
    updated_at: note.updatedAt ?? note.createdAt,
    ink_color: note.inkColor ?? 'walnut',
    font_family: note.fontFamily ?? 'serif',
    kind: note.kind === 'title' ? 'title' : 'note',
    author: note.author ?? null,
    cover_storage_path: note.coverStoragePath ?? null,
    cover_sketch: Boolean(note.coverSketch),
    cover_x: note.coverX ?? null,
    cover_y: note.coverY ?? null,
    cover_width: note.coverWidth ?? null,
    cover_height: note.coverHeight ?? null,
  }));
  const planRows = (state.huntPlans ?? []).map((plan) => ({
    id: plan.id,
    user_id: userId,
    title: plan.title,
    planned_at: plan.plannedAt,
    species: plan.species ?? null,
    lat: plan.latitude,
    lng: plan.longitude,
    notes: plan.notes,
    ink_color: plan.inkColor ?? 'walnut',
    font_family: plan.fontFamily ?? 'serif',
    updated_at: plan.updatedAt ?? plan.plannedAt,
  }));
  const pageRows = Object.entries(state.memoirPages ?? {}).map(([huntId, page]) => ({
    hunt_id: huntId,
    user_id: userId,
    area_name: page.areaName,
    notes: page.notes,
    ink_color: page.inkColor ?? 'walnut',
    font_family: page.fontFamily ?? 'serif',
    updated_at: page.updatedAt ?? new Date().toISOString(),
  }));
  const fieldWaypoints = (state.waypoints ?? []).filter((point) => point.id !== SEED_TRUCK_ID);
  const waypointRows = fieldWaypoints.map((point) => ({
    id: point.id,
    user_id: userId,
    type: point.type,
    name: point.name,
    notes: point.notes ?? null,
    species: point.species ?? null,
    lat: point.latitude,
    lng: point.longitude,
    elevation: point.elevation ?? null,
    created_at: point.createdAt,
    updated_at: point.updatedAt,
    observed_at: point.observedAt ?? null,
    photos: point.photos ?? [],
    tags: point.tags ?? [],
  }));
  const huntRows = (state.hunts ?? []).map((hunt) => ({
    id: hunt.id,
    user_id: userId,
    species: hunt.species ?? null,
    started_at: hunt.startedAt,
    ended_at: hunt.endedAt ?? null,
    track_id: hunt.trackId ?? null,
    distance_meters: hunt.distanceMeters ?? null,
    notes: hunt.notes ?? null,
    updated_at: huntStamp(hunt),
  }));
  const trackRows = (state.tracks ?? []).map((track) => ({
    id: track.id,
    user_id: userId,
    hunt_id: track.huntId ?? null,
    name: track.name,
    started_at: track.startedAt,
    ended_at: track.endedAt ?? null,
    status: track.status,
    points: track.points ?? [],
    distance_meters: track.distanceMeters,
    updated_at: trackStamp(track),
  }));
  const scoutRows = (state.scoutAreas ?? []).map((area) => ({
    id: area.id,
    user_id: userId,
    name: area.name,
    color: area.color,
    radius_meters: area.radiusMeters,
    points: area.points ?? [],
    updated_at: area.updatedAt,
  }));
  const areaRows = (state.huntAreas ?? []).map((area) => ({
    id: area.id,
    user_id: userId,
    name: area.name,
    notes: area.notes ?? null,
    west: area.west,
    south: area.south,
    east: area.east,
    north: area.north,
    created_at: area.createdAt,
    updated_at: area.updatedAt,
  }));
  const cameraRows = (state.trailCameras ?? []).map((camera) => ({
    id: camera.id,
    user_id: userId,
    waypoint_id: camera.waypointId ?? null,
    name: camera.name,
    lat: camera.latitude,
    lng: camera.longitude,
    installed_at: camera.installedAt ?? null,
    last_checked: camera.lastChecked ?? null,
    status: camera.status,
    notes: camera.notes ?? null,
    photos: camera.photos ?? [],
    updated_at: camera.updatedAt,
  }));
  const prefRow = {
    user_id: userId,
    journal_style: state.journalStyle,
    basemap: state.basemap,
    layers: state.layers,
    truck_waypoint_id: state.truckWaypointId,
    public_land_opacity: state.publicLandOpacity,
    extras: {
      bookmarkedPageIds: state.bookmarkedPageIds ?? [],
      hiddenMemoirIds: state.hiddenMemoirIds ?? [],
      hunterState: state.hunterState,
      profilePhotoPath: state.profileStoragePath,
    },
  };

  try {
    try {
      await restUpsert('nomad_gear', gearRows);
    } catch {
      await restUpsert(
        'nomad_gear',
        gearRows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          name: row.name,
          packed: row.packed,
          sort: row.sort,
          updated_at: row.updated_at,
        })),
      );
    }
    await Promise.all([
      restUpsertNotes(noteRows),
      restUpsert('nomad_hunt_plans', planRows),
      restUpsert('nomad_memoir_pages', pageRows),
    ]);
    await restDeleteMissing('nomad_gear', userId, gearRows.map((row) => row.id));
    try {
      await restUpsert('nomad_user_prefs', [prefRow]);
    } catch {
      try {
        await restUpsert('nomad_user_prefs', [
          {
            user_id: userId,
            journal_style: state.journalStyle,
            basemap: state.basemap,
            layers: state.layers,
            truck_waypoint_id: state.truckWaypointId,
            public_land_opacity: state.publicLandOpacity,
          },
        ]);
      } catch {
        await restUpsert('nomad_user_prefs', [
          { user_id: userId, journal_style: state.journalStyle },
        ]);
      }
    }
    await pushSketches(userId, state.pageSketches ?? {});
    await pushCovers(userId, state.journalNotes ?? []);
    await pushMemories(userId, state.memories ?? []);
    await pushProfilePhoto(userId, state.profilePhotoUri, state.profileStoragePath);
    await pushWaypointPhotos(userId, state.waypoints ?? []);
    await pushFieldMarks(userId, {
      waypoints: waypointRows,
      hunts: huntRows,
      tracks: trackRows,
      scouts: scoutRows,
      areas: areaRows,
      cameras: cameraRows,
      waypointIds: fieldWaypoints.map((item) => item.id),
      huntIds: (state.hunts ?? []).map((item) => item.id),
      trackIds: (state.tracks ?? []).map((item) => item.id),
      scoutIds: (state.scoutAreas ?? []).map((item) => item.id),
      areaIds: (state.huntAreas ?? []).map((item) => item.id),
      cameraIds: (state.trailCameras ?? []).map((item) => item.id),
    });
  } catch (error) {
    console.warn('Nomad cloud push skipped:', error instanceof Error ? error.message : error);
  }
}

async function restUpsertNotes(noteRows: object[]): Promise<void> {
  try {
    await restUpsert('nomad_journal_notes', noteRows);
  } catch {
    await restUpsert(
      'nomad_journal_notes',
      noteRows.map((row) => {
        const next = { ...(row as Record<string, unknown>) };
        delete next.kind;
        delete next.author;
        delete next.cover_storage_path;
        delete next.cover_sketch;
        delete next.cover_x;
        delete next.cover_y;
        delete next.cover_width;
        delete next.cover_height;
        return next;
      }),
    );
  }
}

async function pushFieldMarks(
  userId: string,
  rows: {
    waypoints: object[];
    hunts: object[];
    tracks: object[];
    scouts: object[];
    areas: object[];
    cameras: object[];
    waypointIds: string[];
    huntIds: string[];
    trackIds: string[];
    scoutIds: string[];
    areaIds: string[];
    cameraIds: string[];
  },
): Promise<void> {
  try {
    await Promise.all([
      restUpsert('nomad_waypoints', rows.waypoints, MARK_CONFLICT),
      restUpsert('nomad_hunts', rows.hunts, MARK_CONFLICT),
      restUpsert('nomad_tracks', rows.tracks, MARK_CONFLICT),
      restUpsert('nomad_scout_areas', rows.scouts, MARK_CONFLICT),
    ]);
    try {
      await Promise.all([
        restUpsert('nomad_hunt_areas', rows.areas, MARK_CONFLICT),
        restUpsert('nomad_trail_cameras', rows.cameras, MARK_CONFLICT),
      ]);
    } catch (error) {
      console.warn('Nomad hunt-area/camera push skipped:', error instanceof Error ? error.message : error);
    }
    if (!allowRemoteDeletes) return;
    await Promise.all([
      restDeleteMissing('nomad_waypoints', userId, rows.waypointIds),
      restDeleteMissing('nomad_hunts', userId, rows.huntIds),
      restDeleteMissing('nomad_tracks', userId, rows.trackIds),
      restDeleteMissing('nomad_scout_areas', userId, rows.scoutIds),
      restDeleteMissing('nomad_hunt_areas', userId, rows.areaIds),
      restDeleteMissing('nomad_trail_cameras', userId, rows.cameraIds),
    ]);
  } catch (error) {
    console.warn('Nomad field-mark push skipped:', error instanceof Error ? error.message : error);
  }
}

async function pushSketches(userId: string, pages: Record<string, PageSketch[]>): Promise<void> {
  const rows = [];
  for (const sketches of Object.values(pages)) {
    for (const sketch of sketches ?? []) {
      const storagePath = sketch.storagePath ?? `${userId}/${sketch.id}.png`;
      if (sketch.uri.startsWith('data:') || sketch.uri.startsWith('file:')) {
        try {
          const blob = await (await fetch(sketch.uri)).blob();
          await uploadSketch(storagePath, blob);
        } catch (error) {
          console.warn('Sketch upload skipped:', error instanceof Error ? error.message : error);
          continue;
        }
      }
      rows.push({
        id: sketch.id,
        user_id: userId,
        page_id: sketch.pageId,
        storage_path: storagePath,
        x: sketch.x,
        y: sketch.y,
        width: sketch.width,
        height: sketch.height,
        updated_at: sketch.updatedAt,
      });
    }
  }
  await restUpsert('nomad_page_sketches', rows);
}

async function pushMemories(userId: string, memories: MemoryPhoto[]): Promise<void> {
  const rows = [];
  const uploaded: Array<{ id: string; path: string }> = [];
  for (const memory of memories) {
    const storagePath = memory.storagePath || `${userId}/memories/${memory.id}.jpg`;
    if (memory.uri.startsWith('data:') || memory.uri.startsWith('file:')) {
      try {
        const blob = await (await fetch(memory.uri)).blob();
        await uploadSketch(storagePath, blob);
        uploaded.push({ id: memory.id, path: storagePath });
      } catch (error) {
        console.warn('Memory upload skipped:', error instanceof Error ? error.message : error);
        continue;
      }
    }
    rows.push({
      id: memory.id,
      user_id: userId,
      storage_path: memory.storagePath || storagePath,
      caption: memory.caption ?? null,
      lat: memory.latitude ?? null,
      lng: memory.longitude ?? null,
      taken_at: memory.takenAt,
      place_label: memory.placeLabel ?? null,
      width: memory.width ?? null,
      height: memory.height ?? null,
      updated_at: memory.updatedAt,
    });
  }
  if (rows.length === 0 && memories.length === 0) {
    try {
      await restDeleteMissing('nomad_memories', userId, []);
    } catch {
      // Table may not exist yet.
    }
    return;
  }
  try {
    await restUpsert('nomad_memories', rows);
    await restDeleteMissing('nomad_memories', userId, rows.map((row) => row.id));
  } catch (error) {
    console.warn('Nomad memory push skipped:', error instanceof Error ? error.message : error);
    return;
  }
  if (uploaded.length === 0) return;
  applyingRemote = true;
  try {
    useFieldStore.setState({
      memories: useFieldStore.getState().memories.map((item) => {
        const match = uploaded.find((row) => row.id === item.id);
        return match ? { ...item, storagePath: match.path } : item;
      }),
    });
  } finally {
    applyingRemote = false;
  }
}

async function mergeMemories(local: MemoryPhoto[], remote: RemoteMemory[]): Promise<MemoryPhoto[]> {
  const byId = new Map((local ?? []).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      let uri = current?.uri ?? '';
      if (row.storage_path) {
        try {
          uri = (await signedSketchUrl(row.storage_path)) ?? uri;
        } catch {
          uri = current?.uri ?? uri;
        }
      }
      byId.set(row.id, {
        id: row.id,
        uri,
        storagePath: row.storage_path,
        caption: row.caption ?? undefined,
        latitude: row.lat ?? undefined,
        longitude: row.lng ?? undefined,
        takenAt: row.taken_at,
        placeLabel: row.place_label ?? undefined,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        updatedAt: row.updated_at,
      });
    }
  }
  return [...byId.values()].sort((left, right) => (left.takenAt < right.takenAt ? 1 : -1));
}

type RemoteGear = {
  id: string;
  name: string;
  packed: boolean;
  sort: number;
  kit_group?: string | null;
  essential?: boolean | null;
  updated_at: string;
};

type RemoteMemory = {
  id: string;
  storage_path: string;
  caption?: string | null;
  lat?: number | null;
  lng?: number | null;
  taken_at: string;
  place_label?: string | null;
  width?: number | null;
  height?: number | null;
  updated_at: string;
};

type RemoteNote = {
  id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  ink_color?: string;
  font_family?: string;
  kind?: string | null;
  author?: string | null;
  cover_storage_path?: string | null;
  cover_sketch?: boolean | null;
  cover_x?: number | null;
  cover_y?: number | null;
  cover_width?: number | null;
  cover_height?: number | null;
};

type RemotePlan = {
  id: string;
  title: string;
  planned_at: string;
  species?: string | null;
  lat: number;
  lng: number;
  notes: string;
  ink_color?: string;
  font_family?: string;
  updated_at: string;
};

type RemotePage = {
  hunt_id: string;
  area_name: string;
  notes: string;
  ink_color?: string;
  font_family?: string;
  updated_at: string;
};

type RemotePref = {
  journal_style?: string;
  basemap?: string | null;
  layers?: unknown;
  truck_waypoint_id?: string | null;
  public_land_opacity?: number | null;
  extras?: {
    bookmarkedPageIds?: unknown;
    hiddenMemoirIds?: unknown;
    hunterState?: unknown;
    profilePhotoPath?: unknown;
  } | null;
};

type RemoteWaypoint = {
  id: string;
  type: string;
  name: string;
  notes?: string | null;
  species?: string | null;
  lat: number;
  lng: number;
  elevation?: number | null;
  created_at: string;
  updated_at: string;
  observed_at?: string | null;
  photos?: unknown;
  tags?: unknown;
};

type RemoteHunt = {
  id: string;
  species?: string | null;
  started_at: string;
  ended_at?: string | null;
  track_id?: string | null;
  distance_meters?: number | null;
  notes?: string | null;
  updated_at?: string;
};

type RemoteTrack = {
  id: string;
  hunt_id?: string | null;
  name: string;
  started_at: string;
  ended_at?: string | null;
  status: string;
  points?: unknown;
  distance_meters?: number | null;
  updated_at?: string;
};

type RemoteScout = {
  id: string;
  name: string;
  color: string;
  radius_meters: number;
  points?: unknown;
  updated_at: string;
};

type RemoteHuntArea = {
  id: string;
  name: string;
  notes?: string | null;
  west: number;
  south: number;
  east: number;
  north: number;
  created_at: string;
  updated_at: string;
};

type RemoteCamera = {
  id: string;
  waypoint_id?: string | null;
  name: string;
  lat: number;
  lng: number;
  installed_at?: string | null;
  last_checked?: string | null;
  status: string;
  notes?: string | null;
  photos?: unknown;
  updated_at: string;
};

type RemoteSketch = {
  id: string;
  page_id: string;
  storage_path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  updated_at: string;
};

function mergeGear(local: GearItem[], remote: RemoteGear[]): GearItem[] {
  const byId = new Map((local ?? []).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        packed: row.packed,
        sort: row.sort,
        group: asGearGroup(row.kit_group) === 'Custom' ? groupForGearName(row.name) : asGearGroup(row.kit_group),
        essential: row.essential ?? isEssentialGearName(row.name),
        updatedAt: row.updated_at,
      });
    }
  }
  return [...byId.values()].sort((left, right) => left.sort - right.sort);
}

function mergeNotes(local: JournalNote[], remote: RemoteNote[]): JournalNote[] {
  const byId = new Map((local ?? []).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        inkColor: asInk(row.ink_color),
        fontFamily: asFont(row.font_family),
        kind: row.kind === 'title' || current?.kind === 'title' ? 'title' : current?.kind ?? 'note',
        author: row.author ?? current?.author,
        coverUri: current?.coverUri,
        coverPhotoUri: current?.coverPhotoUri,
        coverSketch: row.cover_sketch ?? current?.coverSketch,
        coverStoragePath: row.cover_storage_path ?? current?.coverStoragePath,
        coverX: row.cover_x ?? current?.coverX,
        coverY: row.cover_y ?? current?.coverY,
        coverWidth: row.cover_width ?? current?.coverWidth,
        coverHeight: row.cover_height ?? current?.coverHeight,
      });
    }
  }
  return [...byId.values()].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

async function resolveCoverPhotos(notes: JournalNote[], userId: string): Promise<JournalNote[]> {
  return Promise.all(
    notes.map(async (note) => {
      if (note.kind !== 'title') return note;
      if (note.coverUri?.startsWith('data:') || note.coverUri?.startsWith('file:')) return note;
      const path = note.coverStoragePath ?? `${userId}/cover-${note.id}.png`;
      const signed = await signedSketchUrl(path);
      if (!signed) return note;
      return { ...note, coverUri: signed, coverStoragePath: path };
    }),
  );
}

async function pushCovers(userId: string, notes: JournalNote[]): Promise<void> {
  const uploaded: Array<{ id: string; path: string }> = [];
  for (const note of notes) {
    if (note.kind !== 'title' || !note.coverUri) continue;
    if (note.coverUri.startsWith('http')) continue;
    if (note.coverStoragePath && !note.coverUri.startsWith('data:') && !note.coverUri.startsWith('file:')) {
      continue;
    }
    const path = `${userId}/cover-${note.id}.png`;
    try {
      const blob = await (await fetch(note.coverUri)).blob();
      await uploadSketch(path, blob);
      uploaded.push({ id: note.id, path });
    } catch (error) {
      console.warn('Cover upload skipped:', error instanceof Error ? error.message : error);
    }
  }
  if (uploaded.length === 0) return;
  applyingRemote = true;
  try {
    useFieldStore.setState({
      journalNotes: useFieldStore.getState().journalNotes.map((note) => {
        const match = uploaded.find((item) => item.id === note.id);
        return match ? { ...note, coverStoragePath: match.path } : note;
      }),
    });
  } finally {
    applyingRemote = false;
  }
}

function mergePlans(local: HuntPlan[], remote: RemotePlan[]): HuntPlan[] {
  const byId = new Map((local ?? []).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        plannedAt: row.planned_at,
        species: (row.species ?? undefined) as HuntPlan['species'],
        latitude: row.lat,
        longitude: row.lng,
        notes: row.notes,
        inkColor: asInk(row.ink_color),
        fontFamily: asFont(row.font_family),
        updatedAt: row.updated_at,
      });
    }
  }
  return [...byId.values()];
}

function mergePages(
  local: Record<string, MemoirPage>,
  remote: RemotePage[],
): Record<string, MemoirPage> {
  const next = { ...local };
  for (const row of remote) {
    const current = next[row.hunt_id];
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      next[row.hunt_id] = {
        areaName: row.area_name,
        notes: row.notes,
        inkColor: asInk(row.ink_color),
        fontFamily: asFont(row.font_family),
        updatedAt: row.updated_at,
      };
    }
  }
  return next;
}

async function mergeSketches(
  local: Record<string, PageSketch[]>,
  remote: RemoteSketch[],
): Promise<Record<string, PageSketch[]>> {
  const next: Record<string, PageSketch[]> = { ...local };
  for (const row of remote) {
    const current = (next[row.page_id] ?? []).find((item) => item.id === row.id);
    if (current && !isNewer(row.updated_at, current.updatedAt)) continue;
    let uri = current?.uri ?? '';
    const signed = await signedSketchUrl(row.storage_path);
    if (signed) uri = signed;
    const sketch: PageSketch = {
      id: row.id,
      pageId: row.page_id,
      uri,
      storagePath: row.storage_path,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      updatedAt: row.updated_at,
    };
    next[row.page_id] = [...(next[row.page_id] ?? []).filter((item) => item.id !== row.id), sketch];
  }
  return next;
}

function asInk(value?: string): JournalNote['inkColor'] {
  switch (value) {
    case 'walnut':
    case 'black':
    case 'rust':
    case 'blue':
    case 'green':
    case 'sepia':
    case 'pencil':
      return value;
    default:
      return 'walnut';
  }
}

function asFont(value?: string): JournalNote['fontFamily'] {
  switch (value) {
    case 'serif':
    case 'serifAlt':
    case 'sans':
    case 'mono':
    case 'script':
    case 'slab':
      return value;
    default:
      return 'serif';
  }
}

function huntStamp(hunt: HuntSession): string {
  return hunt.endedAt ?? hunt.startedAt;
}

function trackStamp(track: Track): string {
  const last = track.points[track.points.length - 1]?.recordedAt;
  return track.endedAt ?? last ?? track.startedAt;
}

function asJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const next = value.filter((item): item is string => typeof item === 'string');
  return next;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStateCode(value: unknown): string | undefined {
  return typeof value === 'string' && isUsStateCode(value) ? value : undefined;
}

async function resolveProfilePhoto(
  path: string | undefined,
  local: string | undefined,
): Promise<string | undefined> {
  if (local?.startsWith('data:') || local?.startsWith('file:')) return local;
  if (!path) return local;
  try {
    return (await signedSketchUrl(path)) ?? local;
  } catch {
    return local;
  }
}

async function pushProfilePhoto(
  userId: string,
  uri: string | undefined,
  storagePath: string | undefined,
): Promise<void> {
  if (!uri || uri.startsWith('http')) return;
  if (storagePath && !uri.startsWith('data:') && !uri.startsWith('file:')) return;
  const path = `${userId}/profile.jpg`;
  try {
    const blob = await (await fetch(uri)).blob();
    await uploadSketch(path, blob);
    applyingRemote = true;
    try {
      useFieldStore.setState({ profileStoragePath: path });
    } finally {
      applyingRemote = false;
    }
  } catch (error) {
    console.warn('Profile photo upload skipped:', error instanceof Error ? error.message : error);
  }
}

function mergeWaypoints(
  local: Waypoint[],
  remote: RemoteWaypoint[],
  userId: string,
  replaceLocal: boolean,
): Waypoint[] {
  const source = replaceLocal
    ? []
    : remote.length > 0
      ? local.filter((item) => item.id !== SEED_TRUCK_ID)
      : local;
  const byId = new Map(source.map((item) => [item.id, item]));
  for (const row of remote) {
    if (row.id === SEED_TRUCK_ID) continue;
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        userId,
        type: asWaypointType(row.type),
        name: row.name,
        notes: row.notes ?? undefined,
        species: asSpecies(row.species),
        latitude: row.lat,
        longitude: row.lng,
        elevation: row.elevation,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        observedAt: row.observed_at ?? undefined,
        photos: asJsonArray<string>(row.photos),
        tags: asJsonArray<string>(row.tags),
        visibility: 'private',
        syncStatus: 'synced',
        version: current ? current.version + 1 : 1,
      });
    }
  }
  return [...byId.values()];
}

function mergeHunts(
  local: HuntSession[],
  remote: RemoteHunt[],
  userId: string,
  replaceLocal: boolean,
): HuntSession[] {
  const byId = new Map((replaceLocal ? [] : local).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at ?? row.ended_at ?? row.started_at, huntStamp(current))) {
      byId.set(row.id, {
        id: row.id,
        userId,
        species: asSpecies(row.species),
        startedAt: row.started_at,
        endedAt: row.ended_at ?? undefined,
        trackId: row.track_id ?? undefined,
        distanceMeters: row.distance_meters ?? undefined,
        notes: row.notes ?? undefined,
        visibility: 'private',
        syncStatus: 'synced',
        version: current ? current.version + 1 : 1,
      });
    }
  }
  return [...byId.values()].sort((left, right) => (left.startedAt < right.startedAt ? 1 : -1));
}

function mergeTracks(
  local: Track[],
  remote: RemoteTrack[],
  userId: string,
  replaceLocal: boolean,
): Track[] {
  const byId = new Map((replaceLocal ? [] : local).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    const remoteAt = row.updated_at ?? row.ended_at ?? row.started_at;
    const localAt = current ? trackStamp(current) : undefined;
    if (!current || isNewer(remoteAt, localAt)) {
      byId.set(row.id, {
        id: row.id,
        userId,
        huntId: row.hunt_id ?? undefined,
        name: row.name,
        startedAt: row.started_at,
        endedAt: row.ended_at ?? undefined,
        status: asTrackStatus(row.status),
        points: asJsonArray<TrackPoint>(row.points),
        distanceMeters: row.distance_meters ?? 0,
        visibility: 'private',
        syncStatus: 'synced',
        version: current ? current.version + 1 : 1,
      });
    }
  }
  return [...byId.values()];
}

function mergeScouts(local: ScoutArea[], remote: RemoteScout[], replaceLocal: boolean): ScoutArea[] {
  const byId = new Map((replaceLocal ? [] : local).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        color: asScoutColor(row.color),
        radiusMeters: row.radius_meters,
        points: asJsonArray<ScoutPoint>(row.points),
        updatedAt: row.updated_at,
      });
    }
  }
  return [...byId.values()].sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
}

function mergeHuntAreas(
  local: HuntArea[],
  remote: RemoteHuntArea[],
  userId: string,
  replaceLocal: boolean,
): HuntArea[] {
  const byId = new Map((replaceLocal ? [] : local).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        userId,
        name: row.name,
        notes: row.notes ?? undefined,
        west: row.west,
        south: row.south,
        east: row.east,
        north: row.north,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        visibility: 'private',
        syncStatus: 'synced',
        version: current ? current.version + 1 : 1,
      });
    }
  }
  return [...byId.values()];
}

function mergeCameras(
  local: FieldCamera[],
  remote: RemoteCamera[],
  userId: string,
  replaceLocal: boolean,
): FieldCamera[] {
  const byId = new Map((replaceLocal ? [] : local).map((item) => [item.id, item]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || isNewer(row.updated_at, current.updatedAt)) {
      byId.set(row.id, {
        id: row.id,
        userId,
        waypointId: row.waypoint_id ?? undefined,
        name: row.name,
        latitude: row.lat,
        longitude: row.lng,
        installedAt: row.installed_at ?? undefined,
        lastChecked: row.last_checked ?? undefined,
        status: row.status === 'inactive' ? 'inactive' : row.status === 'unknown' ? 'unknown' : 'active',
        notes: row.notes ?? undefined,
        photos: asJsonArray<string>(row.photos),
        visibility: 'private',
        syncStatus: 'synced',
        version: current ? current.version + 1 : 1,
        updatedAt: row.updated_at,
      });
    }
  }
  return [...byId.values()];
}

async function pushWaypointPhotos(userId: string, waypoints: Waypoint[]): Promise<void> {
  const next: Record<string, string[]> = {};
  for (const point of waypoints) {
    const photos: string[] = [];
    let changed = false;
    for (const [index, photo] of point.photos.entries()) {
      if (!photo.startsWith('data:') && !photo.startsWith('file:')) {
        photos.push(photo);
        continue;
      }
      const path = `${userId}/wp-${point.id}-${index}.jpg`;
      try {
        const blob = await (await fetch(photo)).blob();
        await uploadSketch(path, blob);
        photos.push(path);
        changed = true;
      } catch (error) {
        console.warn('Waypoint photo upload skipped:', error instanceof Error ? error.message : error);
        photos.push(photo);
      }
    }
    if (changed) next[point.id] = photos;
  }
  if (Object.keys(next).length === 0) return;
  applyingRemote = true;
  try {
    useFieldStore.setState({
      waypoints: useFieldStore.getState().waypoints.map((point) =>
        next[point.id] ? { ...point, photos: next[point.id] ?? point.photos } : point,
      ),
    });
  } finally {
    applyingRemote = false;
  }
}

async function resolveWaypointPhotos(waypoints: Waypoint[], userId: string): Promise<Waypoint[]> {
  return Promise.all(
    waypoints.map(async (point) => {
      const photos = await Promise.all(
        point.photos.map(async (photo) => {
          if (photo.startsWith('data:') || photo.startsWith('file:') || photo.startsWith('http')) {
            return photo;
          }
          return (await signedSketchUrl(photo.startsWith(userId) ? photo : `${userId}/${photo}`)) ?? photo;
        }),
      );
      return { ...point, photos };
    }),
  );
}

function mergeLayers(local: LayerState, remote: unknown): LayerState {
  if (!remote || typeof remote !== 'object') return local;
  const next = { ...local };
  for (const key of Object.keys(next) as (keyof LayerState)[]) {
    const value = (remote as Record<string, unknown>)[key];
    if (typeof value === 'boolean') next[key] = value;
  }
  return next;
}

function asBasemap(value?: string | null): BasemapId | undefined {
  switch (value) {
    case 'satellite':
    case 'topo':
    case 'hybrid':
    case 'streets':
    case 'naip':
    case 'relief':
      return value;
    default:
      return undefined;
  }
}

function asWaypointType(value: string): WaypointType {
  switch (value) {
    case 'stand':
    case 'blind':
    case 'truck':
    case 'camp':
    case 'trail_camera':
    case 'scrape':
    case 'rub':
    case 'bedding':
    case 'food':
    case 'water':
    case 'track':
    case 'sighting':
    case 'scat':
    case 'harvest':
    case 'trailhead':
    case 'gate':
    case 'hazard':
    case 'custom':
      return value;
    default:
      return 'custom';
  }
}

function asSpecies(value?: string | null): SpeciesId | undefined {
  switch (value) {
    case 'whitetail':
    case 'mule_deer':
    case 'elk':
    case 'turkey':
    case 'feral_hog':
    case 'dove':
    case 'waterfowl':
    case 'sika_deer':
    case 'axis_deer':
    case 'nilgai':
      return value;
    default:
      return undefined;
  }
}

function asTrackStatus(value: string): Track['status'] {
  switch (value) {
    case 'recording':
    case 'paused':
    case 'stopped':
      return value;
    default:
      return 'stopped';
  }
}

function asScoutColor(value: string): ScoutColor {
  switch (value) {
    case 'rust':
    case 'gold':
    case 'teal':
    case 'violet':
      return value;
    default:
      return 'rust';
  }
}

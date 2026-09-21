import { huntArea } from '@/constants/sample-data';
import type { MemoirLeaf } from '@/components/memoir-page';
import type { HuntPlan, JournalNote, MemoirPage } from '@/src/store';
import type { HuntSession, Waypoint } from '@huntos/core';

export function buildLeaves(
  hunts: HuntSession[],
  plans: HuntPlan[],
  notes: JournalNote[],
  pages: Record<string, MemoirPage>,
  waypoints: Waypoint[],
  hiddenIds: string[],
): MemoirLeaf[] {
  const hidden = new Set(hiddenIds);
  const huntLeaves: MemoirLeaf[] = (hunts ?? []).map((hunt) => ({
    kind: 'hunt',
    id: `hunt:${hunt.id}`,
    dateIso: hunt.startedAt,
    title: pages[hunt.id]?.areaName ?? huntArea.name,
    notes: pages[hunt.id]?.notes ?? '',
    session: hunt,
    waypoints,
    inkColor: pages[hunt.id]?.inkColor,
    fontFamily: pages[hunt.id]?.fontFamily,
    typeScale: pages[hunt.id]?.typeScale,
  }));
  const planLeaves: MemoirLeaf[] = (plans ?? []).map((plan) => ({
    kind: 'plan',
    id: `plan:${plan.id}`,
    dateIso: plan.plannedAt,
    title: plan.title,
    notes: plan.notes,
    species: plan.species,
    inkColor: plan.inkColor,
    fontFamily: plan.fontFamily,
    typeScale: plan.typeScale,
  }));
  const noteLeaves: MemoirLeaf[] = (notes ?? []).map((note) => ({
    kind: note.kind === 'title' ? 'title' : 'note',
    id: `note:${note.id}`,
    dateIso: note.createdAt,
    title: note.title,
    notes: note.notes,
    author: note.author,
    coverUri: note.coverUri,
    coverSketch: note.coverSketch,
    coverX: note.coverX,
    coverY: note.coverY,
    coverWidth: note.coverWidth,
    coverHeight: note.coverHeight,
    inkColor: note.inkColor,
    fontFamily: note.fontFamily,
    typeScale: note.typeScale,
  }));
  const newestCover = noteLeaves
    .filter((leaf) => leaf.kind === 'title')
    .sort((left, right) => (left.dateIso < right.dateIso ? 1 : -1))[0];
  const rest = [...noteLeaves.filter((leaf) => leaf.kind !== 'title'), ...planLeaves, ...huntLeaves].sort(
    (left, right) => (left.dateIso < right.dateIso ? 1 : left.dateIso > right.dateIso ? -1 : 0),
  );
  return [...(newestCover ? [newestCover] : []), ...rest].filter((leaf) => !hidden.has(leaf.id));
}

export function contentsLabel(leaf: MemoirLeaf): string {
  switch (leaf.kind) {
    case 'title':
      return leaf.title.trim() || 'Cover';
    case 'hunt':
    case 'note':
    case 'plan':
      return leaf.title.trim() || 'Untitled';
    default: {
      const _exhaustive: never = leaf.kind;
      return _exhaustive;
    }
  }
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );
}

export function chapterKindLabel(leaf: MemoirLeaf): string {
  switch (leaf.kind) {
    case 'title':
      return 'Cover';
    case 'hunt':
      return 'Hunt';
    case 'plan':
      return 'Plan';
    case 'note':
      return 'Note';
    default: {
      const _exhaustive: never = leaf.kind;
      return _exhaustive;
    }
  }
}

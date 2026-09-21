import { pathLengthMeters } from "./geo";
import type { HuntSession, Track, Waypoint } from "./entities";
import { WAYPOINT_TYPE_LABELS } from "./types";

export interface HuntTimelineEvent {
  at: string;
  label: string;
}

export function formatHuntClock(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

function inSessionWindow(iso: string, session: HuntSession): boolean {
  const time = Date.parse(iso);
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : Date.now();
  return Number.isFinite(time) && time >= start && time <= end;
}

export function buildHuntTimeline(
  session: HuntSession,
  waypoints: readonly Waypoint[],
  options?: { timeZone?: string },
): HuntTimelineEvent[] {
  const timeZone = options?.timeZone;
  const events: HuntTimelineEvent[] = [
    {
      at: session.startedAt,
      label: `${formatHuntClock(session.startedAt, timeZone)} — Hunt started`,
    },
  ];

  const related = waypoints
    .filter((waypoint) =>
      inSessionWindow(waypoint.observedAt ?? waypoint.createdAt, session),
    )
    .sort(
      (left, right) =>
        Date.parse(left.observedAt ?? left.createdAt) -
        Date.parse(right.observedAt ?? right.createdAt),
    );

  for (const waypoint of related) {
    const when = waypoint.observedAt ?? waypoint.createdAt;
    const typeLabel = WAYPOINT_TYPE_LABELS[waypoint.type];
    const name = waypoint.name.trim() ? `: ${waypoint.name}` : "";
    events.push({
      at: when,
      label: `${formatHuntClock(when, timeZone)} — ${typeLabel} recorded${name}`,
    });
  }

  if (session.endedAt) {
    events.push({
      at: session.endedAt,
      label: `${formatHuntClock(session.endedAt, timeZone)} — Hunt ended`,
    });
  }

  return events;
}

export function stopRecordingTrack(track: Track, endedAt: string): Track {
  return {
    ...track,
    status: "stopped",
    endedAt,
    distanceMeters: pathLengthMeters(track.points),
    version: track.version + 1,
    syncStatus: "pending",
  };
}

import { formatBearing, formatDistance, haversineMeters, initialBearingDegrees, pathLengthMeters } from "./geo";
import type { LonLat } from "./types";

export type RouteKind = "straight" | "breadcrumb" | "mapped";

export interface RouteOption {
  kind: RouteKind;
  truthLayer: "inferred" | "observed" | "authoritative";
  distanceMeters: number;
  bearingDegrees?: number;
  points: LonLat[];
  label: string;
  warning: string;
}

const TRAVERSE_WARNING =
  "This is a navigation aid, not a guarantee of safe or legal travel. Straight lines ignore terrain, water, private land, and closures.";

export function straightRoute(from: LonLat, to: LonLat): RouteOption {
  return {
    kind: "straight",
    truthLayer: "inferred",
    distanceMeters: haversineMeters(from, to),
    bearingDegrees: initialBearingDegrees(from, to),
    points: [from, to],
    label: `${formatDistance(haversineMeters(from, to))} ${formatBearing(initialBearingDegrees(from, to))}`,
    warning: TRAVERSE_WARNING,
  };
}

export function breadcrumbReturn(track: LonLat[]): RouteOption | null {
  if (track.length < 2) return null;
  return {
    kind: "breadcrumb",
    truthLayer: "observed",
    distanceMeters: pathLengthMeters([...track].reverse()),
    points: [...track].reverse(),
    label: `Breadcrumb return · ${formatDistance(pathLengthMeters(track))}`,
    warning:
      "Retraces your recorded track. Conditions may have changed since you traveled it.",
  };
}

export function returnToTruck(options: {
  from: LonLat;
  truck?: LonLat | null;
  breadcrumbs?: LonLat[];
  mapped?: LonLat[] | null;
}): RouteOption[] {
  const routes: RouteOption[] = [];
  if (options.truck) {
    routes.push(straightRoute(options.from, options.truck));
  }
  if (options.breadcrumbs && options.breadcrumbs.length > 1) {
    const breadcrumb = breadcrumbReturn(options.breadcrumbs);
    if (breadcrumb) routes.push(breadcrumb);
  }
  if (options.mapped && options.mapped.length > 1) {
    routes.push({
      kind: "mapped",
      truthLayer: "authoritative",
      distanceMeters: pathLengthMeters(options.mapped),
      points: options.mapped,
      label: `Mapped route · ${formatDistance(pathLengthMeters(options.mapped))}`,
      warning:
        "Uses available road/trail geometry. It is not a guarantee of legal access or safe travel.",
    });
  }
  return routes;
}

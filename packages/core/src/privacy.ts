import type { Visibility } from "./types";

export const DEFAULT_VISIBILITY: Visibility = "private";

export const PRIVATE_BY_DEFAULT = [
  "stand",
  "trail_camera",
  "harvest",
  "breadcrumb",
  "hunt_area",
  "track",
  "blind",
] as const;

export function canSharePreciseLocation(visibility: Visibility): boolean {
  return visibility === "shared" || visibility === "hunting_party";
}

export function redactLocation<T extends { latitude: number; longitude: number }>(
  entity: T,
  visibility: Visibility,
): T | Omit<T, "latitude" | "longitude"> {
  if (canSharePreciseLocation(visibility)) return entity;
  const { latitude: _lat, longitude: _lon, ...rest } = entity;
  return rest;
}

import type { BoundingBox, LonLat } from "./types";

const EARTH_RADIUS_M = 6_371_000;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function normalizeBearing(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function haversineMeters(from: LonLat, to: LonLat): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function initialBearingDegrees(from: LonLat, to: LonLat): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

export function destinationPoint(
  from: LonLat,
  bearingDegrees: number,
  distanceMeters: number,
): LonLat {
  const d = distanceMeters / EARTH_RADIUS_M;
  const brng = toRadians(bearingDegrees);
  const lat1 = toRadians(from.latitude);
  const lon1 = toRadians(from.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: toDegrees(lat2), longitude: toDegrees(lon2) };
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1609.344 / 10) {
    const yards = meters * 1.09361;
    return `${Math.round(yards)} yd`;
  }
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function formatBearing(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const index = Math.round(normalizeBearing(degrees) / 45) % dirs.length;
  const dir = dirs[index] ?? "N";
  return `${Math.round(normalizeBearing(degrees))}° ${dir}`;
}

export function bboxAreaKm2(bbox: BoundingBox): number {
  const sw: LonLat = { longitude: bbox.west, latitude: bbox.south };
  const se: LonLat = { longitude: bbox.east, latitude: bbox.south };
  const nw: LonLat = { longitude: bbox.west, latitude: bbox.north };
  const width = haversineMeters(sw, se) / 1000;
  const height = haversineMeters(sw, nw) / 1000;
  return width * height;
}

export function bboxContains(bbox: BoundingBox, point: LonLat): boolean {
  return (
    point.longitude >= bbox.west &&
    point.longitude <= bbox.east &&
    point.latitude >= bbox.south &&
    point.latitude <= bbox.north
  );
}

export function expandBBox(bbox: BoundingBox, meters: number): BoundingBox {
  const center: LonLat = {
    longitude: (bbox.west + bbox.east) / 2,
    latitude: (bbox.south + bbox.north) / 2,
  };
  const north = destinationPoint(center, 0, meters).latitude;
  const south = destinationPoint(center, 180, meters).latitude;
  const east = destinationPoint(center, 90, meters).longitude;
  const west = destinationPoint(center, 270, meters).longitude;
  return {
    west: Math.min(bbox.west, west),
    south: Math.min(bbox.south, south),
    east: Math.max(bbox.east, east),
    north: Math.max(bbox.north, north),
  };
}

export function pointInRing(
  point: LonLat,
  ring: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (
      xi === undefined ||
      yi === undefined ||
      xj === undefined ||
      yj === undefined
    ) {
      continue;
    }
    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude <
        ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(
  point: LonLat,
  coordinates: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
): boolean {
  const outer = coordinates[0];
  if (!outer || !pointInRing(point, outer)) return false;
  for (let i = 1; i < coordinates.length; i += 1) {
    const hole = coordinates[i];
    if (hole && pointInRing(point, hole)) return false;
  }
  return true;
}

export function tileToBBox(
  z: number,
  x: number,
  y: number,
): { west: number; south: number; east: number; north: number } {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { west, south, east, north };
}

export function estimateRasterTileCount(
  bbox: BoundingBox,
  minZoom: number,
  maxZoom: number,
): number {
  let count = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const n = 2 ** z;
    const xMin = Math.floor(((bbox.west + 180) / 360) * n);
    const xMax = Math.floor(((bbox.east + 180) / 360) * n);
    const latRadNorth = toRadians(bbox.north);
    const latRadSouth = toRadians(bbox.south);
    const yMin = Math.floor(
      ((1 - Math.log(Math.tan(latRadNorth) + 1 / Math.cos(latRadNorth)) / Math.PI) /
        2) *
        n,
    );
    const yMax = Math.floor(
      ((1 - Math.log(Math.tan(latRadSouth) + 1 / Math.cos(latRadSouth)) / Math.PI) /
        2) *
        n,
    );
    count += (xMax - xMin + 1) * (yMax - yMin + 1);
  }
  return Math.max(0, count);
}

export function pathLengthMeters(points: readonly LonLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev && curr) total += haversineMeters(prev, curr);
  }
  return total;
}

export function polygonAreaAcres(
  ring: ReadonlyArray<readonly [number, number]>,
): number {
  if (ring.length < 4) return 0;
  const origin = ring[0];
  if (!origin) return 0;
  let area = 0;
  for (let i = 1; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!a || !b) continue;
    const ax = haversineMeters(
      { longitude: origin[0], latitude: origin[1] },
      { longitude: a[0], latitude: origin[1] },
    ) * (a[0] >= origin[0] ? 1 : -1);
    const ay = haversineMeters(
      { longitude: origin[0], latitude: origin[1] },
      { longitude: origin[0], latitude: a[1] },
    ) * (a[1] >= origin[1] ? 1 : -1);
    const bx = haversineMeters(
      { longitude: origin[0], latitude: origin[1] },
      { longitude: b[0], latitude: origin[1] },
    ) * (b[0] >= origin[0] ? 1 : -1);
    const by = haversineMeters(
      { longitude: origin[0], latitude: origin[1] },
      { longitude: origin[0], latitude: b[1] },
    ) * (b[1] >= origin[1] ? 1 : -1);
    area += ax * by - bx * ay;
  }
  const meters2 = Math.abs(area) / 2;
  return meters2 / 4046.8564224;
}

export function compassCardinal(degrees: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;
  const index = Math.round(normalizeBearing(degrees) / 22.5) % dirs.length;
  return dirs[index] ?? "N";
}

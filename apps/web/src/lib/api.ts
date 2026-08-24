import type { DatasetRecord, IdentifyResult, Waypoint, WeatherSnapshot } from "@huntos/core";

export function userHeaders(userId: string): HeadersInit {
  return { "x-huntos-user": userId, "content-type": "application/json" };
}

export async function identifyLand(
  lng: number,
  lat: number,
): Promise<IdentifyResult> {
  const response = await fetch(`/api/gis/identify?lng=${lng}&lat=${lat}`);
  return (await response.json()) as IdentifyResult;
}

export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot> {
  const response = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
  if (!response.ok) {
    throw new Error("Weather source unavailable.");
  }
  return (await response.json()) as WeatherSnapshot;
}

export async function syncWaypoints(
  userId: string,
  waypoints: Waypoint[],
): Promise<Waypoint[]> {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: userHeaders(userId),
    body: JSON.stringify({ waypoints }),
  });
  if (!response.ok) {
    throw new Error("Sync endpoint unavailable.");
  }
  const payload = (await response.json()) as { waypoints: Waypoint[] };
  return payload.waypoints;
}

export async function fetchDatasets(): Promise<DatasetRecord[]> {
  const response = await fetch("/api/datasets");
  const payload = (await response.json()) as { datasets: DatasetRecord[] };
  return payload.datasets;
}

export async function runScoutRequest(body: {
  species: string;
  period: string;
  west: number;
  south: number;
  east: number;
  north: number;
  wind?: {
    directionFromDegrees: number;
    speedMps: number;
    source: string;
    retrievedAt: string;
  } | null;
}) {
  const response = await fetch("/api/intelligence/scout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Scout analysis failed without substituting results.");
  }
  return response.json();
}

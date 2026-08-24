import type { DatasetRecord, IdentifyResult, Waypoint, WeatherSnapshot } from "@huntos/core";

export function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json" };
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

export async function syncWaypoints(waypoints: Waypoint[]): Promise<Waypoint[]> {
  const response = await fetch("/api/sync", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders(),
    body: JSON.stringify({ waypoints }),
  });
  if (response.status === 401) {
    throw new Error("Sign in to sync. Offline marks were kept on this device.");
  }
  if (!response.ok) {
    throw new Error("Sync endpoint unavailable. Offline marks were not discarded.");
  }
  const payload = (await response.json()) as { waypoints: Waypoint[] };
  return payload.waypoints;
}

export async function fetchSession(): Promise<{ id: string; email: string } | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  const payload = (await response.json()) as {
    user: { id: string; email: string } | null;
  };
  return payload.user;
}

export async function registerAccount(email: string, password: string) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json()) as {
    user?: { id: string; email: string };
    error?: string;
  };
  if (!response.ok || !payload.user) {
    throw new Error(payload.error ?? "Registration failed.");
  }
  return payload.user;
}

export async function loginAccount(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json()) as {
    user?: { id: string; email: string };
    error?: string;
  };
  if (!response.ok || !payload.user) {
    throw new Error(payload.error ?? "Login failed.");
  }
  return payload.user;
}

export async function logoutAccount(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function pullWaypoints(): Promise<Waypoint[]> {
  const response = await fetch("/api/sync", { credentials: "include" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { waypoints?: Waypoint[] };
  return payload.waypoints ?? [];
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

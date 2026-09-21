import {
  createOpenMeteoProvider,
  enrichIdentifyWithTexasSources,
  fetchOpenMeteoForecast,
  parseRainViewerMaps,
  RAINVIEWER_MAPS_URL,
  sampleOpenMeteoElevation,
  unavailableIdentify,
  type IdentifyResult,
  type LonLat,
  type RadarCatalog,
  type WeatherForecast,
  type WeatherSnapshot,
} from '@huntos/core';

const openMeteo = createOpenMeteoProvider({
  weatherUrl: 'https://api.open-meteo.com/v1/forecast',
  elevationUrl: 'https://api.open-meteo.com/v1/elevation',
});

export function huntosApiUrl(): string {
  return process.env.EXPO_PUBLIC_HUNTOS_API_URL?.replace(/\/$/, '') ?? '';
}

export function huntosApiConfigured(): boolean {
  return huntosApiUrl().length > 0;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${huntosApiUrl()}${path}`);
  if (!response.ok) {
    throw new Error(`Nomad field API returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchIdentify(
  longitude: number,
  latitude: number,
  options?: { stateCode?: string | null },
): Promise<IdentifyResult> {
  const point = { longitude, latitude };
  const stateCode = options?.stateCode ?? undefined;
  let base: IdentifyResult;
  if (!huntosApiConfigured()) {
    base = unavailableIdentify(
      'Land status unknown — verify posted boundaries. Nomad field API is not configured.',
    );
  } else {
    try {
      const stateQuery =
        stateCode != null && stateCode.length > 0
          ? `&state=${encodeURIComponent(stateCode)}`
          : '';
      base = await getJson<IdentifyResult>(
        `/api/gis/identify?lng=${encodeURIComponent(String(longitude))}&lat=${encodeURIComponent(String(latitude))}${stateQuery}`,
      );
    } catch {
      base = unavailableIdentify(
        'Land status unknown — verify posted boundaries. Identify is unavailable offline.',
      );
    }
  }
  if (base.parcel !== undefined) return base;
  if (stateCode !== 'TX') return base;
  return enrichIdentifyWithTexasSources(base, point, { stateCode });
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | undefined> {
  if (huntosApiConfigured()) {
    try {
      return await getJson<WeatherSnapshot>(
        `/api/weather?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
      );
    } catch {
      // Fall through to the public Open-Meteo forecast.
    }
  }
  try {
    return await openMeteo.getCurrent({ latitude, longitude });
  } catch {
    return undefined;
  }
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
): Promise<WeatherForecast | undefined> {
  try {
    return await fetchOpenMeteoForecast(
      { latitude, longitude },
      {
        weatherUrl: 'https://api.open-meteo.com/v1/forecast',
        elevationUrl: 'https://api.open-meteo.com/v1/elevation',
      },
    );
  } catch {
    return undefined;
  }
}

export async function fetchScout(body: {
  west: number;
  south: number;
  east: number;
  north: number;
}): Promise<{
  ok: boolean;
  message: string;
  overlay?: Array<{
    latitude: number;
    longitude: number;
    overall: number | null;
    bedding: number | null;
    feeding: number | null;
    reasons: string[];
    unavailable: string[];
    disclaimer: string;
  }>;
  units?: Array<{
    id: string;
    label: string;
    points: Array<{ latitude: number; longitude: number }>;
  }>;
  features?: Array<{
    latitude: number;
    longitude: number;
    kind: string;
    label: string;
    reasons: string[];
    confidence: number;
  }>;
  setups?: Array<{ score: number | null; reasons: string[] }>;
}> {
  if (!huntosApiConfigured()) {
    return { ok: false, message: 'Scout requires the Nomad field API.' };
  }
  try {
    const response = await fetch(`${huntosApiUrl()}/api/intelligence/scout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        species: 'whitetail',
        period: 'now',
        method: 'any',
        ...body,
      }),
    });
    if (!response.ok) {
      return { ok: false, message: 'Scout is unavailable. Scores were not invented.' };
    }
    const payload = (await response.json()) as {
      explanation?: {
        narrative?: string;
        setups?: Array<{ scores?: { overall?: number | null }; reasons?: string[] }>;
      };
      overlay?: {
        features?: Array<{
          properties?: {
            overall?: number | null;
            bedding?: number | null;
            feeding?: number | null;
            reasons?: string[];
            unavailable?: string[];
            disclaimer?: string;
          };
          geometry?: { coordinates?: number[] };
        }>;
      };
      unitOverlay?: {
        features?: Array<{
          properties?: { label?: string };
          geometry?: { type?: string; coordinates?: unknown };
        }>;
      };
      featureOverlay?: {
        features?: Array<{
          properties?: { kind?: string; label?: string; reasons?: string[]; confidence?: number };
          geometry?: { coordinates?: number[] };
        }>;
      };
    };
    return {
      ok: true,
      message:
        payload.explanation?.narrative ??
        'Scout result received. Scores stay inferred — not animal presence.',
      overlay: (payload.overlay?.features ?? [])
        .map((feature) => ({
          longitude: feature.geometry?.coordinates?.[0] ?? 0,
          latitude: feature.geometry?.coordinates?.[1] ?? 0,
          overall: feature.properties?.overall ?? null,
          bedding: feature.properties?.bedding ?? null,
          feeding: feature.properties?.feeding ?? null,
          reasons: feature.properties?.reasons ?? [],
          unavailable: feature.properties?.unavailable ?? [],
          disclaimer: feature.properties?.disclaimer ?? '',
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
      units: (payload.unitOverlay?.features ?? [])
        .map((feature, index) => {
          const ring = outerRing(feature.geometry);
          return {
            id: `${feature.properties?.label ?? 'unit'}-${index}`,
            label: feature.properties?.label ?? 'Hunting unit',
            points: ring,
          };
        })
        .filter((item) => item.points.length >= 3),
      features: (payload.featureOverlay?.features ?? [])
        .map((feature) => ({
          longitude: feature.geometry?.coordinates?.[0] ?? 0,
          latitude: feature.geometry?.coordinates?.[1] ?? 0,
          kind: feature.properties?.kind ?? 'unknown',
          label: feature.properties?.label ?? 'Terrain feature',
          reasons: feature.properties?.reasons ?? [],
          confidence: feature.properties?.confidence ?? 0,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
      setups: (payload.explanation?.setups ?? []).map((setup) => ({
        score: setup.scores?.overall ?? null,
        reasons: setup.reasons ?? [],
      })),
    };
  } catch {
    return { ok: false, message: 'Scout requires the Nomad field API.' };
  }
}

function outerRing(
  geometry?: { type?: string; coordinates?: unknown },
): Array<{ latitude: number; longitude: number }> {
  if (!geometry?.coordinates) return [];
  let ring: unknown = geometry.coordinates;
  if (geometry.type === 'MultiPolygon' && Array.isArray(ring)) {
    ring = ring[0];
  }
  if (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
    ring = ring[0];
  }
  if (!Array.isArray(ring)) return [];
  return ring
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const longitude = Number(pair[0]);
      const latitude = Number(pair[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    })
    .filter((item): item is { latitude: number; longitude: number } => item != null);
}

export async function fetchTerrainAnalyze(body: {
  west: number;
  south: number;
  east: number;
  north: number;
}): Promise<{
  ok: boolean;
  message: string;
  features: Array<{
    latitude: number;
    longitude: number;
    kind: string;
    label: string;
    reasons: string[];
    confidence: number;
  }>;
  slopeHeat: Array<{ latitude: number; longitude: number; slopeDegrees: number }>;
}> {
  if (!huntosApiConfigured()) {
    return {
      ok: false,
      message: 'Analyze Terrain requires the Nomad field API.',
      features: [],
      slopeHeat: [],
    };
  }
  try {
    const response = await fetch(`${huntosApiUrl()}/api/terrain/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return {
        ok: false,
        message: 'Terrain analysis is unavailable. Features were not invented.',
        features: [],
        slopeHeat: [],
      };
    }
    const payload = (await response.json()) as {
      overlay?: {
        features?: Array<{
          properties?: { kind?: string; label?: string; reasons?: string[]; confidence?: number };
          geometry?: { coordinates?: number[] };
        }>;
      };
      cells?: Array<{
        center?: { longitude?: number; latitude?: number };
        slopeDegrees?: number | null;
      }>;
    };
    return {
      ok: true,
      message: 'Terrain features inferred from sampled elevations — not lidar.',
      features: (payload.overlay?.features ?? [])
        .map((feature) => ({
          longitude: feature.geometry?.coordinates?.[0] ?? 0,
          latitude: feature.geometry?.coordinates?.[1] ?? 0,
          kind: feature.properties?.kind ?? 'unknown',
          label: feature.properties?.label ?? 'Terrain feature',
          reasons: feature.properties?.reasons ?? [],
          confidence: feature.properties?.confidence ?? 0,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
      slopeHeat: (payload.cells ?? [])
        .map((cell) => ({
          longitude: cell.center?.longitude ?? 0,
          latitude: cell.center?.latitude ?? 0,
          slopeDegrees: cell.slopeDegrees ?? 0,
        }))
        .filter(
          (item) =>
            Number.isFinite(item.latitude) &&
            Number.isFinite(item.longitude) &&
            Number.isFinite(item.slopeDegrees) &&
            item.slopeDegrees > 0,
        ),
    };
  } catch {
    return {
      ok: false,
      message: 'Analyze Terrain requires the Nomad field API.',
      features: [],
      slopeHeat: [],
    };
  }
}

export async function fetchRadarCatalog(): Promise<RadarCatalog | undefined> {
  try {
    const response = await fetch(RAINVIEWER_MAPS_URL);
    if (!response.ok) return undefined;
    return parseRainViewerMaps(await response.json()) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchElevationSamples(
  points: LonLat[],
): Promise<Array<{ point: LonLat; elevationMeters: number }>> {
  if (points.length === 0) return [];
  try {
    return await sampleOpenMeteoElevation(points, openMeteoElevationUrl());
  } catch {
    return [];
  }
}

function openMeteoElevationUrl(): string {
  return 'https://api.open-meteo.com/v1/elevation';
}

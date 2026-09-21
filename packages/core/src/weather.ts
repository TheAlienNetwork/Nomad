import type { LonLat } from "./types";

export interface WeatherSnapshot {
  truthLayer: "authoritative";
  source: string;
  retrievedAt: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  windSpeedMps: number | null;
  windDirectionFromDegrees: number | null;
  windGustMps: number | null;
  pressureHpa: number | null;
  humidityPct: number | null;
  visibilityM: number | null;
  hourly: Array<{
    time: string;
    temperatureC: number | null;
    precipitationMm: number | null;
    windSpeedMps: number | null;
    windDirectionFromDegrees: number | null;
    windGustMps: number | null;
  }>;
}

export interface DailyForecast {
  date: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationMm: number | null;
  windSpeedMps: number | null;
  windDirectionFromDegrees: number | null;
  weatherCode: number | null;
}

export interface WeatherForecast {
  current: WeatherSnapshot;
  daily: DailyForecast[];
}

export interface WeatherProvider {
  id: string;
  getCurrent(point: LonLat): Promise<WeatherSnapshot>;
}

export interface OpenMeteoConfig {
  weatherUrl: string;
  elevationUrl: string;
  fetchImpl?: typeof fetch;
}

interface OpenMeteoForecast {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    surface_pressure?: number;
    relative_humidity_2m?: number;
    visibility?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
    wind_direction_10m?: number[];
    wind_gusts_10m?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    wind_direction_10m_dominant?: number[];
    weather_code?: number[];
  };
}

function kmhToMps(value: number | undefined): number | null {
  return typeof value === "number" ? value / 3.6 : null;
}

function snapshotFromPayload(payload: OpenMeteoForecast): WeatherSnapshot {
  const current = payload.current ?? {};
  const hourly = payload.hourly ?? {};
  const times = hourly.time ?? [];
  return {
    truthLayer: "authoritative",
    source: "open-meteo",
    retrievedAt: new Date().toISOString(),
    temperatureC: current.temperature_2m ?? null,
    precipitationMm: current.precipitation ?? null,
    windSpeedMps: kmhToMps(current.wind_speed_10m),
    windDirectionFromDegrees: current.wind_direction_10m ?? null,
    windGustMps: kmhToMps(current.wind_gusts_10m),
    pressureHpa: current.surface_pressure ?? null,
    humidityPct: current.relative_humidity_2m ?? null,
    visibilityM: current.visibility ?? null,
    hourly: times.slice(0, 24).map((time, index) => ({
      time,
      temperatureC: hourly.temperature_2m?.[index] ?? null,
      precipitationMm: hourly.precipitation?.[index] ?? null,
      windSpeedMps: kmhToMps(hourly.wind_speed_10m?.[index]),
      windDirectionFromDegrees: hourly.wind_direction_10m?.[index] ?? null,
      windGustMps: kmhToMps(hourly.wind_gusts_10m?.[index]),
    })),
  };
}

export function createOpenMeteoProvider(
  config: OpenMeteoConfig,
): WeatherProvider {
  return {
    id: "open-meteo",
    async getCurrent(point) {
      const url = new URL(config.weatherUrl);
      url.searchParams.set("latitude", String(point.latitude));
      url.searchParams.set("longitude", String(point.longitude));
      url.searchParams.set(
        "current",
        "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,relative_humidity_2m,visibility",
      );
      url.searchParams.set(
        "hourly",
        "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
      );
      url.searchParams.set("forecast_hours", "24");
      url.searchParams.set("wind_speed_unit", "kmh");
      const fetchImpl = config.fetchImpl ?? fetch;
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`Weather provider returned HTTP ${response.status}`);
      }
      return snapshotFromPayload((await response.json()) as OpenMeteoForecast);
    },
  };
}

export async function fetchOpenMeteoForecast(
  point: LonLat,
  config: OpenMeteoConfig,
): Promise<WeatherForecast> {
  const url = new URL(config.weatherUrl);
  url.searchParams.set("latitude", String(point.latitude));
  url.searchParams.set("longitude", String(point.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,relative_humidity_2m,visibility",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  );
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code",
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("wind_speed_unit", "kmh");
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Weather provider returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as OpenMeteoForecast;
  const daily = payload.daily ?? {};
  const days = daily.time ?? [];
  return {
    current: snapshotFromPayload(payload),
    daily: days.slice(0, 7).map((date, index) => ({
      date,
      temperatureMaxC: daily.temperature_2m_max?.[index] ?? null,
      temperatureMinC: daily.temperature_2m_min?.[index] ?? null,
      precipitationMm: daily.precipitation_sum?.[index] ?? null,
      windSpeedMps: kmhToMps(daily.wind_speed_10m_max?.[index]),
      windDirectionFromDegrees: daily.wind_direction_10m_dominant?.[index] ?? null,
      weatherCode: daily.weather_code?.[index] ?? null,
    })),
  };
}

export async function sampleOpenMeteoElevation(
  points: LonLat[],
  elevationUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<{ point: LonLat; elevationMeters: number }>> {
  if (points.length === 0) return [];
  const url = new URL(elevationUrl);
  url.searchParams.set("latitude", points.map((point) => point.latitude).join(","));
  url.searchParams.set(
    "longitude",
    points.map((point) => point.longitude).join(","),
  );
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Elevation provider returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { elevation?: number[] };
  const elevations = payload.elevation ?? [];
  return points.flatMap((point, index) => {
    const elevation = elevations[index];
    if (typeof elevation !== "number") return [];
    return [{ point, elevationMeters: elevation }];
  });
}

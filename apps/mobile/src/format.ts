import {
  formatLengthFeet,
  formatSpeedMph,
  formatTemperatureF,
  type WeatherSnapshot,
} from '@huntos/core';

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;

export function formatRadiusYards(meters: number): string {
  const yards = Math.round(meters / 0.9144);
  if (yards >= 1760) {
    const miles = yards / 1760;
    return `${miles % 1 === 0 ? miles.toFixed(0) : miles.toFixed(1)} mi`;
  }
  return `${yards} yd`;
}

export function yardsToMeters(yards: number): number {
  return yards * 0.9144;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function formatDdm(latitude: number, longitude: number): string {
  return `${toDdm(latitude, 'N', 'S')}  ${toDdm(longitude, 'E', 'W')}`;
}

function toDdm(value: number, pos: string, neg: string): string {
  const hemi = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minutes = (abs - deg) * 60;
  return `${deg}°${minutes.toFixed(3)}'${hemi}`;
}

export function windLabel(weather?: WeatherSnapshot): string {
  if (
    !weather ||
    weather.windSpeedMps == null ||
    weather.windDirectionFromDegrees == null
  ) {
    return 'Wind unknown';
  }
  const dir = compassPoint(weather.windDirectionFromDegrees);
  return `${dir} ${formatSpeedMph(weather.windSpeedMps)}`;
}

export function compassPoint(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % COMPASS.length;
  return COMPASS[index] ?? 'N';
}

export function weatherCodeLabel(code: number | null | undefined): string {
  if (code == null) return 'Sky unknown';
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return `Sky code ${code}`;
}

export function temperatureLabel(weather?: WeatherSnapshot): string {
  if (!weather || weather.temperatureC == null) return 'Temp unknown';
  return formatTemperatureF(weather.temperatureC);
}

export function formatDuration(startedAt: string, nowMs = Date.now()): string {
  const elapsed = Math.max(0, nowMs - Date.parse(startedAt));
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}m`;
  return `${hours}h ${rest}m`;
}

export function formatAcres(acres: number): string {
  if (!Number.isFinite(acres) || acres <= 0) return '—';
  if (acres < 10) return `${acres.toFixed(1)} ac`;
  return `${Math.round(acres)} ac`;
}

export function formatElevationFeet(meters: number): string {
  return formatLengthFeet(meters);
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatPace(distanceMeters: number, startedAt: string, nowMs = Date.now()): string {
  const hours = Math.max(1 / 60, (nowMs - Date.parse(startedAt)) / 3_600_000);
  const miles = distanceMeters / 1609.344;
  if (miles < 0.02) return 'Pace —';
  const minPerMile = (hours * 60) / miles;
  if (!Number.isFinite(minPerMile) || minPerMile > 99) return 'Pace —';
  const whole = Math.floor(minPerMile);
  const seconds = Math.round((minPerMile - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, '0')}/mi`;
}

export type SkySnapshot = {
  latitude: number;
  longitude: number;
  at: string;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  sunriseIso: string | null;
  sunsetIso: string | null;
  civilDawnIso: string | null;
  civilDuskIso: string | null;
  moonPhaseName: string;
  moonIllumination: number;
};

function solarPosition(
  date: Date,
  latitude: number,
  longitude: number,
): { altitude: number; azimuth: number } {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const g = ((357.529 + 0.98560028 * d) * Math.PI) / 180;
  const q = 280.459 + 0.98564736 * d;
  const L = ((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI) / 180;
  const e = ((23.439 - 0.00000036 * d) * Math.PI) / 180;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = (((gmst + longitude / 15) % 24) + 24) % 24;
  const ha = (lst * 15 * Math.PI) / 180 - ra;
  const latr = (latitude * Math.PI) / 180;
  const alt = Math.asin(
    Math.sin(latr) * Math.sin(dec) + Math.cos(latr) * Math.cos(dec) * Math.cos(ha),
  );
  const az = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(latr) - Math.tan(dec) * Math.cos(latr),
  );
  return {
    altitude: (alt * 180) / Math.PI,
    azimuth: (((az * 180) / Math.PI) + 180 + 360) % 360,
  };
}

function findCrossing(
  latitude: number,
  longitude: number,
  start: Date,
  hours: number,
  targetAlt: number,
  rising: boolean,
): Date | null {
  const stepMs = 60_000;
  const end = start.getTime() + hours * 3_600_000;
  let prev = solarPosition(start, latitude, longitude).altitude;
  for (let t = start.getTime() + stepMs; t <= end; t += stepMs) {
    const next = solarPosition(new Date(t), latitude, longitude).altitude;
    const crossed = rising
      ? prev < targetAlt && next >= targetAlt
      : prev > targetAlt && next <= targetAlt;
    if (crossed) return new Date(t);
    prev = next;
  }
  return null;
}

function moonPhase(date: Date): { name: string; illumination: number } {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((date.getTime() - knownNew) / 86_400_000) % synodic + synodic) % synodic;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2;
  const names = [
    'New',
    'Waxing crescent',
    'First quarter',
    'Waxing gibbous',
    'Full',
    'Waning gibbous',
    'Last quarter',
    'Waning crescent',
  ] as const;
  const index = Math.round((age / synodic) * 8) % names.length;
  return { name: names[index] ?? 'New', illumination };
}

export function computeSky(
  latitude: number,
  longitude: number,
  at = new Date(),
): SkySnapshot {
  const noon = new Date(at);
  noon.setHours(12, 0, 0, 0);
  const morning = new Date(noon);
  morning.setHours(0, 0, 0, 0);
  const sun = solarPosition(at, latitude, longitude);
  const moon = moonPhase(at);
  const sunrise = findCrossing(latitude, longitude, morning, 14, -0.83, true);
  const sunset = findCrossing(latitude, longitude, noon, 14, -0.83, false);
  const civilDawn = findCrossing(latitude, longitude, morning, 14, -6, true);
  const civilDusk = findCrossing(latitude, longitude, noon, 14, -6, false);
  return {
    latitude,
    longitude,
    at: at.toISOString(),
    sunAltitudeDeg: sun.altitude,
    sunAzimuthDeg: sun.azimuth,
    sunriseIso: sunrise?.toISOString() ?? null,
    sunsetIso: sunset?.toISOString() ?? null,
    civilDawnIso: civilDawn?.toISOString() ?? null,
    civilDuskIso: civilDusk?.toISOString() ?? null,
    moonPhaseName: moon.name,
    moonIllumination: moon.illumination,
  };
}

export async function fetchOpenMeteoSun(
  latitude: number,
  longitude: number,
): Promise<{ sunriseIso: string | null; sunsetIso: string | null }> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');
  const response = await fetch(url);
  if (!response.ok) {
    return { sunriseIso: null, sunsetIso: null };
  }
  const payload = (await response.json()) as {
    daily?: { sunrise?: string[]; sunset?: string[] };
  };
  return {
    sunriseIso: payload.daily?.sunrise?.[0] ?? null,
    sunsetIso: payload.daily?.sunset?.[0] ?? null,
  };
}

export async function skyForPoint(
  latitude: number,
  longitude: number,
): Promise<SkySnapshot> {
  const local = computeSky(latitude, longitude);
  try {
    const remote = await fetchOpenMeteoSun(latitude, longitude);
    return {
      ...local,
      sunriseIso: remote.sunriseIso ?? local.sunriseIso,
      sunsetIso: remote.sunsetIso ?? local.sunsetIso,
    };
  } catch {
    return local;
  }
}

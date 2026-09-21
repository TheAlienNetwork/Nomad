export type PlaceHit = {
  label: string;
  latitude: number;
  longitude: number;
};

const COORD = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/;

export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const coord = COORD.exec(trimmed);
  if (coord) {
    const latitude = Number(coord[1]);
    const longitude = Number(coord[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return [{ label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude }];
    }
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NomadField/1.0 (https://nomad-field-privacy.vercel.app)',
    },
  });
  if (!response.ok) throw new Error('Place search failed.');
  const rows = (await response.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
  return rows
    .map((row) => {
      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        label: row.display_name?.trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
      };
    })
    .filter((item): item is PlaceHit => item != null);
}

function shortPlaceLabel(display: string): string {
  const parts = display
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 2) return display.trim();
  return parts.slice(0, 3).join(', ');
}

export async function reversePlace(latitude: number, longitude: number): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NomadField/1.0 (https://nomad-field-privacy.vercel.app)',
    },
  });
  if (!response.ok) return null;
  const row = (await response.json()) as { display_name?: string };
  const label = row.display_name?.trim();
  return label ? shortPlaceLabel(label) : null;
}

export type MemoryExifFix = {
  latitude?: number;
  longitude?: number;
  takenAt?: string;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }
  return null;
}

function dmsToDecimal(value: unknown, ref?: unknown): number | null {
  const direct = asNumber(value);
  if (direct != null) {
    const hemi = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
    if (hemi === 'S' || hemi === 'W') return -Math.abs(direct);
    return direct;
  }
  if (!Array.isArray(value) || value.length < 2) return null;
  const deg = asNumber(value[0]) ?? 0;
  const min = asNumber(value[1]) ?? 0;
  const sec = asNumber(value[2]) ?? 0;
  const decimal = Math.abs(deg) + min / 60 + sec / 3600;
  if (!Number.isFinite(decimal)) return null;
  const hemi = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
  if (hemi === 'S' || hemi === 'W') return -decimal;
  return decimal;
}

function parseExifDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export function parseMemoryExif(exif: Record<string, unknown> | null | undefined): MemoryExifFix {
  if (!exif) return {};
  const latitude = dmsToDecimal(exif.GPSLatitude ?? exif.gpsLatitude, exif.GPSLatitudeRef ?? exif.gpsLatitudeRef);
  const longitude = dmsToDecimal(
    exif.GPSLongitude ?? exif.gpsLongitude,
    exif.GPSLongitudeRef ?? exif.gpsLongitudeRef,
  );
  const takenAt = parseExifDate(
    exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime ?? exif.GPSDateStamp,
  );
  const latOk = latitude != null && Math.abs(latitude) <= 90;
  const lngOk = longitude != null && Math.abs(longitude) <= 180;
  return {
    latitude: latOk ? latitude : undefined,
    longitude: lngOk ? longitude : undefined,
    takenAt,
  };
}

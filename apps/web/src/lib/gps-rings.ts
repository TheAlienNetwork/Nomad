import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { destinationPoint, formatBearing, formatLengthFeet, geodesicCircleRing } from "@huntos/core";

export const GPS_RANGE_YARDS = [100, 200, 400] as const;
export const GPS_RING_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export const GPS_RING_HIGH_FT = 10;
const METERS_TO_FEET = 3.28084;
const YARD_METERS = 0.9144;

export type GpsRingKind = "high" | "low" | "level";

export type GpsRingIntel = {
  kind: GpsRingKind;
  deltaFt: number;
  bearing: number;
  label: string;
};

export type GpsRingSample = {
  yards: number;
  bearing: number;
  longitude: number;
  latitude: number;
  elevationMeters: number | null;
};

export function resolveGpsRingKind(kind: GpsRingKind): GpsRingKind {
  switch (kind) {
    case "high":
    case "low":
    case "level":
      return kind;
    default: {
      const _exhausted: never = kind;
      return _exhausted;
    }
  }
}

export function gpsRangeMeters(yards: number): number {
  return yards * YARD_METERS;
}

export function formatDeltaFeet(meters: number): string {
  const ft = Math.round(meters * METERS_TO_FEET);
  if (ft > 0) return `+${ft} ft`;
  if (ft < 0) return `${ft} ft`;
  return "0 ft";
}

export function formatHudFeet(meters: number): string {
  return String(Math.abs(Math.round(meters * METERS_TO_FEET))).padStart(4, "0");
}

export function formatHudYards(yards: number): string {
  return String(Math.abs(Math.round(yards))).padStart(4, "0");
}

export function formatHudDelta(meters: number): string {
  const ft = Math.round(meters * METERS_TO_FEET);
  if (ft > 0) return `+${String(ft).padStart(3, "0")}`;
  if (ft < 0) return `-${String(Math.abs(ft)).padStart(3, "0")}`;
  return "+000";
}

export function gpsRingSamplePoints(origin: { latitude: number; longitude: number }): Array<{
  yards: number;
  bearing: number;
  longitude: number;
  latitude: number;
}> {
  const points: Array<{ yards: number; bearing: number; longitude: number; latitude: number }> = [];
  for (const yards of GPS_RANGE_YARDS) {
    for (const bearing of GPS_RING_BEARINGS) {
      const point = destinationPoint(origin, bearing, gpsRangeMeters(yards));
      points.push({
        yards,
        bearing,
        longitude: point.longitude,
        latitude: point.latitude,
      });
    }
  }
  return points;
}

export function buildGpsRangeRingCollection(origin: { latitude: number; longitude: number }): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: GPS_RANGE_YARDS.map((yards) => ({
      type: "Feature",
      properties: { kind: "range", yards },
      geometry: {
        type: "LineString",
        coordinates: geodesicCircleRing(origin, gpsRangeMeters(yards), 64),
      },
    })),
  };
}

export function gpsRingHudLine(intel: GpsRingIntel | null): string | null {
  if (!intel) return null;
  switch (intel.kind) {
    case "high":
    case "low":
      return intel.label;
    case "level":
      return null;
    default: {
      const _exhausted: never = intel.kind;
      return _exhausted;
    }
  }
}

export function classifyGpsRingIntel(
  gpsElevationMeters: number | null,
  samples: GpsRingSample[],
): GpsRingIntel | null {
  if (gpsElevationMeters == null) return null;
  const known = samples.filter(
    (sample): sample is GpsRingSample & { elevationMeters: number } => sample.elevationMeters != null,
  );
  if (known.length === 0) return null;
  const highest = known.reduce((best, sample) =>
    sample.elevationMeters > best.elevationMeters ? sample : best,
  );
  const lowest = known.reduce((best, sample) =>
    sample.elevationMeters < best.elevationMeters ? sample : best,
  );
  const riseFt = Math.round((highest.elevationMeters - gpsElevationMeters) * METERS_TO_FEET);
  const dropFt = Math.round((gpsElevationMeters - lowest.elevationMeters) * METERS_TO_FEET);
  if (riseFt >= GPS_RING_HIGH_FT) {
    return {
      kind: "high",
      deltaFt: riseFt,
      bearing: highest.bearing,
      label: `HIGH ${formatDeltaFeet(highest.elevationMeters - gpsElevationMeters)} · ${formatBearing(highest.bearing)}`,
    };
  }
  if (dropFt >= GPS_RING_HIGH_FT) {
    return {
      kind: "low",
      deltaFt: -dropFt,
      bearing: lowest.bearing,
      label: `LOW ${formatDeltaFeet(lowest.elevationMeters - gpsElevationMeters)} · ${formatBearing(lowest.bearing)}`,
    };
  }
  return {
    kind: "level",
    deltaFt: 0,
    bearing: highest.bearing,
    label: "LEVEL · sampled DEM",
  };
}

export function buildGpsRingLabelCollection(
  origin: { latitude: number; longitude: number },
  heading: number | null,
  gpsElevationMeters: number | null,
  samples: GpsRingSample[],
  intel: GpsRingIntel | null,
): FeatureCollection<Point | LineString> {
  const features: Array<Feature<Point | LineString>> = [];
  for (const yards of GPS_RANGE_YARDS) {
    const spokeBearing = heading ?? 0;
    const spoke = destinationPoint(origin, spokeBearing, gpsRangeMeters(yards));
    features.push({
      type: "Feature",
      properties: {
        kind: "yards",
        primary: formatHudYards(yards),
        unit: "YD",
        text: `${yards} yd`,
      },
      geometry: { type: "Point", coordinates: [spoke.longitude, spoke.latitude] },
    });
  }
  for (const sample of samples) {
    if (sample.elevationMeters == null) continue;
    const cardinal = sample.yards === 200 && sample.bearing % 90 === 0;
    const delta = gpsElevationMeters != null ? sample.elevationMeters - gpsElevationMeters : 0;
    const isExtreme =
      intel != null &&
      sample.bearing === intel.bearing &&
      (intel.kind === "high" || intel.kind === "low");
    if (!cardinal && !isExtreme) continue;
    const kind = isExtreme ? intel.kind : "elev";
    const primary = formatHudFeet(sample.elevationMeters);
    const unit = isExtreme ? formatHudDelta(delta) : "FT";
    features.push({
      type: "Feature",
      properties: {
        kind,
        primary,
        unit,
        text: `${formatLengthFeet(sample.elevationMeters)}${isExtreme ? ` ${formatDeltaFeet(delta)}` : ""}`,
      },
      geometry: { type: "Point", coordinates: [sample.longitude, sample.latitude] },
    });
  }
  if (intel && (intel.kind === "high" || intel.kind === "low")) {
    const far = destinationPoint(origin, intel.bearing, gpsRangeMeters(400));
    features.push({
      type: "Feature",
      properties: { kind: intel.kind },
      geometry: {
        type: "LineString",
        coordinates: [
          [origin.longitude, origin.latitude],
          [far.longitude, far.latitude],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

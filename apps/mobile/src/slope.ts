import {
  haversineMeters,
  sampleOpenMeteoElevation,
  type BoundingBox,
} from '@huntos/core';

const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

export type SlopeSample = {
  latitude: number;
  longitude: number;
  slopePct: number | null;
  aspectDeg: number | null;
};

export async function sampleViewportSlope(
  bounds: BoundingBox,
  cols = 8,
  rows = 8,
): Promise<SlopeSample[]> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      points.push({
        latitude: bounds.south + ((r + 0.5) / rows) * (bounds.north - bounds.south),
        longitude: bounds.west + ((c + 0.5) / cols) * (bounds.east - bounds.west),
      });
    }
  }
  const samples = await sampleOpenMeteoElevation(points, ELEVATION_URL);
  const elev = new Map(
    samples.map((item) => [
      `${item.point.latitude.toFixed(5)},${item.point.longitude.toFixed(5)}`,
      item.elevationMeters,
    ]),
  );
  const lookup = (latitude: number, longitude: number) =>
    elev.get(`${latitude.toFixed(5)},${longitude.toFixed(5)}`);

  return points.map((point, index) => {
    const here = lookup(point.latitude, point.longitude);
    const east = points[index + 1];
    const north = points[index + cols];
    if (
      here == null ||
      !east ||
      !north ||
      (index % cols) === cols - 1
    ) {
      return { ...point, slopePct: null, aspectDeg: null };
    }
    const eElev = lookup(east.latitude, east.longitude);
    const nElev = lookup(north.latitude, north.longitude);
    if (eElev == null || nElev == null) {
      return { ...point, slopePct: null, aspectDeg: null };
    }
    const dx = haversineMeters(point, east);
    const dy = haversineMeters(point, north);
    if (dx < 1 || dy < 1) {
      return { ...point, slopePct: null, aspectDeg: null };
    }
    const dzx = (eElev - here) / dx;
    const dzy = (nElev - here) / dy;
    const slopePct = Math.sqrt(dzx * dzx + dzy * dzy) * 100;
    const aspectDeg = ((Math.atan2(dzx, dzy) * 180) / Math.PI + 360) % 360;
    return { ...point, slopePct, aspectDeg };
  });
}

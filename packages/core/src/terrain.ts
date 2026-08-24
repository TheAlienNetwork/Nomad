import { destinationPoint, haversineMeters } from "./geo";
import type { BoundingBox, LonLat, Uncertainty } from "./types";

export interface ElevationSample {
  point: LonLat;
  elevationMeters: number;
}

export interface TerrainCell {
  cellId: string;
  center: LonLat;
  elevationMeters: number | null;
  slopeDegrees: number | null;
  aspectDegrees: number | null;
  terrainPosition: "ridge" | "slope" | "valley" | "flat" | "unknown";
}

export interface TerrainGrid {
  truthLayer: "authoritative";
  source: "elevation_samples";
  cells: TerrainCell[];
  rows: number;
  cols: number;
  cellSizeMeters: number;
  uncertainty: Uncertainty;
}

export interface ElevationProvider {
  sample(points: LonLat[]): Promise<ElevationSample[]>;
}

export function cellId(point: LonLat, precision = 4): string {
  return `${point.latitude.toFixed(precision)}:${point.longitude.toFixed(precision)}`;
}

export function buildSampleGrid(
  bounds: BoundingBox,
  maxCells = 36,
): { points: LonLat[]; rows: number; cols: number; cellSizeMeters: number } {
  const width = haversineMeters(
    { longitude: bounds.west, latitude: (bounds.south + bounds.north) / 2 },
    { longitude: bounds.east, latitude: (bounds.south + bounds.north) / 2 },
  );
  const height = haversineMeters(
    { longitude: bounds.west, latitude: bounds.south },
    { longitude: bounds.west, latitude: bounds.north },
  );
  const cols = Math.max(3, Math.min(8, Math.round(Math.sqrt(maxCells))));
  const rows = Math.max(3, Math.min(8, Math.round(maxCells / cols)));
  const points: LonLat[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const longitude =
        bounds.west + ((c + 0.5) / cols) * (bounds.east - bounds.west);
      const latitude =
        bounds.south + ((r + 0.5) / rows) * (bounds.north - bounds.south);
      points.push({ longitude, latitude });
    }
  }
  return {
    points,
    rows,
    cols,
    cellSizeMeters: Math.max(width / cols, height / rows),
  };
}

export function slopeDegrees(
  dzdx: number,
  dzdy: number,
): number {
  return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
}

export function aspectDegrees(dzdx: number, dzdy: number): number {
  if (dzdx === 0 && dzdy === 0) return 0;
  const radians = Math.atan2(dzdx, dzdy);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function classifyTerrainPosition(
  slope: number | null,
  neighborElevations: Array<number | null>,
  elevation: number | null,
): TerrainCell["terrainPosition"] {
  if (slope === null || elevation === null) return "unknown";
  if (slope < 3) return "flat";
  const known = neighborElevations.filter(
    (value): value is number => value !== null,
  );
  if (known.length < 3) return "slope";
  const max = Math.max(...known);
  const min = Math.min(...known);
  if (elevation >= max - 2) return "ridge";
  if (elevation <= min + 2) return "valley";
  return "slope";
}

export function deriveTerrainGrid(
  samples: ElevationSample[],
  rows: number,
  cols: number,
  cellSizeMeters: number,
): TerrainGrid {
  const byId = new Map(
    samples.map((sample) => [cellId(sample.point), sample.elevationMeters]),
  );
  const cells: TerrainCell[] = samples.map((sample, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const east = destinationPoint(sample.point, 90, cellSizeMeters);
    const north = destinationPoint(sample.point, 0, cellSizeMeters);
    const west = destinationPoint(sample.point, 270, cellSizeMeters);
    const south = destinationPoint(sample.point, 180, cellSizeMeters);
    const e = byId.get(cellId(east));
    const w = byId.get(cellId(west));
    const n = byId.get(cellId(north));
    const s = byId.get(cellId(south));
    const neighbor = (r: number, c: number): number | null => {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
      return samples[r * cols + c]?.elevationMeters ?? null;
    };
    const eVal = e ?? neighbor(row, col + 1);
    const wVal = w ?? neighbor(row, col - 1);
    const nVal = n ?? neighbor(row + 1, col);
    const sVal = s ?? neighbor(row - 1, col);
    let slope: number | null = null;
    let aspect: number | null = null;
    if (
      eVal !== null &&
      eVal !== undefined &&
      wVal !== null &&
      wVal !== undefined &&
      nVal !== null &&
      nVal !== undefined &&
      sVal !== null &&
      sVal !== undefined
    ) {
      const dzdx = (eVal - wVal) / (2 * cellSizeMeters);
      const dzdy = (nVal - sVal) / (2 * cellSizeMeters);
      slope = slopeDegrees(dzdx, dzdy);
      aspect = aspectDegrees(dzdx, dzdy);
    } else if (sample.elevationMeters !== null) {
      slope = null;
      aspect = null;
    }
    return {
      cellId: cellId(sample.point),
      center: sample.point,
      elevationMeters: sample.elevationMeters,
      slopeDegrees: slope,
      aspectDegrees: aspect,
      terrainPosition: classifyTerrainPosition(slope, [eVal ?? null, wVal ?? null, nVal ?? null, sVal ?? null], sample.elevationMeters),
    };
  });

  const missing: TerrainGrid["uncertainty"]["missing"] = [];
  if (cells.some((cell) => cell.slopeDegrees === null)) {
    missing.push({
      factor: "slope",
      reason: "Neighbor elevation samples were insufficient to derive slope.",
    });
  }
  return {
    truthLayer: "authoritative",
    source: "elevation_samples",
    cells,
    rows,
    cols,
    cellSizeMeters,
    uncertainty: {
      confidence: missing.length === 0 ? 0.82 : 0.55,
      missing,
      warnings: [
        "Slope and aspect are derived from sampled elevations, not a full DEM.",
      ],
    },
  };
}

export async function analyzeTerrain(
  bounds: BoundingBox,
  provider: ElevationProvider,
  maxCells = 36,
): Promise<TerrainGrid> {
  const grid = buildSampleGrid(bounds, maxCells);
  const samples = await provider.sample(grid.points);
  if (samples.length === 0) {
    return {
      truthLayer: "authoritative",
      source: "elevation_samples",
      cells: [],
      rows: grid.rows,
      cols: grid.cols,
      cellSizeMeters: grid.cellSizeMeters,
      uncertainty: {
        confidence: 0,
        missing: [
          {
            factor: "elevation",
            reason: "Elevation provider returned no samples.",
          },
        ],
        warnings: ["Terrain analysis is unavailable for this area."],
      },
    };
  }
  return deriveTerrainGrid(samples, grid.rows, grid.cols, grid.cellSizeMeters);
}

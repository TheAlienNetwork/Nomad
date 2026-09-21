import type { GeoJsonFeatureCollection } from "./gis";
import type { TerrainCell, TerrainGrid } from "./terrain";
import type { LonLat, TruthLayer } from "./types";

export const TERRAIN_FEATURE_DISCLAIMER =
  "Inferred from sampled elevations, not a lidar DEM. Confirm on the ground.";

export const TERRAIN_FEATURE_KINDS = [
  "saddle",
  "bench",
  "funnel",
  "pinch",
  "ridgeline",
  "drainage",
  "basin",
  "cliff",
  "glassing_candidate",
] as const;

export type TerrainFeatureKind = (typeof TERRAIN_FEATURE_KINDS)[number];

export interface TerrainFeature {
  id: string;
  kind: TerrainFeatureKind;
  cellId: string;
  center: LonLat;
  truthLayer: Extract<TruthLayer, "inferred">;
  source: "elevation_samples";
  confidence: number;
  label: string;
  reasons: string[];
  disclaimer: string;
}

const FEATURE_LABELS: Record<TerrainFeatureKind, string> = {
  saddle: "Saddle",
  bench: "Bench",
  funnel: "Funnel",
  pinch: "Pinch point",
  ridgeline: "Ridgeline",
  drainage: "Drainage",
  basin: "Basin",
  cliff: "Cliff",
  glassing_candidate: "Glassing candidate",
};

function cellAt(
  grid: TerrainGrid,
  row: number,
  col: number,
): TerrainCell | undefined {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) {
    return undefined;
  }
  return grid.cells[row * grid.cols + col];
}

function neighbor(
  grid: TerrainGrid,
  row: number,
  col: number,
  dRow: number,
  dCol: number,
): TerrainCell | undefined {
  return cellAt(grid, row + dRow, col + dCol);
}

function isSaddle(
  cell: TerrainCell,
  north: TerrainCell | undefined,
  south: TerrainCell | undefined,
  east: TerrainCell | undefined,
  west: TerrainCell | undefined,
): boolean {
  const elev = cell.elevationMeters;
  const n = north?.elevationMeters;
  const s = south?.elevationMeters;
  const e = east?.elevationMeters;
  const w = west?.elevationMeters;
  if (
    elev === null ||
    n === undefined ||
    s === undefined ||
    e === undefined ||
    w === undefined ||
    n === null ||
    s === null ||
    e === null ||
    w === null
  ) {
    return false;
  }
  const nsMin = elev < n - 4 && elev < s - 4;
  const nsMax = elev > n + 4 && elev > s + 4;
  const ewMin = elev < e - 4 && elev < w - 4;
  const ewMax = elev > e + 4 && elev > w + 4;
  return (nsMin && ewMax) || (nsMax && ewMin);
}

function isLocalExtremum(
  cell: TerrainCell,
  grid: TerrainGrid,
  row: number,
  col: number,
  mode: "min" | "max",
): boolean {
  const elev = cell.elevationMeters;
  if (elev === null) return false;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const other = neighbor(grid, row, col, dr, dc)?.elevationMeters;
      if (other === undefined || other === null) continue;
      if (mode === "min" && other < elev - 0.5) return false;
      if (mode === "max" && other > elev + 0.5) return false;
    }
  }
  return true;
}

function maxDropMeters(
  cell: TerrainCell,
  grid: TerrainGrid,
  row: number,
  col: number,
): number {
  const elev = cell.elevationMeters;
  if (elev === null) return 0;
  let drop = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const other = neighbor(grid, row, col, dr, dc)?.elevationMeters;
      if (other === undefined || other === null) continue;
      drop = Math.max(drop, elev - other);
    }
  }
  return drop;
}

function makeFeature(
  kind: TerrainFeatureKind,
  cell: TerrainCell,
  confidence: number,
  reasons: string[],
): TerrainFeature {
  return {
    id: `${kind}:${cell.cellId}`,
    kind,
    cellId: cell.cellId,
    center: cell.center,
    truthLayer: "inferred",
    source: "elevation_samples",
    confidence,
    label: FEATURE_LABELS[kind],
    reasons,
    disclaimer: TERRAIN_FEATURE_DISCLAIMER,
  };
}

export function detectTerrainFeatures(grid: TerrainGrid): TerrainFeature[] {
  if (grid.cells.length === 0) return [];
  const features: TerrainFeature[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const cell = cellAt(grid, row, col);
      if (!cell || cell.elevationMeters === null) continue;
      const north = neighbor(grid, row, col, 1, 0);
      const south = neighbor(grid, row, col, -1, 0);
      const east = neighbor(grid, row, col, 0, 1);
      const west = neighbor(grid, row, col, 0, -1);
      const slope = cell.slopeDegrees;
      const kinds = new Set<TerrainFeatureKind>();

      if (isSaddle(cell, north, south, east, west)) {
        kinds.add("saddle");
      }
      if (slope !== null && slope >= 35) {
        kinds.add("cliff");
      }
      if (
        isLocalExtremum(cell, grid, row, col, "min") &&
        (slope === null || slope < 12)
      ) {
        kinds.add("basin");
      }
      if (isLocalExtremum(cell, grid, row, col, "max")) {
        kinds.add("ridgeline");
        if (maxDropMeters(cell, grid, row, col) >= 15) {
          kinds.add("glassing_candidate");
        }
      }
      if (cell.terrainPosition === "ridge") {
        kinds.add("ridgeline");
      }
      const eastHigh =
        east?.elevationMeters != null &&
        cell.elevationMeters != null &&
        east.elevationMeters - cell.elevationMeters > 15;
      const westHigh =
        west?.elevationMeters != null &&
        cell.elevationMeters != null &&
        west.elevationMeters - cell.elevationMeters > 15;
      const northHigh =
        north?.elevationMeters != null &&
        cell.elevationMeters != null &&
        north.elevationMeters - cell.elevationMeters > 15;
      const southHigh =
        south?.elevationMeters != null &&
        cell.elevationMeters != null &&
        south.elevationMeters - cell.elevationMeters > 15;
      if (cell.terrainPosition === "valley" || (eastHigh && westHigh) || (northHigh && southHigh)) {
        kinds.add("drainage");
      }
      if ((eastHigh && westHigh) || (northHigh && southHigh)) {
        const pinch =
          (eastHigh && westHigh && !northHigh && !southHigh) ||
          (northHigh && southHigh && !eastHigh && !westHigh);
        kinds.add(pinch ? "pinch" : "funnel");
      }
      if (
        cell.terrainPosition === "slope" &&
        slope !== null &&
        slope >= 4 &&
        slope <= 18
      ) {
        const eastSlope = east?.slopeDegrees;
        const westSlope = west?.slopeDegrees;
        const northSlope = north?.slopeDegrees;
        const southSlope = south?.slopeDegrees;
        const steeperNeighbor = [eastSlope, westSlope, northSlope, southSlope]
          .filter((value): value is number => value !== null && value !== undefined)
          .some((value) => value > slope + 4);
        if (steeperNeighbor || kinds.size === 0) {
          kinds.add("bench");
        }
      }

      for (const kind of kinds) {
        switch (kind) {
          case "saddle":
            features.push(
              makeFeature(kind, cell, 0.62, [
                "Local min along one axis and max along the perpendicular",
              ]),
            );
            break;
          case "bench":
            features.push(
              makeFeature(kind, cell, 0.58, [
                "Moderate mid-slope flattening relative to neighboring samples",
              ]),
            );
            break;
          case "funnel":
            features.push(
              makeFeature(kind, cell, 0.6, [
                "Valley with higher terrain on the sides — possible travel constriction",
              ]),
            );
            break;
          case "pinch":
            features.push(
              makeFeature(kind, cell, 0.64, [
                "Narrow valley between higher neighboring samples",
              ]),
            );
            break;
          case "ridgeline":
            features.push(
              makeFeature(kind, cell, 0.66, ["Local high relative to neighboring samples"]),
            );
            break;
          case "drainage":
            features.push(
              makeFeature(kind, cell, 0.6, ["Local low — possible drainage or draw"]),
            );
            break;
          case "basin":
            features.push(
              makeFeature(kind, cell, 0.63, ["Local elevation minimum among sampled neighbors"]),
            );
            break;
          case "cliff":
            features.push(
              makeFeature(kind, cell, 0.7, [
                `Derived slope ${Math.round(slope ?? 0)}° from sampled elevations`,
              ]),
            );
            break;
          case "glassing_candidate":
            features.push(
              makeFeature(kind, cell, 0.55, [
                "Local high point with a drop to neighboring samples — not a line-of-sight result",
              ]),
            );
            break;
          default: {
            const _exhaustive: never = kind;
            return _exhaustive;
          }
        }
      }
    }
  }
  return features;
}

export function terrainFeaturesToGeoJson(
  features: readonly TerrainFeature[],
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      id: feature.id,
      geometry: {
        type: "Point",
        coordinates: [feature.center.longitude, feature.center.latitude],
      },
      properties: {
        truthLayer: feature.truthLayer,
        source: feature.source,
        kind: feature.kind,
        label: feature.label,
        cellId: feature.cellId,
        confidence: feature.confidence,
        reasons: feature.reasons,
        disclaimer: feature.disclaimer,
      },
    })),
  };
}

export function featuresForCell(
  features: readonly TerrainFeature[],
  cellId: string,
): TerrainFeatureKind[] {
  return features.filter((feature) => feature.cellId === cellId).map((feature) => feature.kind);
}

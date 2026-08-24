import type { TerrainCell } from "./terrain";
import type { SpeciesId, TruthLayer, Uncertainty } from "./types";

export type LandCoverClass =
  | "open"
  | "grassland"
  | "shrub"
  | "deciduous_forest"
  | "evergreen_forest"
  | "mixed_forest"
  | "wetland"
  | "agricultural"
  | "developed"
  | "water"
  | "unknown";

export interface HabitatCellInput {
  cellId: string;
  species: SpeciesId;
  center?: { latitude: number; longitude: number };
  elevationMeters?: number | null;
  slopeDegrees?: number | null;
  aspectDegrees?: number | null;
  distanceToWaterMeters?: number | null;
  distanceToRoadMeters?: number | null;
  distanceToTrailMeters?: number | null;
  landCover?: LandCoverClass | null;
  forestCover?: number | null;
  edgeDensity?: number | null;
  distanceToOpeningMeters?: number | null;
  terrainPosition?: TerrainCell["terrainPosition"] | null;
  publicLandStatus?: "public" | "unknown";
  legalAccessConfidence?: "authoritative" | "incomplete" | "unavailable";
  userObservationDensity?: number | null;
  estimatedHumanAccessPressure?: number | null;
}

export interface HabitatScores {
  bedding: number | null;
  feeding: number | null;
  water: number | null;
  security: number | null;
  travel: number | null;
  overall: number | null;
}

export interface HabitatScoreResult {
  cellId: string;
  species: SpeciesId;
  truthLayer: TruthLayer;
  scores: HabitatScores;
  confidence: number;
  reasons: string[];
  missing: Uncertainty["missing"];
  disclaimer: string;
}

export interface HabitatConditions {
  period: "now" | "morning" | "evening" | "custom";
  method?: "spot_and_stalk" | "stand" | "blind" | "still" | "any";
}

const DISCLAIMER =
  "These scores are habitat heuristics from available data. They are not claims that animals are present.";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inverseDistanceScore(
  meters: number | null | undefined,
  near: number,
  far: number,
): number | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) {
    return null;
  }
  if (meters <= near) return 100;
  if (meters >= far) return 0;
  return clamp(100 - ((meters - near) / (far - near)) * 100);
}

function forestBonus(cover: LandCoverClass | null | undefined): number {
  switch (cover) {
    case "deciduous_forest":
    case "mixed_forest":
      return 22;
    case "evergreen_forest":
      return 18;
    case "shrub":
      return 10;
    case "wetland":
      return 8;
    case "grassland":
    case "open":
      return -6;
    case "agricultural":
      return -4;
    case "developed":
      return -24;
    case "water":
      return -30;
    case "unknown":
    case undefined:
    case null:
      return 0;
    default: {
      const _exhaustive: never = cover;
      return _exhaustive;
    }
  }
}

function feedingBonus(cover: LandCoverClass | null | undefined): number {
  switch (cover) {
    case "agricultural":
      return 24;
    case "open":
    case "grassland":
      return 16;
    case "shrub":
    case "wetland":
      return 10;
    case "deciduous_forest":
    case "mixed_forest":
      return 6;
    case "evergreen_forest":
      return 2;
    case "developed":
      return -16;
    case "water":
      return -20;
    case "unknown":
    case undefined:
    case null:
      return 0;
    default: {
      const _exhaustive: never = cover;
      return _exhaustive;
    }
  }
}

function average(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return null;
  return clamp(known.reduce((sum, value) => sum + value, 0) / known.length);
}

function speciesAdjust(
  species: SpeciesId,
  scores: HabitatScores,
): HabitatScores {
  switch (species) {
    case "whitetail":
      return scores;
    case "mule_deer":
      return {
        ...scores,
        bedding:
          scores.bedding === null ? null : clamp(scores.bedding + 4),
        security:
          scores.security === null ? null : clamp(scores.security + 2),
      };
    case "elk":
      return {
        ...scores,
        travel: scores.travel === null ? null : clamp(scores.travel + 6),
        security:
          scores.security === null ? null : clamp(scores.security + 4),
      };
    case "turkey":
      return {
        ...scores,
        feeding: scores.feeding === null ? null : clamp(scores.feeding + 6),
        bedding: scores.bedding === null ? null : clamp(scores.bedding - 8),
      };
    default: {
      const _exhaustive: never = species;
      return _exhaustive;
    }
  }
}

export function scoreHabitatCell(
  input: HabitatCellInput,
  _conditions: HabitatConditions,
): HabitatScoreResult {
  const missing: HabitatScoreResult["missing"] = [];
  const reasons: string[] = [];

  const require = (
    value: number | null | undefined,
    factor: string,
    reason: string,
  ): number | null => {
    if (value === null || value === undefined) {
      missing.push({ factor, reason });
      return null;
    }
    return value;
  };

  const coverBonus = forestBonus(input.landCover);
  const roadScore = inverseDistanceScore(input.distanceToRoadMeters, 400, 2500);
  const trailScore = inverseDistanceScore(input.distanceToTrailMeters, 200, 1600);
  const waterScore = inverseDistanceScore(input.distanceToWaterMeters, 80, 1600);
  const slope = input.slopeDegrees ?? null;

  let bedding: number | null = 48 + coverBonus;
  if (input.landCover === "unknown" || !input.landCover) {
    missing.push({
      factor: "land_cover",
      reason: "No authoritative land-cover value for this cell.",
    });
  } else if (coverBonus > 12) {
    reasons.push("Dense or mixed cover present in available land-cover class");
  }
  if (slope !== null) {
    bedding += slope > 8 && slope < 35 ? 8 : slope >= 35 ? -6 : 0;
  } else {
    missing.push({ factor: "slope", reason: "Slope was not derived." });
  }
  if (roadScore !== null) {
    bedding += Math.round((roadScore - 40) * 0.18);
    if (roadScore > 70) reasons.push("Away from mapped motorized access");
  } else {
    missing.push({
      factor: "distance_to_road",
      reason: "Road distance is unavailable; security/bedding not fully scored.",
    });
  }

  let feeding: number | null = 46 + feedingBonus(input.landCover);
  if (input.distanceToOpeningMeters !== null && input.distanceToOpeningMeters !== undefined) {
    feeding += inverseDistanceScore(input.distanceToOpeningMeters, 40, 600) ?? 0;
    if (input.distanceToOpeningMeters < 250) {
      reasons.push("Terrain or cover/open-edge transition nearby");
    }
  }
  if (input.edgeDensity !== null && input.edgeDensity !== undefined) {
    feeding += clamp(input.edgeDensity * 20) * 0.2;
  }

  const water = require(
    waterScore,
    "distance_to_water",
    "Water distance is unavailable. Water suitability is not estimated.",
  );
  if (water !== null && water > 70) reasons.push("Near mapped or sampled water");

  let security: number | null = 50 + Math.max(0, coverBonus);
  if (roadScore !== null) security += Math.round(roadScore * 0.25);
  if (trailScore !== null) security += Math.round(trailScore * 0.1);
  if (input.estimatedHumanAccessPressure !== null && input.estimatedHumanAccessPressure !== undefined) {
    security -= Math.round(input.estimatedHumanAccessPressure * 20);
  }
  if (input.publicLandStatus === "unknown") {
    missing.push({
      factor: "public_land_status",
      reason: "Public/private status is unknown for this cell.",
    });
  }

  let travel: number | null = 50;
  if (input.terrainPosition === "valley" || input.terrainPosition === "ridge") {
    travel += 12;
    reasons.push("Terrain constriction or travel-shape nearby");
  } else if (input.terrainPosition === "unknown" || !input.terrainPosition) {
    missing.push({
      factor: "terrain_position",
      reason: "Terrain position was not classified.",
    });
  }
  if (slope !== null) {
    travel += slope > 5 && slope < 28 ? 8 : 0;
  }

  const adjusted = speciesAdjust(input.species, {
    bedding: bedding === null ? null : clamp(bedding),
    feeding: clamp(feeding),
    water,
    security: clamp(security),
    travel: clamp(travel),
    overall: null,
  });
  adjusted.overall = average([
    adjusted.bedding,
    adjusted.feeding,
    adjusted.water,
    adjusted.security,
    adjusted.travel,
  ]);

  const confidence = Math.max(
    0.15,
    0.88 - missing.length * 0.08,
  );

  if (reasons.length === 0) {
    reasons.push("Limited structured evidence; scores reflect only available factors");
  }

  return {
    cellId: input.cellId,
    species: input.species,
    truthLayer: "inferred",
    scores: adjusted,
    confidence: Number(confidence.toFixed(2)),
    reasons,
    missing,
    disclaimer: DISCLAIMER,
  };
}

export function scoreHabitat(
  species: SpeciesId,
  conditions: HabitatConditions,
  cells: HabitatCellInput[],
): HabitatScoreResult[] {
  return cells.map((cell) =>
    scoreHabitatCell({ ...cell, species }, conditions),
  );
}

export function topSetups(
  results: HabitatScoreResult[],
  limit = 3,
): HabitatScoreResult[] {
  return [...results]
    .filter((result) => result.scores.overall !== null)
    .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
    .slice(0, limit);
}

import { formatDistance } from "./geo";
import {
  featuresContainingPoint,
  nearestDistanceMeters,
  overlayFeatureLabel,
  type GeoJsonFeatureCollection,
} from "./gis";
import { speciesWeights } from "./species-models";
import type { TerrainCell } from "./terrain";
import type { TerrainFeature, TerrainFeatureKind } from "./terrain-features";
import { featuresForCell } from "./terrain-features";
import type { SpeciesId, TruthLayer, Uncertainty, WindClass } from "./types";

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
  terrainFeatures?: TerrainFeatureKind[];
  windClass?: WindClass | null;
  publicLandStatus?: "public" | "unknown";
  legalAccessConfidence?: "authoritative" | "incomplete" | "unavailable";
  padusUnitName?: string;
  huntingUnitLabel?: string;
  publicHuntAreaLabel?: string;
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

export interface HuntScoreExplanation {
  truthLayer: Extract<TruthLayer, "inferred">;
  label: "Nomad Score";
  score: number | null;
  confidence: number;
  reasons: string[];
  missing: Uncertainty["missing"];
  unavailable: string[];
  disclaimer: string;
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
  explanation: HuntScoreExplanation;
}

export interface HabitatConditions {
  period: "now" | "morning" | "evening" | "custom";
  method?: "spot_and_stalk" | "stand" | "blind" | "still" | "any";
}

export const HABITAT_SCORE_DISCLAIMER =
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

function applySpeciesWeights(species: SpeciesId, scores: HabitatScores): HabitatScores {
  const weights = speciesWeights(species);
  if (!weights) {
    return {
      bedding: null,
      feeding: null,
      water: null,
      security: null,
      travel: null,
      overall: null,
    };
  }
  const shift = (value: number | null, delta: number): number | null =>
    value === null ? null : clamp(value + delta);
  return {
    bedding: shift(scores.bedding, weights.beddingDelta),
    feeding: shift(scores.feeding, weights.feedingDelta),
    water: shift(scores.water, weights.waterDelta),
    security: shift(scores.security, weights.securityDelta),
    travel: shift(scores.travel, weights.travelDelta),
    overall: scores.overall,
  };
}

function isNorthFacing(aspectDegrees: number | null | undefined): boolean {
  if (aspectDegrees === null || aspectDegrees === undefined) return false;
  return aspectDegrees >= 315 || aspectDegrees <= 45;
}

function aspectPhrase(aspectDegrees: number | null | undefined): string {
  if (!isNorthFacing(aspectDegrees)) return "";
  return "north-facing ";
}

function featureLabel(kind: TerrainFeatureKind): string {
  switch (kind) {
    case "saddle":
      return "saddle";
    case "bench":
      return "bench";
    case "funnel":
      return "terrain funnel";
    case "pinch":
      return "pinch point";
    case "ridgeline":
      return "ridgeline";
    case "drainage":
      return "drainage";
    case "basin":
      return "basin";
    case "cliff":
      return "steep break";
    case "glassing_candidate":
      return "glassing candidate";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function periodAdjust(
  period: HabitatConditions["period"],
  dim: "bedding" | "feeding" | "water" | "security" | "travel",
): number {
  switch (period) {
    case "morning":
      if (dim === "bedding" || dim === "security") return 8;
      if (dim === "travel") return 6;
      if (dim === "feeding") return -4;
      return 0;
    case "evening":
      if (dim === "feeding") return 8;
      if (dim === "water") return 6;
      if (dim === "travel") return 4;
      if (dim === "bedding") return -4;
      return 0;
    case "now":
    case "custom":
      return 0;
    default: {
      const _exhaustive: never = period;
      return _exhaustive;
    }
  }
}

function methodAdjust(
  method: HabitatConditions["method"],
  dim: "bedding" | "feeding" | "water" | "security" | "travel",
  features: readonly TerrainFeatureKind[],
): number {
  switch (method) {
    case "stand":
    case "blind":
      if (dim === "travel") return 6;
      if (dim === "security") return 4;
      return 0;
    case "spot_and_stalk":
      if (dim === "travel" && (features.includes("ridgeline") || features.includes("glassing_candidate"))) {
        return 8;
      }
      return 0;
    case "still":
      if (dim === "security") return 6;
      return 0;
    case "any":
    case undefined:
      return 0;
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

export function explainHuntScore(result: HabitatScoreResult): HuntScoreExplanation {
  return {
    truthLayer: "inferred",
    label: "Nomad Score",
    score: result.scores.overall,
    confidence: result.confidence,
    reasons: result.reasons,
    missing: result.missing,
    unavailable: result.missing.map((item) => item.factor),
    disclaimer: result.disclaimer,
  };
}

export function scoreHabitatCell(
  input: HabitatCellInput,
  conditions: HabitatConditions,
): HabitatScoreResult {
  const missing: HabitatScoreResult["missing"] = [];
  const reasons: string[] = [];
  const features = input.terrainFeatures ?? [];

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
  const facing = aspectPhrase(input.aspectDegrees);

  let bedding: number | null = 48 + coverBonus;
  if (input.landCover === "unknown" || !input.landCover) {
    missing.push({
      factor: "land_cover",
      reason: "No authoritative land-cover value for this cell.",
    });
  } else if (coverBonus > 12) {
    reasons.push("dense or mixed cover in the available land-cover class");
  }
  if (slope !== null) {
    bedding += slope > 8 && slope < 35 ? 8 : slope >= 35 ? -6 : 0;
  } else {
    missing.push({ factor: "slope", reason: "Slope was not derived." });
  }
  if (roadScore !== null) {
    bedding += Math.round((roadScore - 40) * 0.18);
    if (roadScore > 70 && input.distanceToRoadMeters != null) {
      reasons.push(`${formatDistance(input.distanceToRoadMeters)} from nearest road`);
    }
  } else {
    missing.push({
      factor: "distance_to_road",
      reason: "Road distance is unavailable; security/bedding not fully scored.",
    });
  }
  if (features.includes("bench")) {
    bedding += 10;
    reasons.push(`${facing}bench`.trim());
  }
  if (features.includes("basin")) {
    bedding += 6;
    reasons.push("basin terrain");
  }

  let feeding: number | null = 46 + feedingBonus(input.landCover);
  if (input.distanceToOpeningMeters !== null && input.distanceToOpeningMeters !== undefined) {
    feeding += inverseDistanceScore(input.distanceToOpeningMeters, 40, 600) ?? 0;
    if (input.distanceToOpeningMeters < 250) {
      reasons.push("cover/open-edge transition nearby");
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
  if (water !== null && water > 70 && input.distanceToWaterMeters != null) {
    reasons.push(`${formatDistance(input.distanceToWaterMeters)} from water`);
  }

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
  if (input.padusUnitName) {
    reasons.push(
      `PAD-US: ${input.padusUnitName} (access category, not a hunt license)`,
    );
  }
  if (input.publicHuntAreaLabel) {
    reasons.push(
      `TPWD listed hunt area: ${input.publicHuntAreaLabel} (not seasons or permission)`,
    );
  }
  if (input.huntingUnitLabel) {
    reasons.push(
      `TPWD deer management unit ${input.huntingUnitLabel} (not seasons)`,
    );
  }
  if (features.includes("cliff")) {
    security += 4;
  }

  switch (input.windClass) {
    case "favorable":
      security += 6;
      reasons.push(
        conditions.period === "morning" ? "favorable morning wind" : "favorable wind",
      );
      break;
    case "unfavorable":
      security -= 10;
      reasons.push("unfavorable wind relative to this cell");
      break;
    case "marginal":
      reasons.push("marginal wind");
      break;
    case "unknown":
    case undefined:
    case null:
      missing.push({
        factor: "wind",
        reason: "No wind observation for this cell.",
      });
      break;
    default: {
      const _exhaustive: never = input.windClass;
      return _exhaustive;
    }
  }

  let travel: number | null = 50;
  if (input.terrainPosition === "valley" || input.terrainPosition === "ridge") {
    travel += 12;
  } else if (input.terrainPosition === "unknown" || !input.terrainPosition) {
    missing.push({
      factor: "terrain_position",
      reason: "Terrain position was not classified.",
    });
  }
  if (slope !== null) {
    travel += slope > 5 && slope < 28 ? 8 : 0;
  }
  if (features.includes("funnel") || features.includes("pinch") || features.includes("saddle")) {
    travel += 10;
    if (features.includes("funnel")) reasons.push("strong terrain funnel");
    if (features.includes("pinch")) reasons.push("pinch point");
    if (features.includes("saddle")) reasons.push("saddle");
  }
  if (features.includes("ridgeline") && !reasons.some((item) => item.includes("ridgeline"))) {
    reasons.push("ridgeline");
  }
  if (features.includes("drainage")) {
    travel += 4;
    reasons.push("drainage");
  }
  if (features.includes("glassing_candidate")) {
    reasons.push("glassing candidate (elevation only — not line-of-sight)");
  }
  if (features.includes("cliff")) {
    travel -= 8;
  }

  const applyDim = (
    value: number | null,
    dim: "bedding" | "feeding" | "water" | "security" | "travel",
  ): number | null => {
    if (value === null) return null;
    return clamp(
      value + periodAdjust(conditions.period, dim) + methodAdjust(conditions.method, dim, features),
    );
  };

  const adjusted = applySpeciesWeights(input.species, {
    bedding: applyDim(bedding, "bedding"),
    feeding: applyDim(feeding, "feeding"),
    water: applyDim(water, "water"),
    security: applyDim(security, "security"),
    travel: applyDim(travel, "travel"),
    overall: null,
  });
  const knownCount = [
    adjusted.bedding,
    adjusted.feeding,
    adjusted.water,
    adjusted.security,
    adjusted.travel,
  ].filter((value) => value !== null).length;
  adjusted.overall = knownCount < 2 ? null : average([
    adjusted.bedding,
    adjusted.feeding,
    adjusted.water,
    adjusted.security,
    adjusted.travel,
  ]);

  const confidence = Math.max(0.15, 0.88 - missing.length * 0.08);

  if (reasons.length === 0) {
    reasons.push("Limited structured evidence; scores reflect only available factors");
  }

  const result: HabitatScoreResult = {
    cellId: input.cellId,
    species: input.species,
    truthLayer: "inferred",
    scores: adjusted,
    confidence: Number(confidence.toFixed(2)),
    reasons,
    missing,
    disclaimer: HABITAT_SCORE_DISCLAIMER,
    explanation: {
      truthLayer: "inferred",
      label: "Nomad Score",
      score: null,
      confidence: Number(confidence.toFixed(2)),
      reasons,
      missing,
      unavailable: missing.map((item) => item.factor),
      disclaimer: HABITAT_SCORE_DISCLAIMER,
    },
  };
  result.explanation = explainHuntScore(result);
  return result;
}

export function attachHabitatContext(
  cells: HabitatCellInput[],
  context: {
    water?: GeoJsonFeatureCollection | null;
    roads?: GeoJsonFeatureCollection | null;
    padus?: GeoJsonFeatureCollection | null;
    huntingUnits?: GeoJsonFeatureCollection | null;
    publicHuntAreas?: GeoJsonFeatureCollection | null;
    features?: readonly TerrainFeature[];
    windClass?: WindClass | null;
  },
): HabitatCellInput[] {
  return cells.map((cell) => {
    const center = cell.center;
    const waterDistance =
      context.water && center
        ? nearestDistanceMeters(center, context.water)
        : cell.distanceToWaterMeters;
    const roadDistance =
      context.roads && center
        ? nearestDistanceMeters(center, context.roads)
        : cell.distanceToRoadMeters;
    const padusHits =
      context.padus && center ? featuresContainingPoint(context.padus, center) : [];
    const unitHits =
      context.huntingUnits && center
        ? featuresContainingPoint(context.huntingUnits, center)
        : [];
    const huntHits =
      context.publicHuntAreas && center
        ? featuresContainingPoint(context.publicHuntAreas, center)
        : [];
    const insidePadus = padusHits.length > 0;
    return {
      ...cell,
      distanceToWaterMeters: waterDistance ?? cell.distanceToWaterMeters,
      distanceToRoadMeters: roadDistance ?? cell.distanceToRoadMeters,
      terrainFeatures: context.features
        ? featuresForCell(context.features, cell.cellId)
        : cell.terrainFeatures,
      windClass: context.windClass ?? cell.windClass,
      publicLandStatus: context.padus
        ? insidePadus
          ? "public"
          : "unknown"
        : cell.publicLandStatus,
      legalAccessConfidence: context.padus
        ? insidePadus
          ? "authoritative"
          : "unavailable"
        : cell.legalAccessConfidence,
      padusUnitName: insidePadus
        ? overlayFeatureLabel(padusHits[0], "PAD-US unit")
        : cell.padusUnitName,
      huntingUnitLabel: unitHits.length
        ? overlayFeatureLabel(unitHits[0], "TPWD DMU")
        : cell.huntingUnitLabel,
      publicHuntAreaLabel: huntHits.length
        ? overlayFeatureLabel(huntHits[0], "TPWD hunt area")
        : cell.publicHuntAreaLabel,
    };
  });
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

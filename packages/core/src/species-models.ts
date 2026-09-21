import type { SpeciesId } from "./types";

export type HabitatScoreDimension =
  | "bedding"
  | "feeding"
  | "water"
  | "security"
  | "travel";

export interface SpeciesScoreWeights {
  species: SpeciesId;
  beddingDelta: number;
  feedingDelta: number;
  waterDelta: number;
  securityDelta: number;
  travelDelta: number;
}

const SCORED_SPECIES_WEIGHTS: Partial<Record<SpeciesId, SpeciesScoreWeights>> = {
  whitetail: {
    species: "whitetail",
    beddingDelta: 0,
    feedingDelta: 0,
    waterDelta: 0,
    securityDelta: 0,
    travelDelta: 0,
  },
  mule_deer: {
    species: "mule_deer",
    beddingDelta: 4,
    feedingDelta: 0,
    waterDelta: 0,
    securityDelta: 2,
    travelDelta: 0,
  },
  elk: {
    species: "elk",
    beddingDelta: 0,
    feedingDelta: 0,
    waterDelta: 0,
    securityDelta: 4,
    travelDelta: 6,
  },
  turkey: {
    species: "turkey",
    beddingDelta: -8,
    feedingDelta: 6,
    waterDelta: 0,
    securityDelta: 0,
    travelDelta: 0,
  },
};

/** Habitat score weights when a model exists. Other species stay unknown. */
export function speciesWeights(species: SpeciesId): SpeciesScoreWeights | null {
  switch (species) {
    case "whitetail":
    case "mule_deer":
    case "elk":
    case "turkey":
      return SCORED_SPECIES_WEIGHTS[species] ?? null;
    case "feral_hog":
    case "dove":
    case "waterfowl":
    case "sika_deer":
    case "axis_deer":
    case "nilgai":
      return null;
    default: {
      const _exhausted: never = species;
      return _exhausted;
    }
  }
}

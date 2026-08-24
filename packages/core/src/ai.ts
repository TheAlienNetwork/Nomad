import { scoreHabitat, topSetups, type HabitatCellInput, type HabitatScoreResult } from "./habitat";
import { evaluateWind, type WindEvaluation, type WindObservation } from "./wind";
import { unavailableIdentify, type IdentifyResult } from "./gis";
import type { BoundingBox, LonLat, SpeciesId } from "./types";
import { VERIFY_REGULATION_WARNING } from "./types";

export type AssistantToolName =
  | "queryPublicLand"
  | "queryHuntingUnits"
  | "queryTerrain"
  | "queryWater"
  | "queryRoads"
  | "queryTrails"
  | "queryObservations"
  | "queryWeather"
  | "scoreHabitat"
  | "evaluateWind"
  | "calculateRoute"
  | "createMapLayer";

export interface ToolEvidence {
  tool: AssistantToolName;
  ok: boolean;
  truthLayer: "authoritative" | "observed" | "inferred";
  summary: string;
  missing?: string[];
  data?: unknown;
}

export interface ScoutRequest {
  species: SpeciesId;
  period: "now" | "morning" | "evening" | "custom";
  method?: "spot_and_stalk" | "stand" | "blind" | "still" | "any";
  bounds: BoundingBox;
  cells: HabitatCellInput[];
  wind?: WindObservation | null;
  identify?: IdentifyResult | null;
  huntingUnitsAvailable: boolean;
  regulationsAvailable: boolean;
}

export interface ScoutExplanation {
  truthLayer: "inferred";
  headline: string;
  narrative: string;
  setups: HabitatScoreResult[];
  wind?: WindEvaluation;
  evidence: ToolEvidence[];
  warnings: string[];
  confidence: number;
}

export interface LegalQuestionResult {
  allowed: boolean;
  answer: string;
  evidence: ToolEvidence[];
}

export function refuseInventedLegalAnswer(
  question: "property" | "regulations" | "season" | "unit",
  evidence: ToolEvidence[],
): LegalQuestionResult {
  const supported = evidence.some((item) => item.ok && item.truthLayer === "authoritative");
  if (supported) {
    return {
      allowed: true,
      answer: "Authoritative records were returned by GIS/regulation tools.",
      evidence,
    };
  }
  const labels: Record<typeof question, string> = {
    property:
      "Property or public/private status cannot be determined because no authoritative land record was returned.",
    regulations:
      "Regulations cannot be stated because no authoritative regulation record is configured.",
    season:
      "Season dates cannot be stated because no authoritative season record is configured.",
    unit: "Hunting-unit identity cannot be stated because no authoritative unit dataset is configured.",
  };
  return {
    allowed: false,
    answer: `${labels[question]} ${VERIFY_REGULATION_WARNING}`,
    evidence,
  };
}

export function explainScores(results: HabitatScoreResult[]): string {
  const best = topSetups(results, 3);
  if (best.length === 0) {
    return "The habitat model did not produce an overall score because too many inputs were unavailable.";
  }
  return best
    .map((result, index) => {
      const score = result.scores.overall;
      const reasons = result.reasons.slice(0, 3).join("; ");
      return `Candidate setup ${index + 1} scored ${score}/100 (${result.species}). Model suggests: ${reasons}. Confidence ${Math.round(result.confidence * 100)}%.`;
    })
    .join(" ");
}

export function runScout(request: ScoutRequest): ScoutExplanation {
  const evidence: ToolEvidence[] = [];
  const warnings: string[] = [];

  if (request.identify?.found) {
    evidence.push({
      tool: "queryPublicLand",
      ok: true,
      truthLayer: "authoritative",
      summary: request.identify.message,
      data: request.identify.features.map((feature) => feature.properties),
    });
  } else {
    evidence.push({
      tool: "queryPublicLand",
      ok: false,
      truthLayer: "authoritative",
      summary:
        request.identify?.message ??
        "No public-land identify result was supplied for this scout.",
      missing: ["public_land"],
    });
    warnings.push(
      "Public/private status is incomplete for part of this area. The model will not invent access rights.",
    );
  }

  if (!request.huntingUnitsAvailable) {
    evidence.push({
      tool: "queryHuntingUnits",
      ok: false,
      truthLayer: "authoritative",
      summary: "Hunting-unit dataset is not configured.",
      missing: ["hunting_units"],
    });
    warnings.push("Hunting-unit boundaries are unavailable and were not inferred.");
  }

  if (!request.regulationsAvailable) {
    warnings.push(VERIFY_REGULATION_WARNING);
  }

  const scores = scoreHabitat(request.species, { period: request.period, method: request.method }, request.cells);
  evidence.push({
    tool: "scoreHabitat",
    ok: scores.length > 0,
    truthLayer: "inferred",
    summary: `Scored ${scores.length} cells with a deterministic ${request.species} model.`,
    data: { cellCount: scores.length },
  });

  const setups = topSetups(scores, 3);
  let wind: WindEvaluation | undefined;
  const firstCell = request.cells.find((cell) => cell.cellId === setups[0]?.cellId);
  const targetCell = request.cells.find((cell) => cell.cellId === setups[1]?.cellId) ?? firstCell;
  if (firstCell?.center && targetCell?.center) {
    wind = evaluateWind(firstCell.center, targetCell.center, request.wind ?? null);
  }
  if (request.wind) {
    evidence.push({
      tool: "evaluateWind",
      ok: true,
      truthLayer: "authoritative",
      summary: `Wind from ${Math.round(request.wind.directionFromDegrees)}° at ${request.wind.speedMps.toFixed(1)} m/s.`,
    });
  } else {
    evidence.push({
      tool: "queryWeather",
      ok: false,
      truthLayer: "authoritative",
      summary: "No wind observation available.",
      missing: ["wind"],
    });
  }

  const confidence =
    setups.reduce((sum, item) => sum + item.confidence, 0) /
    Math.max(1, setups.length);

  return {
    truthLayer: "inferred",
    headline: `AI Scout — ${request.species.replace("_", " ")}`,
    narrative: explainScores(scores),
    setups,
    wind,
    evidence,
    warnings,
    confidence: Number(confidence.toFixed(2)),
  };
}

export function emptyLegalIdentify(): IdentifyResult {
  return unavailableIdentify(
    "No authoritative dataset answered this legal/geographic question.",
  );
}

export interface AssistantQuery {
  text: string;
  point?: LonLat;
}

export function classifyAssistantIntent(
  text: string,
): "legal" | "scout" | "data" | "unknown" {
  const lower = text.toLowerCase();
  if (
    /season|bag limit|legal light|weapon|regulation|private land|public land|boundary/.test(
      lower,
    )
  ) {
    return "legal";
  }
  if (/scout|bed|feed|setup|wind|ridge|saddle/.test(lower)) return "scout";
  if (/water|road|trail|waypoint|observation/.test(lower)) return "data";
  return "unknown";
}

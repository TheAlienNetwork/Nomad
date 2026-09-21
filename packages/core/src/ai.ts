import { formatSpeedMph } from "./geo";
import { unavailableIdentify, type IdentifyResult } from "./gis";
import { scoreHabitat, topSetups, explainHuntScore, type HabitatCellInput, type HabitatScoreResult } from "./habitat";
import type { BoundingBox, LonLat, SpeciesId } from "./types";
import { VERIFY_REGULATION_WARNING } from "./types";
import { evaluateWind, type WindEvaluation, type WindObservation } from "./wind";

export type AssistantToolName =
  | "queryPublicLand"
  | "queryHuntingUnits"
  | "queryPublicHuntAreas"
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

export interface ScoutOverlayBrief {
  padusNames: string[];
  huntingUnitLabels: string[];
  publicHuntAreaNames: string[];
  cellsInsidePadus: number;
  cellsInsideHuntAreas: number;
  cellCount: number;
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
  publicHuntAreasAvailable?: boolean;
  regulationsAvailable: boolean;
  waterAvailable?: boolean;
  roadsAvailable?: boolean;
  landCoverAvailable?: boolean;
}

export interface ScoutExplanation {
  truthLayer: "inferred";
  headline: string;
  narrative: string;
  setups: HabitatScoreResult[];
  wind?: WindEvaluation;
  overlays: ScoutOverlayBrief;
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
  question: "property" | "regulations" | "season" | "unit" | "hunt_area",
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
    hunt_area:
      "A listed public hunt overlay is not permission to hunt. No season, bag-limit, or access determination can be invented from that layer.",
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
      const explained = explainHuntScore(result);
      const reasons = explained.reasons.slice(0, 4).join("; ");
      return `Candidate setup ${index + 1} Nomad Score ${explained.score ?? "—"}/100 (${result.species}). ${reasons}. Confidence ${Math.round(explained.confidence * 100)}%.`;
    })
    .join(" ");
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function overlayBriefFromCells(cells: HabitatCellInput[]): ScoutOverlayBrief {
  const padus: string[] = [];
  const units: string[] = [];
  const hunts: string[] = [];
  let cellsInsidePadus = 0;
  let cellsInsideHuntAreas = 0;
  for (const cell of cells) {
    if (cell.padusUnitName) {
      padus.push(cell.padusUnitName);
      cellsInsidePadus += 1;
    }
    if (cell.huntingUnitLabel) units.push(cell.huntingUnitLabel);
    if (cell.publicHuntAreaLabel) {
      hunts.push(cell.publicHuntAreaLabel);
      cellsInsideHuntAreas += 1;
    }
  }
  return {
    padusNames: uniqueSorted(padus),
    huntingUnitLabels: uniqueSorted(units),
    publicHuntAreaNames: uniqueSorted(hunts),
    cellsInsidePadus,
    cellsInsideHuntAreas,
    cellCount: cells.length,
  };
}

function terrainOverlaySummary(cells: HabitatCellInput[]): string {
  const counts = new Map<string, number>();
  for (const cell of cells) {
    for (const kind of cell.terrainFeatures ?? []) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
  }
  if (counts.size === 0) {
    return "No inferred terrain features in the scored cells (sampled DEM, not lidar).";
  }
  const parts = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([kind, count]) => `${kind.replaceAll("_", " ")} (${count})`);
  return `Inferred terrain from sampled elevations, not lidar: ${parts.join(", ")}.`;
}

function listNames(names: string[], empty: string): string {
  if (names.length === 0) return empty;
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 4).join(", ")}, +${names.length - 4} more`;
}

function buildScoutNarrative(
  request: ScoutRequest,
  scores: HabitatScoreResult[],
  overlays: ScoutOverlayBrief,
): string {
  const period = request.period === "now" ? "current period" : request.period;
  const method = request.method && request.method !== "any" ? ` · ${request.method.replaceAll("_", " ")}` : "";
  const padus =
    overlays.padusNames.length > 0
      ? `${overlays.cellsInsidePadus}/${overlays.cellCount || request.cells.length} cells sit inside PAD-US fee polygons (${listNames(overlays.padusNames, "")}). Remaining cells stay unknown — that is not a private-land claim.`
      : "No PAD-US fee polygon contained a scored cell. Missing GIS is not public or private.";
  const units = request.huntingUnitsAvailable
    ? overlays.huntingUnitLabels.length > 0
      ? `TPWD deer management units in view: ${listNames(overlays.huntingUnitLabels, "unlabeled")}. Units are management boundaries, not seasons or bag limits.`
      : "TPWD deer management units were queried but no unit polygon contained a scored cell."
    : "TPWD deer management units were not available and were not inferred.";
  const hunts = request.publicHuntAreasAvailable
    ? overlays.publicHuntAreaNames.length > 0
      ? `TPWD Public Hunt Locator polygons in view: ${listNames(overlays.publicHuntAreaNames, "unlabeled")}. Listed hunt areas are not permission, seasons, or bag limits.`
      : "TPWD Public Hunt Locator was queried; no listed hunt polygon contained a scored cell."
    : "TPWD public hunt-area overlay was not supplied for this scout.";
  const wind = request.wind
    ? `Wind from ${Math.round(request.wind.directionFromDegrees)}° at ${formatSpeedMph(request.wind.speedMps)}.`
    : "No wind observation — wind class was not invented.";
  return [
    `AI Scout for ${request.species.replaceAll("_", " ")} · ${period}${method}.`,
    padus,
    units,
    hunts,
    terrainOverlaySummary(request.cells),
    wind,
    explainScores(scores),
  ].join(" ");
}

export function runScout(request: ScoutRequest): ScoutExplanation {
  const evidence: ToolEvidence[] = [];
  const warnings: string[] = [];
  const overlays = overlayBriefFromCells(request.cells);
  const padusOk = Boolean(request.identify?.found || overlays.padusNames.length);

  if (padusOk) {
    evidence.push({
      tool: "queryPublicLand",
      ok: true,
      truthLayer: "authoritative",
      summary:
        overlays.padusNames.length > 0
          ? `PAD-US fee polygons in scored cells: ${listNames(overlays.padusNames, "PAD-US")}. Access codes are categories, not a hunt license.`
          : request.identify?.message ?? "PAD-US identify returned a public-land record.",
      data: {
        names: overlays.padusNames,
        cellsInside: overlays.cellsInsidePadus,
        cellCount: overlays.cellCount,
      },
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

  if (request.huntingUnitsAvailable) {
    evidence.push({
      tool: "queryHuntingUnits",
      ok: true,
      truthLayer: "authoritative",
      summary:
        overlays.huntingUnitLabels.length > 0
          ? `TPWD deer management units: ${listNames(overlays.huntingUnitLabels, "DMU")}. Not seasons, bag limits, or legal access.`
          : "TPWD white-tailed deer management units were queried. This is not a season, bag-limit, or legal-access source.",
      data: { labels: overlays.huntingUnitLabels },
    });
  } else {
    evidence.push({
      tool: "queryHuntingUnits",
      ok: false,
      truthLayer: "authoritative",
      summary: "Hunting-unit dataset is not configured.",
      missing: ["hunting_units"],
    });
    warnings.push("Hunting-unit boundaries are unavailable and were not inferred.");
  }

  if (request.publicHuntAreasAvailable) {
    evidence.push({
      tool: "queryPublicHuntAreas",
      ok: true,
      truthLayer: "authoritative",
      summary:
        overlays.publicHuntAreaNames.length > 0
          ? `TPWD listed public hunt areas: ${listNames(overlays.publicHuntAreaNames, "hunt area")}. Overlay is not permission to hunt.`
          : "TPWD Public Hunt Locator was queried. Listed polygons are not seasons or permission.",
      data: {
        names: overlays.publicHuntAreaNames,
        cellsInside: overlays.cellsInsideHuntAreas,
      },
    });
  } else {
    evidence.push({
      tool: "queryPublicHuntAreas",
      ok: false,
      truthLayer: "authoritative",
      summary: "TPWD public hunt-area overlay was not supplied for this scout.",
      missing: ["public_hunt_areas"],
    });
  }

  if (!request.regulationsAvailable) {
    warnings.push(VERIFY_REGULATION_WARNING);
  }
  warnings.push(
    "Map overlays (PAD-US, TPWD hunt locator, deer management units) are GIS layers, not posted signs, seasons, or permission.",
  );

  if (request.waterAvailable) {
    evidence.push({
      tool: "queryWater",
      ok: true,
      truthLayer: "authoritative",
      summary: "Hydrography features were queried for water distance.",
    });
  } else {
    evidence.push({
      tool: "queryWater",
      ok: false,
      truthLayer: "authoritative",
      summary: "Hydrography is unavailable; water distance was not invented.",
      missing: ["distance_to_water"],
    });
  }

  if (request.roadsAvailable) {
    evidence.push({
      tool: "queryRoads",
      ok: true,
      truthLayer: "authoritative",
      summary: "Road features were queried for access-pressure distance.",
    });
  } else {
    evidence.push({
      tool: "queryRoads",
      ok: false,
      truthLayer: "authoritative",
      summary: "Road dataset is not configured; road distance was not invented.",
      missing: ["distance_to_road"],
    });
  }

  if (!request.landCoverAvailable) {
    evidence.push({
      tool: "queryTerrain",
      ok: false,
      truthLayer: "authoritative",
      summary: "Land-cover dataset is not configured.",
      missing: ["land_cover"],
    });
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
      summary: `Wind from ${Math.round(request.wind.directionFromDegrees)}° at ${formatSpeedMph(request.wind.speedMps)}.`,
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
    headline: `AI Scout — ${request.species.replaceAll("_", " ")}`,
    narrative: buildScoutNarrative(request, scores, overlays),
    setups,
    wind,
    overlays,
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
    /season|bag limit|legal light|weapon|regulation|private land|permission to hunt|can i hunt|legal to hunt/.test(
      lower,
    )
  ) {
    return "legal";
  }
  if (
    /scout|bed|feed|setup|wind|ridge|saddle|funnel|bench|glassing|nomad score/.test(
      lower,
    )
  ) {
    return "scout";
  }
  if (
    /water|road|trail|waypoint|observation|overlay|wma|hunt area|hunt locator|dmu|management unit|pad-us|national forest|public land|boundary/.test(
      lower,
    )
  ) {
    return "data";
  }
  return "unknown";
}

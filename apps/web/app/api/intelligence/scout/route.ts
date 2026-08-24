import { NextResponse } from "next/server";
import {
  analyzeTerrain,
  cellId,
  createArcgisProvider,
  runScout,
  sampleOpenMeteoElevation,
  scoreHabitat,
  unavailableIdentify,
  type HabitatCellInput,
  type IdentifyResult,
  type SpeciesId,
} from "@huntos/core";
import { listDatasets } from "@/server/registry";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    species?: SpeciesId;
    period?: "now" | "morning" | "evening" | "custom";
    method?: "spot_and_stalk" | "stand" | "blind" | "still" | "any";
    west?: number;
    south?: number;
    east?: number;
    north?: number;
    wind?: {
      directionFromDegrees: number;
      speedMps: number;
      source: string;
      retrievedAt: string;
    } | null;
  };
  const { west, south, east, north } = body;
  const species = body.species ?? "whitetail";
  if (![west, south, east, north].every((value) => typeof value === "number")) {
    return NextResponse.json({ error: "bounds are required." }, { status: 400 });
  }

  const datasets = listDatasets();
  const elevation = datasets.find((item) => item.datasetId === "open-meteo-elevation");
  const padus = datasets.find(
    (item) => item.datasetId === "padus-4-1-fee" && item.enabled && item.sourceUrl,
  );
  const units = datasets.find(
    (item) => item.datasetId === "tx-hunting-units" && item.enabled && item.sourceUrl,
  );
  const regulations = datasets.find(
    (item) => item.datasetId === "tx-regulations" && item.enabled,
  );

  const bounds = { west: west!, south: south!, east: east!, north: north! };
  const grid = await analyzeTerrain(bounds, {
    async sample(points) {
      return sampleOpenMeteoElevation(
        points,
        elevation?.sourceUrl || "https://api.open-meteo.com/v1/elevation",
      );
    },
  });

  let identify: IdentifyResult = unavailableIdentify(
    "Public-land identify was not run because PAD-US is unconfigured.",
  );
  if (padus) {
    const center = {
      longitude: (bounds.west + bounds.east) / 2,
      latitude: (bounds.south + bounds.north) / 2,
    };
    identify = (await createArcgisProvider(padus).identify?.(center)) ?? identify;
  }

  const cells: HabitatCellInput[] = grid.cells.map((terrainCell) => ({
    cellId: terrainCell.cellId || cellId(terrainCell.center),
    species,
    center: terrainCell.center,
    elevationMeters: terrainCell.elevationMeters,
    slopeDegrees: terrainCell.slopeDegrees,
    aspectDegrees: terrainCell.aspectDegrees,
    terrainPosition: terrainCell.terrainPosition,
    publicLandStatus: identify.found ? "public" : "unknown",
    legalAccessConfidence: identify.found ? "authoritative" : "unavailable",
  }));

  const scores = scoreHabitat(species, { period: body.period ?? "now", method: body.method }, cells);
  const explanation = runScout({
    species,
    period: body.period ?? "now",
    method: body.method,
    bounds,
    cells,
    wind: body.wind ?? null,
    identify,
    huntingUnitsAvailable: Boolean(units),
    regulationsAvailable: Boolean(regulations),
  });

  return NextResponse.json({
    explanation,
    terrain: grid,
    overlay: {
      type: "FeatureCollection",
      features: grid.cells.map((terrainCell) => {
        const scored = scores.find((item) => item.cellId === terrainCell.cellId);
        return {
          type: "Feature",
          properties: {
            truthLayer: "inferred",
            label: "AI Analysis",
            cellId: terrainCell.cellId,
            overall: scored?.scores.overall ?? null,
            bedding: scored?.scores.bedding ?? null,
            feeding: scored?.scores.feeding ?? null,
            security: scored?.scores.security ?? null,
            travel: scored?.scores.travel ?? null,
            water: scored?.scores.water ?? null,
            confidence: scored?.confidence ?? null,
            reasons: scored?.reasons ?? [],
            missing: scored?.missing ?? [],
            disclaimer: scored?.disclaimer,
            elevationMeters: terrainCell.elevationMeters,
            slopeDegrees: terrainCell.slopeDegrees,
            aspectDegrees: terrainCell.aspectDegrees,
          },
          geometry: {
            type: "Point",
            coordinates: [terrainCell.center.longitude, terrainCell.center.latitude],
          },
        };
      }),
    },
  });
}

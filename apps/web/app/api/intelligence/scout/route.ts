import { NextResponse } from "next/server";
import {
  analyzeTerrain,
  attachHabitatContext,
  cellId,
  createArcgisProvider,
  detectTerrainFeatures,
  emptyFeatureCollection,
  evaluateWind,
  overlayFeatureLabel,
  runScout,
  sampleOpenMeteoElevation,
  scoreHabitat,
  terrainFeaturesToGeoJson,
  unavailableIdentify,
  type GeoJsonFeatureCollection,
  type HabitatCellInput,
  type IdentifyResult,
  type SpeciesId,
  type WindClass,
} from "@huntos/core";
import { boundsCacheKey, cacheGet, cacheSet, mergeFeatureCollections, queryOptionalGis } from "@/server/intel-cache";
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
  const units = datasets.find((item) => item.datasetId === "tx-hunting-units");
  const publicHunt = datasets.find((item) => item.datasetId === "tx-public-hunt-areas");
  const regulations = datasets.find(
    (item) => item.datasetId === "tx-regulations" && item.enabled,
  );
  const waterbody = datasets.find((item) => item.datasetId === "usgs-nhd-waterbody");
  const flowline = datasets.find((item) => item.datasetId === "usgs-nhd-flowline");
  const roads = datasets.find((item) => item.datasetId === "usgs-tnm-roads");
  const nlcd = datasets.find((item) => item.datasetId === "usgs-nlcd");

  const bounds = { west: west!, south: south!, east: east!, north: north! };
  const terrainKey = boundsCacheKey("terrain", bounds);
  let grid = cacheGet<Awaited<ReturnType<typeof analyzeTerrain>>>(terrainKey);
  if (!grid) {
    grid = await analyzeTerrain(bounds, {
      async sample(points) {
        return sampleOpenMeteoElevation(
          points,
          elevation?.sourceUrl || "https://api.open-meteo.com/v1/elevation",
        );
      },
    });
    cacheSet(terrainKey, grid);
  }
  const features = detectTerrainFeatures(grid);

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

  const [waterbodyFc, flowlineFc, roadsFc, unitsFc, padusFc, huntFc] = await Promise.all([
    queryOptionalGis(waterbody, bounds),
    queryOptionalGis(flowline, bounds),
    queryOptionalGis(roads, bounds),
    queryOptionalGis(units, bounds, { resultRecordCount: null }),
    queryOptionalGis(padus, bounds),
    queryOptionalGis(publicHunt, bounds, { layerIdentifier: "9" }),
  ]);
  const water = mergeFeatureCollections([waterbodyFc, flowlineFc]);
  const waterAvailable = water.features.length > 0;
  const roadsAvailable = Boolean(roadsFc && roadsFc.features.length > 0);
  const huntingUnitsAvailable = Boolean(unitsFc && unitsFc.features.length > 0);
  const publicHuntAreasAvailable = huntFc !== null;
  const unitOverlay =
    unitsFc && huntingUnitsAvailable ? stampHuntingUnits(unitsFc) : emptyFeatureCollection();
  const huntAreaOverlay =
    huntFc && huntFc.features.length > 0 ? stampPublicHuntAreas(huntFc) : emptyFeatureCollection();
  const landCoverAvailable = false;

  const baseCells: HabitatCellInput[] = grid.cells.map((terrainCell) => ({
    cellId: terrainCell.cellId || cellId(terrainCell.center),
    species,
    center: terrainCell.center,
    elevationMeters: terrainCell.elevationMeters,
    slopeDegrees: terrainCell.slopeDegrees,
    aspectDegrees: terrainCell.aspectDegrees,
    terrainPosition: terrainCell.terrainPosition,
    publicLandStatus: "unknown",
    legalAccessConfidence: "unavailable",
  }));

  let windClass: WindClass | null = null;
  if (body.wind && baseCells[0]?.center && baseCells[1]?.center) {
    windClass = evaluateWind(baseCells[0].center, baseCells[1].center, body.wind).classification;
  }

  const cells = attachHabitatContext(baseCells, {
    water: waterAvailable ? water : null,
    roads: roadsAvailable ? roadsFc : null,
    padus: padusFc,
    huntingUnits: unitsFc,
    publicHuntAreas: huntFc,
    features,
    windClass,
  });

  const scores = scoreHabitat(species, { period: body.period ?? "now", method: body.method }, cells);
  const explanation = runScout({
    species,
    period: body.period ?? "now",
    method: body.method,
    bounds,
    cells,
    wind: body.wind ?? null,
    identify,
    huntingUnitsAvailable,
    publicHuntAreasAvailable,
    regulationsAvailable: Boolean(regulations),
    waterAvailable,
    roadsAvailable,
    landCoverAvailable,
  });
  if (nlcd?.enabled && nlcd.sourceUrl) {
    explanation.warnings.push(
      "NLCD WMS is configured but pixel identify is not implemented; land cover stays unknown.",
    );
  }

  return NextResponse.json({
    explanation,
    terrain: grid,
    features,
    featureOverlay: terrainFeaturesToGeoJson(features),
    unitOverlay,
    huntAreaOverlay,
    overlay: {
      type: "FeatureCollection",
      features: grid.cells.map((terrainCell) => {
        const scored = scores.find((item) => item.cellId === terrainCell.cellId);
        return {
          type: "Feature",
          properties: {
            truthLayer: "inferred",
            label: "Nomad Score",
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
            unavailable: scored?.explanation.unavailable ?? [],
            disclaimer: scored?.disclaimer,
            explanation: scored?.explanation,
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

function stampPublicHuntAreas(collection: GeoJsonFeatureCollection): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => {
      const label = overlayFeatureLabel(feature, "TPWD hunt area");
      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          truthLayer: "authoritative",
          source: "tpwd-public-hunt",
          label,
          disclaimer:
            "TPWD-listed public hunt area. Not seasons, bag limits, or permission to hunt.",
        },
      };
    }),
  };
}

function stampHuntingUnits(collection: GeoJsonFeatureCollection): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => {
      const properties = feature.properties ?? {};
      const unitNumber = properties.UnitNumber ?? properties.label;
      return {
        ...feature,
        properties: {
          ...properties,
          truthLayer: "authoritative",
          source: "tpwd-wtdmu",
          label: typeof unitNumber === "string" ? unitNumber : "TPWD DMU",
          disclaimer: "White-tailed deer management unit. Not seasons or bag limits.",
        },
      };
    }),
  };
}

import { NextResponse } from "next/server";
import {
  analyzeTerrain,
  detectTerrainFeatures,
  sampleOpenMeteoElevation,
  terrainFeaturesToGeoJson,
} from "@huntos/core";
import { boundsCacheKey, cacheGet, cacheSet } from "@/server/intel-cache";
import { listDatasets, recordHealth } from "@/server/registry";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    west?: number;
    south?: number;
    east?: number;
    north?: number;
  };
  const { west, south, east, north } = body;
  if (![west, south, east, north].every((value) => typeof value === "number")) {
    return NextResponse.json({ error: "bounds are required." }, { status: 400 });
  }
  const dataset = listDatasets().find(
    (item) => item.datasetId === "open-meteo-elevation",
  );
  const bounds = { west: west!, south: south!, east: east!, north: north! };
  try {
    const key = boundsCacheKey("terrain", bounds);
    let grid = cacheGet<Awaited<ReturnType<typeof analyzeTerrain>>>(key);
    if (!grid) {
      grid = await analyzeTerrain(bounds, {
        async sample(points) {
          return sampleOpenMeteoElevation(
            points,
            dataset?.sourceUrl || "https://api.open-meteo.com/v1/elevation",
          );
        },
      });
      cacheSet(key, grid);
    }
    const features = detectTerrainFeatures(grid);
    if (dataset) recordHealth(dataset.datasetId, "healthy", { featureCount: grid.cells.length });
    return NextResponse.json({
      ...grid,
      features,
      overlay: terrainFeaturesToGeoJson(features),
    });
  } catch (error) {
    if (dataset) {
      recordHealth(dataset.datasetId, "error", {
        lastError: error instanceof Error ? error.message : "terrain failed",
      });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Terrain analysis failed.",
        fabricated: false,
      },
      { status: 502 },
    );
  }
}

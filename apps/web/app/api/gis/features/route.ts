import { NextResponse } from "next/server";
import { createArcgisProvider, emptyFeatureCollection, GisUnavailableError } from "@huntos/core";
import { listDatasets, recordHealth } from "@/server/registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const west = Number(url.searchParams.get("west"));
  const south = Number(url.searchParams.get("south"));
  const east = Number(url.searchParams.get("east"));
  const north = Number(url.searchParams.get("north"));
  if (![west, south, east, north].every(Number.isFinite)) {
    return NextResponse.json({ error: "bbox is required." }, { status: 400 });
  }
  const dataset = listDatasets().find(
    (item) => item.datasetId === "padus-4-1-fee" && item.enabled && item.sourceUrl,
  );
  if (!dataset) {
    return NextResponse.json({
      ...emptyFeatureCollection(),
      warning: "PAD-US is not configured. No public-land features were substituted.",
    });
  }
  try {
    const collection = await createArcgisProvider(dataset).getFeatures({
      west,
      south,
      east,
      north,
    });
    recordHealth(dataset.datasetId, "healthy", {
      featureCount: collection.features.length,
    });
    return NextResponse.json(collection);
  } catch (error) {
    const message =
      error instanceof GisUnavailableError || error instanceof Error
        ? error.message
        : "GIS query failed.";
    recordHealth(dataset.datasetId, "error", { lastError: message });
    return NextResponse.json(
      {
        ...emptyFeatureCollection(),
        error: message,
        fabricated: false,
      },
      { status: 502 },
    );
  }
}

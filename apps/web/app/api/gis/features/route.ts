import { NextResponse } from "next/server";
import {
  createArcgisProvider,
  emptyFeatureCollection,
  GisUnavailableError,
  isOverlayId,
  overlayDefinition,
  queryArcgisGeoJson,
} from "@huntos/core";
import { listDatasets, recordHealth } from "@/server/registry";

function combineWhere(parts: Array<string | undefined>): string | undefined {
  const clauses = parts.filter((item): item is string => Boolean(item && item.trim()));
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return clauses.map((item) => `(${item})`).join(" AND ");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const west = Number(url.searchParams.get("west"));
  const south = Number(url.searchParams.get("south"));
  const east = Number(url.searchParams.get("east"));
  const north = Number(url.searchParams.get("north"));
  if (![west, south, east, north].every(Number.isFinite)) {
    return NextResponse.json({ error: "bbox is required." }, { status: 400 });
  }
  const bounds = { west, south, east, north };
  const overlayParam = url.searchParams.get("overlay");
  const datasetParam = url.searchParams.get("dataset");
  const state = url.searchParams.get("state");

  if (overlayParam) {
    if (!isOverlayId(overlayParam)) {
      return NextResponse.json({ error: "Unknown overlay." }, { status: 404 });
    }
    const overlay = overlayDefinition(overlayParam);
    if (overlay.cacheMode === "raster") {
      return NextResponse.json({
        ...emptyFeatureCollection(),
        overlay: overlay.id,
        datasetId: overlay.datasetId,
        warning: `${overlay.label} is a raster overlay. No vector features were queried.`,
      });
    }
    const dataset = listDatasets().find(
      (item) => item.datasetId === overlay.datasetId && item.enabled && item.sourceUrl,
    );
    if (!dataset) {
      return NextResponse.json({
        ...emptyFeatureCollection(),
        warning: `${overlay.label} is not configured. No features were substituted.`,
      });
    }
    const stateWhere =
      state && overlay.datasetId.startsWith("padus") ? `State_Nm = '${state}'` : undefined;
    try {
      const collection = await queryArcgisGeoJson({
        sourceUrl: dataset.sourceUrl,
        layerIdentifier: overlay.tiles[0]?.layerIdentifier ?? dataset.layerIdentifier,
        bounds,
        where: combineWhere([overlay.vectorWhere, stateWhere]),
        outFields: "*",
        returnGeometry: true,
        maxAllowableOffset: 0.001,
        resultRecordCount: 2000,
        timeoutMs: 45_000,
      });
      recordHealth(dataset.datasetId, "healthy", { featureCount: collection.features.length });
      return NextResponse.json({
        ...collection,
        overlay: overlay.id,
        datasetId: dataset.datasetId,
      });
    } catch (error) {
      const message =
        error instanceof GisUnavailableError || error instanceof Error
          ? error.message
          : "GIS query failed.";
      recordHealth(dataset.datasetId, "error", { lastError: message });
      return NextResponse.json(
        { ...emptyFeatureCollection(), error: message, fabricated: false },
        { status: 502 },
      );
    }
  }

  const dataset = listDatasets().find(
    (item) =>
      item.datasetId === (datasetParam || "padus-4-1-fee") && item.enabled && item.sourceUrl,
  );
  if (!dataset) {
    return NextResponse.json({
      ...emptyFeatureCollection(),
      warning: "PAD-US is not configured. No public-land features were substituted.",
    });
  }
  try {
    const collection = await createArcgisProvider(dataset).getFeatures(bounds);
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

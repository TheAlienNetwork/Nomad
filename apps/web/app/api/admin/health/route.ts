import { NextResponse } from "next/server";
import { queryArcgisGeoJson } from "@huntos/core";
import { getHealth, listDatasets, recordHealth } from "@/server/registry";
import { TEXAS_DEFAULT_CENTER } from "@/server/sources";

export async function GET() {
  const datasets = listDatasets().map((dataset) => ({
    ...dataset,
    health: getHealth(dataset.datasetId) ?? null,
  }));
  return NextResponse.json({
    datasets,
    states: [{ code: "TX", name: "Texas", enabled: true }],
  });
}

export async function POST() {
  const datasets = listDatasets();
  for (const dataset of datasets) {
    if (!dataset.enabled || !dataset.sourceUrl) {
      recordHealth(dataset.datasetId, dataset.sourceUrl ? "disabled" : "unconfigured", {
        lastError: dataset.notes,
      });
      continue;
    }
    if (dataset.serviceType === "arcgis-mapserver" || dataset.serviceType === "arcgis-featureserver") {
      try {
        const collection = await queryArcgisGeoJson({
          sourceUrl: dataset.sourceUrl,
          layerIdentifier: dataset.layerIdentifier,
          bounds: {
            west: TEXAS_DEFAULT_CENTER.longitude - 0.15,
            south: TEXAS_DEFAULT_CENTER.latitude - 0.1,
            east: TEXAS_DEFAULT_CENTER.longitude + 0.15,
            north: TEXAS_DEFAULT_CENTER.latitude + 0.1,
          },
          returnGeometry: false,
          resultRecordCount: 1,
          timeoutMs: 20_000,
        });
        recordHealth(dataset.datasetId, "healthy", {
          featureCount: collection.features.length,
        });
      } catch (error) {
        recordHealth(dataset.datasetId, "error", {
          lastError: error instanceof Error ? error.message : "check failed",
        });
      }
      continue;
    }
    try {
      const response = await fetch(dataset.sourceUrl, { method: "GET" });
      recordHealth(dataset.datasetId, response.ok ? "healthy" : "warning", {
        lastError: response.ok ? undefined : `HTTP ${response.status}`,
      });
    } catch (error) {
      recordHealth(dataset.datasetId, "error", {
        lastError: error instanceof Error ? error.message : "check failed",
      });
    }
  }
  return GET();
}

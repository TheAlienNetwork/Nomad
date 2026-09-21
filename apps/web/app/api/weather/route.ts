import { NextResponse } from "next/server";
import { createOpenMeteoProvider } from "@huntos/core";
import { listDatasets, recordHealth } from "@/server/registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required." }, { status: 400 });
  }
  const dataset = listDatasets().find((item) => item.datasetId === "open-meteo-weather");
  try {
    const snapshot = await createOpenMeteoProvider({
      weatherUrl: dataset?.sourceUrl || "https://api.open-meteo.com/v1/forecast",
      elevationUrl: "https://api.open-meteo.com/v1/elevation",
    }).getCurrent({ latitude: lat, longitude: lng });
    if (dataset) recordHealth(dataset.datasetId, "healthy");
    return NextResponse.json(snapshot);
  } catch (error) {
    if (dataset) {
      recordHealth(dataset.datasetId, "error", {
        lastError: error instanceof Error ? error.message : "weather failed",
      });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Weather unavailable.",
        fabricated: false,
      },
      { status: 502 },
    );
  }
}

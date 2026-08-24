import { NextResponse } from "next/server";
import { createArcgisProvider, unavailableIdentify } from "@huntos/core";
import { listDatasets, recordHealth } from "@/server/registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lng = Number(url.searchParams.get("lng"));
  const lat = Number(url.searchParams.get("lat"));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "lng and lat are required." }, { status: 400 });
  }
  const dataset = listDatasets().find(
    (item) => item.datasetId === "padus-4-1-fee" && item.enabled && item.sourceUrl,
  );
  if (!dataset) {
    return NextResponse.json(
      unavailableIdentify(
        "PAD-US is not configured. Public/private status cannot be determined.",
      ),
    );
  }
  const provider = createArcgisProvider(dataset);
  const result = provider.identify
    ? await provider.identify({ longitude: lng, latitude: lat })
    : unavailableIdentify("Identify is not supported for this provider.");
  recordHealth(dataset.datasetId, result.found ? "healthy" : "warning", {
    featureCount: result.features.length,
    lastError: result.found ? undefined : result.message,
  });
  return NextResponse.json(result);
}

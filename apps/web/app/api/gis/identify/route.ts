import { NextResponse } from "next/server";
import {
  createArcgisProvider,
  enrichIdentifyWithTexasSources,
  unavailableIdentify,
} from "@huntos/core";
import { listDatasets, recordHealth } from "@/server/registry";
import { clientKey, rateLimit } from "@/server/rate-limit";

function texasLikely(lng: number, lat: number): boolean {
  return lat >= 25.8 && lat <= 36.6 && lng >= -106.7 && lng <= -93.4;
}

export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "identify"), 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Identify rate limited." }, { status: 429 });
  }
  const url = new URL(request.url);
  const lng = Number(url.searchParams.get("lng"));
  const lat = Number(url.searchParams.get("lat"));
  const state = url.searchParams.get("state") ?? undefined;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "lng and lat are required." }, { status: 400 });
  }
  const dataset = listDatasets().find(
    (item) => item.datasetId === "padus-4-1-fee" && item.enabled && item.sourceUrl,
  );
  let result = dataset
    ? await (async () => {
        const provider = createArcgisProvider(dataset);
        return provider.identify
          ? await provider.identify({ longitude: lng, latitude: lat })
          : unavailableIdentify("Identify is not supported for this provider.");
      })()
    : unavailableIdentify(
        "PAD-US is not configured. Public/private status cannot be determined.",
      );
  if (dataset) {
    recordHealth(dataset.datasetId, result.found ? "healthy" : "warning", {
      featureCount: result.features.length,
      lastError: result.found ? undefined : result.message,
    });
  }
  const stateCode =
    state === "TX" || (!state && texasLikely(lng, lat)) ? "TX" : state;
  result = await enrichIdentifyWithTexasSources(
    result,
    { longitude: lng, latitude: lat },
    { stateCode },
  );
  return NextResponse.json(result);
}

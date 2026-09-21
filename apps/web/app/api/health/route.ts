import { NextResponse } from "next/server";
import { listDatasets } from "@/server/registry";
import { authSecret, isProduction } from "@/server/env";
import { persistenceMode } from "@/server/store";

export async function GET() {
  try {
    authSecret();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Configuration error.",
      },
      { status: 503 },
    );
  }
  const datasets = listDatasets();
  return NextResponse.json({
    ok: true,
    service: "huntos",
    persistence: persistenceMode(),
    production: isProduction(),
    datasets: datasets.length,
    time: new Date().toISOString(),
  });
}

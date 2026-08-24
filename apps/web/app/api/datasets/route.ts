import { NextResponse } from "next/server";
import { listDatasets, updateDataset } from "@/server/registry";

export async function GET() {
  return NextResponse.json({ datasets: listDatasets() });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    datasetId?: string;
    enabled?: boolean;
    sourceUrl?: string;
  };
  if (!body.datasetId) {
    return NextResponse.json({ error: "datasetId is required." }, { status: 400 });
  }
  const updated = updateDataset(body.datasetId, {
    enabled: body.enabled,
    sourceUrl: body.sourceUrl,
  });
  if (!updated) {
    return NextResponse.json({ error: "Unknown dataset." }, { status: 404 });
  }
  return NextResponse.json({ dataset: updated });
}

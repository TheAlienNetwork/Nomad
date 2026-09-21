import { NextResponse } from "next/server";
import {
  fetchBasemapTile,
  fetchDemTile,
  fetchOverlayTile,
  isBasemapTileSource,
  isDemTileSource,
  isOverlayTileSource,
} from "@/server/tiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string; z: string; x: string; y: string }> },
) {
  const params = await context.params;
  const source = params.source;
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y);
  if (![z, x, y].every(Number.isFinite)) {
    return NextResponse.json({ error: "Invalid tile coordinates." }, { status: 400 });
  }
  if (!isBasemapTileSource(source) && !isDemTileSource(source) && !isOverlayTileSource(source)) {
    return NextResponse.json({ error: "Unknown tile source." }, { status: 404 });
  }
  try {
    const tile = isBasemapTileSource(source)
      ? await fetchBasemapTile(source, z, x, y)
      : isDemTileSource(source)
        ? await fetchDemTile(source, z, x, y)
        : await fetchOverlayTile(source, z, x, y);
    const emptyMiss = !isBasemapTileSource(source) && !isDemTileSource(source) && tile.body.byteLength <= 80;
    return new NextResponse(tile.body, {
      headers: {
        "Content-Type": tile.contentType,
        "Cache-Control": emptyMiss ? "public, max-age=60" : "public, max-age=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Tile fetch failed.",
        fabricated: false,
      },
      { status: 502 },
    );
  }
}

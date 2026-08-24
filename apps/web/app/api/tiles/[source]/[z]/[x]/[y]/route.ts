import { NextResponse } from "next/server";
import {
  fetchBasemapTile,
  fetchPadusTile,
  type TileSource,
} from "@/server/tiles";

const SOURCES: TileSource[] = [
  "usgs-topo",
  "usgs-imagery",
  "usgs-hillshade",
  "padus",
];

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string; z: string; x: string; y: string }> },
) {
  const params = await context.params;
  const source = params.source as TileSource;
  if (!SOURCES.includes(source)) {
    return NextResponse.json({ error: "Unknown tile source." }, { status: 404 });
  }
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y);
  if (![z, x, y].every(Number.isFinite)) {
    return NextResponse.json({ error: "Invalid tile coordinates." }, { status: 400 });
  }
  try {
    const tile =
      source === "padus"
        ? await fetchPadusTile(z, x, y)
        : await fetchBasemapTile(source, z, x, y);
    return new NextResponse(tile.body, {
      headers: {
        "Content-Type": tile.contentType,
        "Cache-Control": "public, max-age=86400",
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

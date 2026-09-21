import { overlayTileRequestUrl, overlayTileSpec, OVERLAY_CATALOG } from "@huntos/core";
import { TERRARIUM_DEM, USGS_BASEMAPS } from "./sources";

export type BasemapTileSource = "usgs-topo" | "usgs-imagery" | "usgs-hillshade";
export type DemTileSource = "terrarium";
export type OverlayTileSource = string;
export type TileSource = BasemapTileSource | DemTileSource | OverlayTileSource;

const BASEMAPS: BasemapTileSource[] = ["usgs-topo", "usgs-imagery", "usgs-hillshade"];
const DEM_SOURCES: DemTileSource[] = ["terrarium"];

export const OVERLAY_TILE_SOURCES = OVERLAY_CATALOG.flatMap((item) =>
  item.tiles.map((tile) => tile.id),
);

function arcgisTileUrl(base: string, z: number, x: number, y: number): string {
  return base.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

export function isBasemapTileSource(source: string): source is BasemapTileSource {
  return BASEMAPS.includes(source as BasemapTileSource);
}

export function isDemTileSource(source: string): source is DemTileSource {
  return DEM_SOURCES.includes(source as DemTileSource);
}

export function isOverlayTileSource(source: string): boolean {
  return overlayTileSpec(source) !== undefined;
}

export async function fetchBasemapTile(
  source: BasemapTileSource,
  z: number,
  x: number,
  y: number,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const catalog = {
    "usgs-topo": USGS_BASEMAPS.topo.tileUrl,
    "usgs-imagery": USGS_BASEMAPS.imagery.tileUrl,
    "usgs-hillshade": USGS_BASEMAPS.hillshade.tileUrl,
  } as const;
  const url = arcgisTileUrl(catalog[source], z, x, y);
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`${source} tile HTTP ${response.status}`);
  }
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "image/jpeg",
  };
}

export async function fetchDemTile(
  source: DemTileSource,
  z: number,
  x: number,
  y: number,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const catalog = {
    terrarium: process.env.TERRARIUM_TILE_URL || TERRARIUM_DEM.tileUrl,
  } as const;
  const url = arcgisTileUrl(catalog[source], z, x, y);
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`${source} tile HTTP ${response.status}`);
  }
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "image/png",
  };
}

const EMPTY_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function emptyOverlayTile(): { body: ArrayBuffer; contentType: string } {
  return { body: EMPTY_PNG.buffer.slice(EMPTY_PNG.byteOffset, EMPTY_PNG.byteOffset + EMPTY_PNG.byteLength), contentType: "image/png" };
}

export async function fetchOverlayTile(
  source: string,
  z: number,
  x: number,
  y: number,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const spec = overlayTileSpec(source);
  if (!spec) {
    throw new Error(`Unknown overlay tile source ${source}`);
  }
  const url = overlayTileRequestUrl(spec, z, x, y);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("image")) {
      return emptyOverlayTile();
    }
    return {
      body: await response.arrayBuffer(),
      contentType,
    };
  } catch {
    return emptyOverlayTile();
  }
}

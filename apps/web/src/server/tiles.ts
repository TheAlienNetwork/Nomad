import { tileToBBox } from "@huntos/core";
import { PADUS_FEE, USGS_BASEMAPS } from "./sources";

export type TileSource = "usgs-topo" | "usgs-imagery" | "usgs-hillshade" | "padus";

function arcgisTileUrl(base: string, z: number, x: number, y: number): string {
  return base.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

export async function fetchBasemapTile(
  source: Exclude<TileSource, "padus">,
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

export async function fetchPadusTile(
  z: number,
  x: number,
  y: number,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const bbox = tileToBBox(z, x, y);
  const url = new URL(`${PADUS_FEE.mapServer}/export`);
  url.searchParams.set(
    "bbox",
    `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
  );
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "3857");
  url.searchParams.set("size", "256,256");
  url.searchParams.set("format", "png32");
  url.searchParams.set("transparent", "true");
  url.searchParams.set("layers", `show:${PADUS_FEE.layerIdentifier}`);
  url.searchParams.set("f", "image");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PAD-US export HTTP ${response.status}`);
  }
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "image/png",
  };
}

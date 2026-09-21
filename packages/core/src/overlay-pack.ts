import { estimateRasterTileCount } from "./geo";
import {
  OVERLAY_CATALOG,
  STATE_PACK_EXTENTS,
  overlayDefinition,
  overlaysForState,
  type OverlayId,
} from "./overlays";
import type { BoundingBox } from "./types";

export const PACK_MIN_ZOOM = 7;
export const PACK_MAX_ZOOM = 10;
export const PACK_BYTES_PER_TILE = 18_000;
export const PACK_BYTES_PER_VECTOR = 180_000;

export interface OverlayPackEstimate {
  overlayIds: OverlayId[];
  tileCount: number;
  rasterSources: number;
  vectorLayers: number;
  estimatedBytes: number;
  minZoom: number;
  maxZoom: number;
  extent: BoundingBox;
}

export function packExtentForState(stateCode: string | null | undefined): BoundingBox | undefined {
  if (!stateCode) return undefined;
  return STATE_PACK_EXTENTS[stateCode];
}

export function overlaysAvailableToDownload(stateCode: string | null | undefined): OverlayId[] {
  return overlaysForState(stateCode).map((item) => item.id);
}

export function sanitizePackSelection(
  stateCode: string | null | undefined,
  selected: readonly string[],
): OverlayId[] {
  const allowed = new Set(overlaysAvailableToDownload(stateCode));
  const unique: OverlayId[] = [];
  for (const id of selected) {
    if (!allowed.has(id as OverlayId)) continue;
    if (unique.includes(id as OverlayId)) continue;
    unique.push(id as OverlayId);
  }
  return unique;
}

export function estimateOverlayPack(
  extent: BoundingBox,
  overlayIds: readonly OverlayId[],
): OverlayPackEstimate {
  let rasterSources = 0;
  let vectorLayers = 0;
  for (const id of overlayIds) {
    const overlay = overlayDefinition(id);
    if (overlay.cacheMode === "raster" || overlay.dense) {
      rasterSources += overlay.tiles.length;
    } else {
      vectorLayers += 1;
    }
  }
  const tileCount =
    rasterSources > 0 ? estimateRasterTileCount(extent, PACK_MIN_ZOOM, PACK_MAX_ZOOM) * rasterSources : 0;
  return {
    overlayIds: [...overlayIds],
    tileCount,
    rasterSources,
    vectorLayers,
    estimatedBytes: tileCount * PACK_BYTES_PER_TILE + vectorLayers * PACK_BYTES_PER_VECTOR,
    minZoom: PACK_MIN_ZOOM,
    maxZoom: PACK_MAX_ZOOM,
    extent,
  };
}

export function overlayPackUsesStatewideZoomCap(minZoom: number, maxZoom: number): boolean {
  return minZoom >= PACK_MIN_ZOOM && maxZoom <= PACK_MAX_ZOOM;
}

export function overlayDatasetIds(overlayIds: readonly OverlayId[]): string[] {
  return [...new Set(overlayIds.map((id) => overlayDefinition(id).datasetId))];
}

export const OVERLAY_CATALOG_IDS = OVERLAY_CATALOG.map((item) => item.id);

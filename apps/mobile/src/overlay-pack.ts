import {
  listRasterTiles,
  overlayDefinition,
  overlayTileRequestUrl,
  packExtentForState,
  queryArcgisGeoJson,
  sanitizePackSelection,
  type BoundingBox,
  type GeoJsonFeatureCollection,
  type OverlayId,
  type OverlayTileSpec,
} from '@huntos/core';
import { Directory, File, Paths } from 'expo-file-system';

import { huntosApiConfigured, huntosApiUrl } from './api';
import { basemapSlug, rasterTileMaxZoom, rasterTileUrl, type RasterTileSlug } from './map-tiles';
import { useFieldStore } from './store';

export function overlayTileCacheRoot(stateCode: string | null | undefined): string | undefined {
  if (!stateCode) return undefined;
  const dir = new Directory(Paths.document, 'nomad-tiles', stateCode);
  return dir.uri;
}

export async function hydrateOverlayCache(): Promise<void> {
  const state = useFieldStore.getState();
  const code = state.hunterState;
  if (!code || state.packCachedIds.length === 0) return;
  const loaded: Record<string, GeoJsonFeatureCollection> = { ...state.cachedOverlayGeoJson };
  for (const id of state.packCachedIds) {
    if (loaded[id]) continue;
    try {
      const overlay = overlayDefinition(id);
      if (overlay.cacheMode !== 'vector') continue;
      const file = overlayJsonFile(code, id);
      if (!file.exists) continue;
      loaded[id] = JSON.parse(await file.text()) as GeoJsonFeatureCollection;
    } catch {
      // Missing or unreadable cache stays unknown; live tiles still work online.
    }
  }
  useFieldStore.setState({ cachedOverlayGeoJson: loaded });
}

export async function readCachedTileBase64(
  slug: string,
  z: number,
  x: number,
  y: number,
): Promise<string | null> {
  const code = useFieldStore.getState().hunterState;
  if (!code) return null;
  try {
    const file = overlayTileFile(code, slug, z, x, y);
    if (!file.exists) return null;
    return bytesToBase64(await file.bytes());
  } catch {
    return null;
  }
}

export async function downloadSelectedPack(): Promise<void> {
  const state = useFieldStore.getState();
  const code = state.hunterState;
  const extent = packExtentForState(code);
  const ids = sanitizePackSelection(code, state.packSelection);
  if (!extent || !code || ids.length === 0) return;
  const cached = [...state.packCachedIds];
  for (const id of ids) {
    const overlay = overlayDefinition(id);
    useFieldStore.setState({
      packStatus: { overlayId: id, done: 0, total: 1, label: overlay.label },
    });
    let ok = false;
    if (overlay.cacheMode === 'vector') {
      const collection = await fetchOverlayFeatures(id, code, extent);
      if (collection) {
        await writeOverlayJson(code, id, collection);
        useFieldStore.setState({
          cachedOverlayGeoJson: { ...useFieldStore.getState().cachedOverlayGeoJson, [id]: collection },
        });
        ok = true;
      }
    } else {
      const tiles = listRasterTiles(extent, 7, 10);
      let done = 0;
      const total = tiles.length * overlay.tiles.length;
      ok = total === 0;
      await mapPool(tiles, 6, async (tile) => {
        const results = await Promise.all(
          overlay.tiles.map((spec) => writeOverlayTile(code, spec.id, spec, tile.z, tile.x, tile.y)),
        );
        if (results.some(Boolean)) ok = true;
        done += overlay.tiles.length;
        useFieldStore.setState({
          packStatus: { overlayId: id, done, total, label: overlay.label },
        });
      });
    }
    if (ok && !cached.includes(id)) cached.push(id);
    useFieldStore.setState({ packCachedIds: [...cached] });
  }
  useFieldStore.setState({
    packLastDownloaded: new Date().toISOString(),
    packStatus: undefined,
  });
}

/** Save the selected basemap for the current hunt view (visible zoom ±1). */
export async function downloadBasemapForView(): Promise<void> {
  const state = useFieldStore.getState();
  const bounds = state.mapBounds;
  const code = state.hunterState ?? 'field';
  if (!bounds) {
    useFieldStore.setState({
      packStatus: {
        overlayId: 'publicLand',
        done: 0,
        total: 0,
        label: 'Open the Hunt map first so Nomad knows the view',
      },
    });
    return;
  }
  const slug = basemapSlug(state.basemap);
  const centerZ = Math.round(
    Math.log2(
      360 /
        Math.max(0.0001, Math.abs(bounds.east - bounds.west)),
    ),
  );
  const maxZ = rasterTileMaxZoom(slug);
  const mid = Math.max(3, Math.min(maxZ, Number.isFinite(centerZ) ? centerZ : 12));
  const minZoom = Math.max(3, mid - 1);
  const maxZoom = Math.min(maxZ, mid + 1);
  const tiles = listRasterTiles(bounds, minZoom, maxZoom);
  let done = 0;
  useFieldStore.setState({
    packStatus: { overlayId: 'publicLand', done: 0, total: tiles.length, label: `Basemap ${slug}` },
  });
  await mapPool(tiles, 6, async (tile) => {
    await writeBasemapTile(code, slug, tile.z, tile.x, tile.y);
    done += 1;
    useFieldStore.setState({
      packStatus: {
        overlayId: 'publicLand',
        done,
        total: tiles.length,
        label: `Basemap ${slug}`,
      },
    });
  });
  useFieldStore.setState({
    packLastDownloaded: new Date().toISOString(),
    packStatus: undefined,
    basemapCachedSlug: slug,
    basemapCachedAt: new Date().toISOString(),
  });
}

export function readCachedBasemapUri(
  slug: RasterTileSlug,
  z: number,
  x: number,
  y: number,
): string | null {
  const code = useFieldStore.getState().hunterState ?? 'field';
  try {
    const file = basemapTileFile(code, slug, z, x, y);
    if (!file.exists) return null;
    return file.uri;
  } catch {
    return null;
  }
}

async function writeBasemapTile(
  stateCode: string,
  slug: RasterTileSlug,
  z: number,
  x: number,
  y: number,
): Promise<boolean> {
  try {
    const response = await fetch(rasterTileUrl(slug, z, x, y));
    if (!response.ok) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const file = basemapTileFile(stateCode, slug, z, x, y);
    const dir = new Directory(
      Paths.document,
      'nomad-basemap',
      stateCode,
      slug,
      String(z),
      String(x),
    );
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return true;
  } catch {
    return false;
  }
}

function basemapTileFile(
  stateCode: string,
  slug: string,
  z: number,
  x: number,
  y: number,
): File {
  return new File(
    Paths.document,
    'nomad-basemap',
    stateCode,
    slug,
    String(z),
    String(x),
    `${y}.img`,
  );
}

async function fetchOverlayFeatures(
  overlayId: OverlayId,
  stateCode: string,
  extent: BoundingBox,
): Promise<GeoJsonFeatureCollection | null> {
  if (huntosApiConfigured()) {
    const url = `${huntosApiUrl()}/api/gis/features?overlay=${overlayId}&state=${stateCode}&west=${extent.west}&south=${extent.south}&east=${extent.east}&north=${extent.north}`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return (await response.json()) as GeoJsonFeatureCollection;
    } catch {
      return null;
    }
  }
  const overlay = overlayDefinition(overlayId);
  const tile = overlay.tiles[0];
  if (!tile) return null;
  const stateWhere =
    overlay.datasetId.startsWith('padus') ? `State_Nm = '${stateCode}'` : undefined;
  const where = [overlay.vectorWhere, stateWhere].filter(Boolean).join(' AND ');
  try {
    return await queryArcgisGeoJson({
      sourceUrl: tile.mapServer,
      layerIdentifier: tile.layerIdentifier.split(',')[0],
      bounds: extent,
      where: where || undefined,
      resultRecordCount: 2000,
      maxAllowableOffset: 0.001,
      timeoutMs: 45_000,
    });
  } catch {
    return null;
  }
}

async function writeOverlayJson(
  stateCode: string,
  overlayId: OverlayId,
  collection: GeoJsonFeatureCollection,
): Promise<void> {
  const file = overlayJsonFile(stateCode, overlayId);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(collection));
}

async function writeOverlayTile(
  stateCode: string,
  slug: string,
  spec: OverlayTileSpec,
  z: number,
  x: number,
  y: number,
): Promise<boolean> {
  try {
    const response = await fetch(overlayTileRequestUrl(spec, z, x, y));
    if (!response.ok) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const file = overlayTileFile(stateCode, slug, z, x, y);
    const dir = new Directory(Paths.document, 'nomad-tiles', stateCode, slug, String(z), String(x));
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return true;
  } catch {
    return false;
  }
}

function overlayJsonFile(stateCode: string, overlayId: OverlayId): File {
  return new File(Paths.document, `nomad-pack-${stateCode}-${overlayId}.json`);
}

function overlayTileFile(stateCode: string, slug: string, z: number, x: number, y: number): File {
  return new File(Paths.document, 'nomad-tiles', stateCode, slug, String(z), String(x), `${y}.png`);
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const run = async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      const item = items[current];
      if (item !== undefined) await worker(item);
    }
  };
  const width = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: width }, () => run()));
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[triple & 63] : '=';
  }
  return out;
}

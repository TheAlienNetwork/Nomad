export type RasterTileSlug =
  | 'usgs-topo'
  | 'usgs-imagery'
  | 'usgs-hillshade'
  | 'esri-street'
  | 'esri-imagery'
  | 'esri-transport'
  | 'esri-hillshade'
  | 'terrarium';

export type BasemapStyleId = 'satellite' | 'topo' | 'hybrid' | 'streets' | 'naip' | 'relief';

export function basemapSlug(id: BasemapStyleId): RasterTileSlug {
  switch (id) {
    case 'satellite':
    case 'hybrid':
      return 'esri-imagery';
    case 'naip':
      return 'usgs-imagery';
    case 'streets':
      return 'esri-street';
    case 'topo':
      return 'usgs-topo';
    case 'relief':
      return 'esri-hillshade';
    default: {
      const _exhausted: never = id;
      return _exhausted;
    }
  }
}

export function parseRasterTileSlug(value: string): RasterTileSlug | null {
  switch (value) {
    case 'usgs-topo':
    case 'usgs-imagery':
    case 'usgs-hillshade':
    case 'esri-street':
    case 'esri-imagery':
    case 'esri-transport':
    case 'esri-hillshade':
    case 'terrarium':
      return value;
    default:
      return null;
  }
}

export function osmTileUrl(z: number, x: number, y: number): string {
  const n = 2 ** z;
  const wrapped = ((x % n) + n) % n;
  return `https://tile.openstreetmap.org/${z}/${wrapped}/${y}.png`;
}

export function rasterTileUrl(slug: RasterTileSlug, z: number, x: number, y: number): string {
  switch (slug) {
    case 'usgs-topo':
      return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/${z}/${y}/${x}`;
    case 'usgs-imagery':
      return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`;
    case 'usgs-hillshade':
      return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/${z}/${y}/${x}`;
    case 'esri-street':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;
    case 'esri-imagery':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    case 'esri-transport':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${z}/${y}/${x}`;
    case 'esri-hillshade':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${y}/${x}`;
    case 'terrarium':
      return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    default: {
      const _exhausted: never = slug;
      return _exhausted;
    }
  }
}

export function rasterTileMaxZoom(slug: RasterTileSlug): number {
  switch (slug) {
    case 'esri-imagery':
    case 'esri-street':
    case 'esri-transport':
    case 'esri-hillshade':
      return 19;
    case 'usgs-topo':
    case 'usgs-imagery':
      return 16;
    case 'usgs-hillshade':
      return 13;
    case 'terrarium':
      return 15;
    default: {
      const _exhausted: never = slug;
      return _exhausted;
    }
  }
}

export function rasterTileMime(slug: RasterTileSlug): 'image/png' | 'image/jpeg' {
  switch (slug) {
    case 'terrarium':
      return 'image/png';
    case 'usgs-topo':
    case 'usgs-imagery':
    case 'usgs-hillshade':
    case 'esri-street':
    case 'esri-imagery':
    case 'esri-transport':
    case 'esri-hillshade':
      return 'image/jpeg';
    default: {
      const _exhausted: never = slug;
      return _exhausted;
    }
  }
}

export async function fetchRasterTileDataUrl(
  slug: string,
  z: number,
  x: number,
  y: number,
): Promise<string | null> {
  const id = parseRasterTileSlug(slug);
  if (!id) return null;
  const url = rasterTileUrl(id, z, x, y);
  const attempts: Array<Record<string, string>> = [
    {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.usgs.gov/',
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 NomadField/1.0',
    },
    {
      Accept: 'image/*',
    },
  ];
  for (const headers of attempts) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 32) continue;
      const mime = response.headers.get('content-type') || rasterTileMime(id);
      return `data:${mime};base64,${bytesToBase64(bytes)}`;
    } catch {
      // Try the next header set.
    }
  }
  return null;
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

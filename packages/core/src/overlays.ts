import type { BoundingBox } from "./types";
import { tileToBBox } from "./geo";

export const OVERLAY_IDS = [
  "publicLand",
  "nationalForests",
  "publicHunting",
  "padusBlm",
  "padusNps",
  "padusFws",
  "padusState",
  "padusTribal",
  "padusClosed",
  "texasParcels",
  "publicHuntAreas",
  "huntingUnits",
  "water",
  "roads",
  "contours",
  "lidar",
  "wetlands",
  "landCover",
  "gnisCamp",
  "mvum",
] as const;

export type OverlayId = (typeof OVERLAY_IDS)[number];

export type OverlayGroup = "land" | "hunt" | "terrain" | "camp";

export type OverlayCacheMode = "vector" | "raster";

export type OverlayTileProtocol = "arcgis-export" | "arcgis-image" | "wms";

export interface OverlayTileSpec {
  id: string;
  protocol: OverlayTileProtocol;
  mapServer: string;
  layerIdentifier: string;
  layerDefs?: Record<string, string>;
  /** ArcGIS export/dynamicMapLayer drawing override (JSON array string or object). */
  dynamicLayers?: unknown;
  wmsLayer?: string;
  /** ArcGIS ImageServer raster function name (exportImage renderingRule). */
  renderingRule?: string;
  opacity: number;
}

export interface OverlayDefinition {
  id: OverlayId;
  label: string;
  group: OverlayGroup;
  defaultOn: boolean;
  defaultPackChecked: boolean;
  dense: boolean;
  jurisdiction: "US" | "TX";
  cacheMode: OverlayCacheMode;
  datasetId: string;
  tiles: OverlayTileSpec[];
  vectorWhere?: string;
  notes?: string;
}

export const PADUS_FEE_MAPSERVER =
  "https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US_4_1/MapServer";

const TPWD_HUNT_MAPSERVER =
  "https://tpwd.texas.gov/server/rest/services/Wildlife/TPWD_PublicHuntLocatorMap/MapServer";

const TPWD_WTDMU_MAPSERVER =
  "https://tpwd.texas.gov/server/rest/services/Wildlife/TPWD_WL_WTDMU/MapServer";

export const TX_STRATMAP_PARCELS_MAPSERVER =
  "https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer";

const NHD_MAPSERVER = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer";

const TNM_ROADS_MAPSERVER =
  "https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer";

const CONTOURS_MAPSERVER =
  "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer";

const GNIS_MAPSERVER =
  "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer";

const NWI_MAPSERVER =
  "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer";

const NLCD_WMS = "https://www.mrlc.gov/geoserver/mrlc_display/wms";

const MVUM_MAPSERVER =
  "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer";

export const USGS_3DEP_IMAGESERVER =
  "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer";

export const LIDAR_RENDERING_RULE = "Hillshade Multidirectional";

function padusTile(
  id: string,
  layerDefs: string,
  opacity: number,
  dynamicLayers?: unknown,
): OverlayTileSpec {
  return {
    id,
    protocol: "arcgis-export",
    mapServer: PADUS_FEE_MAPSERVER,
    layerIdentifier: "0",
    layerDefs: { "0": layerDefs },
    dynamicLayers,
    opacity,
  };
}

type Rgba = [number, number, number, number];

export function glassPadusLayers(
  definitionExpression: string,
  fill: Rgba,
  outline: Rgba,
): unknown {
  const wash: Rgba = [fill[0], fill[1], fill[2], Math.min(84, Math.max(fill[3], 64))];
  const edge: Rgba = [outline[0], outline[1], outline[2], Math.min(220, Math.max(outline[3], 175))];
  return [
    {
      id: 0,
      source: {
        type: "mapLayer",
        mapLayerId: 0,
      },
      definitionExpression,
      drawingInfo: {
        renderer: {
          type: "simple",
          symbol: {
            type: "esriSFS",
            style: "esriSFSSolid",
            color: wash,
            outline: {
              type: "esriSLS",
              style: "esriSLSSolid",
              color: edge,
              width: 1.15,
            },
          },
        },
      },
    },
  ];
}

/** Glass wash for National Forests — luminous edge, not a solid slab. */
export const NATIONAL_FOREST_DYNAMIC_LAYERS = glassPadusLayers(
  "Mang_Name = 'USFS'",
  [56, 189, 168, 28],
  [167, 243, 208, 150],
);

export const OVERLAY_CATALOG: readonly OverlayDefinition[] = [
  {
    id: "publicLand",
    label: "Open / restricted public land",
    group: "land",
    defaultOn: true,
    defaultPackChecked: true,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus",
        "Pub_Access IN ('OA','RA')",
        0.4,
        glassPadusLayers("Pub_Access IN ('OA','RA')", [56, 189, 248, 26], [125, 211, 252, 155]),
      ),
    ],
    vectorWhere: "Pub_Access IN ('OA','RA')",
    notes: "PAD-US Fee access categories. Not a hunt license or permission.",
  },
  {
    id: "nationalForests",
    label: "National Forests",
    group: "land",
    defaultOn: true,
    defaultPackChecked: true,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-forests",
        "Mang_Name = 'USFS'",
        0.38,
        NATIONAL_FOREST_DYNAMIC_LAYERS,
      ),
    ],
    vectorWhere: "Mang_Name = 'USFS'",
  },
  {
    id: "publicHunting",
    label: "Public hunting access",
    group: "land",
    defaultOn: true,
    defaultPackChecked: true,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-hunting",
        "Pub_Access = 'OA' OR Mang_Name IN ('SFW','FWS') OR Des_Tp = 'NWR'",
        0.44,
        glassPadusLayers(
          "Pub_Access = 'OA' OR Mang_Name IN ('SFW','FWS') OR Des_Tp = 'NWR'",
          [230, 163, 26, 30],
          [252, 211, 77, 150],
        ),
      ),
    ],
    vectorWhere: "Pub_Access = 'OA' OR Mang_Name IN ('SFW','FWS') OR Des_Tp = 'NWR'",
    notes: "PAD-US heuristic, not a TPWD hunt list.",
  },
  {
    id: "padusBlm",
    label: "BLM",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-blm",
        "Mang_Name = 'BLM'",
        0.28,
        glassPadusLayers("Mang_Name = 'BLM'", [251, 191, 36, 26], [253, 230, 138, 145]),
      ),
    ],
    vectorWhere: "Mang_Name = 'BLM'",
    notes: "Sparse in Texas. Manager filter on PAD-US Fee, not SMA private land.",
  },
  {
    id: "padusNps",
    label: "National Parks / NPS",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-nps",
        "Mang_Name = 'NPS' OR Des_Tp IN ('NP','NM')",
        0.28,
        glassPadusLayers(
          "Mang_Name = 'NPS' OR Des_Tp IN ('NP','NM')",
          [52, 211, 153, 26],
          [167, 243, 208, 145],
        ),
      ),
    ],
    vectorWhere: "Mang_Name = 'NPS' OR Des_Tp IN ('NP','NM')",
  },
  {
    id: "padusFws",
    label: "Wildlife refuges (FWS)",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-fws",
        "Mang_Name = 'FWS' OR Des_Tp = 'NWR'",
        0.28,
        glassPadusLayers("Mang_Name = 'FWS' OR Des_Tp = 'NWR'", [45, 212, 191, 26], [153, 246, 228, 145]),
      ),
    ],
    vectorWhere: "Mang_Name = 'FWS' OR Des_Tp = 'NWR'",
  },
  {
    id: "padusState",
    label: "State land",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-state",
        "Mang_Type = 'STAT'",
        0.28,
        glassPadusLayers("Mang_Type = 'STAT'", [125, 211, 252, 26], [186, 230, 253, 145]),
      ),
    ],
    vectorWhere: "Mang_Type = 'STAT'",
  },
  {
    id: "padusTribal",
    label: "Tribal land",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-tribal",
        "Mang_Type = 'TRIB'",
        0.28,
        glassPadusLayers("Mang_Type = 'TRIB'", [196, 181, 253, 26], [221, 214, 254, 145]),
      ),
    ],
    vectorWhere: "Mang_Type = 'TRIB'",
    notes: "Not public hunting land.",
  },
  {
    id: "padusClosed",
    label: "Closed public (XA)",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "padus-4-1-fee",
    tiles: [
      padusTile(
        "padus-closed",
        "Pub_Access = 'XA'",
        0.26,
        glassPadusLayers("Pub_Access = 'XA'", [251, 113, 133, 24], [254, 205, 211, 140]),
      ),
    ],
    vectorWhere: "Pub_Access = 'XA'",
  },
  {
    id: "texasParcels",
    label: "Texas parcels (appraisal)",
    group: "land",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "TX",
    cacheMode: "raster",
    datasetId: "tx-stratmap-parcels",
    tiles: [
      {
        id: "tx-parcels",
        protocol: "arcgis-export",
        mapServer: TX_STRATMAP_PARCELS_MAPSERVER,
        layerIdentifier: "0",
        opacity: 0.55,
        dynamicLayers: [
          {
            id: 0,
            source: { type: "mapLayer", mapLayerId: 0 },
            drawingInfo: {
              renderer: {
                type: "simple",
                symbol: {
                  type: "esriSFS",
                  style: "esriSFSSolid",
                  color: [0, 0, 0, 0],
                  outline: {
                    type: "esriSLS",
                    style: "esriSLSSolid",
                    color: [212, 175, 55, 220],
                    width: 1.1,
                  },
                },
              },
            },
          },
        ],
      },
    ],
    notes:
      "TxGIO StratMap appraisal parcels. Owner name when the county published one. Not survey-grade and not permission to enter. Donley County is missing.",
  },
  {
    id: "publicHuntAreas",
    label: "TPWD public hunt areas",
    group: "hunt",
    defaultOn: true,
    defaultPackChecked: true,
    dense: false,
    jurisdiction: "TX",
    cacheMode: "vector",
    datasetId: "tx-public-hunt-areas",
    tiles: [
      {
        id: "public-hunt",
        protocol: "arcgis-export",
        mapServer: TPWD_HUNT_MAPSERVER,
        layerIdentifier: "7,8,9",
        opacity: 0.72,
      },
    ],
    notes: "Listed hunt areas only — not seasons, bag limits, or permission.",
  },
  {
    id: "huntingUnits",
    label: "TPWD deer management units",
    group: "hunt",
    defaultOn: false,
    defaultPackChecked: true,
    dense: false,
    jurisdiction: "TX",
    cacheMode: "vector",
    datasetId: "tx-hunting-units",
    tiles: [
      {
        id: "tpwd-wtdmu",
        protocol: "arcgis-export",
        mapServer: TPWD_WTDMU_MAPSERVER,
        layerIdentifier: "0",
        opacity: 0.35,
      },
    ],
  },
  {
    id: "water",
    label: "Water (NHD)",
    group: "terrain",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "usgs-nhd-waterbody",
    tiles: [
      {
        id: "nhd-waterbody",
        protocol: "arcgis-export",
        mapServer: NHD_MAPSERVER,
        layerIdentifier: "12",
        opacity: 0.7,
      },
      {
        id: "nhd-flowline",
        protocol: "arcgis-export",
        mapServer: NHD_MAPSERVER,
        layerIdentifier: "6",
        opacity: 0.65,
      },
    ],
  },
  {
    id: "roads",
    label: "Roads",
    group: "terrain",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "usgs-tnm-roads",
    tiles: [
      {
        id: "tnm-roads",
        protocol: "arcgis-export",
        mapServer: TNM_ROADS_MAPSERVER,
        layerIdentifier: "29,30,31,32",
        opacity: 0.7,
      },
    ],
  },
  {
    id: "contours",
    label: "Contours",
    group: "terrain",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "usgs-contours",
    tiles: [
      {
        id: "usgs-contours",
        protocol: "arcgis-export",
        mapServer: CONTOURS_MAPSERVER,
        layerIdentifier: "0",
        opacity: 0.55,
      },
    ],
  },
  {
    id: "lidar",
    label: "Lidar relief (3DEP)",
    group: "terrain",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "usgs-3dep-elevation",
    tiles: [
      {
        id: "usgs-3dep-lidar",
        protocol: "arcgis-image",
        mapServer: USGS_3DEP_IMAGESERVER,
        layerIdentifier: "0",
        renderingRule: LIDAR_RENDERING_RULE,
        opacity: 0.72,
      },
    ],
    notes:
      "USGS 3DEP hillshade. Lidar-derived where 1 m coverage exists, ~10 m elsewhere. Not a point cloud.",
  },
  {
    id: "wetlands",
    label: "Wetlands (NWI)",
    group: "terrain",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "fws-nwi",
    tiles: [
      {
        id: "nwi",
        protocol: "arcgis-export",
        mapServer: NWI_MAPSERVER,
        layerIdentifier: "0",
        opacity: 0.5,
      },
    ],
  },
  {
    id: "landCover",
    label: "Land cover (NLCD)",
    group: "terrain",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "usgs-nlcd",
    tiles: [
      {
        id: "nlcd",
        protocol: "wms",
        mapServer: NLCD_WMS,
        layerIdentifier: "NLCD_2021_Land_Cover_L48",
        wmsLayer: "NLCD_2021_Land_Cover_L48",
        opacity: 0.45,
      },
    ],
    notes: "Display overlay only. Pixel identify stays unknown.",
  },
  {
    id: "gnisCamp",
    label: "Camps, springs, trails",
    group: "camp",
    defaultOn: false,
    defaultPackChecked: false,
    dense: false,
    jurisdiction: "US",
    cacheMode: "vector",
    datasetId: "usgs-gnis-camp",
    tiles: [
      {
        id: "gnis",
        protocol: "arcgis-export",
        mapServer: GNIS_MAPSERVER,
        layerIdentifier: "0",
        layerDefs: {
          "0": "FEATURE_CLASS IN ('Spring','Camp','Trail','Reservoir','Well')",
        },
        opacity: 0.85,
      },
    ],
    vectorWhere: "FEATURE_CLASS IN ('Spring','Camp','Trail','Reservoir','Well')",
  },
  {
    id: "mvum",
    label: "Forest Service MVUM",
    group: "camp",
    defaultOn: false,
    defaultPackChecked: false,
    dense: true,
    jurisdiction: "US",
    cacheMode: "raster",
    datasetId: "usfs-mvum",
    tiles: [
      {
        id: "usfs-mvum",
        protocol: "arcgis-export",
        mapServer: MVUM_MAPSERVER,
        layerIdentifier: "1,2",
        opacity: 0.75,
      },
    ],
    notes: "Motor-vehicle use on National Forest roads and trails. Not a camping permit.",
  },
];

export const OVERLAY_TILE_SLUGS = OVERLAY_CATALOG.flatMap((item) =>
  item.tiles.map((tile) => tile.id),
);

export type OverlayTileSlug = (typeof OVERLAY_TILE_SLUGS)[number];

const byId = new Map(OVERLAY_CATALOG.map((item) => [item.id, item]));
const tileBySlug = new Map(
  OVERLAY_CATALOG.flatMap((item) => item.tiles.map((tile) => [tile.id, tile] as const)),
);

export function overlayDefinition(id: OverlayId): OverlayDefinition {
  const found = byId.get(id);
  if (!found) {
    throw new Error(`Unknown overlay ${id}`);
  }
  return found;
}

export function overlayTileSpec(slug: string): OverlayTileSpec | undefined {
  return tileBySlug.get(slug);
}

export function isOverlayId(value: string): value is OverlayId {
  return byId.has(value as OverlayId);
}

export function overlaysForState(stateCode: string | null | undefined): OverlayDefinition[] {
  return OVERLAY_CATALOG.filter(
    (item) => item.jurisdiction === "US" || item.jurisdiction === stateCode,
  );
}

export function overlaysInGroup(
  group: OverlayGroup,
  stateCode?: string | null,
): OverlayDefinition[] {
  return overlaysForState(stateCode).filter((item) => item.group === group);
}

export type OverlayLayerFlags = Record<OverlayId, boolean>;

export function defaultOverlayLayerFlags(): OverlayLayerFlags {
  const flags = {} as OverlayLayerFlags;
  for (const item of OVERLAY_CATALOG) {
    flags[item.id] = item.defaultOn;
  }
  return flags;
}

export function mergeOverlayLayerFlags(
  partial?: Partial<Record<string, boolean>> | null,
): OverlayLayerFlags {
  const defaults = defaultOverlayLayerFlags();
  if (!partial) return defaults;
  for (const id of OVERLAY_IDS) {
    if (typeof partial[id] === "boolean") defaults[id] = partial[id];
  }
  return defaults;
}

export function defaultPackSelection(
  stateCode: string | null | undefined,
  displayed?: Partial<Record<OverlayId, boolean>>,
): OverlayId[] {
  return overlaysForState(stateCode)
    .filter((item) => {
      if (item.dense) return false;
      if (displayed && typeof displayed[item.id] === "boolean") return displayed[item.id] === true;
      return item.defaultPackChecked;
    })
    .map((item) => item.id);
}

export function encodeLayerDefs(defs: Record<string, string> | undefined): string | undefined {
  if (!defs) return undefined;
  return JSON.stringify(defs);
}

export function arcgisExportTileUrl(
  spec: OverlayTileSpec,
  z: number,
  x: number,
  y: number,
): string {
  const bbox = tileToBBox(z, x, y);
  const url = new URL(`${spec.mapServer.replace(/\/+$/, "")}/export`);
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "3857");
  url.searchParams.set("size", "256,256");
  url.searchParams.set("format", "png32");
  url.searchParams.set("transparent", "true");
  url.searchParams.set("layers", `show:${spec.layerIdentifier}`);
  url.searchParams.set("f", "image");
  let built = url.toString();
  const defs = encodeLayerDefs(spec.layerDefs);
  if (defs) built += `&layerDefs=${encodeURIComponent(defs)}`;
  if (spec.dynamicLayers) {
    const dynamic =
      typeof spec.dynamicLayers === "string"
        ? spec.dynamicLayers
        : JSON.stringify(spec.dynamicLayers);
    built += `&dynamicLayers=${encodeURIComponent(dynamic)}`;
  }
  return built;
}

export function wmsGetMapUrl(spec: OverlayTileSpec, z: number, x: number, y: number): string {
  const bbox = tileToBBox(z, x, y);
  const url = new URL(spec.mapServer);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.1.1");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("LAYERS", spec.wmsLayer ?? spec.layerIdentifier);
  url.searchParams.set("STYLES", "");
  url.searchParams.set("SRS", "EPSG:4326");
  url.searchParams.set("BBOX", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
  url.searchParams.set("WIDTH", "256");
  url.searchParams.set("HEIGHT", "256");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "true");
  return url.toString();
}

export function arcgisImageTileUrl(
  spec: OverlayTileSpec,
  z: number,
  x: number,
  y: number,
): string {
  const bbox = tileToBBox(z, x, y);
  const url = new URL(`${spec.mapServer.replace(/\/+$/, "")}/exportImage`);
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "3857");
  url.searchParams.set("size", "256,256");
  url.searchParams.set("format", "png32");
  url.searchParams.set("pixelType", "U8");
  url.searchParams.set("interpolation", "RSP_BilinearInterpolation");
  url.searchParams.set("f", "image");
  let built = url.toString();
  if (spec.renderingRule) {
    built += `&renderingRule=${encodeURIComponent(JSON.stringify({ rasterFunction: spec.renderingRule }))}`;
  }
  return built;
}

export function overlayTileRequestUrl(
  spec: OverlayTileSpec,
  z: number,
  x: number,
  y: number,
): string {
  switch (spec.protocol) {
    case "arcgis-export":
      return arcgisExportTileUrl(spec, z, x, y);
    case "arcgis-image":
      return arcgisImageTileUrl(spec, z, x, y);
    case "wms":
      return wmsGetMapUrl(spec, z, x, y);
    default: {
      const _exhaustive: never = spec.protocol;
      return _exhaustive;
    }
  }
}

export function overlayGroupLabel(group: OverlayGroup): string {
  switch (group) {
    case "land":
      return "LAND";
    case "hunt":
      return "HUNT";
    case "terrain":
      return "TERRAIN";
    case "camp":
      return "CAMP · ACCESS";
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

export function assertOverlayId(id: OverlayId): OverlayId {
  switch (id) {
    case "publicLand":
    case "nationalForests":
    case "publicHunting":
    case "padusBlm":
    case "padusNps":
    case "padusFws":
    case "padusState":
    case "padusTribal":
    case "padusClosed":
    case "texasParcels":
    case "publicHuntAreas":
    case "huntingUnits":
    case "water":
    case "roads":
    case "contours":
    case "lidar":
    case "wetlands":
    case "landCover":
    case "gnisCamp":
    case "mvum":
      return id;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Matches data-sources/states/texas TEXAS_STATE_MODULE.defaultExtent. */
export const TEXAS_PACK_EXTENT: BoundingBox = {
  west: -106.65,
  south: 25.84,
  east: -93.51,
  north: 36.5,
};

export const STATE_PACK_EXTENTS: Record<string, BoundingBox> = {
  TX: TEXAS_PACK_EXTENT,
};

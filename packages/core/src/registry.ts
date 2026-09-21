import type { DatasetRecord } from "./types";

export const DATASET_REGISTRY: DatasetRecord[] = [
  {
    datasetId: "usgs-topo",
    name: "USGS National Map Topo",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "basemap",
    sourceUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer",
    serviceType: "xyz-raster",
    version: "The National Map",
    license: "Public domain (USGS The National Map)",
    attribution:
      "USGS The National Map: National Boundaries Dataset, 3DEP, GNIS, NHD, NLCD, National Structures Dataset, and National Transportation Dataset.",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "usgs-imagery",
    name: "USGS National Map Imagery",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "basemap",
    sourceUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer",
    serviceType: "xyz-raster",
    license: "Public domain / NAIP attribution required",
    attribution:
      "USGS The National Map imagery. NAIP administered by USDA FSA where applicable.",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "usgs-hillshade",
    name: "USGS Shaded Relief",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "terrain",
    sourceUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer",
    serviceType: "xyz-raster",
    license: "Public domain (USGS The National Map)",
    attribution: "USGS The National Map shaded relief.",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "usgs-3dep-elevation",
    name: "USGS 3DEP Elevation",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "terrain",
    sourceUrl:
      "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer",
    serviceType: "arcgis-imageserver",
    license: "Public domain (USGS 3DEP / The National Map)",
    attribution:
      "USGS 3D Elevation Program (3DEP). Hillshade is lidar-derived where 1 m coverage exists.",
    status: "unknown",
    enabled: true,
    notes:
      "ImageServer hillshade overlay for hunting-style lidar relief. Not a LAS point cloud. Resolution varies.",
  },
  {
    datasetId: "terrarium",
    name: "Mapzen Terrarium DEM",
    agency: "Mapzen / Amazon",
    jurisdiction: "global",
    dataType: "terrain",
    sourceUrl: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    serviceType: "xyz-raster",
    license: "ODBL / public terrain tiles",
    attribution: "Mapzen / Amazon Terrain Tiles.",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "padus-4-1-fee",
    name: "PAD-US 4.1 Fee",
    agency: "USGS Gap Analysis Project",
    jurisdiction: "US",
    dataType: "public_land",
    sourceUrl:
      "https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US_4_1/MapServer/0",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "0",
    version: "4.1",
    license: "USGS data release https://doi.org/10.5066/P96WBCHS",
    attribution:
      "U.S. Geological Survey (USGS) Gap Analysis Project (GAP), Protected Areas Database of the United States (PAD-US) 4.1, https://doi.org/10.5066/P96WBCHS. Agencies remain the official source of their land data.",
    status: "unknown",
    enabled: true,
    notes:
      "Fee feature class only. Designations, easements, and proclamation boundaries are not implied. Public access codes are categorical and may be incomplete.",
  },
  {
    datasetId: "open-meteo-weather",
    name: "Open-Meteo Forecast",
    agency: "Open-Meteo",
    jurisdiction: "global",
    dataType: "weather",
    sourceUrl: "https://api.open-meteo.com/v1/forecast",
    serviceType: "open-meteo",
    license: "CC BY 4.0 (Open-Meteo attribution)",
    attribution: "Weather data by Open-Meteo.com",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "open-meteo-elevation",
    name: "Open-Meteo Elevation",
    agency: "Open-Meteo",
    jurisdiction: "global",
    dataType: "elevation",
    sourceUrl: "https://api.open-meteo.com/v1/elevation",
    serviceType: "open-meteo",
    license: "CC BY 4.0 (Open-Meteo attribution)",
    attribution: "Elevation data by Open-Meteo.com",
    status: "unknown",
    enabled: true,
    notes: "Used as a DEM sample source until a local 3DEP package is downloaded.",
  },
  {
    datasetId: "rainviewer-radar",
    name: "RainViewer Radar",
    agency: "RainViewer",
    jurisdiction: "global",
    dataType: "weather",
    sourceUrl: "https://api.rainviewer.com/public/weather-maps.json",
    serviceType: "xyz-raster",
    license: "RainViewer terms; underlying radar agencies retain their data",
    attribution: "Radar by RainViewer.com",
    status: "unknown",
    enabled: true,
    notes:
      "Observed reflectivity composites plus a short nowcast. Not a site forecast, season, or permission layer.",
  },
  {
    datasetId: "usgs-nhd-waterbody",
    name: "USGS NHD Waterbodies",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "hydrography",
    sourceUrl:
      "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "12",
    license: "Public domain (USGS National Hydrography Dataset)",
    attribution:
      "USGS National Hydrography Dataset (NHD), The National Map. Not for site-specific regulatory determinations.",
    status: "unknown",
    enabled: true,
    notes:
      "Large-scale NHD waterbodies. If the service fails, water distance stays unknown and is not invented.",
  },
  {
    datasetId: "usgs-nhd-flowline",
    name: "USGS NHD Flowlines",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "hydrography",
    sourceUrl:
      "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "6",
    license: "Public domain (USGS National Hydrography Dataset)",
    attribution:
      "USGS National Hydrography Dataset (NHD), The National Map. Not for site-specific regulatory determinations.",
    status: "unknown",
    enabled: true,
    notes:
      "Large-scale NHD flowlines. If the service fails, water distance stays unknown and is not invented.",
  },
  {
    datasetId: "usgs-tnm-roads",
    name: "USGS The National Map Transportation",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "roads",
    sourceUrl:
      "https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer",
    serviceType: "arcgis-mapserver",
    license: "Public domain (USGS National Transportation Dataset)",
    attribution:
      "USGS The National Map: National Transportation Dataset; U.S. Census Bureau TIGER/Line; U.S. Forest Service.",
    status: "unknown",
    enabled: true,
    notes:
      "Official TNM transportation MapServer. Road-distance scoring still stays unknown unless a query service is used — this overlay is display only.",
  },
  {
    datasetId: "usgs-contours",
    name: "USGS Elevation Contours",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "terrain",
    sourceUrl:
      "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer",
    serviceType: "arcgis-mapserver",
    license: "Public domain (USGS 3DEP / The National Map)",
    attribution: "USGS The National Map: 3D Elevation Program contours.",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "usgs-gnis",
    name: "USGS Geographic Names (GNIS)",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "places",
    sourceUrl:
      "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer",
    serviceType: "arcgis-mapserver",
    license: "Public domain (USGS Geographic Names Information System)",
    attribution: "USGS The National Map: Geographic Names Information System.",
    status: "unknown",
    enabled: true,
  },
  {
    datasetId: "fws-nwi",
    name: "USFWS National Wetlands Inventory",
    agency: "U.S. Fish and Wildlife Service",
    jurisdiction: "US",
    dataType: "wetlands",
    sourceUrl:
      "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "0",
    license: "Public domain (USFWS National Wetlands Inventory)",
    attribution:
      "U.S. Fish and Wildlife Service National Wetlands Inventory. Not for site-specific regulatory determinations.",
    status: "unknown",
    enabled: true,
    notes: "Visible when zoomed in (service minScale 1:100,000).",
  },
  {
    datasetId: "usgs-nlcd",
    name: "USGS NLCD Land Cover",
    agency: "USGS / MRLC",
    jurisdiction: "US",
    dataType: "land_cover",
    sourceUrl: "https://www.mrlc.gov/geoserver/mrlc_display/wms",
    serviceType: "wms",
    layerIdentifier: "NLCD_2021_Land_Cover_L48",
    version: "2021",
    license: "Public domain (NLCD / MRLC)",
    attribution:
      "National Land Cover Database (NLCD), Multi-Resolution Land Characteristics Consortium.",
    status: "unknown",
    enabled: true,
    notes:
      "Official MRLC WMS display overlay. Land-cover scoring stays unknown until an identify/query service is used.",
  },
  {
    datasetId: "tx-hunting-units",
    name: "Texas Hunting Units",
    agency: "Texas Parks and Wildlife Department",
    jurisdiction: "TX",
    dataType: "hunting_units",
    sourceUrl: "https://tpwd.texas.gov/server/rest/services/Wildlife/TPWD_WL_WTDMU/MapServer/0",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "0",
    attribution:
      "Texas Parks and Wildlife Department is the source of record for Texas hunting units and regulations.",
    status: "unknown",
    enabled: true,
    notes:
      "Official TPWD white-tailed deer management units. Overlay is not seasons, bag limits, or permission.",
  },
  {
    datasetId: "tx-public-hunt-areas",
    name: "TPWD Public Hunt Areas",
    agency: "Texas Parks and Wildlife Department",
    jurisdiction: "TX",
    dataType: "public_hunt_areas",
    sourceUrl:
      "https://tpwd.texas.gov/server/rest/services/Wildlife/TPWD_PublicHuntLocatorMap/MapServer",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "7,8,9",
    attribution:
      "Texas Parks and Wildlife Department Public Hunt Locator. Listed public hunt areas only — not seasons, bag limits, or permission.",
    status: "unknown",
    enabled: true,
    notes:
      "Official TPWD Public Hunt Locator (points, lines, polygons). Overlay is not a legal-access determination.",
  },
  {
    datasetId: "tx-stratmap-parcels",
    name: "Texas StratMap Land Parcels",
    agency: "Texas Geographic Information Office",
    jurisdiction: "TX",
    dataType: "parcels",
    sourceUrl:
      "https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer/0",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "0",
    license: "TxGIO StratMap / county appraisal districts",
    attribution:
      "Texas Geographic Information Office StratMap land parcels. Appraisal-district geometry; not survey grade.",
    status: "unknown",
    enabled: true,
    notes:
      "Owner name, county, and tax year when published by the contributing county. Donley County is missing. Not permission to enter.",
  },
  {
    datasetId: "tx-regulations",
    name: "Texas Hunting Regulations",
    agency: "Texas Parks and Wildlife Department",
    jurisdiction: "TX",
    dataType: "regulations",
    sourceUrl: "https://tpwd.texas.gov",
    serviceType: "geojson",
    attribution: "Texas Parks and Wildlife Department Outdoor Annual.",
    status: "unconfigured",
    enabled: false,
    notes:
      "Regulations are never hardcoded. Import structured records with provenance only.",
  },
  {
    datasetId: "usgs-gnis-camp",
    name: "USGS GNIS camps / springs / trails",
    agency: "USGS",
    jurisdiction: "US",
    dataType: "places",
    sourceUrl:
      "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/0",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "0",
    license: "Public domain (USGS Geographic Names Information System)",
    attribution: "USGS The National Map: Geographic Names Information System.",
    status: "unknown",
    enabled: true,
    notes: "Filtered to camp, spring, trail, reservoir, and well feature classes when queried.",
  },
  {
    datasetId: "usfs-mvum",
    name: "USFS Motor Vehicle Use Map",
    agency: "U.S. Forest Service",
    jurisdiction: "US",
    dataType: "roads",
    sourceUrl:
      "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer",
    serviceType: "arcgis-mapserver",
    layerIdentifier: "1,2",
    license: "Public domain (U.S. Forest Service)",
    attribution:
      "U.S. Forest Service Motor Vehicle Use Map. Designated routes only — not a camping permit or hunt license.",
    status: "unknown",
    enabled: true,
  },
];

export function applyEnvOverrides(
  records: DatasetRecord[],
  env: Record<string, string | undefined>,
): DatasetRecord[] {
  return records.map((record) => {
    if (record.datasetId === "padus-4-1-fee" && env.PADUS_FEATURE_URL) {
      return { ...record, sourceUrl: env.PADUS_FEATURE_URL, enabled: true };
    }
    if (record.datasetId === "usgs-topo" && env.USGS_TOPO_TILE_URL) {
      return { ...record, sourceUrl: env.USGS_TOPO_TILE_URL };
    }
    if (record.datasetId === "usgs-imagery" && env.USGS_IMAGERY_TILE_URL) {
      return { ...record, sourceUrl: env.USGS_IMAGERY_TILE_URL };
    }
    if (record.datasetId === "usgs-hillshade" && env.USGS_HILLSHADE_TILE_URL) {
      return { ...record, sourceUrl: env.USGS_HILLSHADE_TILE_URL };
    }
    if (record.datasetId === "terrarium" && env.TERRARIUM_TILE_URL) {
      return { ...record, sourceUrl: env.TERRARIUM_TILE_URL };
    }
    if (record.datasetId === "tx-hunting-units" && env.TPWD_HUNTING_UNITS_URL) {
      return {
        ...record,
        sourceUrl: env.TPWD_HUNTING_UNITS_URL,
        enabled: true,
        status: "unknown",
      };
    }
    if (record.datasetId === "tx-public-hunt-areas" && env.TPWD_PUBLIC_HUNT_URL) {
      return {
        ...record,
        sourceUrl: env.TPWD_PUBLIC_HUNT_URL,
        enabled: true,
        status: "unknown",
      };
    }
    if (record.datasetId === "usgs-nhd-waterbody" && env.NHD_WATERBODY_URL) {
      return { ...record, sourceUrl: env.NHD_WATERBODY_URL, enabled: true, status: "unknown" };
    }
    if (record.datasetId === "usgs-nhd-flowline" && env.NHD_FLOWLINE_URL) {
      return { ...record, sourceUrl: env.NHD_FLOWLINE_URL, enabled: true, status: "unknown" };
    }
    if (record.datasetId === "usgs-tnm-roads" && env.TNM_ROADS_URL) {
      return { ...record, sourceUrl: env.TNM_ROADS_URL, enabled: true, status: "unknown" };
    }
    if (record.datasetId === "usgs-nlcd" && env.NLCD_URL) {
      return { ...record, sourceUrl: env.NLCD_URL, enabled: true, status: "unknown" };
    }
    return record;
  });
}

export function getDataset(
  records: readonly DatasetRecord[],
  datasetId: string,
): DatasetRecord | undefined {
  return records.find((record) => record.datasetId === datasetId);
}

export function enabledDatasets(
  records: readonly DatasetRecord[],
  dataType?: string,
): DatasetRecord[] {
  return records.filter(
    (record) =>
      record.enabled &&
      Boolean(record.sourceUrl) &&
      (dataType ? record.dataType === dataType : true),
  );
}

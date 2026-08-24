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
    datasetId: "tx-hunting-units",
    name: "Texas Hunting Units",
    agency: "Texas Parks and Wildlife Department",
    jurisdiction: "TX",
    dataType: "hunting_units",
    sourceUrl: "",
    serviceType: "arcgis-featureserver",
    attribution:
      "Texas Parks and Wildlife Department is the source of record for Texas hunting units and regulations.",
    status: "unconfigured",
    enabled: false,
    notes:
      "Do not invent a TPWD endpoint. Set TPWD_HUNTING_UNITS_URL when an official service is available.",
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
    if (record.datasetId === "tx-hunting-units" && env.TPWD_HUNTING_UNITS_URL) {
      return {
        ...record,
        sourceUrl: env.TPWD_HUNTING_UNITS_URL,
        enabled: true,
        status: "unknown",
      };
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

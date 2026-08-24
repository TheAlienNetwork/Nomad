export const USGS_BASEMAPS = {
  topo: {
    datasetId: "usgs-topo",
    tileUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "USGS The National Map",
  },
  imagery: {
    datasetId: "usgs-imagery",
    tileUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
    attribution: "USGS The National Map / NAIP",
  },
  hillshade: {
    datasetId: "usgs-hillshade",
    tileUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}",
    attribution: "USGS The National Map shaded relief",
  },
} as const;

export const PADUS_FEE = {
  datasetId: "padus-4-1-fee",
  mapServer:
    "https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US_4_1/MapServer",
  featureLayer:
    "https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US_4_1/MapServer/0",
  layerIdentifier: "0",
} as const;

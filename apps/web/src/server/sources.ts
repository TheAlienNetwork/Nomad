export const USGS_BASEMAPS = {
  topo: {
    datasetId: "usgs-topo",
    tileUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
  },
  imagery: {
    datasetId: "usgs-imagery",
    tileUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
  },
  hillshade: {
    datasetId: "usgs-hillshade",
    tileUrl:
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}",
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

export const TEXAS_DEFAULT_CENTER = {
  latitude: 30.52,
  longitude: -95.28,
} as const;

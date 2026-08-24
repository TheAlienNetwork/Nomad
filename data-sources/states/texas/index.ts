/**
 * Texas is the first fully configured state module.
 * This file holds adapters/configuration only — no application logic
 * and no hardcoded hunting regulations or season dates.
 */
export const TEXAS_STATE_MODULE = {
  code: "TX",
  name: "Texas",
  defaultCenter: { latitude: 30.58, longitude: -95.47 },
  defaultZoom: 10,
  defaultExtent: {
    west: -106.65,
    south: 25.84,
    east: -93.51,
    north: 36.5,
  },
  agencies: {
    wildlife: {
      name: "Texas Parks and Wildlife Department",
      homepage: "https://tpwd.texas.gov",
      regulationsNote:
        "TPWD is the source of record. Do not invent season dates, bag limits, or legal-light rules.",
    },
  },
  datasets: {
    huntingUnits: {
      datasetId: "tx-hunting-units",
      envUrlKey: "TPWD_HUNTING_UNITS_URL",
      status: "unconfigured",
    },
    regulations: {
      datasetId: "tx-regulations",
      envUrlKey: null,
      status: "unconfigured",
    },
  },
} as const;

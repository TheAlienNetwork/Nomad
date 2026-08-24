/**
 * Map-frame presets for Texas public-land units that exist in PAD-US.
 * These are navigation extents only — not legal boundaries.
 */
export const TEXAS_PUBLIC_LAND_PLACES = [
  {
    id: "tx-sam-houston-nf",
    name: "Sam Houston National Forest",
    padusUnitName: "Sam Houston National Forest",
    agency: "USFS",
    state: "TX",
    datasetId: "padus-4-1-fee",
    center: { latitude: 30.58, longitude: -95.47 },
    bounds: {
      west: -95.8114,
      south: 30.3278,
      east: -95.0378,
      north: 30.7505,
    },
    aliases: ["sam houston", "shnf", "houston national forest"],
  },
  {
    id: "tx-davy-crockett-nf",
    name: "Davy Crockett National Forest",
    padusUnitName: "Davy Crockett National Forest",
    agency: "USFS",
    state: "TX",
    datasetId: "padus-4-1-fee",
    center: { latitude: 31.32, longitude: -95.15 },
    bounds: {
      west: -95.37124059015773,
      south: 31.031575356508384,
      east: -94.84402388678149,
      north: 31.57681372806265,
    },
    aliases: [
      "davy crockett",
      "davey crockett",
      "davey crocket",
      "davy crocket",
      "crockett national forest",
      "dcnf",
    ],
  },
] as const;

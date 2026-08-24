import type { BoundingBox, LonLat } from "@huntos/core";

export interface PublicLandPlace {
  id: string;
  name: string;
  padusUnitName: string;
  agency: string;
  state: string;
  datasetId: string;
  center: LonLat;
  bounds: BoundingBox;
  aliases: readonly string[];
}

export const TEXAS_PUBLIC_LAND_PLACES: readonly PublicLandPlace[] = [
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
];

function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchPublicLandPlace(query: string): PublicLandPlace | undefined {
  const needle = normalizeQuery(query);
  if (!needle) return undefined;
  return TEXAS_PUBLIC_LAND_PLACES.find((place) => {
    const names = [place.name, place.padusUnitName, ...place.aliases].map(normalizeQuery);
    return names.some((name) => name === needle || name.includes(needle) || needle.includes(name));
  });
}

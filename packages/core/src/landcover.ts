import type { LandCoverClass } from "./habitat";

export interface NormalizedLandCover {
  truthLayer: "authoritative";
  originalClass: string;
  originalScheme: string;
  normalized: LandCoverClass;
}

const NLCD: Record<string, LandCoverClass> = {
  "11": "water",
  "12": "water",
  "21": "developed",
  "22": "developed",
  "23": "developed",
  "24": "developed",
  "31": "open",
  "41": "deciduous_forest",
  "42": "evergreen_forest",
  "43": "mixed_forest",
  "52": "shrub",
  "71": "grassland",
  "81": "agricultural",
  "82": "agricultural",
  "90": "wetland",
  "95": "wetland",
};

export function normalizeLandCover(
  originalClass: string,
  scheme: "nlcd" | "custom" | "raw",
  customMap?: Record<string, LandCoverClass>,
): NormalizedLandCover {
  const key = originalClass.trim();
  let normalized: LandCoverClass = "unknown";
  if (scheme === "nlcd") {
    normalized = NLCD[key] ?? "unknown";
  } else if (scheme === "custom" && customMap) {
    normalized = customMap[key] ?? "unknown";
  } else {
    const direct = key.toLowerCase().replace(/\s+/g, "_");
    const allowed: LandCoverClass[] = [
      "open",
      "grassland",
      "shrub",
      "deciduous_forest",
      "evergreen_forest",
      "mixed_forest",
      "wetland",
      "agricultural",
      "developed",
      "water",
      "unknown",
    ];
    normalized = allowed.includes(direct as LandCoverClass)
      ? (direct as LandCoverClass)
      : "unknown";
  }
  return {
    truthLayer: "authoritative",
    originalClass,
    originalScheme: scheme,
    normalized,
  };
}

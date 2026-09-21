import { normalizeBearing } from "./geo";
import type { LonLat, WindClass } from "./types";

export interface WindObservation {
  directionFromDegrees: number;
  speedMps: number;
  gustMps?: number;
  source: string;
  retrievedAt: string;
}

export interface WindEvaluation {
  truthLayer: "inferred";
  classification: WindClass;
  setupBearingToTarget: number;
  windFrom: number;
  relativeDegrees: number;
  reasons: string[];
  disclaimer: string;
}

export function evaluateWind(
  setup: LonLat,
  target: LonLat,
  wind: WindObservation | null,
): WindEvaluation {
  if (!wind) {
    return {
      truthLayer: "inferred",
      classification: "unknown",
      setupBearingToTarget: 0,
      windFrom: 0,
      relativeDegrees: 0,
      reasons: ["No wind observation is available."],
      disclaimer:
        "Wind classification is unavailable without a weather observation.",
    };
  }
  const dLat = target.latitude - setup.latitude;
  const dLon = target.longitude - setup.longitude;
  const setupBearingToTarget = normalizeBearing(
    (Math.atan2(dLon, dLat) * 180) / Math.PI,
  );
  const windToward = normalizeBearing(wind.directionFromDegrees + 180);
  let relative = Math.abs(windToward - setupBearingToTarget);
  if (relative > 180) relative = 360 - relative;

  let classification: WindClass;
  const reasons: string[] = [];
  if (relative <= 40) {
    classification = "unfavorable";
    reasons.push("Wind blows from setup toward the target area.");
  } else if (relative >= 110) {
    classification = "favorable";
    reasons.push("Wind is generally from the target area toward the hunter.");
  } else {
    classification = "marginal";
    reasons.push("Cross-wind component is significant.");
  }
  if (wind.speedMps < 0.6) {
    classification = classification === "unfavorable" ? "marginal" : classification;
    reasons.push("Light wind increases swirl risk.");
  }

  return {
    truthLayer: "inferred",
    classification,
    setupBearingToTarget,
    windFrom: wind.directionFromDegrees,
    relativeDegrees: Math.round(relative),
    reasons,
    disclaimer:
      "Wind evaluation is a geometric heuristic. Terrain channeling is not fully modeled.",
  };
}

export function whatIfWind(
  setup: LonLat,
  target: LonLat,
  fromDegrees: number,
  speedMps = 3,
): WindEvaluation {
  return evaluateWind(setup, target, {
    directionFromDegrees: fromDegrees,
    speedMps,
    source: "what-if",
    retrievedAt: new Date().toISOString(),
  });
}

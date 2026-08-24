import { isHarvestMark, type Waypoint } from "@huntos/core";

export interface HarvestFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      id: string;
      name: string;
      type: Waypoint["type"];
      species: string;
      truthLayer: "observed";
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
}

export function mapMarkWaypoints(waypoints: Waypoint[]): Waypoint[] {
  return waypoints.filter((waypoint) => !isHarvestMark(waypoint.type));
}

export function harvestsToFc(waypoints: Waypoint[]): HarvestFeatureCollection {
  return {
    type: "FeatureCollection",
    features: waypoints.filter((waypoint) => isHarvestMark(waypoint.type)).map((waypoint) => ({
      type: "Feature",
      properties: {
        id: waypoint.id,
        name: waypoint.name,
        type: waypoint.type,
        species: waypoint.species ?? "",
        truthLayer: "observed",
      },
      geometry: {
        type: "Point",
        coordinates: [waypoint.longitude, waypoint.latitude],
      },
    })),
  };
}

import { describe, expect, it } from "vitest";
import {
  OBSERVATION_WAYPOINT_TYPES,
  WAYPOINT_TYPES,
  WAYPOINT_TYPE_LABELS,
} from "../src/types";

describe("waypoint catalog", () => {
  it("includes sightings and scat as first-class types", () => {
    expect(WAYPOINT_TYPES).toContain("sighting");
    expect(WAYPOINT_TYPES).toContain("scat");
    expect(WAYPOINT_TYPE_LABELS.sighting).toBe("Sighting");
    expect(WAYPOINT_TYPE_LABELS.scat).toBe("Scat");
  });

  it("groups hunter observations separately from infrastructure", () => {
    expect(OBSERVATION_WAYPOINT_TYPES).toEqual(
      expect.arrayContaining(["sighting", "scat"]),
    );
  });
});

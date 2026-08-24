import { describe, expect, it } from "vitest";
import { DEFAULT_FIELD_CENTER, matchPublicLandPlace } from "../src/lib/places";

describe("Texas public-land place search", () => {
  it("matches common misspellings of Davy Crockett NF", () => {
    expect(matchPublicLandPlace("davey crocket")?.id).toBe("tx-davy-crockett-nf");
    expect(matchPublicLandPlace("Davy Crockett National Forest")?.padusUnitName).toBe(
      "Davy Crockett National Forest",
    );
  });

  it("still matches Sam Houston NF", () => {
    expect(matchPublicLandPlace("sam houston")?.id).toBe("tx-sam-houston-nf");
  });

  it("keeps a known default field center", () => {
    expect(DEFAULT_FIELD_CENTER).toEqual({ latitude: 30.58, longitude: -95.47 });
  });
});

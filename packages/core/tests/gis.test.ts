import { describe, expect, it } from "vitest";
import {
  assertNoFabricatedLegalStatus,
  createGeoJsonProvider,
  identifyFromCollection,
  mapPadusAccess,
  normalizePadusFeature,
  provenanceFromRecord,
} from "../src/gis";
import { BOUNDARY_CONFIDENCE_WARNING } from "../src/types";
import type { DatasetRecord } from "../src/types";

const provenance = provenanceFromRecord(
  {
    datasetId: "test-padus",
    name: "TEST PUBLIC LAND",
    agency: "TEST_AGENCY",
    jurisdiction: "TEST",
    dataType: "public_land",
    sourceUrl: "https://example.test/padus",
    serviceType: "geojson",
    attribution: "unit-test-fixture",
    status: "healthy",
    enabled: true,
    version: "fixture-1",
  } satisfies DatasetRecord,
  "2026-01-01T00:00:00.000Z",
);

const polygon = {
  type: "FeatureCollection" as const,
  features: [
    normalizePadusFeature(
      {
        type: "Feature",
        properties: {
          Unit_Nm: "TEST PUBLIC UNIT A",
          Mang_Name: "USFS",
          Mang_Type: "FED",
          Des_Tp: "NF",
          Pub_Access: "OA",
          State_Nm: "TX",
          GIS_Src: "unit-test-fixture",
          Src_Date: "2024-01-01",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-96, 30],
              [-94, 30],
              [-94, 32],
              [-96, 32],
              [-96, 30],
            ],
          ],
        },
      },
      provenance,
    ),
  ],
};

describe("PAD-US normalization", () => {
  it("maps access codes without inventing values", () => {
    expect(mapPadusAccess("OA")).toBe("open");
    expect(mapPadusAccess("XA")).toBe("closed");
    expect(mapPadusAccess("not-a-code")).toBe("unknown");
    expect(mapPadusAccess(undefined)).toBe("unknown");
  });

  it("preserves provenance on normalized features", () => {
    const feature = polygon.features[0];
    expect(feature?.properties?.truthLayer).toBe("authoritative");
    expect(feature?.properties?.provenance).toMatchObject({
      datasetId: "test-padus",
      agency: "TEST_AGENCY",
      sourceUrl: "https://example.test/padus",
      version: "fixture-1",
      retrievedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("public-land lookup", () => {
  it("returns public status only when a polygon contains the point", async () => {
    const provider = createGeoJsonProvider(
      {
        datasetId: "test-padus",
        name: "TEST PUBLIC LAND",
        agency: "TEST_AGENCY",
        jurisdiction: "TEST",
        dataType: "public_land",
        sourceUrl: "https://example.test/padus",
        serviceType: "geojson",
        attribution: "unit-test-fixture",
        status: "healthy",
        enabled: true,
      },
      polygon,
    );
    const hit = await provider.identify?.({ longitude: -95, latitude: 31 });
    expect(hit?.found).toBe(true);
    expect(hit?.status).toBe("public");
    expect(hit?.features[0]?.properties.manager).toBe("USFS");
    expect(hit?.warnings).toContain(BOUNDARY_CONFIDENCE_WARNING);
  });

  it("does not invent private or public status when no feature hits", () => {
    const miss = identifyFromCollection(polygon, { longitude: -90, latitude: 31 }, provenance);
    expect(miss.found).toBe(false);
    expect(miss.status).toBe("unknown");
    expect(miss.message).toMatch(/does not mean the land is private/i);
    assertNoFabricatedLegalStatus(miss);
  });
});

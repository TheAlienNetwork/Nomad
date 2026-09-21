import { describe, expect, it } from "vitest";
import {
  assertNoFabricatedLegalStatus,
  createGeoJsonProvider,
  describeLandStatus,
  describeParcelStatus,
  extractPublishedRegulationFields,
  featuresContainingPoint,
  identifyFromCollection,
  isMuleDeerDrawListing,
  mapPadusAccess,
  normalizePadusFeature,
  overlayFeatureLabel,
  provenanceFromRecord,
  unavailableIdentify,
  arcgisQueryUrl,
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

  it("keeps unavailable identify as unknown and never claims private land", () => {
    const result = unavailableIdentify(
      "HUNT//OS API is not configured. Public/private status cannot be determined.",
    );
    const copy = describeLandStatus(result);
    expect(result.found).toBe(false);
    expect(result.status).toBe("unknown");
    expect(copy.unknown).toBe(true);
    expect(copy.headline).toBe("Land status unknown");
    expect(copy.headline.toLowerCase()).not.toContain("private");
    assertNoFabricatedLegalStatus(result);
  });

  it("labels overlay polygons without inventing private land", () => {
    const hits = featuresContainingPoint(polygon, { longitude: -95, latitude: 31 });
    const miss = featuresContainingPoint(polygon, { longitude: -90, latitude: 31 });
    expect(overlayFeatureLabel(hits[0], "PAD-US")).toBe("TEST PUBLIC UNIT A");
    expect(miss).toHaveLength(0);
  });
});

describe("ArcGIS query URLs", () => {
  it("omits resultRecordCount when the layer does not support pagination", () => {
    const url = arcgisQueryUrl({
      sourceUrl: "https://example.test/MapServer/0",
      bounds: { west: -96, south: 30, east: -94, north: 32 },
      resultRecordCount: null,
    });
    expect(url).not.toMatch(/resultRecordCount/);
    expect(url).toMatch(/f=geojson/);
  });

  it("includes a where clause for state extracts", () => {
    const url = arcgisQueryUrl({
      sourceUrl: "https://example.test/MapServer/0",
      bounds: { west: -96, south: 30, east: -94, north: 32 },
      where: "State_Nm = 'TX'",
    });
    expect(url).toMatch(/where=State_Nm/);
  });
});

describe("Texas parcels and published regs", () => {
  it("copies only season, weapon, or date fields from TPWD attributes", () => {
    expect(
      extractPublishedRegulationFields({
        Name: "Test WMA",
        Season: "Nov 1 – Jan 4",
        Weapon: "Archery",
        Comments: "Ignore me",
      }),
    ).toEqual([
      { label: "Season", value: "Nov 1 – Jan 4" },
      { label: "Weapon", value: "Archery" },
    ]);
    expect(extractPublishedRegulationFields({ Name: "Test WMA", Class: "Public" })).toEqual([]);
    expect(
      describeParcelStatus({
        found: true,
        ownerName: "SMITH JOHN",
        county: "Travis",
        taxYear: "2025",
        message: "ok",
        retrievedAt: "2026-01-01T00:00:00.000Z",
        provenance,
      }).headline,
    ).toBe("SMITH JOHN");
    expect(
      describeParcelStatus({
        found: true,
        county: "Travis",
        message: "ok",
        retrievedAt: "2026-01-01T00:00:00.000Z",
        provenance,
      }).headline,
    ).toBe("Owner unknown");
  });

  it("flags known mule deer draw area names without inventing seasons", () => {
    expect(isMuleDeerDrawListing("Big Bend Ranch SP")).toBe(true);
    expect(isMuleDeerDrawListing("Black Gap WMA")).toBe(true);
    expect(isMuleDeerDrawListing("Random pasture")).toBe(false);
  });
});

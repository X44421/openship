import { describe, expect, it } from "vitest";

import {
  SAMPLE_CUSTOMERS_ASSET_ID,
  SAMPLE_CUSTOMERS_ROW_COUNT,
  fixtureId,
  loadSampleCustomerAsset,
} from "./index";

describe("fixtureId", () => {
  it("is deterministic for identical inputs", () => {
    expect(fixtureId("dataset", 7)).toBe(fixtureId("dataset", 7));
  });

  it("pads sequences to a stable sortable width", () => {
    expect(fixtureId("dataset", 1)).toBe("dataset-0001");
    expect(fixtureId("dataset", 1234)).toBe("dataset-1234");
    expect(fixtureId("row", 12) < fixtureId("row", 345)).toBe(true);
  });
});

describe("sampleCustomers (FE1-S5 slice 1)", () => {
  it("determinism contract: the same asset id always yields identical bytes", () => {
    const first = loadSampleCustomerAsset(SAMPLE_CUSTOMERS_ASSET_ID);
    const second = loadSampleCustomerAsset(SAMPLE_CUSTOMERS_ASSET_ID);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("rejects unknown asset ids (fail closed, mirrors the core loader)", () => {
    expect(() => loadSampleCustomerAsset("00000000-0000-4000-8000-000000000099")).toThrow(
      /Unknown source asset/,
    );
  });

  it("pins the dataset shape so accidental edits are visible", () => {
    const { schema, rows } = loadSampleCustomerAsset(SAMPLE_CUSTOMERS_ASSET_ID);
    expect(rows).toHaveLength(SAMPLE_CUSTOMERS_ROW_COUNT);
    expect(SAMPLE_CUSTOMERS_ROW_COUNT).toBe(40);
    expect(schema.fields.map((f) => f.name)).toEqual([
      "customer_id",
      "name",
      "email",
      "amount",
      "category",
      "status",
      "created_at",
      "margin_pct",
    ]);
  });

  it("stays dirty on purpose: nulls, whitespace and duplicates survive", () => {
    const { rows } = loadSampleCustomerAsset(SAMPLE_CUSTOMERS_ASSET_ID);
    const nameColumn = "00000000-0000-4000-8000-000000000002"; // name column
    const aliceRows = rows.filter((r) => r[nameColumn] === "Alice Chen");
    expect(aliceRows).toHaveLength(3); // original + duplicate + whitespace-email variant
    const nullAmounts = rows.filter((r) => Object.values(r).includes(null));
    expect(nullAmounts.length).toBeGreaterThan(0);
  });
});

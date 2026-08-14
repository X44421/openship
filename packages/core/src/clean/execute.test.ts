import { describe, expect, it } from "vitest";
import { COL, SAMPLE_CUSTOMERS_ASSET_ID } from "./sample";
import { previewPlan } from "./execute";
import { validatePlan } from "./validate";
import type { LogicalPlan } from "./types";

const scanId = "00000000-0000-4000-8000-000000000101";
const filterId = "00000000-0000-4000-8000-000000000102";
const rulesId = "00000000-0000-4000-8000-000000000103";
const outId = "00000000-0000-4000-8000-000000000104";

function samplePlan(): LogicalPlan {
  return {
    version: 1,
    root: outId,
    nodes: {
      [scanId]: {
        inputs: [],
        kind: {
          kind: "scan",
          value: {
            sourceAssetId: SAMPLE_CUSTOMERS_ASSET_ID,
            projection: Object.values(COL),
            predicate: null,
          },
        },
      },
      [filterId]: {
        inputs: [scanId],
        kind: {
          kind: "filter",
          value: {
            predicate: {
              kind: "isNull",
              value: {
                expression: { kind: "column", value: COL.status },
                negated: true,
              },
            },
          },
        },
      },
      [rulesId]: {
        inputs: [filterId],
        kind: {
          kind: "applyRules",
          value: {
            rules: [
              { kind: "trim", value: { column: COL.email } },
              { kind: "deduplicate", value: { keys: [COL.customer_id] } },
            ],
          },
        },
      },
      [outId]: {
        inputs: [rulesId],
        kind: { kind: "materialize", value: { outputLabel: "clean_customers" } },
      },
    },
  };
}

describe("clean plan", () => {
  it("rejects cycles", () => {
    const plan: LogicalPlan = {
      version: 1,
      root: filterId,
      nodes: {
        [scanId]: {
          inputs: [filterId],
          kind: {
            kind: "filter",
            value: { predicate: { kind: "column", value: COL.status } },
          },
        },
        [filterId]: {
          inputs: [scanId],
          kind: {
            kind: "filter",
            value: { predicate: { kind: "column", value: COL.status } },
          },
        },
      },
    };
    expect(() => validatePlan(plan)).toThrow(/cycle/);
  });

  it("previews a stillflow-shaped cleaning DAG", () => {
    const result = previewPlan(samplePlan());
    expect(result.preview.totalRows).toBeGreaterThan(0);
    expect(result.preview.totalRows).toBeLessThan(40);
    expect(result.preview.schema.fields.some((f) => f.name === "customer_id")).toBe(true);
    expect(result.nodeMetrics[outId]?.rowsOut).toBe(result.preview.totalRows);
    expect(result.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });
});

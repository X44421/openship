import type { Context } from "hono";
import {
  MAX_PREVIEW_ROWS,
  PlanError,
  previewPlan,
  SAMPLE_CUSTOMER_FIELDS,
  SAMPLE_CUSTOMERS_ASSET_ID,
  validatePlan,
  type LogicalPlan,
} from "@repo/core";

export function catalog(c: Context) {
  return c.json({
    assets: [
      {
        id: SAMPLE_CUSTOMERS_ASSET_ID,
        name: "raw_customers.csv",
        kind: "csv",
        fields: SAMPLE_CUSTOMER_FIELDS,
      },
    ],
    operators: [
      "scan",
      "project",
      "filter",
      "applyRules",
      "join",
      "union",
      "materialize",
    ],
    previewLimit: MAX_PREVIEW_ROWS,
  });
}

async function readPlan(c: Context): Promise<{ plan: LogicalPlan; limit?: number }> {
  const body = (await c.req.json()) as { plan?: LogicalPlan; limit?: number };
  if (!body?.plan || typeof body.plan !== "object") {
    throw new PlanError("body.plan is required");
  }
  return body as { plan: LogicalPlan; limit?: number };
}

export async function validate(c: Context) {
  try {
    const { plan } = await readPlan(c);
    validatePlan(plan);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid plan";
    return c.json({ ok: false, error: message }, 400);
  }
}

export async function preview(c: Context) {
  try {
    const { plan, limit } = await readPlan(c);
    const result = previewPlan(plan, limit);
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return c.json({ ok: false, error: message }, 400);
  }
}

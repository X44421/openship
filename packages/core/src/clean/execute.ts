import {
  MAX_PREVIEW_BYTES,
  MAX_PREVIEW_ROWS,
  PlanError,
  type BinaryOperator,
  type ColumnId,
  type Expr,
  type LogicalField,
  type LogicalPlan,
  type LogicalSchema,
  type LogicalType,
  type NodeMetrics,
  type PlanNodeId,
  type PreviewResult,
  type Rule,
  type ScalarValue,
  type TableBatch,
} from "./types";
import { loadSampleAsset } from "./sample";
import { planFingerprint, validatePlan } from "./validate";

function scalarToJs(value: ScalarValue): unknown {
  if (value.kind === "null") return null;
  return value.value;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function evalExpr(expr: Expr, row: Record<ColumnId, unknown>): unknown {
  switch (expr.kind) {
    case "column":
      return row[expr.value] ?? null;
    case "literal":
      return scalarToJs(expr.value);
    case "unary": {
      const inner = evalExpr(expr.value.expression, row);
      if (expr.value.operator === "not") return !inner;
      const n = asNumber(inner);
      return n == null ? null : -n;
    }
    case "binary": {
      const left = evalExpr(expr.value.left, row);
      const right = evalExpr(expr.value.right, row);
      return evalBinary(expr.value.operator, left, right);
    }
    case "isNull": {
      const inner = evalExpr(expr.value.expression, row);
      const isNull = inner == null || inner === "";
      return expr.value.negated ? !isNull : isNull;
    }
    case "cast":
      return castValue(evalExpr(expr.value.expression, row), expr.value.dataType);
    case "coalesce": {
      for (const part of expr.value.expressions) {
        const v = evalExpr(part, row);
        if (v != null && v !== "") return v;
      }
      return null;
    }
  }
}

function evalBinary(op: BinaryOperator, left: unknown, right: unknown): unknown {
  switch (op) {
    case "and":
      return Boolean(left) && Boolean(right);
    case "or":
      return Boolean(left) || Boolean(right);
    case "contains":
      return asString(left).includes(asString(right));
    case "equal":
      return left === right || asString(left) === asString(right);
    case "notEqual":
      return !(left === right || asString(left) === asString(right));
    case "lessThan":
    case "lessThanOrEqual":
    case "greaterThan":
    case "greaterThanOrEqual":
    case "add":
    case "subtract":
    case "multiply":
    case "divide": {
      const l = asNumber(left);
      const r = asNumber(right);
      if (l == null || r == null) return null;
      switch (op) {
        case "lessThan":
          return l < r;
        case "lessThanOrEqual":
          return l <= r;
        case "greaterThan":
          return l > r;
        case "greaterThanOrEqual":
          return l >= r;
        case "add":
          return l + r;
        case "subtract":
          return l - r;
        case "multiply":
          return l * r;
        case "divide":
          return r === 0 ? null : l / r;
      }
    }
  }
}

function castValue(value: unknown, dataType: LogicalType): unknown {
  if (value == null || value === "") return null;
  switch (dataType) {
    case "utf8":
      return asString(value);
    case "boolean":
      if (typeof value === "boolean") return value;
      return ["1", "true", "yes"].includes(asString(value).toLowerCase());
    case "int64":
    case "uint64": {
      const n = asNumber(value);
      return n == null ? null : Math.trunc(n);
    }
    case "float64":
      return asNumber(value);
    case "null":
      return null;
  }
}

function projectRow(
  row: Record<ColumnId, unknown>,
  columns: ColumnId[],
): Record<ColumnId, unknown> {
  const next: Record<ColumnId, unknown> = {};
  for (const id of columns) next[id] = row[id] ?? null;
  return next;
}

function schemaOf(fields: LogicalField[]): LogicalSchema {
  return { version: 1, fields };
}

function applyRule(
  schema: LogicalSchema,
  rows: Record<ColumnId, unknown>[],
  rule: Rule,
): { schema: LogicalSchema; rows: Record<ColumnId, unknown>[] } {
  switch (rule.kind) {
    case "trim":
      return {
        schema,
        rows: rows.map((row) => ({
          ...row,
          [rule.value.column]: asString(row[rule.value.column]).trim() || null,
        })),
      };
    case "fillNull":
      return {
        schema,
        rows: rows.map((row) => {
          const current = row[rule.value.column];
          if (current != null && current !== "") return row;
          return { ...row, [rule.value.column]: scalarToJs(rule.value.value) };
        }),
      };
    case "rename": {
      const fields = schema.fields.map((f) =>
        f.id === rule.value.column ? { ...f, name: rule.value.to } : f,
      );
      return { schema: schemaOf(fields), rows };
    }
    case "cast": {
      const fields = schema.fields.map((f) =>
        f.id === rule.value.column ? { ...f, dataType: rule.value.dataType } : f,
      );
      return {
        schema: schemaOf(fields),
        rows: rows.map((row) => ({
          ...row,
          [rule.value.column]: castValue(row[rule.value.column], rule.value.dataType),
        })),
      };
    }
    case "dropColumn": {
      const fields = schema.fields.filter((f) => f.id !== rule.value.column);
      return {
        schema: schemaOf(fields),
        rows: rows.map((row) => {
          const next = { ...row };
          delete next[rule.value.column];
          return next;
        }),
      };
    }
    case "replaceLiteral":
      return {
        schema,
        rows: rows.map((row) => {
          const current = row[rule.value.column];
          const from = scalarToJs(rule.value.from);
          if (current !== from && asString(current) !== asString(from)) return row;
          return { ...row, [rule.value.column]: scalarToJs(rule.value.to) };
        }),
      };
    case "filterRows":
      return {
        schema,
        rows: rows.filter((row) => Boolean(evalExpr(rule.value.predicate, row))),
      };
    case "deduplicate": {
      const seen = new Set<string>();
      const next: Record<ColumnId, unknown>[] = [];
      for (const row of rows) {
        const key = rule.value.keys.map((id) => JSON.stringify(row[id] ?? null)).join("\0");
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(row);
      }
      return { schema, rows: next };
    }
  }
}

function joinRows(
  left: TableBatch,
  right: TableBatch,
  joinType: "inner" | "left" | "right" | "full" | "semi" | "anti",
  keys: Array<{ left: Expr; right: Expr }>,
): TableBatch {
  const rightByKey = new Map<string, Record<ColumnId, unknown>[]>();
  for (const row of right.rows) {
    const key = keys.map((k) => JSON.stringify(evalExpr(k.right, row))).join("\0");
    const bucket = rightByKey.get(key) ?? [];
    bucket.push(row);
    rightByKey.set(key, bucket);
  }

  const mergedFields = [
    ...left.schema.fields,
    ...right.schema.fields.map((f) =>
      left.schema.fields.some((l) => l.id === f.id || l.name === f.name)
        ? { ...f, name: `right_${f.name}` }
        : f,
    ),
  ];

  const out: Record<ColumnId, unknown>[] = [];
  const matchedRight = new Set<Record<ColumnId, unknown>>();

  for (const lrow of left.rows) {
    const key = keys.map((k) => JSON.stringify(evalExpr(k.left, lrow))).join("\0");
    const matches = rightByKey.get(key) ?? [];
    if (joinType === "anti") {
      if (matches.length === 0) out.push({ ...lrow });
      continue;
    }
    if (joinType === "semi") {
      if (matches.length > 0) out.push({ ...lrow });
      continue;
    }
    if (matches.length === 0) {
      if (joinType === "left" || joinType === "full") out.push({ ...lrow });
      continue;
    }
    for (const rrow of matches) {
      matchedRight.add(rrow);
      out.push({ ...lrow, ...rrow });
    }
  }

  if (joinType === "right" || joinType === "full") {
    for (const rrow of right.rows) {
      if (!matchedRight.has(rrow)) out.push({ ...rrow });
    }
  }

  return {
    schema: schemaOf(joinType === "semi" || joinType === "anti" ? left.schema.fields : mergedFields),
    rows: out,
    truncated: false,
    totalRows: out.length,
  };
}

function bound(batch: TableBatch, limit: number): TableBatch {
  const json = JSON.stringify(batch.rows);
  let rows = batch.rows;
  let truncated = batch.truncated;
  if (rows.length > limit) {
    rows = rows.slice(0, limit);
    truncated = true;
  }
  if (json.length > MAX_PREVIEW_BYTES) {
    while (rows.length > 1 && JSON.stringify(rows).length > MAX_PREVIEW_BYTES) {
      rows = rows.slice(0, Math.max(1, Math.floor(rows.length / 2)));
    }
    truncated = true;
  }
  return { ...batch, rows, truncated, totalRows: batch.totalRows };
}

function execNode(
  plan: LogicalPlan,
  nodeId: PlanNodeId,
  cache: Map<PlanNodeId, TableBatch>,
  metrics: Record<PlanNodeId, NodeMetrics>,
): TableBatch {
  const hit = cache.get(nodeId);
  if (hit) return hit;
  const node = plan.nodes[nodeId];
  if (!node) throw new PlanError(`unknown node ${nodeId}`);

  const inputs = node.inputs.map((id) => execNode(plan, id, cache, metrics));
  const rowsIn = inputs.reduce((sum, b) => sum + b.totalRows, 0);
  let out: TableBatch;

  const kind = node.kind;
  switch (kind.kind) {
    case "scan": {
      const loaded = loadSampleAsset(kind.value.sourceAssetId);
      const projection =
        kind.value.projection.length > 0
          ? kind.value.projection
          : loaded.schema.fields.map((f) => f.id);
      const fields = loaded.schema.fields.filter((f) => projection.includes(f.id));
      let rows = loaded.rows.map((row) => projectRow(row, projection));
      if (kind.value.predicate) {
        const pred = kind.value.predicate;
        rows = rows.filter((row) => Boolean(evalExpr(pred, row)));
      }
      out = {
        schema: schemaOf(fields),
        rows,
        truncated: false,
        totalRows: rows.length,
      };
      break;
    }
    case "project": {
      const src = inputs[0]!;
      out = {
        schema: schemaOf(
          src.schema.fields.filter((f) => kind.value.columns.includes(f.id)),
        ),
        rows: src.rows.map((row) => projectRow(row, kind.value.columns)),
        truncated: src.truncated,
        totalRows: src.totalRows,
      };
      break;
    }
    case "filter": {
      const src = inputs[0]!;
      const rows = src.rows.filter((row) => Boolean(evalExpr(kind.value.predicate, row)));
      out = { schema: src.schema, rows, truncated: src.truncated, totalRows: rows.length };
      break;
    }
    case "applyRules": {
      let schema = inputs[0]!.schema;
      let rows = inputs[0]!.rows;
      for (const rule of kind.value.rules) {
        const next = applyRule(schema, rows, rule);
        schema = next.schema;
        rows = next.rows;
      }
      out = {
        schema,
        rows,
        truncated: inputs[0]!.truncated,
        totalRows: rows.length,
      };
      break;
    }
    case "join": {
      out = joinRows(inputs[0]!, inputs[1]!, kind.value.joinType, kind.value.keys);
      break;
    }
    case "union": {
      const fields = inputs[0]!.schema.fields;
      const rows = inputs.flatMap((b) => b.rows);
      out = { schema: schemaOf(fields), rows, truncated: false, totalRows: rows.length };
      break;
    }
    case "materialize": {
      out = inputs[0]!;
      break;
    }
  }

  metrics[nodeId] = { rowsIn: node.kind.kind === "scan" ? out.totalRows : rowsIn, rowsOut: out.totalRows };
  cache.set(nodeId, out);
  return out;
}

export function previewPlan(
  plan: LogicalPlan,
  limit = MAX_PREVIEW_ROWS,
): PreviewResult {
  validatePlan(plan);
  const cache = new Map<PlanNodeId, TableBatch>();
  const nodeMetrics: Record<PlanNodeId, NodeMetrics> = {};
  const batch = execNode(plan, plan.root, cache, nodeMetrics);
  return {
    fingerprint: planFingerprint(plan),
    preview: bound(batch, Math.min(MAX_PREVIEW_ROWS, Math.max(1, limit))),
    nodeMetrics,
  };
}

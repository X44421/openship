/**
 * Engine-independent cleaning contracts, aligned with stillflow-core /
 * stillflow-plan wire format (camelCase, tagged `kind` + `value`).
 *
 * Logical types must not contain Polars, DuckDB, or physical Arrow objects.
 * Column identity is independent of a mutable display name.
 */

export const LOGICAL_SCHEMA_VERSION = 1 as const;
export const PLAN_VERSION = 1 as const;
export const MAX_PREVIEW_ROWS = 500;
export const MAX_PREVIEW_BYTES = 1_048_576;

export type ColumnId = string;

export type LogicalType =
  | "null"
  | "boolean"
  | "int64"
  | "uint64"
  | "float64"
  | "utf8";

export interface LogicalField {
  id: ColumnId;
  name: string;
  dataType: LogicalType;
  nullable: boolean;
}

export interface LogicalSchema {
  version: typeof LOGICAL_SCHEMA_VERSION;
  fields: LogicalField[];
}

export type ScalarValue =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "int64"; value: number }
  | { kind: "uint64"; value: number }
  | { kind: "float64"; value: number }
  | { kind: "utf8"; value: string };

export type BinaryOperator =
  | "equal"
  | "notEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "and"
  | "or"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "contains";

export type UnaryOperator = "not" | "negate";

export type Expr =
  | { kind: "column"; value: ColumnId }
  | { kind: "literal"; value: ScalarValue }
  | { kind: "unary"; value: { operator: UnaryOperator; expression: Expr } }
  | {
      kind: "binary";
      value: { left: Expr; operator: BinaryOperator; right: Expr };
    }
  | { kind: "isNull"; value: { expression: Expr; negated: boolean } }
  | { kind: "cast"; value: { expression: Expr; dataType: LogicalType } }
  | { kind: "coalesce"; value: { expressions: Expr[] } };

export type CastFailurePolicy = "error" | "setNull";
export type ValidationSeverity = "warning" | "error";

export type Rule =
  | { kind: "rename"; value: { column: ColumnId; to: string } }
  | {
      kind: "cast";
      value: {
        column: ColumnId;
        dataType: LogicalType;
        onFailure: CastFailurePolicy;
      };
    }
  | { kind: "trim"; value: { column: ColumnId } }
  | {
      kind: "replaceLiteral";
      value: { column: ColumnId; from: ScalarValue; to: ScalarValue };
    }
  | { kind: "fillNull"; value: { column: ColumnId; value: ScalarValue } }
  | { kind: "dropColumn"; value: { column: ColumnId } }
  | { kind: "filterRows"; value: { predicate: Expr } }
  | { kind: "deduplicate"; value: { keys: ColumnId[] } };

export type JoinType = "inner" | "left" | "right" | "full" | "semi" | "anti";

export interface JoinKey {
  left: Expr;
  right: Expr;
}

export type PlanNodeId = string;

export type PlanNodeKind =
  | {
      kind: "scan";
      value: {
        sourceAssetId: string;
        projection: ColumnId[];
        predicate: Expr | null;
      };
    }
  | { kind: "project"; value: { columns: ColumnId[] } }
  | { kind: "filter"; value: { predicate: Expr } }
  | { kind: "applyRules"; value: { rules: Rule[] } }
  | { kind: "join"; value: { joinType: JoinType; keys: JoinKey[] } }
  | { kind: "union" }
  | { kind: "materialize"; value: { outputLabel: string } };

export interface PlanNode {
  inputs: PlanNodeId[];
  kind: PlanNodeKind;
}

export interface LogicalPlan {
  version: typeof PLAN_VERSION;
  root: PlanNodeId;
  nodes: Record<PlanNodeId, PlanNode>;
}

export interface TableBatch {
  schema: LogicalSchema;
  rows: Record<ColumnId, unknown>[];
  truncated: boolean;
  totalRows: number;
}

export interface NodeMetrics {
  rowsIn: number;
  rowsOut: number;
}

export interface PreviewResult {
  fingerprint: string;
  preview: TableBatch;
  nodeMetrics: Record<PlanNodeId, NodeMetrics>;
}

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanError";
  }
}

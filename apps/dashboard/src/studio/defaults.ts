import type { Edge, Node } from "@xyflow/react";
import {
  COL,
  SAMPLE_CUSTOMERS_ASSET_ID,
  type BinaryOperator,
  type ColumnId,
  type LogicalType,
  type Rule,
} from "@repo/core";

export type StudioOp =
  | "scan"
  | "project"
  | "filter"
  | "applyRules"
  | "join"
  | "union"
  | "materialize";

export type NodeStatus = "idle" | "running" | "completed" | "failed";

export interface FilterConfig {
  columnId: ColumnId;
  operator: BinaryOperator | "isNull" | "isNotNull";
  value: string;
}

export interface StudioNodeData extends Record<string, unknown> {
  op: StudioOp;
  title: string;
  subtitle: string;
  status: NodeStatus;
  disabled?: boolean;
  rowsIn?: number;
  rowsOut?: number;
  sourceAssetId?: string;
  projection?: ColumnId[];
  filter?: FilterConfig;
  rules?: Rule[];
  joinType?: "inner" | "left";
  leftColumnId?: ColumnId;
  rightColumnId?: ColumnId;
  outputLabel?: string;
}

export type StudioNode = Node<StudioNodeData, StudioOp>;

export const PALETTE: Array<{
  op: StudioOp;
  title: string;
  subtitle: string;
  category: "source" | "transform" | "output";
}> = [
  { op: "scan", title: "CSV Scan", subtitle: "Sample customers", category: "source" },
  { op: "filter", title: "Filter", subtitle: "Keep matching rows", category: "transform" },
  { op: "applyRules", title: "Apply Rules", subtitle: "Trim, fill, dedupe", category: "transform" },
  { op: "project", title: "Project", subtitle: "Select columns", category: "transform" },
  { op: "join", title: "Join", subtitle: "Left/right keys", category: "transform" },
  { op: "union", title: "Union", subtitle: "Stack tables", category: "transform" },
  { op: "materialize", title: "Materialize", subtitle: "Named output", category: "output" },
];

export function defaultData(op: StudioOp): StudioNodeData {
  switch (op) {
    case "scan":
      return {
        op,
        title: "raw_customers.csv",
        subtitle: "CSV · sample asset",
        status: "idle",
        sourceAssetId: SAMPLE_CUSTOMERS_ASSET_ID,
        projection: Object.values(COL),
      };
    case "filter":
      return {
        op,
        title: "Filter",
        subtitle: "status is not null",
        status: "idle",
        filter: { columnId: COL.status, operator: "isNotNull", value: "" },
      };
    case "applyRules":
      return {
        op,
        title: "Clean",
        subtitle: "Trim + deduplicate",
        status: "idle",
        rules: [
          { kind: "trim", value: { column: COL.email } },
          { kind: "trim", value: { column: COL.name } },
          { kind: "fillNull", value: { column: COL.name, value: { kind: "utf8", value: "Unknown" } } },
          { kind: "deduplicate", value: { keys: [COL.customer_id] } },
        ],
      };
    case "project":
      return {
        op,
        title: "Project",
        subtitle: "Select columns",
        status: "idle",
        projection: [COL.customer_id, COL.name, COL.email, COL.amount, COL.status],
      };
    case "join":
      return {
        op,
        title: "Join",
        subtitle: "inner on customer_id",
        status: "idle",
        joinType: "inner",
        leftColumnId: COL.customer_id,
        rightColumnId: COL.customer_id,
      };
    case "union":
      return {
        op,
        title: "Union",
        subtitle: "Stack inputs",
        status: "idle",
      };
    case "materialize":
      return {
        op,
        title: "Export",
        subtitle: "clean_customers",
        status: "idle",
        outputLabel: "clean_customers",
      };
  }
}

export const LOGICAL_TYPES: LogicalType[] = ["utf8", "float64", "int64", "boolean"];

export function defaultGraph(): { nodes: StudioNode[]; edges: Edge[] } {
  const n1 = "n-scan";
  const n2 = "n-filter";
  const n3 = "n-rules";
  const n4 = "n-out";
  return {
    nodes: [
      {
        id: n1,
        type: "scan",
        position: { x: 80, y: 180 },
        data: defaultData("scan"),
      },
      {
        id: n2,
        type: "filter",
        position: { x: 380, y: 180 },
        data: defaultData("filter"),
      },
      {
        id: n3,
        type: "applyRules",
        position: { x: 680, y: 180 },
        data: defaultData("applyRules"),
      },
      {
        id: n4,
        type: "materialize",
        position: { x: 920, y: 80 },
        data: defaultData("materialize"),
      },
    ],
    edges: [
      { id: "e1", source: n1, target: n2, sourceHandle: "out", targetHandle: "in" },
      { id: "e2", source: n2, target: n3, sourceHandle: "out", targetHandle: "in" },
      { id: "e3", source: n3, target: n4, sourceHandle: "out", targetHandle: "in" },
    ],
  };
}

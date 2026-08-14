import type { Edge } from "@xyflow/react";
import type { Expr, LogicalPlan, PlanNode, PlanNodeId } from "@repo/core";
import type { StudioNode } from "./defaults";

function filterExpr(node: StudioNode): Expr {
  const filter = node.data.filter;
  if (!filter) {
    return { kind: "literal", value: { kind: "boolean", value: true } };
  }
  const column: Expr = { kind: "column", value: filter.columnId };
  if (filter.operator === "isNull") {
    return { kind: "isNull", value: { expression: column, negated: false } };
  }
  if (filter.operator === "isNotNull") {
    return { kind: "isNull", value: { expression: column, negated: true } };
  }
  const numeric = Number(filter.value);
  const literal: Expr = Number.isFinite(numeric) && filter.value.trim() !== ""
    ? { kind: "literal", value: { kind: "float64", value: numeric } }
    : { kind: "literal", value: { kind: "utf8", value: filter.value } };
  return {
    kind: "binary",
    value: { left: column, operator: filter.operator, right: literal },
  };
}

function toKind(node: StudioNode): PlanNode["kind"] {
  switch (node.data.op) {
    case "scan":
      return {
        kind: "scan",
        value: {
          sourceAssetId: node.data.sourceAssetId ?? "",
          projection: node.data.projection ?? [],
          predicate: null,
        },
      };
    case "project":
      return { kind: "project", value: { columns: node.data.projection ?? [] } };
    case "filter":
      return { kind: "filter", value: { predicate: filterExpr(node) } };
    case "applyRules":
      return { kind: "applyRules", value: { rules: node.data.rules ?? [] } };
    case "join":
      return {
        kind: "join",
        value: {
          joinType: node.data.joinType ?? "inner",
          keys: [
            {
              left: { kind: "column", value: node.data.leftColumnId ?? "" },
              right: { kind: "column", value: node.data.rightColumnId ?? "" },
            },
          ],
        },
      };
    case "union":
      return { kind: "union" };
    case "materialize":
      return {
        kind: "materialize",
        value: { outputLabel: node.data.outputLabel || "output" },
      };
  }
}

function inputsFor(
  nodeId: string,
  edges: Array<Pick<Edge, "source" | "target" | "sourceHandle" | "targetHandle">>,
): PlanNodeId[] {
  const incoming = edges.filter((e) => e.target === nodeId);
  incoming.sort((a, b) => {
    const order = (h?: string | null) => (h === "left" ? 0 : h === "right" ? 1 : 2);
    return order(a.targetHandle) - order(b.targetHandle);
  });
  return incoming.map((e) => e.source);
}

export function graphToPlan(
  nodes: StudioNode[],
  edges: Array<Pick<Edge, "source" | "target" | "sourceHandle" | "targetHandle">>,
  rootId?: string,
): LogicalPlan {
  const materialize = nodes.find((n) => n.data.op === "materialize");
  const root = rootId ?? materialize?.id ?? nodes[nodes.length - 1]?.id;
  if (!root) throw new Error("Plan has no nodes");

  const record: Record<string, PlanNode> = {};
  for (const node of nodes) {
    record[node.id] = {
      inputs: inputsFor(node.id, edges),
      kind: toKind(node),
    };
  }

  return { version: 1, root, nodes: record };
}

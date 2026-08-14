import { PLAN_VERSION, PlanError, type LogicalPlan, type PlanNode, type PlanNodeId } from "./types";

function kindName(node: PlanNode): string {
  return node.kind.kind;
}

function arity(node: PlanNode): { min: number; max: number } {
  switch (node.kind.kind) {
    case "scan":
      return { min: 0, max: 0 };
    case "project":
    case "filter":
    case "applyRules":
    case "materialize":
      return { min: 1, max: 1 };
    case "join":
      return { min: 2, max: 2 };
    case "union":
      return { min: 2, max: Number.POSITIVE_INFINITY };
  }
}

function validateNode(nodeId: PlanNodeId, node: PlanNode): void {
  const { min, max } = arity(node);
  if (node.inputs.length < min || node.inputs.length > max) {
    throw new PlanError(
      `node ${nodeId} (${kindName(node)}) expects ${min}–${max} inputs, got ${node.inputs.length}`,
    );
  }

  switch (node.kind.kind) {
    case "scan": {
      if (!node.kind.value.sourceAssetId) {
        throw new PlanError(`scan ${nodeId} is missing sourceAssetId`);
      }
      if (node.kind.value.projection.length === 0) {
        throw new PlanError(`scan ${nodeId} projection must not be empty`);
      }
      break;
    }
    case "project": {
      if (node.kind.value.columns.length === 0) {
        throw new PlanError(`project ${nodeId} columns must not be empty`);
      }
      break;
    }
    case "applyRules": {
      if (node.kind.value.rules.length === 0) {
        throw new PlanError(`applyRules ${nodeId} rules must not be empty`);
      }
      for (const rule of node.kind.value.rules) {
        if (rule.kind === "deduplicate" && rule.value.keys.length === 0) {
          throw new PlanError(`deduplicate rule on ${nodeId} needs at least one key`);
        }
        if (rule.kind === "rename" && !rule.value.to.trim()) {
          throw new PlanError(`rename rule on ${nodeId} needs a name`);
        }
      }
      break;
    }
    case "join": {
      if (node.kind.value.keys.length === 0) {
        throw new PlanError(`join ${nodeId} needs at least one key`);
      }
      break;
    }
    case "materialize": {
      if (!node.kind.value.outputLabel.trim()) {
        throw new PlanError(`materialize ${nodeId} needs an output label`);
      }
      break;
    }
    default:
      break;
  }
}

/** Validates references, arity, local node invariants, and acyclicity. */
export function validatePlan(plan: LogicalPlan): void {
  if (plan.version !== PLAN_VERSION) {
    throw new PlanError(`unsupported plan version ${plan.version}`);
  }
  if (!plan.nodes[plan.root]) {
    throw new PlanError(`missing root ${plan.root}`);
  }

  const indegree = new Map<PlanNodeId, number>();
  const outgoing = new Map<PlanNodeId, PlanNodeId[]>();
  for (const id of Object.keys(plan.nodes)) indegree.set(id, 0);

  for (const [nodeId, node] of Object.entries(plan.nodes)) {
    validateNode(nodeId, node);
    for (const input of node.inputs) {
      if (!plan.nodes[input]) {
        throw new PlanError(`node ${nodeId} references unknown input ${input}`);
      }
      if (input === nodeId) {
        throw new PlanError(`node ${nodeId} has a self-edge`);
      }
      indegree.set(nodeId, (indegree.get(nodeId) ?? 0) + 1);
      const next = outgoing.get(input) ?? [];
      next.push(nodeId);
      outgoing.set(input, next);
    }
  }

  const ready: PlanNodeId[] = [];
  for (const [id, degree] of indegree) {
    if (degree === 0) ready.push(id);
  }

  let visited = 0;
  while (ready.length > 0) {
    const nodeId = ready.shift()!;
    visited += 1;
    for (const dependent of outgoing.get(nodeId) ?? []) {
      const degree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, degree);
      if (degree === 0) ready.push(dependent);
    }
  }

  if (visited !== Object.keys(plan.nodes).length) {
    throw new PlanError("logical plan contains a directed cycle");
  }
}

export function planFingerprint(plan: LogicalPlan): string {
  validatePlan(plan);
  const keys = Object.keys(plan.nodes).sort();
  const canonical = {
    version: plan.version,
    root: plan.root,
    nodes: Object.fromEntries(keys.map((k) => [k, plan.nodes[k]])),
  };
  const bytes = JSON.stringify(canonical);
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

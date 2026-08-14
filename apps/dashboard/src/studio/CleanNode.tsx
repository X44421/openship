"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  CheckCircle2,
  Circle,
  Columns3,
  Download,
  FileSpreadsheet,
  Filter,
  GitMerge,
  Layers,
  Wand2,
} from "lucide-react";
import type { StudioNode, StudioOp } from "./defaults";

const ICONS: Record<StudioOp, typeof Filter> = {
  scan: FileSpreadsheet,
  filter: Filter,
  applyRules: Wand2,
  project: Columns3,
  join: GitMerge,
  union: Layers,
  materialize: Download,
};

export function CleanNode({ data }: NodeProps<StudioNode>) {
  const Icon = ICONS[data.op];
  const showIn = data.op !== "scan";
  const splitIn = data.op === "join" || data.op === "union";

  return (
    <div className="node-card" style={data.disabled ? { opacity: 0.45 } : undefined}>
      {showIn && !splitIn && (
        <Handle type="target" position={Position.Left} id="in" />
      )}
      {splitIn && (
        <>
          <Handle type="target" position={Position.Left} id="left" style={{ top: "35%" }} />
          <Handle type="target" position={Position.Left} id="right" style={{ top: "65%" }} />
        </>
      )}
      <Handle type="source" position={Position.Right} id="out" />

      <div className="node-ico">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold truncate" style={{ color: "var(--th-text-heading)" }}>
          {data.title}
        </div>
        <div className="text-[11px] truncate" style={{ color: "var(--th-text-muted)" }}>
          {data.subtitle}
        </div>
        {data.rowsOut != null && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--th-text-hint)" }}>
            {data.rowsOut.toLocaleString()} rows
          </div>
        )}
      </div>
      {data.status === "completed" ? (
        <CheckCircle2 size={16} className="shrink-0" style={{ color: "var(--st-success-fg)" }} />
      ) : data.status === "running" ? (
        <span
          className="w-3 h-3 rounded-full shrink-0 animate-pulse"
          style={{ background: "var(--th-text-heading)" }}
        />
      ) : data.status === "failed" ? (
        <Circle size={16} className="shrink-0" style={{ color: "var(--st-danger-fg, #dc2626)" }} />
      ) : (
        <Circle size={16} className="shrink-0" style={{ color: "var(--th-text-ghost)" }} />
      )}
    </div>
  );
}

export const nodeTypes = {
  scan: CleanNode,
  project: CleanNode,
  filter: CleanNode,
  applyRules: CleanNode,
  join: CleanNode,
  union: CleanNode,
  materialize: CleanNode,
};

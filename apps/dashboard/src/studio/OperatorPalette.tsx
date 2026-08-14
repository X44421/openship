"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  Filter,
  GitMerge,
  Layers,
  Plus,
  Search,
  Wand2,
} from "lucide-react";
import { PALETTE, type StudioOp } from "./defaults";

const OP_ICON = {
  scan: FileSpreadsheet,
  filter: Filter,
  applyRules: Wand2,
  project: Columns3,
  join: GitMerge,
  union: Layers,
  materialize: Download,
} as const;

const GROUPS: Array<{ id: string; label: string; ops: StudioOp[] }> = [
  { id: "source", label: "Source", ops: ["scan"] },
  { id: "transform", label: "Transform", ops: ["filter", "applyRules", "project", "join", "union"] },
  { id: "output", label: "Output", ops: ["materialize"] },
];

interface OperatorPaletteProps {
  onAdd: (op: StudioOp) => void;
}

export function OperatorPalette({ onAdd }: OperatorPaletteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({
    source: true,
    transform: true,
    output: true,
  });
  const q = query.trim().toLowerCase();

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: PALETTE.filter(
          (p) =>
            group.ops.includes(p.op) &&
            (!q || p.title.toLowerCase().includes(q) || p.op.includes(q)),
        ),
      })),
    [q],
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-3 pt-3 pb-2">
        <h2 className="text-[15px] font-semibold mb-3" style={{ color: "var(--th-text-heading)" }}>
          Operators
        </h2>
        <div className="st-search" style={{ margin: 0 }}>
          <Search size={13} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search operators"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        {grouped.map((group) => {
          if (group.items.length === 0) return null;
          const expanded = open[group.id] !== false;
          return (
            <div key={group.id}>
              <button
                type="button"
                className="st-acc-h"
                onClick={() => setOpen((s) => ({ ...s, [group.id]: !expanded }))}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {group.label}
              </button>
              {expanded &&
                group.items.map((item) => {
                  const Icon = OP_ICON[item.op];
                  return (
                    <div
                      key={item.op}
                      className="st-item"
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("application/stillflow-op", item.op)
                      }
                    >
                      <div className="st-item-ico">
                        <Icon size={14} />
                      </div>
                      <span
                        className="flex-1 text-[13px] font-medium truncate"
                        style={{ color: "var(--th-text-heading)" }}
                      >
                        {item.title}
                      </span>
                      <button type="button" className="st-plus" onClick={() => onAdd(item.op)}>
                        <Plus size={12} />
                      </button>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

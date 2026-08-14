"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  GitMerge,
  Layers,
  Play,
  Wand2,
  X,
} from "lucide-react";
import { SAMPLE_CUSTOMER_FIELDS } from "@repo/core";
import { useStudio } from "./studio-context";
import type { FilterConfig, StudioNode, StudioOp } from "./defaults";

const ICONS: Record<StudioOp, typeof Filter> = {
  scan: FileSpreadsheet,
  filter: Filter,
  applyRules: Wand2,
  project: Columns3,
  join: GitMerge,
  union: Layers,
  materialize: Download,
};

const TYPE_LABEL: Record<StudioOp, string> = {
  scan: "Source node",
  filter: "Transform node",
  applyRules: "Process node",
  project: "Transform node",
  join: "Transform node",
  union: "Transform node",
  materialize: "Output node",
};

const FILTER_OPS: Array<{ id: FilterConfig["operator"]; label: string }> = [
  { id: "isNotNull", label: "Is not null" },
  { id: "isNull", label: "Is null" },
  { id: "equal", label: "Equals" },
  { id: "notEqual", label: "Not equal" },
  { id: "contains", label: "Contains" },
  { id: "greaterThan", label: "Greater than" },
  { id: "lessThan", label: "Less than" },
];

function formatRows(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between min-h-[28px] gap-3">
      <span className="text-[13px] shrink-0" style={{ color: "var(--th-text-muted)" }}>
        {label}
      </span>
      <div className="min-w-0 text-right text-[13px] font-medium" style={{ color: "var(--th-text-heading)" }}>
        {children}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <select className="st-input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Inspector({ node, nodes }: { node: StudioNode; nodes: StudioNode[] }) {
  const { running, preview, patch, run, closeInspector, showPreview } = useStudio();
  const [editing, setEditing] = useState(false);
  const Icon = ICONS[node.data.op];
  const metrics = preview?.nodeMetrics?.[node.id];
  const idx = nodes.findIndex((n) => n.id === node.id);
  const prev = idx > 0 ? nodes[idx - 1] : null;
  const next = idx >= 0 && idx < nodes.length - 1 ? nodes[idx + 1] : null;

  const columns = useMemo(
    () => SAMPLE_CUSTOMER_FIELDS.map((f) => ({ id: f.id, label: f.name })),
    [],
  );

  useEffect(() => {
    setEditing(false);
  }, [node.id]);

  const status = node.data.disabled
    ? "Disabled"
    : node.data.status === "completed"
      ? "Completed"
      : node.data.status === "running"
        ? "Running"
        : node.data.status === "failed"
          ? "Failed"
          : "Pending";

  const hasRun = metrics != null || node.data.rowsOut != null;

  return (
    <aside className="st-inspector">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="st-item-ico">
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold truncate" style={{ color: "var(--th-text-heading)" }}>
                  {node.data.title}
                </h3>
                <p className="text-[12px]" style={{ color: "var(--th-text-muted)" }}>
                  {TYPE_LABEL[node.data.op]}
                </p>
              </div>
            </div>
            <button type="button" className="st-icon-btn" onClick={closeInspector} aria-label="Close inspector">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className={`st-pill ${node.data.status === "completed" ? "is-ok" : node.data.status === "running" ? "is-run" : ""}`}>
              {status}
            </span>
            <span className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--th-text-ghost)" }}>
              <Clock size={12} />
              {hasRun ? "Updated just now" : "Not run yet"}
            </span>
          </div>
        </div>

        <section className="st-insp-sec">
          <h4>Context</h4>
          <Field label="Input">{prev?.data.title ?? "—"}</Field>
          <Field label="Output">{next?.data.title ?? "—"}</Field>
          <Field label="Relation">
            <span className="st-chip">transforms</span>
          </Field>
        </section>

        <section className="st-insp-sec">
          <h4>Runtime</h4>
          <Field label="Rows">
            {hasRun ? `${formatRows(metrics?.rowsIn ?? node.data.rowsIn)} / ${formatRows(metrics?.rowsOut ?? node.data.rowsOut)}` : "—"}
          </Field>
          <Field label="Mode">Preview</Field>
        </section>

        <section className="st-insp-sec">
          <h4>Metrics</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="st-metric">
              <div className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>Rows out</div>
              <div className="text-lg font-semibold" style={{ color: "var(--th-text-heading)" }}>
                {formatRows(metrics?.rowsOut ?? node.data.rowsOut)}
              </div>
            </div>
            <div className="st-metric">
              <div className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>Rows in</div>
              <div className="text-lg font-semibold" style={{ color: "var(--th-text-heading)" }}>
                {formatRows(metrics?.rowsIn ?? node.data.rowsIn)}
              </div>
            </div>
          </div>
        </section>

        <section className="st-insp-sec">
          <h4>Actions</h4>
          <button
            type="button"
            className="st-btn w-full"
            disabled={running || node.data.disabled}
            onClick={() => void run(node.id)}
          >
            <span className="inline-flex items-center gap-1.5">
              <Play size={13} fill="currentColor" />
              {running ? "Running…" : "Run from here"}
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button type="button" className="st-btn-ghost" onClick={showPreview}>
              <Eye size={13} />
              Preview
            </button>
            <button
              type="button"
              className={`st-btn-ghost ${node.data.disabled ? "is-on" : ""}`}
              onClick={() => patch(node.id, { disabled: !node.data.disabled })}
            >
              {node.data.disabled ? "Enable" : "Disable"}
            </button>
          </div>
        </section>

        <section className="st-insp-sec" style={{ borderBottom: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="!mb-0">Configuration</h4>
            <button
              type="button"
              className="text-[12px] font-medium bg-transparent border-0 cursor-pointer"
              style={{ color: "var(--th-text-heading)" }}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          <ConfigFields node={node} editing={editing} columns={columns} />
        </section>
      </div>
    </aside>
  );
}

function ConfigFields({
  node,
  editing,
  columns,
}: {
  node: StudioNode;
  editing: boolean;
  columns: Array<{ id: string; label: string }>;
}) {
  const { patch } = useStudio();
  const data = node.data;

  if (data.op === "scan") {
    return (
      <Field label="Asset">{data.title}</Field>
    );
  }

  if (data.op === "filter") {
    const filter = data.filter;
    if (!filter) return <Field label="Predicate">—</Field>;
    if (!editing) {
      const col = columns.find((c) => c.id === filter.columnId)?.label ?? filter.columnId;
      const op = FILTER_OPS.find((o) => o.id === filter.operator)?.label ?? filter.operator;
      return (
        <>
          <Field label="Column">{col}</Field>
          <Field label="Operator">{op}</Field>
          {filter.operator !== "isNull" && filter.operator !== "isNotNull" && (
            <Field label="Value">{filter.value || "—"}</Field>
          )}
        </>
      );
    }
    return (
      <div className="space-y-2">
        <Field label="Column">
          <Select
            value={filter.columnId}
            options={columns}
            onChange={(columnId) => patch(node.id, { filter: { ...filter, columnId } })}
          />
        </Field>
        <Field label="Operator">
          <Select
            value={filter.operator}
            options={FILTER_OPS}
            onChange={(operator) =>
              patch(node.id, { filter: { ...filter, operator: operator as FilterConfig["operator"] } })
            }
          />
        </Field>
        {filter.operator !== "isNull" && filter.operator !== "isNotNull" && (
          <Field label="Value">
            <input
              className="st-input"
              value={filter.value}
              onChange={(e) => patch(node.id, { filter: { ...filter, value: e.target.value } })}
            />
          </Field>
        )}
      </div>
    );
  }

  if (data.op === "applyRules") {
    const keys = data.rules?.find((r) => r.kind === "deduplicate")?.value.keys ?? [];
    const key = keys[0] ?? columns[0]?.id ?? "";
    if (!editing) {
      return (
        <>
          <Field label="Rules">{data.rules?.length ?? 0} applied</Field>
          <Field label="Dedupe key">{(columns.find((c) => c.id === key)?.label ?? key) || "—"}</Field>
        </>
      );
    }
    return (
      <Field label="Dedupe key">
        <Select
          value={key}
          options={columns}
          onChange={(columnId) => {
            const rules = (data.rules ?? []).map((r) =>
              r.kind === "deduplicate" ? { ...r, value: { keys: [columnId] } } : r,
            );
            patch(node.id, { rules });
          }}
        />
      </Field>
    );
  }

  if (data.op === "join") {
    if (!editing) {
      return (
        <>
          <Field label="Type">{data.joinType ?? "inner"}</Field>
          <Field label="Left">{columns.find((c) => c.id === data.leftColumnId)?.label ?? "—"}</Field>
          <Field label="Right">{columns.find((c) => c.id === data.rightColumnId)?.label ?? "—"}</Field>
        </>
      );
    }
    return (
      <div className="space-y-2">
        <Field label="Type">
          <Select
            value={data.joinType ?? "inner"}
            options={[
              { id: "inner", label: "Inner" },
              { id: "left", label: "Left" },
            ]}
            onChange={(joinType) => patch(node.id, { joinType: joinType as "inner" | "left" })}
          />
        </Field>
        <Field label="Left">
          <Select
            value={data.leftColumnId ?? ""}
            options={columns}
            onChange={(leftColumnId) => patch(node.id, { leftColumnId })}
          />
        </Field>
        <Field label="Right">
          <Select
            value={data.rightColumnId ?? ""}
            options={columns}
            onChange={(rightColumnId) => patch(node.id, { rightColumnId })}
          />
        </Field>
      </div>
    );
  }

  if (data.op === "materialize") {
    if (!editing) return <Field label="Output">{data.outputLabel || "output"}</Field>;
    return (
      <Field label="Output">
        <input
          className="st-input"
          value={data.outputLabel ?? ""}
          onChange={(e) => patch(node.id, { outputLabel: e.target.value, title: e.target.value || data.title })}
        />
      </Field>
    );
  }

  if (data.op === "project") {
    return <Field label="Columns">{data.projection?.length ?? 0} selected</Field>;
  }

  return <Field label="Operator">{data.op}</Field>;
}

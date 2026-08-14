"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, FileSpreadsheet, Search } from "lucide-react";
import type { LogicalField } from "@repo/core";

export type DatasetCategory = "source" | "interim" | "output";

export interface StudioDataset {
  id: string;
  name: string;
  category: DatasetCategory;
  kind: string;
  size: string;
  runnable?: boolean;
  fields?: LogicalField[];
}

interface DatasetPanelProps {
  datasets: StudioDataset[];
  selectedId: string | null;
  onSelect: (dataset: StudioDataset) => void;
}

const TABS: Array<{ key: "all" | DatasetCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "source", label: "Source" },
  { key: "interim", label: "Interim" },
  { key: "output", label: "Output" },
];

export function DatasetPanel({ datasets, selectedId, onSelect }: DatasetPanelProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<DatasetCategory, boolean>>({
    source: true,
    interim: true,
    output: true,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets.filter((d) => {
      if (tab !== "all" && d.category !== tab) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || d.kind.toLowerCase().includes(q);
    });
  }, [datasets, query, tab]);

  const groups: DatasetCategory[] = ["source", "interim", "output"];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--th-text-heading)" }}>
            Datasets
          </h2>
        </div>
        <div className="st-search" style={{ margin: "0 0 10px" }}>
          <Search size={13} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search datasets"
          />
        </div>
        <div className="st-seg">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={tab === t.key ? "is-on" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-3">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--th-text-ghost)" }}>
            No datasets match “{query}”.
          </div>
        ) : (
          groups.map((key) => {
            const items = filtered.filter((d) => d.category === key);
            if (items.length === 0) return null;
            const expanded = open[key];
            return (
              <div key={key}>
                <button
                  type="button"
                  className="st-acc-h"
                  onClick={() => setOpen((s) => ({ ...s, [key]: !expanded }))}
                >
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {key}
                  <span className="st-count">{items.length}</span>
                </button>
                {expanded &&
                  items.map((dataset) => (
                    <button
                      key={dataset.id}
                      type="button"
                      className={`st-item w-[calc(100%-16px)] text-left ${selectedId === dataset.id ? "is-on" : ""}`}
                      onClick={() => onSelect(dataset)}
                    >
                      <div className="st-item-ico">
                        {dataset.kind === "table" ? <Database size={14} /> : <FileSpreadsheet size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--th-text-heading)" }}
                        >
                          {dataset.name}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                          {dataset.kind.toUpperCase()} · {dataset.size}
                          {dataset.runnable === false ? " · catalog" : ""}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import type { LogicalField } from "@repo/core";
import { useTheme } from "@/components/theme-provider";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface PreviewGridProps {
  fields: LogicalField[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  totalRows: number;
}

export function PreviewGrid({ fields, rows, truncated, totalRows }: PreviewGridProps) {
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";

  const gridTheme = useMemo(
    () =>
      themeQuartz.withParams({
        backgroundColor: light ? "#ffffff" : "#0d0d0d",
        foregroundColor: light ? "rgba(0,0,0,.82)" : "rgba(255,255,255,.82)",
        headerBackgroundColor: light ? "#f9f9f9" : "#111",
        headerTextColor: light ? "rgba(0,0,0,.52)" : "rgba(255,255,255,.52)",
        oddRowBackgroundColor: light ? "#fafafa" : "#101010",
        borderColor: light ? "#f0f0f0" : "rgba(255,255,255,.08)",
        rowBorder: false,
        accentColor: light ? "rgba(0,0,0,.92)" : "#ffffff",
        fontSize: 12,
        headerFontSize: 11,
        wrapperBorderRadius: 0,
      }),
    [light],
  );

  const columnDefs = useMemo<ColDef[]>(
    () =>
      fields.map((field) => ({
        field: field.id,
        headerName: field.name,
        minWidth: 120,
        filter: true,
        sortable: true,
        resizable: true,
        valueFormatter: (p) => (p.value == null || p.value === "" ? "—" : String(p.value)),
      })),
    [fields],
  );

  const namedRows = useMemo(
    () => rows.map((row, i) => ({ __i: i, ...row })),
    [rows],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center justify-between px-3 py-1.5 text-[11px]"
        style={{ color: "var(--th-text-muted)" }}
      >
        <span>
          Preview · {rows.length.toLocaleString()} of {totalRows.toLocaleString()} rows
        </span>
        {truncated && <span>truncated</span>}
      </div>
      <div className="flex-1 min-h-0">
        <AgGridReact
          theme={gridTheme}
          rowData={namedRows}
          columnDefs={columnDefs}
          defaultColDef={{ flex: 1 }}
          headerHeight={30}
          rowHeight={28}
          animateRows={false}
          suppressCellFocus
        />
      </div>
    </div>
  );
}

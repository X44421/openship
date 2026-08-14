"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./studio.css";
import { LayoutGrid, Play, Search, Waypoints } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  SAMPLE_CUSTOMERS_ASSET_ID,
  type LogicalField,
  type PreviewResult,
} from "@repo/core";
import { useTheme } from "@/components/theme-provider";
import { nodeTypes } from "./CleanNode";
import { StudioContext } from "./studio-context";
import { PreviewGrid } from "./PreviewGrid";
import { DatasetPanel, type StudioDataset } from "./DatasetPanel";
import { OperatorPalette } from "./OperatorPalette";
import { Inspector } from "./Inspector";
import {
  defaultData,
  defaultGraph,
  type StudioNode,
  type StudioNodeData,
  type StudioOp,
} from "./defaults";
import { graphToPlan } from "./to-plan";

const CATALOG_DATASETS: StudioDataset[] = [
  { id: SAMPLE_CUSTOMERS_ASSET_ID, name: "raw_customers.csv", category: "source", kind: "csv", size: "sample", runnable: true },
  { id: "transactions_2024.csv", name: "transactions_2024.csv", category: "source", kind: "csv", size: "catalog", runnable: false },
  { id: "web_events.parquet", name: "web_events.parquet", category: "source", kind: "parquet", size: "catalog", runnable: false },
  { id: "marketing_data.xlsx", name: "marketing_data.xlsx", category: "source", kind: "excel", size: "catalog", runnable: false },
  { id: "stg_customers", name: "stg_customers", category: "interim", kind: "table", size: "derived", runnable: false },
  { id: "stg_transactions", name: "stg_transactions", category: "interim", kind: "table", size: "derived", runnable: false },
  { id: "clean_customers", name: "clean_customers", category: "output", kind: "table", size: "derived", runnable: false },
  { id: "customer_report.csv", name: "customer_report.csv", category: "output", kind: "csv", size: "derived", runnable: false },
];

type StudioView = "graph" | "data";
type LeftTab = "datasets" | "operators";

function bypassDisabled(nodes: StudioNode[], edges: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[]) {
  const disabled = new Set(nodes.filter((n) => n.data.disabled).map((n) => n.id));
  const kept = nodes.filter((n) => !disabled.has(n.id));
  let next = edges.filter((e) => !disabled.has(e.source) && !disabled.has(e.target));
  for (const id of disabled) {
    const ins = edges.filter((e) => e.target === id);
    const outs = edges.filter((e) => e.source === id);
    for (const incoming of ins) {
      for (const outgoing of outs) {
        next = [
          ...next,
          {
            id: `bypass-${incoming.id}-${outgoing.id}`,
            source: incoming.source,
            target: outgoing.target,
            sourceHandle: incoming.sourceHandle,
            targetHandle: outgoing.targetHandle,
          },
        ];
      }
    }
  }
  return { nodes: kept, edges: next };
}

function StudioInner() {
  const initial = useMemo(() => defaultGraph(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>("n-filter");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [nodeQuery, setNodeQuery] = useState("");
  const [view, setView] = useState<StudioView>("graph");
  const [leftTab, setLeftTab] = useState<LeftTab>("datasets");
  const [showInspector, setShowInspector] = useState(true);
  const [datasets, setDatasets] = useState<StudioDataset[]>(CATALOG_DATASETS);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(SAMPLE_CUSTOMERS_ASSET_ID);
  const { screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "light" ? "light" : "dark";

  useEffect(() => {
    void api
      .get<{ assets?: Array<{ id: string; name: string; kind: string; fields?: LogicalField[] }> }>(
        "pipelines/catalog",
      )
      .then((res) => {
        const assets = res.assets ?? [];
        if (assets.length === 0) return;
        setDatasets((prev) => {
          const rest = prev.filter((d) => d.category !== "source" || !d.runnable);
          const sources: StudioDataset[] = assets.map((a) => ({
            id: a.id,
            name: a.name,
            category: "source",
            kind: a.kind,
            size: `${a.fields?.length ?? 0} cols`,
            runnable: true,
            fields: a.fields,
          }));
          return [...sources, ...rest];
        });
      })
      .catch(() => {
        /* keep local catalog */
      });
  }, []);

  const patch = useCallback(
    (id: string, patchData: Partial<StudioNodeData>) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patchData } } : n)),
      );
    },
    [setNodes],
  );

  const run = useCallback(
    async (rootId?: string) => {
      setRunning(true);
      setError(null);
      setNodes((prev) =>
        prev.map((n) =>
          n.data.disabled ? n : { ...n, data: { ...n.data, status: "running" as const } },
        ),
      );
      try {
        const { nodes: planNodes, edges: planEdges } = bypassDisabled(
          nodes as StudioNode[],
          edges,
        );
        const plan = graphToPlan(planNodes as StudioNode[], planEdges, rootId);
        const result = await api.post<PreviewResult & { ok?: boolean; error?: string }>(
          "pipelines/preview",
          { plan, limit: 500 },
        );
        if ("ok" in result && result.ok === false) {
          throw new Error(result.error || "Preview failed");
        }
        setPreview(result);
        setNodes((prev) =>
          prev.map((n) => {
            const metrics = result.nodeMetrics?.[n.id];
            if (n.data.disabled) return n;
            return {
              ...n,
              data: {
                ...n.data,
                status: "completed",
                rowsIn: metrics?.rowsIn,
                rowsOut: metrics?.rowsOut,
              },
            };
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Preview failed";
        setError(message);
        setNodes((prev) =>
          prev.map((n) =>
            n.data.disabled ? n : { ...n, data: { ...n.data, status: "failed" } },
          ),
        );
      } finally {
        setRunning(false);
      }
    },
    [edges, nodes, setNodes],
  );

  const addOp = useCallback(
    (op: StudioOp, client?: { x: number; y: number }) => {
      const id = `n-${op}-${Math.random().toString(36).slice(2, 8)}`;
      const position = client
        ? screenToFlowPosition(client)
        : screenToFlowPosition({ x: window.innerWidth * 0.55, y: window.innerHeight * 0.4 });
      setNodes((prev) => [...prev, { id, type: op, position, data: defaultData(op) }]);
      setSelectedId(id);
      setShowInspector(true);
    },
    [screenToFlowPosition, setNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const op = event.dataTransfer.getData("application/stillflow-op") as StudioOp;
      if (!op) return;
      addOp(op, { x: event.clientX, y: event.clientY });
    },
    [addOp],
  );

  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setShowInspector(true);
  }, []);

  const onSelectDataset = useCallback(
    (dataset: StudioDataset) => {
      setSelectedDataset(dataset.id);
      if (!dataset.runnable) return;
      const scan = (nodes as StudioNode[]).find((n) => n.data.op === "scan");
      if (scan) {
        patch(scan.id, {
          sourceAssetId: dataset.id,
          title: dataset.name,
          subtitle: `${dataset.kind.toUpperCase()} · ${dataset.size}`,
        });
        selectNode(scan.id);
      } else {
        addOp("scan");
      }
    },
    [addOp, nodes, patch, selectNode],
  );

  const ctx = useMemo(
    () => ({
      selectedId,
      running,
      preview,
      patch,
      run,
      closeInspector: () => setShowInspector(false),
      showPreview: () => setView("data"),
    }),
    [selectedId, running, preview, patch, run],
  );

  const selected = (nodes as StudioNode[]).find((n) => n.id === selectedId) ?? null;
  const q = nodeQuery.trim().toLowerCase();
  const visibleNodes = useMemo(() => {
    if (!q) return nodes;
    return nodes.map((n) => ({
      ...n,
      hidden:
        !n.data.title.toLowerCase().includes(q) &&
        !n.data.op.includes(q) &&
        !n.data.subtitle.toLowerCase().includes(q),
    }));
  }, [nodes, q]);

  return (
    <StudioContext.Provider value={ctx}>
      <div className="studio-root flex-1 min-h-0 flex overflow-hidden">
        <aside className="st-side">
          <div className="st-seg st-seg-pad">
            <button
              type="button"
              className={leftTab === "datasets" ? "is-on" : ""}
              onClick={() => setLeftTab("datasets")}
            >
              Datasets
            </button>
            <button
              type="button"
              className={leftTab === "operators" ? "is-on" : ""}
              onClick={() => setLeftTab("operators")}
            >
              Nodes
            </button>
          </div>
          {leftTab === "datasets" ? (
            <DatasetPanel
              datasets={datasets}
              selectedId={selectedDataset}
              onSelect={onSelectDataset}
            />
          ) : (
            <OperatorPalette onAdd={addOp} />
          )}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="st-toolbar">
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--th-text-heading)" }}>
                Customer Data Cleaning
              </div>
              <div className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
                Logical plan · bounded preview
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="st-search st-search-sm">
                <Search size={13} />
                <input
                  value={nodeQuery}
                  onChange={(e) => setNodeQuery(e.target.value)}
                  placeholder="Search nodes…"
                />
              </div>
              <div className="st-seg st-seg-compact">
                <button
                  type="button"
                  className={view === "graph" ? "is-on" : ""}
                  onClick={() => setView("graph")}
                  title="Graph"
                >
                  <Waypoints size={14} />
                </button>
                <button
                  type="button"
                  className={view === "data" ? "is-on" : ""}
                  onClick={() => setView("data")}
                  title="Data"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
              <button type="button" className="st-btn" disabled={running} onClick={() => void run()}>
                <span className="inline-flex items-center gap-1.5">
                  <Play size={13} fill="currentColor" />
                  {running ? "Running…" : "Run all"}
                </span>
              </button>
            </div>
          </div>

          {view === "graph" ? (
            <div
              className="flex-1 min-h-0"
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <ReactFlow
                className="studio-flow"
                colorMode={colorMode}
                nodes={visibleNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => selectNode(node.id)}
                onPaneClick={() => setSelectedId(null)}
                fitView
                deleteKeyCode={["Backspace", "Delete"]}
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={22}
                  size={1}
                  color="var(--th-on-12)"
                />
                <MiniMap
                  pannable
                  zoomable
                  maskColor="color-mix(in srgb, var(--th-bg-page) 70%, transparent)"
                  nodeColor="var(--th-on-10)"
                  nodeStrokeWidth={0}
                />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          ) : (
            <div className="flex-1 min-h-0 st-preview st-preview-fill">
              {error ? (
                <div className="p-4 text-sm" style={{ color: "var(--st-danger-fg, #dc2626)" }}>
                  {error}
                </div>
              ) : preview ? (
                <PreviewGrid
                  fields={preview.preview.schema.fields}
                  rows={preview.preview.rows}
                  truncated={preview.preview.truncated}
                  totalRows={preview.preview.totalRows}
                />
              ) : (
                <div
                  className="h-full flex items-center justify-center text-[12px]"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  Run the plan to preview rows
                </div>
              )}
            </div>
          )}

          {view === "graph" && (
            <div className="st-preview">
              {error ? (
                <div className="p-4 text-sm" style={{ color: "var(--st-danger-fg, #dc2626)" }}>
                  {error}
                </div>
              ) : preview ? (
                <PreviewGrid
                  fields={preview.preview.schema.fields}
                  rows={preview.preview.rows}
                  truncated={preview.preview.truncated}
                  totalRows={preview.preview.totalRows}
                />
              ) : (
                <div
                  className="h-full flex items-center justify-center text-[12px]"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  Run the plan to preview rows
                </div>
              )}
            </div>
          )}
        </div>

        {showInspector && selected && <Inspector node={selected} nodes={nodes as StudioNode[]} />}
      </div>
    </StudioContext.Provider>
  );
}

export function StudioApp() {
  return (
    <ReactFlowProvider>
      <StudioInner />
    </ReactFlowProvider>
  );
}

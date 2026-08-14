"use client";

import { createContext, useContext } from "react";
import type { PreviewResult } from "@repo/core";
import type { StudioNodeData } from "./defaults";

export interface StudioCtx {
  selectedId: string | null;
  running: boolean;
  preview: PreviewResult | null;
  patch: (id: string, patch: Partial<StudioNodeData>) => void;
  run: (id?: string) => void;
  closeInspector: () => void;
  showPreview: () => void;
}

export const StudioContext = createContext<StudioCtx | null>(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("StudioContext missing");
  return ctx;
}

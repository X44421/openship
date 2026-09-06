"use client";

/**
 * Development-mode banner (FE1-S5, openship#23).
 *
 * Rendered only under a development build: Next.js inlines `process.env.NODE_ENV`,
 * so the production build evaluates `IS_DEV` to `false` and both the banner and
 * the `openship-dev-mode` marker are tree-shaken out of the shipped chunks.
 * `scripts/check-production-bundle.mjs` enforces that the marker never ships.
 *
 * Purpose: an always-visible, unambiguous signal that the surface on screen is a
 * development build — so demo/fixture-driven states can never be mistaken for
 * production truth (and never shipped as it).
 */
const IS_DEV = process.env.NODE_ENV !== "production";

/** Scan marker: must not appear in production bundle output. */
export const DEV_BANNER_MARKER = "openship-dev-mode";

export function DevBanner() {
  if (!IS_DEV) return null;
  return (
    <div
      data-dev-banner={DEV_BANNER_MARKER}
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 9999,
        pointerEvents: "none",
        background: "rgba(234, 179, 8, 0.92)",
        color: "#422006",
        font: "600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: "2px 8px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      dev build
    </div>
  );
}

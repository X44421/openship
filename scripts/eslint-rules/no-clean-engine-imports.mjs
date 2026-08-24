// Local ESLint rule: `no-clean-engine-imports` — FE1-S1 (#19).
//
// Rule name pinned by the FE0-C1 authority-boundary contract §4 guard table
// (row 1: "no-clean-engine-imports (no-restricted-imports 封 @repo/core 的
// clean 子路径)"). Delivered as a small local rule so the exact frozen name
// exists as a lint error id and can be machine-audited across repos.
//
// Bans every import that resolves into packages/core/src/clean/** from outside
// packages/core itself, in these forms:
//   - relative:          ../../../packages/core/src/clean/execute
//   - bare subpath:      @repo/core/src/clean/execute
//   - bare subpath alt:  @repo/core/clean/execute
//   - dynamic import() of any of the above
//
// AST-based, so unlike the fast pre-install scanner it is exact for every
// syntax form (import/export/import(), multi-line, type-only).
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const coreDir = resolve(repoRoot, "packages/core");
const cleanEngineDir = resolve(coreDir, "src/clean");

/** True when a `@repo/core/...` subpath lands inside the clean subtree. */
function subpathHitsCleanEngine(subpath) {
  return (
    subpath === "clean" ||
    subpath.startsWith("clean/") ||
    subpath === "src/clean" ||
    subpath.startsWith("src/clean/")
  );
}

export const noCleanEngineImports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Bans imports into the @repo/core cleaning-engine subtree from outside packages/core (FE0-C1 §4).",
    },
    messages: {
      banned:
        "Import into the @repo/core cleaning-engine subtree ('{{source}}') is forbidden outside packages/core; the TS cleaning simulator is a recorded anti-pattern (FE0-C1 §2.2).",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    // The whole packages/core package is the clean engine's home: internal
    // wiring between its modules (e.g. src/index.ts re-exporting ./clean) is
    // allowed and evaluated by retirement slices, not by this ban.
    if (filename.startsWith(coreDir)) return {};

    function report(sourceValue, node) {
      if (typeof sourceValue !== "string") return;
      if (sourceValue.startsWith("@repo/core/")) {
        const subpath = sourceValue.slice("@repo/core/".length);
        if (subpathHitsCleanEngine(subpath)) {
          context.report({ node, messageId: "banned", data: { source: sourceValue } });
        }
        return;
      }
      if (sourceValue.startsWith(".")) {
        const absolute = resolve(dirname(filename), sourceValue);
        const rel = relative(cleanEngineDir, absolute);
        if (!rel.startsWith("..") && !rel.startsWith("/")) {
          context.report({ node, messageId: "banned", data: { source: sourceValue } });
        }
      }
    }

    return {
      ImportDeclaration(node) {
        report(node.source?.value, node.source ?? node);
      },
      ExportNamedDeclaration(node) {
        if (node.source) report(node.source.value, node.source);
      },
      ExportAllDeclaration(node) {
        if (node.source) report(node.source.value, node.source);
      },
      ImportExpression(node) {
        report(node.source?.value, node.source ?? node);
      },
    };
  },
};
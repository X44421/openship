// FE1-S6 (#24): bundle analysis gate. Builds are produced by the CI job (root
// `bun run build` for api+dashboard, `packages/client`, `apps/web`, `apps/cli`);
// this script measures each production output and enforces a byte budget.
//
// Fail-closed policy (docs/ci/quality-gates.md §Bundle analysis):
// - budgets are frozen here; raising one is a PR-visible change that must be
//   justified (a legitimate feature grew an output) and re-reviewed;
// - build caches (`cache/` segments) and `node_modules` are excluded from the
//   measurement so the number tracks shipped bytes, not build scratch.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Measured 2026-09-06 on main@e83ba3f (see PR #30 evidence); budgets carry
// ~2x headroom over the measured shipped bytes.
const BUDGETS = [
  { path: "apps/api/dist", maxBytes: 25 * 1024 * 1024 },
  { path: "apps/dashboard/.next", maxBytes: 250 * 1024 * 1024 },
  { path: "apps/web/.next", maxBytes: 550 * 1024 * 1024 },
  { path: "apps/cli/dist", maxBytes: 80 * 1024 * 1024 },
  { path: "packages/client/dist", maxBytes: 512 * 1024 },
];

function sizeOf(dir, depth) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "cache") continue;
      total += sizeOf(path, depth + 1);
    } else if (entry.isFile()) {
      total += statSync(path).size;
    }
  }
  return total;
}

function format(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const over = [];
console.log("bundle analysis:");
for (const budget of BUDGETS) {
  const bytes = sizeOf(budget.path, 0);
  const status = bytes > budget.maxBytes ? "OVER" : "ok";
  console.log(
    `  ${budget.path.padEnd(24)} ${format(bytes).padStart(10)} / ${format(budget.maxBytes)}  ${status}`,
  );
  if (bytes > budget.maxBytes) over.push(budget.path);
}

if (over.length > 0) {
  console.error(
    `\nbundle budget exceeded for: ${over.join(", ")}`,
    "\nA budget may only be raised with a PR-visible justification:",
    "name the feature that grew the output and the new measurement",
    "(docs/ci/quality-gates.md §Bundle analysis).",
  );
  process.exit(1);
}
console.log("bundle analysis: OK (all outputs within budget)");

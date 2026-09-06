// FE1-S5 (openship#23): production-bundle fixture/mock scan.
//
// Scans the shipped surfaces of the target topology (web-client dashboard,
// desktop, cli) for references to demo/fixture machinery: the dev-fixtures
// package, the prototype sample dataset, monitoring preview fixtures, the
// development banner, and the legacy mock module name. A production build
// must contain none of them.
//
// Fail-closed policy (docs/ci/quality-gates.md §Production bundle scan):
// - marker additions/removals are PR-visible changes to this list, each with
//   a reason — the scan is the mechanical half of the FE0-C2 §4 ban on
//   production entries reaching fixtures;
// - the ONLY path exemption is the dashboard's `/dev/` route segment
//   (app/(dashboard)/dev/**): a development-only inspection surface whose
//   page chunks legitimately bundle preview fixtures. It ships, but it is
//   not a production entry, and the exemption is narrowed to that segment;
// - directories named cache / node_modules and source maps are skipped.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const MARKERS = [
  ["@stillflow/dev-fixtures", "dev-fixtures package reached from a production bundle"],
  ["fixtureId", "dev-fixtures factory leaked into production"],
  ["SAMPLE_CUSTOMER", "prototype sample dataset leaked into production"],
  ["MOCK_VARIANTS", "monitoring preview fixtures leaked into production"],
  ["preview-fixtures", "monitoring preview fixture module shipped"],
  ["openship-dev-mode", "development banner marker shipped"],
  ["/constants/mock", "legacy mock module name shipped"],
];

const SKIP_SEGMENTS = new Set(["cache", "node_modules", ".turbo"]);
const EXEMPT_SEGMENT = "/dev/";

function scan(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_SEGMENTS.has(entry.name)) continue;
      scan(path, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".map")) continue;
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.size > 8 * 1024 * 1024) continue;
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue; // binary
    }
    out.push({ path, text });
  }
}

const findings = [];
let files = 0;
for (const root of process.argv.slice(2)) {
  const filesInRoot = [];
  scan(root, filesInRoot);
  for (const { path, text } of filesInRoot) {
    const rel = relative(process.cwd(), path).replaceAll("\\", "/");
    // Development-only inspection surface (dashboard /dev/** routes): the
    // documented, narrowed exemption — see the header comment.
    if (rel.includes(EXEMPT_SEGMENT)) continue;
    files += 1;
    for (const [marker, reason] of MARKERS) {
      if (text.includes(marker)) {
        findings.push(`${rel} → ${marker} (${reason})`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`production bundle scan: ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    "Fixture/demo machinery must not ship in production bundles. Remove the",
    "reference from the production surface; the `/dev/` route segment is the",
    "only exemption (docs/ci/quality-gates.md §Production bundle scan).",
  );
  process.exit(1);
}
console.log(`production bundle scan: OK (${files} files, 0 fixture/mock references)`);

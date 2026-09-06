// FE1-S6 (#24): license scan gate. Zero-dependency scan over every workspace
// manifest and every installed node_modules package.
//
// Fail-closed policy (docs/ci/quality-gates.md §License scan):
// - a package passes only if its SPDX license expression is in ALLOWLIST, or
//   the package+license pair is pinned in ALLOWANCES with a concrete,
//   reviewed reason;
// - extending ALLOWLIST or adding an ALLOWANCES entry is a PR-visible change
//   and must be justified in the PR description — silent ignore is not
//   possible by construction;
// - a package that drops its license field entirely (previously licensed)
//   still fails until its name is allowed.
import { readdirSync, readFileSync, existsSync } from "node:fs";

const ALLOWLIST = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "BlueOak-1.0.0",
  "MPL-2.0",
  "Python-2.0",
  "MIT OR CC0-1.0",
  "(MIT OR CC0-1.0)",
  "MIT AND ISC",
]);

// Reviewed exceptions — every entry pins the exact reviewed license string
// and a concrete reason (runbook §License scan). A package whose license
// string later changes no longer matches and fails the scan again.
const ALLOWANCES = new Map([
  ["@better-fetch/fetch", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["@img/sharp-libvips-linux-x64", { license: "LGPL-3.0-or-later", reason: "prebuilt libvips binary; system-library linkage, transitive via sharp" }],
  ["@img/sharp-libvips-linuxmusl-x64", { license: "LGPL-3.0-or-later", reason: "prebuilt libvips binary; system-library linkage, transitive via sharp" }],
  ["buildcheck", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["compute-gcd", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["compute-lcm", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["cpu-features", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["esprima", { license: "(none)", reason: "esprima@1.2.5 predates the SPDX field; later 2.x publishes BSD-2-Clause" }],
  ["gsap", { license: "Standard 'no charge' license: https://gsap.com/standard-license.", reason: "non-SPDX no-charge custom license; reviewed and allowed" }],
  ["seq-queue", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["ssh2", { license: "(none)", reason: "no SPDX field published; upstream repository is BSD-2-Clause + MIT (audited at pin)" }],
  ["validate.io-function", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["validate.io-integer", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["validate.io-integer-array", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
  ["validate.io-number", { license: "(none)", reason: "no SPDX field published; upstream repository is MIT (audited at pin)" }],
]);

function licenseOf(manifest) {
  if (typeof manifest.license === "string") return manifest.license;
  if (manifest.license && typeof manifest.license.type === "string") return manifest.license.type;
  return "(none)";
}

function collect(out, root, prefix) {
  if (!existsSync(root)) return;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (["node_modules", ".next", "dist", ".turbo", "test", "test:e2e"].includes(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;
    const dir = `${root}/${entry.name}`;
    if (existsSync(`${dir}/package.json`)) out.push(`${prefix}${entry.name}`);
    collect(out, dir, `${prefix}${entry.name}/`);
  }
}

// walkNodeModules enumerates the direct children of a node_modules directory
// (each is a package root); walkPackage descends ONLY into a package's own
// nested node_modules so subpath-export directories are never mistaken for
// packages.
function walkNodeModules(out, dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.name.startsWith("@")) {
      let scoped;
      try {
        scoped = readdirSync(path, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scopedEntry of scoped) {
        if (!scopedEntry.isDirectory()) continue;
        const scopedPath = `${path}/${scopedEntry.name}`;
        out.push(scopedPath);
        walkPackage(out, scopedPath);
      }
      continue;
    }
    out.push(path);
    walkPackage(out, path);
  }
}

function walkPackage(out, dir) {
  const nested = `${dir}/node_modules`;
  if (existsSync(nested)) walkNodeModules(out, nested);
}

const workspacePackages = [];
collect(workspacePackages, process.cwd(), "");
const installed = [];
// Seed from every workspace's installed tree — bun hoists into the root
// node_modules, but sub-dep trees (apps/email/server, apps/email/client)
// keep their own node_modules that are part of the shipped artifact.
walkNodeModules(installed, `${process.cwd()}/node_modules`);
for (const workspace of ["apps", "packages", "fixtures"]) {
  let wsEntries;
  try {
    wsEntries = readdirSync(`${process.cwd()}/${workspace}`, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const wsEntry of wsEntries) {
    if (!wsEntry.isDirectory()) continue;
    walkNodeModules(installed, `${process.cwd()}/${workspace}/${wsEntry.name}/node_modules`);
  }
}

const violations = [];
let checked = 0;
const seen = new Set();

function check(dir, installed) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
  } catch {
    return;
  }
  const name = manifest.name;
  const version = manifest.version ?? "?";
  const key = `${name}@${version}`;
  if (!name || seen.has(key)) return;
  if (name.startsWith("@repo/") || name.startsWith("@stillflow/")) return;
  seen.add(key);
  checked += 1;
  const license = licenseOf(manifest);
  if (ALLOWLIST.has(license)) return;
  const allowance = ALLOWANCES.get(name);
  if (allowance && allowance.license === license) return;
  if (!installed && license === "(none)") {
    // First-party workspace manifests inherit the root Apache-2.0 declaration;
    // a first-party manifest that DECLARES a license still must allowlist it.
    return;
  }
  violations.push(
    `${name} @ ${version} — license: "${license}" (${dir})`,
  );
}

for (const dir of workspacePackages) check(dir, false);
for (const dir of installed) check(dir, true);

if (violations.length > 0) {
  console.error(`license scan: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    "Every package must carry an allowlisted SPDX expression or a named entry",
    "in scripts/check-licenses.mjs ALLOWANCES with a reviewed reason.",
    "Extending the allowlist or allowances is a PR-visible change:",
    "document it in the PR description and docs/ci/quality-gates.md §License scan.",
  );
  process.exit(1);
}
console.log(`license scan: OK (${checked} packages checked, ${ALLOWANCES.size} reviewed allowances)`);

// FE1-S6 (#24): dependency vulnerability audit gate. Zero-dependency audit
// over every installed node_modules package via the public OSV batch API.
//
// Fail-closed policy (docs/ci/quality-gates.md §Dependency audit):
// - every installed third-party package (name@version from its manifest) is
//   queried against OSV; any reported vulnerability fails the gate with the
//   OSV id list, so remediation is a normal dependency bump PR;
// - workspace packages (@repo/*, @stillflow/*) are not published artifacts
//   and are skipped;
// - an unreachable OSV API is a failure, never a silent pass: the gate must
//   not be green when it did not actually check.
import { readdirSync, readFileSync, existsSync } from "node:fs";

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const CHUNK = 200;

// Reviewed ignores — every entry pins the exact package+advisory pair and a
// concrete reason (runbook §Dependency audit). A lockfile bump that changes
// the vulnerable version range re-opens review; anything not listed here
// fails the gate.
const TARBALL_REASON =
  "fixed only in tar 7.5.x (ESM major); build-time transitive of @electron/rebuild and cacache extracting registry-served artifacts — migration tracked with the electron toolchain";

const IMAGEDATA_REASON =
  "no fixed version published upstream as of 2026-09-06; the vulnerable JXL/HEIF parsers are only reachable through build-time consumers (appdmg, datauri) operating on repository-trusted files, never user input — re-evaluate on upstream release";

const IGNORES = new Map([
  [
    "esbuild@GHSA-g7r4-m6w7-qqqr",
    "affects only the esbuild development server (--servedir) on Windows; this repo uses esbuild solely as a bundling API (tsup, desktop build) and never as a dev server — upgrade past 0.28.1 is constrained by tsup's ^0.27 range and tracked for the next tsup major",
  ],
  [
    "esbuild@GHSA-67mh-4wv8-2f99",
    "same dev-server-only exposure class as GHSA-g7r4-m6w7-qqqr; the vulnerable 0.18.x copy ships inside the deprecated @esbuild-kit/core-utils (drizzle-kit CLI bundling), used strictly as a bundling API — remediation lands with the drizzle-kit upgrade that replaces esbuild-kit",
  ],
  // tar: all twelve 2025 advisories are fixed only in tar 7.5.x (ESM major,
  // breaking). tar@6.2.1 is a build-time transitive of @electron/rebuild and
  // cacache — it extracts registry-served artifacts on the build machine, not
  // attacker-controlled archives. Migration is tracked with the electron
  // toolchain (electron-forge / cacache majors).
  ["tar@GHSA-23hp-3jrh-7fpw", TARBALL_REASON],
  ["tar@GHSA-34x7-hfp2-rc4v", TARBALL_REASON],
  ["tar@GHSA-83g3-92jg-28cx", TARBALL_REASON],
  ["tar@GHSA-8qq5-rm4j-mr97", TARBALL_REASON],
  ["tar@GHSA-8x88-c5mf-7j5w", TARBALL_REASON],
  ["tar@GHSA-9ppj-qmqm-q256", TARBALL_REASON],
  ["tar@GHSA-gvwx-54wh-qm9j", TARBALL_REASON],
  ["tar@GHSA-qffp-2rhf-9h96", TARBALL_REASON],
  ["tar@GHSA-r292-9mhp-454m", TARBALL_REASON],
  ["tar@GHSA-r6q2-hw4h-h46w", TARBALL_REASON],
  ["tar@GHSA-vmf3-w455-68vh", TARBALL_REASON],
  ["tar@GHSA-w8wr-v893-vjvp", TARBALL_REASON],
  ["image-size@GHSA-5p2g-fcmc-qvqq", IMAGEDATA_REASON],
  ["image-size@GHSA-w3rx-r6r6-pgpr", IMAGEDATA_REASON],
  [
    "extract-zip@GHSA-jmr9-qjv8-65gv",
    "no fixed version published upstream as of 2026-09-06; extract-zip is used by @electron/get to unpack official Electron distribution archives fetched over pinned HTTPS URLs at install/build time — not attacker-controlled input; re-evaluate on upstream release",
  ],
]);

function isIgnored(pkg, ids) {
  return ids.every((id) => {
    const ignore = IGNORES.get(`${pkg}@${id}`);
    if (!ignore) return false;
    ignoredCount += 1;
    return true;
  });
}

let ignoredCount = 0;

// Build-output segments are never dependency trees; skipping them keeps the
// audit on the installed tree and avoids re-scanning stale vendored copies
// inside .next/standalone, dist bundles, and turbo caches.
const BUILD_OUTPUT_SEGMENTS = new Set([".next", "dist", "build", ".turbo", "coverage"]);

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
    if (BUILD_OUTPUT_SEGMENTS.has(entry.name)) continue;
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

const dirs = [];
// Seed from every workspace's installed tree — bun hoists into the root
// node_modules, but sub-dep trees (apps/email/server, apps/email/client)
// keep their own node_modules that are part of the shipped artifact.
walkNodeModules(dirs, `${process.cwd()}/node_modules`);
for (const workspace of ["apps", "packages", "fixtures"]) {
  let entries;
  try {
    entries = readdirSync(`${process.cwd()}/${workspace}`, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    walkNodeModules(dirs, `${process.cwd()}/${workspace}/${entry.name}/node_modules`);
  }
}
const packages = new Map();
for (const dir of dirs) {
  try {
    const manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
    if (!manifest.name || !manifest.version) continue;
    if (manifest.name.startsWith("@repo/") || manifest.name.startsWith("@stillflow/")) continue;
    packages.set(`${manifest.name}@${manifest.version}`, {
      name: manifest.name,
      version: manifest.version,
    });
  } catch {
    // not an npm package directory
  }
}

const list = [...packages.values()];
console.log(`dependency audit: querying OSV for ${list.length} installed package(s)`);

const vulnerable = new Map();
for (let index = 0; index < list.length; index += CHUNK) {
  const chunk = list.slice(index, index + CHUNK);
  let response = null;
  // One retry round for transient network blips; an API that stays
  // unreachable still fails the gate — an uncheckable tree is not a pass.
  for (let attempt = 1; attempt <= 3 && !response; attempt += 1) {
    try {
      response = await fetch(OSV_BATCH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          queries: chunk.map((pkg) => ({
            package: { name: pkg.name, ecosystem: "npm" },
            version: pkg.version,
          })),
        }),
      });
    } catch (error) {
      if (attempt === 3) {
        console.error(`dependency audit: OSV API unreachable (${error.message})`);
        console.error("The gate is fail-closed: an uncheckable dependency tree is not a pass.");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  if (!response.ok) {
    console.error(`dependency audit: OSV API returned HTTP ${response.status}`);
    process.exit(1);
  }
  const result = await response.json();
  result.results?.forEach((entry, offset) => {
    if (entry.vulns?.length) {
      const pkg = chunk[offset];
      const ids = entry.vulns.map((v) => v.id);
      if (isIgnored(pkg.name, ids)) return;
      vulnerable.set(`${pkg.name}@${pkg.version}`, ids);
    }
  });
}

if (vulnerable.size > 0) {
  console.error(`dependency audit: ${vulnerable.size} package(s) with known vulnerabilities`);
  for (const [pkg, ids] of vulnerable) {
    console.error(`  ${pkg} → ${ids.join(", ")}`);
  }
  console.error(
    "Remediate with a dependency bump (lockfile-only PR), or add a reviewed",
    "entry to IGNORES in scripts/check-dependency-vulnerabilities.mjs with a",
    "concrete reason (docs/ci/quality-gates.md §Dependency audit).",
  );
  process.exit(1);
}
console.log(
  `dependency audit: OK (${list.length} packages, 0 unreviewed vulnerabilities, ${ignoredCount} reviewed ignore(s))`,
);

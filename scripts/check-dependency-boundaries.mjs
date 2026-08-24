// Workspace dependency-boundary guard — FE1-S1 (#19).
//
// Enforcement piece for the frozen target topology
// (docs/issues/issue-013-package-topology-contract.md §2) and the canonical
// recalculation guard design (docs/issues/issue-011-client-authority-boundary-contract.md §4).
//
// Zero-dependency, pure Node: runs before install in CI, fails closed on any
// violation. `no-clean-engine-imports` intentionally matches the guard-rule
// name frozen in the FE0-C1 contract §4 table.
//
// Usage: node scripts/check-dependency-boundaries.mjs
//
// Scope discipline: legacy (@repo/*) inter-package dependencies are existing
// stock consumed slice-by-slice by retirement tasks (FE5 series) and are NOT
// evaluated here — except the clean-engine subtree ban, which applies
// everywhere outside packages/core itself, tests included.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".next", ".output", "coverage"]);

// ---------------------------------------------------------------------------
// Frozen topology data (FE0-C2 §1–§2)
// ---------------------------------------------------------------------------

const NEW_PACKAGE_NAMES = new Set([
  "@stillflow/contracts",
  "@stillflow/client",
  "@stillflow/studio-ui",
  "@stillflow/dev-fixtures",
]);

// Target-role mapping of app members (topology contract §1: dashboard is the
// web-client base; physical renames are deferred to retirement slices, §3).
const APP_ROLES = {
  "apps/dashboard": "web-client",
  "apps/desktop": "desktop",
  "apps/cli": "cli",
};

// The complete allowed edge set over target roles / new packages (§2 允许).
// Every other edge touching @stillflow/* is a violation.
const ALLOWED_NEW_EDGES = new Set([
  "role:web-client>@stillflow/client",
  "role:desktop>@stillflow/client",
  "role:cli>@stillflow/client",
  "@stillflow/client>@stillflow/contracts",
  "role:web-client>@stillflow/studio-ui",
  "@stillflow/studio-ui>@stillflow/contracts",
  "@stillflow/dev-fixtures>@stillflow/contracts",
]);

// ---------------------------------------------------------------------------

function discoverMembers() {
  const members = [];
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(join(repoRoot, group)).sort()) {
      const manifestPath = join(repoRoot, group, entry, "package.json");
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch {
        continue;
      }
      if (!manifest.name) continue;
      members.push({
        name: manifest.name,
        dir: join(repoRoot, group, entry),
        relDir: `${group}/${entry}`,
        role: APP_ROLES[`${group}/${entry}`] ?? null,
        isNew: NEW_PACKAGE_NAMES.has(manifest.name),
        isCore: manifest.name === "@repo/core",
        isApp: group === "apps",
        manifest,
      });
    }
  }
  return members;
}

function isTestScopedFile(relPath) {
  return (
    /\.(test|spec|stories)\./.test(relPath) ||
    relPath.includes("__tests__/") ||
    relPath.includes("__mocks__/") ||
    relPath.includes(".storybook/")
  );
}

function describeSource(member) {
  return member.role ? `${member.name} (${member.role})` : member.name;
}

/** Edge key used against the frozen allowed set; null when unconstrained. */
function sourceEdgeKey(member) {
  if (member.isNew) return member.name;
  if (member.role !== null) return `role:${member.role}`;
  return null; // retired/legacy objects carry no target role — out of scope here
}

function* walkSourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      yield* walkSourceFiles(full);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext)) && !entry.endsWith(".d.ts")) {
      yield full;
    }
  }
}

const IMPORT_PATTERNS = [
  /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/,
  /(?:^|\n)\s*import\s+["']([^"']+)["']/,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/,
];

function extractImportSpecifiers(sourceText) {
  const specifiers = [];
  const lines = sourceText.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of IMPORT_PATTERNS) {
      const match = lines[index].match(pattern);
      if (match?.[1]) {
        specifiers.push({ specifier: match[1], line: index + 1 });
        break;
      }
    }
  }
  return specifiers;
}

function memberContainingPath(members, absolutePath) {
  return members.find((member) => {
    const rel = relative(member.dir, absolutePath);
    return !rel.startsWith("..") && !rel.startsWith("/");
  });
}

function recordViolation(violations, rule, location, detail) {
  violations.push({ rule, location, detail });
}

/**
 * Evaluates one cross-member edge (manifest or import) against the rules.
 * `via` describes the evidence channel; `testScoped` marks test/storybook
 * sources; `manifestGroup` is set for package.json edges.
 */
function evaluateEdge({
  violations,
  sourceMember,
  targetMember,
  location,
  via,
  testScoped = false,
  manifestGroup = null,
}) {
  // Applications must never be depended upon (拓扑 §2 禁止第一项).
  if (targetMember.isApp && !sourceMember.isApp) {
    recordViolation(
      violations,
      "boundary/app-as-dependency",
      location,
      `${describeSource(sourceMember)} -> app ${targetMember.name}: applications must never be depended upon`,
    );
    return;
  }

  if (!targetMember.isNew) return; // legacy-to-legacy stock is consumed by FE5 slices

  // dev-fixtures has dedicated semantics beyond the plain edge set:
  //   - contracts / client / studio-ui may NEVER reach it (§2 禁止第二项, tests included);
  //   - apps may reference it from test-scoped sources / devDependencies only;
  //   - legacy packages reaching it are existing stock (FE5 slices).
  if (targetMember.name === "@stillflow/dev-fixtures") {
    if (sourceMember === targetMember) return;
    if (sourceMember.isNew) {
      recordViolation(
        violations,
        "boundary/disallowed-new-edge",
        location,
        `edge ${describeSource(sourceMember)} -> ${targetMember.name} (${via}): contracts/client/studio-ui are hard-banned from dev-fixtures`,
      );
      return;
    }
    if (sourceMember.isApp) {
      const testOnly = manifestGroup === "devDependencies" || testScoped;
      if (!testOnly) {
        recordViolation(
          violations,
          "boundary/dev-fixtures-in-production",
          location,
          `${describeSource(sourceMember)} reaches @stillflow/dev-fixtures (${via}) outside test scopes/devDependencies`,
        );
      }
      return;
    }
    return; // legacy stock — FE5 slices
  }

  const sourceKey = sourceEdgeKey(sourceMember);
  if (sourceKey === null) return; // retired apps/packages touching new ones are FE5 stock
  if (!ALLOWED_NEW_EDGES.has(`${sourceKey}>${targetMember.name}`)) {
    recordViolation(
      violations,
      "boundary/disallowed-new-edge",
      location,
      `edge ${describeSource(sourceMember)} -> ${targetMember.name} (${via}) is not in the FE0-C2 §2 allowed edge set`,
    );
  }
}

function checkManifestEdges(members, violations) {
  for (const member of members) {
    for (const group of ["dependencies", "peerDependencies", "devDependencies"]) {
      const deps = member.manifest[group] ?? {};
      for (const [name] of Object.entries(deps).sort(([a], [b]) => a.localeCompare(b))) {
        const target = members.find((candidate) => candidate.name === name);
        if (!target || target === member) continue;
        evaluateEdge({
          violations,
          sourceMember: member,
          targetMember: target,
          location: `${member.relDir}/package.json (${group})`,
          via: `manifest ${group}`,
          manifestGroup: group,
        });
      }
    }
  }
}

function checkSourceEdges(members, violations) {
  let scannedFiles = 0;
  for (const member of members) {
    for (const file of walkSourceFiles(member.dir)) {
      scannedFiles += 1;
      const fileRel = relative(repoRoot, file);
      const text = readFileSync(file, "utf8");
      for (const { specifier, line } of extractImportSpecifiers(text)) {
        const testScoped = isTestScopedFile(fileRel);
        // Bare workspace-name import (@stillflow/*, @repo/*).
        const bareTarget = members.find((candidate) => candidate.name === specifier);
        if (bareTarget && bareTarget !== member) {
          evaluateEdge({
            violations,
            sourceMember: member,
            targetMember: bareTarget,
            location: `${fileRel}:${line}`,
            via: "bare specifier",
            testScoped,
          });
          continue;
        }

        // Relative import reaching into another member's tree.
        if (!specifier.startsWith(".")) continue;
        const absoluteTarget = resolve(dirname(file), specifier);
        const owner = memberContainingPath(members, absoluteTarget);
        if (!owner || owner === member) continue;

        // Canonical-recalculation guard (FE0-C1 §4): the TypeScript cleaning
        // engine subtree is banned everywhere outside packages/core itself,
        // tests included.
        if (owner.isCore) {
          const relInsideClean = relative(join(owner.dir, "src", "clean"), absoluteTarget);
          if (!relInsideClean.startsWith("..")) {
            recordViolation(
              violations,
              "no-clean-engine-imports",
              `${fileRel}:${line}`,
              `import into the @repo/core cleaning-engine subtree (${specifier}); the TS cleaning simulator is a recorded anti-pattern (FE0-C1 §2.2) and may only be imported within packages/core`,
            );
            continue;
          }
        }

        evaluateEdge({
          violations,
          sourceMember: member,
          targetMember: owner,
          location: `${fileRel}:${line}`,
          via: `deep relative import into ${owner.relDir}`,
          testScoped,
        });
      }
    }
  }
  return scannedFiles;
}

// ---------------------------------------------------------------------------

const members = discoverMembers();
const violations = [];
checkManifestEdges(members, violations);
const scannedFiles = checkSourceEdges(members, violations);

const summary = `${members.length} members, ${scannedFiles} source files`;
if (violations.length > 0) {
  process.stderr.write(
    [
      `dependency-boundary check: FAILED (${violations.length} violation(s); ${summary})`,
      "",
      ...violations.map(
        (violation) => `  [${violation.rule}] ${violation.location}\n    -> ${violation.detail}`,
      ),
      "",
      "Frozen topology: docs/issues/issue-013-package-topology-contract.md §2",
      "Guard design: docs/issues/issue-011-client-authority-boundary-contract.md §4",
    ].join("\n"),
  );
  process.exit(1);
}

process.stdout.write(`dependency-boundary check: OK (${summary}, 0 violations)\n`);

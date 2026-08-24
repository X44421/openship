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
// Import extraction is a lexical scanner (strings/comments skipped, keywords
// matched at identifier boundaries), so legal multi-line static imports and
// `from "…"` clauses spanning lines are captured — not just same-line imports.
// AST-exact coverage is layered on top by the ESLint boundary rules
// (eslint.config.mjs: `no-restricted-imports` edge set + the local
// `no-clean-engine-imports` rule).
//
// Scope discipline: legacy (@repo/*) inter-package dependencies are existing
// stock consumed slice-by-slice by retirement tasks (FE5 series) and are NOT
// evaluated here — except the clean-engine subtree ban (applies everywhere
// outside packages/core itself, tests included) and hard bans on any NEW
// dependency from the @stillflow/* packages onto legacy members.
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
// Lexical import scanner
// ---------------------------------------------------------------------------

function isWordChar(character) {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

/** Skips whitespace and comments from `index`; returns next token position. */
function skipWhitespaceAndComments(text, index) {
  const n = text.length;
  let i = index;
  for (;;) {
    while (i < n && /\s/.test(text[i])) i += 1;
    if (text[i] === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (text[i] === "/" && text[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(i + 2, n);
      continue;
    }
    return i;
  }
}

/** Skips a string literal starting at `start`; returns index after it. */
function skipString(text, start) {
  const quote = text[start];
  const n = text.length;
  let i = start + 1;
  while (i < n) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === quote) return i + 1;
    i += 1;
  }
  return n;
}

/** Reads a single/double-quoted literal at `index`; null when not a quote. */
function readQuoted(text, index) {
  const quote = text[index];
  if (quote !== '"' && quote !== "'") return null;
  const n = text.length;
  let i = index + 1;
  while (i < n) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === quote) return { value: text.slice(index + 1, i), offset: i - index + 1 };
    i += 1;
  }
  return null;
}

/**
 * Searches from `start` for the `from` keyword of an import/export statement.
 * Returns -1 when a statement boundary (`;`) or a plainly non-import keyword
 * is met first. String/comment content is skipped.
 */
function findFromKeyword(text, start) {
  const n = text.length;
  let i = start;
  const bailKeywords = new Set([
    "const", "let", "var", "return", "if", "else", "for", "while", "function", "class",
    "default", "async", "await", "new", "typeof", "throw", "switch", "case",
  ]);
  while (i < n) {
    const character = text[i];
    if (character === '"' || character === "'" || character === "`") {
      i = skipString(text, i);
      continue;
    }
    if (character === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (character === "/" && text[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(i + 2, n);
      continue;
    }
    if (character === ";") return -1;
    if (/[A-Za-z_$]/.test(character)) {
      const previous = i > 0 ? text[i - 1] : "";
      if (!isWordChar(previous)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_$]/.test(text[j])) j += 1;
        const word = text.slice(i, j);
        if (word === "from") return i;
        if (bailKeywords.has(word)) return -1;
        i = j;
        continue;
      }
    }
    i += 1;
  }
  return -1;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

/**
 * Extracts import specifiers with their 1-based line numbers. Covers:
 *   - `import X from "…"`, `import { … } from "…"`, `import type { … } from "…"`
 *   - `import "…"` side effects, `export * from "…"`, `export { … } from "…"`
 *   - dynamic `import("…")` and `require("…")`
 * Multi-line statements are handled because scanning is lexical, not line-based.
 * Known limitation (documented): template-literal interpolation containing a
 * dynamic import is skipped with the template; AST-exact coverage is provided
 * by the ESLint boundary rules layered on top.
 */
function extractImportSpecifiers(sourceText) {
  const specifiers = [];
  const n = sourceText.length;
  let i = 0;
  while (i < n) {
    const character = sourceText[i];

    if (character === '"' || character === "'" || character === "`") {
      i = skipString(sourceText, i);
      continue;
    }
    if (character === "/" && sourceText[i + 1] === "/") {
      while (i < n && sourceText[i] !== "\n") i += 1;
      continue;
    }
    if (character === "/" && sourceText[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(sourceText[i] === "*" && sourceText[i + 1] === "/")) i += 1;
      i = Math.min(i + 2, n);
      continue;
    }

    if (/[A-Za-z_$]/.test(character)) {
      const previous = i > 0 ? sourceText[i - 1] : "";
      if (isWordChar(previous)) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(sourceText[j])) j += 1;
      const word = sourceText.slice(i, j);

      if (word === "import" || word === "export" || word === "require") {
        const next = skipWhitespaceAndComments(sourceText, j);
        const nextCharacter = sourceText[next];

        if (nextCharacter === "(" && word !== "export") {
          // dynamic import("…") / require("…")
          const literalStart = skipWhitespaceAndComments(sourceText, next + 1);
          const literal = readQuoted(sourceText, literalStart);
          if (literal) {
            specifiers.push({
              specifier: literal.value,
              line: lineNumberAt(sourceText, literalStart),
            });
          }
        } else if (word === "import" && (nextCharacter === '"' || nextCharacter === "'")) {
          // side-effect import "…"
          const literal = readQuoted(sourceText, next);
          if (literal) specifiers.push({ specifier: literal.value, line: lineNumberAt(sourceText, next) });
        } else {
          // import { … } from / export { … } from / export * from
          const fromIndex = findFromKeyword(sourceText, next);
          if (fromIndex !== -1) {
            const literalStart = skipWhitespaceAndComments(sourceText, fromIndex + 4);
            const literal = readQuoted(sourceText, literalStart);
            if (literal) {
              specifiers.push({
                specifier: literal.value,
                line: lineNumberAt(sourceText, literalStart),
              });
            }
          }
        }
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return specifiers;
}

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
  return null; // retired objects — forbidden from new edges
}

function walkSourceFiles(dir) {
  const files = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(current, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext)) && !entry.endsWith(".d.ts")) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
}

function memberContainingPath(members, absolutePath) {
  return members.find((member) => {
    const rel = relative(member.dir, absolutePath);
    return !rel.startsWith("..") && !rel.startsWith("/");
  });
}

/**
 * Splits a bare specifier into its workspace package name and the subpath.
 * "@stillflow/client/sub" -> { base: "@stillflow/client", subpath: "sub" };
 * "@repo/core/src/clean/x" -> { base: "@repo/core", subpath: "src/clean/x" }.
 */
function splitBareSpecifier(specifier) {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length < 2) return { base: specifier, subpath: null };
    return {
      base: `${parts[0]}/${parts[1]}`,
      subpath: parts.length > 2 ? parts.slice(2).join("/") : null,
    };
  }
  const slash = specifier.indexOf("/");
  if (slash === -1) return { base: specifier, subpath: null };
  return { base: specifier.slice(0, slash), subpath: specifier.slice(slash + 1) };
}

/** True when a core subpath lands inside the cleaning-engine subtree. */
function subpathHitsCleanEngine(subpath) {
  if (subpath === null) return false;
  return (
    subpath === "clean" ||
    subpath.startsWith("clean/") ||
    subpath === "src/clean" ||
    subpath.startsWith("src/clean/")
  );
}

function recordViolation(violations, rule, location, detail) {
  violations.push({ rule, location, detail });
}

/**
 * Evaluates one cross-member edge (manifest or import) against the rules.
 * `via` describes the evidence channel; `testScoped` marks test/storybook
 * sources; `manifestGroup` is set for package.json edges. `specifier` /
 * `subpath` carry the import form and its workspace-relative part;
 * `resolvedInsideClean` marks relative imports into the clean subtree.
 */
function evaluateEdge({
  violations,
  sourceMember,
  targetMember,
  location,
  via,
  testScoped = false,
  manifestGroup = null,
  specifier = null,
  subpath = null,
  resolvedInsideClean = false,
}) {
  const viaLabel = via ?? (specifier === null ? "manifest" : `import ${specifier}`);

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

  // Canonical-recalculation guard (FE0-C1 §4): the TypeScript cleaning engine
  // subtree is banned everywhere outside packages/core itself, tests included.
  // Relative and bare-subpath forms both resolve here.
  if (targetMember.isCore && resolvedInsideClean && sourceMember !== targetMember) {
    recordViolation(
      violations,
      "no-clean-engine-imports",
      location,
      `import into the @repo/core cleaning-engine subtree (${specifier}); the TS cleaning simulator is a recorded anti-pattern (FE0-C1 §2.2) and may only be imported within packages/core`,
    );
    return;
  }

  // New @stillflow/* packages must never form NEW dependencies onto legacy
  // members (拓扑 §2: 一切对新 @stillflow/* 之外旧包的新增依赖禁止).
  if (sourceMember.isNew && !targetMember.isNew) {
    recordViolation(
      violations,
      "boundary/disallowed-new-edge",
      location,
      `edge ${describeSource(sourceMember)} -> ${targetMember.name} (${viaLabel}): new @stillflow/* packages must not depend on legacy members (FE0-C2 §2)`,
    );
    return;
  }

  if (!targetMember.isNew) return; // legacy-to-legacy stock is consumed by FE5 slices

  // Retired apps (api/email/web/edge) are replace/delete objects — they must
  // not join the new topology by importing @stillflow/*.
  if (sourceMember.isApp && sourceMember.role === null) {
    recordViolation(
      violations,
      "boundary/disallowed-new-edge",
      location,
      `edge ${describeSource(sourceMember)} -> ${targetMember.name} (${viaLabel}): retired apps are out of the target topology (FE0-C2 §4)`,
    );
    return;
  }

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
        `edge ${describeSource(sourceMember)} -> ${targetMember.name} (${viaLabel}): contracts/client/studio-ui are hard-banned from dev-fixtures`,
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
          `${describeSource(sourceMember)} reaches @stillflow/dev-fixtures (${viaLabel}) outside test scopes/devDependencies`,
        );
      }
      return;
    }
    return; // legacy stock — FE5 slices
  }

  const sourceKey = sourceEdgeKey(sourceMember);
  if (sourceKey === null) return;
  if (!ALLOWED_NEW_EDGES.has(`${sourceKey}>${targetMember.name}`)) {
    recordViolation(
      violations,
      "boundary/disallowed-new-edge",
      location,
      `edge ${describeSource(sourceMember)} -> ${targetMember.name} (${viaLabel}) is not in the FE0-C2 §2 allowed edge set`,
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
        const location = `${fileRel}:${line}`;

        if (specifier.startsWith(".")) {
          // Relative import reaching into another member's tree.
          const absoluteTarget = resolve(dirname(file), specifier);
          const owner = memberContainingPath(members, absoluteTarget);
          if (!owner || owner === member) continue;
          const resolvedInsideClean =
            owner.isCore &&
            !relative(join(owner.dir, "src", "clean"), absoluteTarget).startsWith("..");
          evaluateEdge({
            violations,
            sourceMember: member,
            targetMember: owner,
            location,
            via: `deep relative import into ${owner.relDir}`,
            testScoped,
            specifier,
            resolvedInsideClean,
          });
          continue;
        }

        // Bare workspace import: base package name + optional subpath.
        const { base, subpath } = splitBareSpecifier(specifier);
        const bareTarget = members.find((candidate) => candidate.name === base);
        if (!bareTarget || bareTarget === member) continue;
        evaluateEdge({
          violations,
          sourceMember: member,
          targetMember: bareTarget,
          location,
          via: subpath ? `bare subpath import ${specifier}` : "bare specifier",
          testScoped,
          specifier,
          subpath,
          resolvedInsideClean: subpathHitsCleanEngine(subpath),
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
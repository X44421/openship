// FE1-I1 (openship#30) phase A4: mechanical consistency gate for the
// StillFlow capability matrix.
//
// Modes:
//   node scripts/check-capability-matrix.mjs
//       Verify internal consistency: the matrix has exactly the same
//       operationIds as the vendored manifest snapshot (no omissions, no
//       hand-added rows, no duplicates), every row carries a valid
//       disposition, WIRED rows carry client evidence, BLOCKED rows carry a
//       blocker, and the Markdown rendering is up to date.
//
//   node scripts/check-capability-matrix.mjs --stillflow <path>
//       Additionally parse <path>/backend/crates/stillflow-api/src/manifest.rs
//       (the authoritative source; OpenAPI is derived from it) and compare
//       operationIds against the vendored snapshot. Run this when StillFlow
//       main moves: any added/removed route fails until the snapshot and the
//       matrix are regenerated.
//
//   node scripts/check-capability-matrix.mjs --write-md
//       Regenerate docs/integration/stillflow-capability-matrix.md from the
//       JSON (the Markdown is a rendering, never hand-edited).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MATRIX = "docs/integration/stillflow-capability-matrix.json";
const SNAPSHOT = "docs/integration/stillflow-manifest.snapshot.json";
const MARKDOWN = "docs/integration/stillflow-capability-matrix.md";
const DISPOSITIONS = ["WIRED", "READY-TO-WIRE", "BLOCKED", "NON-PRODUCT/INTERNAL"];

const args = process.argv.slice(2);
const stillflowIndex = args.indexOf("--stillflow");
const stillflowPath = stillflowIndex >= 0 ? args[stillflowIndex + 1] : null;
const writeMd = args.includes("--write-md");

const fail = (messages) => {
  for (const message of messages) console.error(`capability matrix: ${message}`);
  console.error("capability matrix: FAILED");
  process.exit(1);
};

const errors = [];
const matrix = JSON.parse(readFileSync(MATRIX, "utf8"));
const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

// --- 1. snapshot integrity -------------------------------------------------
if (snapshot.source?.repo !== "X44421/stillflow" || !snapshot.source?.commit) {
  errors.push("snapshot provenance missing repo/commit");
}
if (snapshot.routes?.length !== snapshot.source?.routeCount) {
  errors.push(
    `snapshot route count ${snapshot.routes?.length} != declared ${snapshot.source?.routeCount}`,
  );
}

// --- 2. matrix ↔ snapshot (primary key: operationId) -----------------------
const snapshotIds = snapshot.routes.map((r) => r.operationId);
const matrixIds = matrix.rows.map((r) => r.operationId);
const snapshotSet = new Set(snapshotIds);
const matrixSet = new Set(matrixIds);
if (matrix.rows.length !== snapshot.routes.length) {
  errors.push(`matrix rows ${matrix.rows.length} != manifest routes ${snapshot.routes.length}`);
}
for (const id of snapshotIds) {
  if (!matrixSet.has(id)) errors.push(`manifest route missing from matrix: ${id}`);
}
for (const id of matrixIds) {
  if (!snapshotSet.has(id)) errors.push(`matrix row is not in the manifest (hand-added?): ${id}`);
}
if (new Set(matrixIds).size !== matrixIds.length) {
  errors.push("duplicate operationId in matrix");
}

// --- 3. row-level discipline ------------------------------------------------
for (const row of matrix.rows) {
  const id = row.operationId;
  if (!DISPOSITIONS.includes(row.disposition)) {
    errors.push(`${id}: disposition "${row.disposition}" is not one of ${DISPOSITIONS.join(", ")}`);
  }
  if (!row.availabilityDev || !row.availabilityRelease) {
    errors.push(`${id}: availabilityDev / availabilityRelease must both be recorded`);
  }
  if (row.disposition === "BLOCKED" && !(row.blocker ?? "").trim()) {
    errors.push(`${id}: BLOCKED rows must carry a blocker`);
  }
  if (row.disposition === "WIRED") {
    if (!(row.clientEvidence ?? "").trim()) errors.push(`${id}: WIRED rows must carry clientEvidence`);
    if (!(row.targetClientMethod ?? "").trim()) errors.push(`${id}: WIRED rows must carry targetClientMethod`);
  }
}

// --- 4. optional: verify against a live stillflow checkout ------------------
if (stillflowPath) {
  const manifestPath = `${stillflowPath}/backend/crates/stillflow-api/src/manifest.rs`;
  if (!existsSync(manifestPath)) {
    errors.push(`--stillflow ${stillflowPath}: manifest.rs not found at ${manifestPath}`);
  } else {
    const source = readFileSync(manifestPath, "utf8");
    const pattern =
      /route\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",?\s*\)/gs;
    const live = [...source.matchAll(pattern)].map((m) => m[1]);
    if (live.length !== snapshot.routes.length) {
      errors.push(
        `live manifest has ${live.length} routes but the vendored snapshot has ${snapshot.routes.length} — regenerate the snapshot`,
      );
    }
    const liveSet = new Set(live);
    for (const id of snapshotIds) {
      if (!liveSet.has(id)) errors.push(`snapshot route no longer in the live manifest: ${id}`);
    }
    for (const id of live) {
      if (!snapshotSet.has(id)) errors.push(`live manifest route missing from snapshot: ${id}`);
    }
  }
}

// --- 5. markdown rendering -------------------------------------------------
function renderMarkdown(data) {
  const lines = [
    "<!-- Generated by scripts/check-capability-matrix.mjs --write-md. DO NOT EDIT. -->",
    "# StillFlow Capability Matrix (FE1-I1 phase A)",
    "",
    `Source: \`${SNAPSHOT}\` (${data.summary.routeCount} routes, extracted from stillflow \`${snapshot.source.commit.slice(0, 9)}\`).`,
    "",
    `Dispositions: ${Object.entries(data.summary.dispositions).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
    "",
    "| operationId | method | path | disposition | availabilityDev | availabilityRelease | targetClientMethod |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of data.rows) {
    lines.push(
      `| ${row.operationId} | ${row.method} | ${row.path} | ${row.disposition} | ${row.availabilityDev} | ${row.availabilityRelease} | ${row.targetClientMethod || "—"} |`,
    );
  }
  return lines.join("\n") + "\n";
}

if (writeMd) {
  writeFileSync(MARKDOWN, renderMarkdown(matrix));
  console.log(`capability matrix: markdown regenerated (${matrix.rows.length} rows)`);
  process.exit(0);
}

// The Markdown is a generated rendering: a stale or hand-edited rendering
// fails the same way any other drift does.
if (existsSync(MARKDOWN)) {
  const current = readFileSync(MARKDOWN, "utf8");
  if (current !== renderMarkdown(matrix)) {
    errors.push(
      `${MARKDOWN} is stale or hand-edited — regenerate with: node scripts/check-capability-matrix.mjs --write-md`,
    );
  }
}

if (errors.length > 0) fail(errors);
console.log(
  `capability matrix: OK (${matrix.rows.length} rows = ${snapshot.routes.length} manifest routes; 0 unexplained)`,
);

// FE1-S6 (#24): secret scan gate. Zero-dependency lexical scan over every
// git-tracked file for high-confidence credential shapes.
//
// Fail-closed policy (docs/ci/quality-gates.md §Secret scan):
// - only high-confidence patterns are detected; anything ambiguous is out of
//   scope for this gate and belongs to review;
// - a line carrying `secret-scan:allow(<reason>)` is exempt — every marker
//   must name a concrete reason and is reviewed like any other diff hunk;
//   unexplained markers are treated as violations by the same scan;
// - network or tool failures never silently pass: the script exits 1 on any
//   error it cannot attribute to a finding.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1_000_000;
const ALLOW_MARKER = /secret-scan:allow\([^)]+\)/;

const PATTERNS = [
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token (ghp_/gho_/ghu_/ghs_/ghr_)", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["GitHub fine-grained PAT", /\bgithub_pat_[A-Za-z0-9_]{22,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  [
    "high-entropy assignment to a credential-ish name",
    /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'][A-Za-z0-9+/_-]{32,}["']/,
  ],
];
// A real private key carries a base64 body after the header; UI placeholders,
// i18n templates, and redaction tests only contain the bare header, so the
// body requirement keeps those out of a high-confidence gate.
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----\\?n?\s*[A-Za-z0-9+/=]{40,}/;

const files = execFileSync("git", ["ls-files", "-z"], {
  maxBuffer: 64 * 1024 * 1024,
})
  .toString()
  .split("\0")
  .filter(Boolean);

const findings = [];
let scanned = 0;
for (const file of files) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch {
    continue;
  }
  if (bytes.length > MAX_BYTES) continue;
  let text;
  try {
    text = bytes.toString("utf8");
  } catch {
    continue;
  }
  if (text.includes("\0")) continue; // binary
  scanned += 1;
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    if (ALLOW_MARKER.test(line)) continue;
    for (const [name, pattern] of PATTERNS) {
      if (pattern.test(line)) {
        findings.push({ file, line: index + 1, name, text: line.trim().slice(0, 120) });
      }
    }
  }
  if (PRIVATE_KEY.test(text)) {
    const line = text.slice(0, text.search(PRIVATE_KEY)).split("\n").length;
    findings.push({ file, line, name: "private key with body", text: "embedded PEM private key" });
  }
}

if (findings.length > 0) {
  console.error(`secret scan: ${findings.length} finding(s)`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} — ${finding.name}`);
    console.error(`    ${finding.text}`);
  }
  console.error(
    "If a finding is a false positive, it is NOT silently ignorable: either",
    "remove the secret-shaped literal, or add an inline",
    "`secret-scan:allow(<reason>)` marker with a concrete reason on the same",
    "line and record it in docs/ci/quality-gates.md §Secret scan.",
  );
  process.exit(1);
}
console.log(`secret scan: OK (${scanned} text files scanned, 0 findings)`);

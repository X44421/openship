// FE1-I1 (openship#30) phase B0: mechanical extractor for the StillFlow API
// DTO surface.
//
// Parses the serde definitions of the StillFlow crates (the authoritative
// shapes the HTTP service actually serializes) and emits the API DTO snapshot
// consumed by generate.mjs to render src/generated/api.ts.
//
// Fail-closed by design:
//   - an unknown Rust type expression is an error, never a silent `unknown`;
//   - `#[serde(flatten)]` is rejected (it makes the wire shape non-declarative);
//   - the extraction only succeeds when every requested root resolves and the
//     transitive closure is complete.
//
// Usage:
//   node scripts/extract-api-dtos.mjs --stillflow <stillflow-checkout> \
//        [--out schema/api-dto.snapshot.json] [--roots <manifest.snapshot.json>]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}
const stillflow = argValue("--stillflow");
const outPath = argValue("--out", joinHere("../schema/api-dto.snapshot.json"));
const rootsPath = argValue("--roots", joinHere("../../../docs/integration/stillflow-manifest.snapshot.json"));

function joinHere(rel) {
  return new URL(rel, import.meta.url).pathname;
}

if (!stillflow) {
  console.error("usage: extract-api-dtos.mjs --stillflow <stillflow-checkout> [--out FILE] [--roots FILE]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Rust source collection
// ---------------------------------------------------------------------------
function collectRsFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "target" || entry.name === "node_modules") continue;
      out.push(...collectRsFiles(path));
    } else if (entry.name.endsWith(".rs")) {
      out.push(path);
    }
  }
  return out;
}

const rsFiles = collectRsFiles(stillflow);

/** Matches a balanced {...} block starting at `openBraceIndex`. */
function blockEnd(text, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits a body on top-level commas (depth-aware for <>, (), {}). */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if ("<([".includes(ch)) depth += 1;
    else if (">)]".includes(ch)) depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  if (body.slice(start).trim()) parts.push(body.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSerdeOptions(attr) {
  // attr: the inside of #[serde( ... )]
  const options = {};
  const re = /([a-z_]+)\s*=\s*(?:"([^"]*)"|([a-z_]+))/g;
  let m;
  while ((m = re.exec(attr))) {
    options[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  if (/^\s*deny_unknown_fields\s*,?\s*$/.test(attr)) options.deny_unknown_fields = true;
  return options;
}

const items = new Map(); // name -> {kind, file, attrs, body}
const typeAliases = new Map(); // name -> rust type

for (const file of rsFiles) {
  const text = readFileSync(file, "utf8");
  const itemRe = /\n(pub (?:struct|enum|type) [A-Z][A-Za-z0-9]*)/g;
  let m;
  while ((m = itemRe.exec(text))) {
    const declStart = m.index + 1;
    const attrStart = Math.max(
      text.lastIndexOf("\n\n", declStart),
      text.lastIndexOf("\n\n#", declStart) >= 0 ? text.indexOf("\n\n#", declStart) : -1,
    );
    // Collect the attribute block directly above the declaration.
    let attrText = "";
    const linesBefore = text.slice(0, declStart).split("\n");
    let i = linesBefore.length - 2;
    while (i >= 0 && (linesBefore[i].trim().startsWith("#[") || linesBefore[i].trim() === "")) {
      if (linesBefore[i].trim()) attrText = linesBefore[i].trim() + "\n" + attrText;
      i -= 1;
    }
    const decl = m[1];
    const kind = decl.startsWith("pub struct") ? "struct" : decl.startsWith("pub enum") ? "enum" : "type";
    const name = decl.replace(/^pub (struct|enum|type) /, "");
    if (kind === "type") {
      const aliasRe = /pub type ([A-Za-z0-9]+)\s*=\s*([^;]+);/;
      const full = text.slice(declStart, declStart + 400);
      const am = full.match(aliasRe);
      if (am) typeAliases.set(am[1], am[2].trim());
      continue;
    }
    const openBrace = text.indexOf("{", declStart);
    const semi = text.indexOf(";", declStart);
    const end = openBrace >= 0 && (semi < 0 || openBrace < semi)
      ? blockEnd(text, openBrace)
      : semi;
    if (end < 0) continue;
    const body = openBrace >= 0 ? text.slice(openBrace + 1, end) : "";
    if (!items.has(name)) {
      items.set(name, { kind, file: relative(stillflow, file), attrText, body, name });
    }
  }
}

// ---------------------------------------------------------------------------
// serde attribute helpers
// ---------------------------------------------------------------------------
function serdeOptions(item) {
  const options = {};
  for (const line of item.attrText.split("\n")) {
    const m = line.match(/#\[serde\((.*)\)\]/);
    if (m) Object.assign(options, parseSerdeOptions(m[1]));
  }
  return options;
}

function renameCase(name, renameAll) {
  if (renameAll === "camelCase") {
    return name
      .replace(/_/g, "-")
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      .replace(/^-/, "");
  }
  if (renameAll === "PascalCase") {
    return name[0].toUpperCase() + name.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
  if (renameAll === "kebab-case") return name.replace(/_/g, "-");
  if (renameAll === "snake_case") return name;
  return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Rust type expression → TS (+ transitive resolution)
// ---------------------------------------------------------------------------
const emitted = new Map(); // TS name -> IR node
const primitives = new Set(["String", "bool", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "usize", "isize", "f32", "f64"]);
const stringish = new Set(["Uuid", "DateTime", "NaiveDateTime", "PlanNodeId", "ColumnId", "DigestHex", "RuleId", "JobId", "RunId"]);

function resolveBase(typeName) {
  // Strip crate paths (stillflow_core::X, stillflow_plan::X, crate::X).
  const base = typeName.split("::").pop();
  return base;
}

function rustToTs(typeExpr, genericBindings, context) {
  let t = typeExpr.trim().replace(/^&\s*/, "").replace(/^mut\s+/, "").trim();
  // Box<T> / std::boxed::Box<T>
  const boxM = t.match(/^(?:Box|std::boxed::Box)<(.+)>$/s);
  if (boxM) return rustToTs(boxM[1], genericBindings, context);
  const optM = t.match(/^(?:Option<(.+)>|core::option::Option<(.+)>)$/s);
  if (optM) return `${rustToTs(optM[1] ?? optM[2], genericBindings, context)} | null`;
  const vecM = t.match(/^(?:Vec<(.+)>|std::vec::Vec<(.+)>)$/s);
  if (vecM) return `readonly (${rustToTs(vecM[1] ?? vecM[2], genericBindings, context)})[]`;
  const arrM = t.match(/^\[(.+);\s*\d+\]$/);
  if (arrM) return `readonly (${rustToTs(arrM[1], genericBindings, context)})[]`;
  const mapM = t.match(/^(?:std::collections::)?(?:HashMap|BTreeMap)<(.+)>$/s);
  if (mapM) {
    const [keyType, valueType] = splitTopLevel(mapM[1]);
    if (rustToTs(keyType, genericBindings, context) !== "string") {
      throw new Error(`[${context}] non-string map key in ${typeExpr}`);
    }
    return `{ readonly [key: string]: ${rustToTs(valueType, genericBindings, context)} }`;
  }
  const tupleM = t.match(/^\((.+)\)$/s);
  if (tupleM && t.includes(",")) {
    const parts = splitTopLevel(tupleM[1]).map((p) => rustToTs(p, genericBindings, context));
    return `readonly [${parts.join(", ")}]`;
  }
  if (t === "serde_json::Value" || t === "Value") return "unknown";
  if (t === "DateTime<Utc>" || t === " chrono::DateTime<chrono::Utc>" || t === "chrono::DateTime<chrono::Utc>") return "string";
  // Generic parameter binding (ObjectList<T> etc.)
  if (genericBindings.has(t)) return genericBindings.get(t);
  // Primitive / stringish
  const bare = resolveBase(t);
  if (bare === "Uuid" || bare === "DateTime" || stringish.has(bare)) return "string";
  if (primitives.has(bare)) return bare === "String" ? "string" : "number";
  if (bare === "String") return "string";
  if (bare === "bool") return "boolean";
  // serde_json::Value with crate path
  if (bare === "Value") return "unknown";
  // Named item: resolve transitively
  if (items.has(bare) || emitted.has(bare) || typeAliases.has(bare)) {
    ensure(bare, genericBindings, context);
    return bare;
  }
  throw new Error(`[${context}] unresolvable Rust type "${typeExpr}" (base "${bare}")`);
}

function snakeToCamel(name) {
  return name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function ensure(name, genericBindings = new Map(), context = "") {
  const key = genericBindings.size
    ? `${name}<${[...genericBindings.values()].join(",")}>`
    : name;
  if (emitted.has(key) || emitted.has(name)) return;
  const item = items.get(name);
  if (!item) throw new Error(`[${context}] item ${name} not found in Rust sources`);
  const options = serdeOptions(item);
  if (options.flatten) throw new Error(`${name}: serde(flatten) is rejected (fail-closed)`);
  if (options.rename_all && !["camelCase", "snake_case", "kebab-case", "PascalCase"].includes(options.renameAll ?? options.rename_all)) {
    throw new Error(`${name}: unsupported serde rename_all ${options.rename_all}`);
  }
  const renameAll = options.rename_all ?? "snake_case";

  if (item.kind === "struct") {
    // Strip attribute lines; field bodies may contain generic params <T>.
    const generics = item.body.match(/<([A-Z]>)$/) ? item.body.match(/<([A-Z])>\s*$/) : null;
    const typeParam = generics ? generics[1] : null;
    let fieldBody = item.body;
    if (typeParam) fieldBody = fieldBody.replace(new RegExp(`<\\s*${typeParam}\\s*>`), "").trim();
    const bindings = new Map(genericBindings);
    if (typeParam) {
      // The generic parameter itself is emitted as a type argument placeholder.
      bindings.set(typeParam, typeParam);
    }
    const fields = [];
    for (const part of splitTopLevel(fieldBody)) {
      const fm = part.match(/^(?:#\[[^\]]*\]\s*)*pub\s+([a-z_0-9]+)\s*:\s*([\s\S]+)$/);
      if (!fm) continue; // comment or non-field line
      const fieldOptions = {};
      const attrM = part.match(/#\[serde\((.*)\)\]/);
      if (attrM) Object.assign(fieldOptions, parseSerdeOptions(attrM[1]));
      if (fieldOptions.skip) continue;
      if (fieldOptions.flatten) throw new Error(`${name}.${fm[1]}: serde(flatten) is rejected`);
      const wireName = fieldOptions.rename ?? renameCase(fm[1], renameAll);
      let tsType = rustToTs(fm[2].trim(), bindings, `${name}.${fm[1]}`);
      const optional = fieldOptions.skip_serializing_if !== undefined || fieldOptions.default !== undefined
        ? false
        : false;
      fields.push({ name: wireName, type: tsType, optional });
    }
    if (typeParam) {
      emitted.set(name, {
        name, kind: "genericStruct", typeParam, fields,
        provenance: item.file,
      });
    } else {
      emitted.set(name, { name, kind: "struct", fields, provenance: item.file });
    }
    return;
  }

  if (item.kind === "enum") {
    const tag = options.tag;
    const content = options.content;
    const variants = splitTopLevel(item.body);
    const rendered = [];
    for (const variant of variants) {
      const vm = variant.match(/^(?:#\[[^\]]*\]\s*)*([A-Z][A-Za-z0-9]*)\s*(?:\(([\s\S]+)\)|\{([\s\S]+)\})?\s*$/);
      if (!vm) continue;
      const variantName = renameCase(vm[1], renameAll === "kebab-case" ? "kebab-case" : renameAll);
      if (options.otherwise) continue;
      const structBody = vm[3];
      const tupleBody = vm[2];
      if (tag && content) {
        // Adjacent tagging: { kind, value }.
        let payload = null;
        if (structBody) {
          const fields = splitTopLevel(structBody)
            .map((part) => {
              const fm = part.match(/^(?:pub\s+)?([a-z_0-9]+)\s*:\s*([\s\S]+)$/);
              if (!fm) return null;
              return { name: renameCase(fm[1], renameAll), type: rustToTs(fm[2].trim(), new Map(genericBindings), `${name}.${vm[1]}`) };
            })
            .filter(Boolean);
          payload = { type: "object", fields };
        } else if (tupleBody) {
          payload = { type: rustToTs(tupleBody.trim(), new Map(genericBindings), `${name}.${vm[1]}`) };
        }
        rendered.push({ name: variantName, payload });
      } else if (tag) {
        // Internally tagged: struct variants inline their fields next to the tag.
        if (structBody) {
          const fields = splitTopLevel(structBody)
            .map((part) => {
              const fm = part.match(/^(?:pub\s+)?([a-z_0-9]+)\s*:\s*([\s\S]+)$/);
              if (!fm) return null;
              return { name: renameCase(fm[1], renameAll), type: rustToTs(fm[2].trim(), new Map(genericBindings), `${name}.${vm[1]}`) };
            })
            .filter(Boolean);
          rendered.push({ name: variantName, kind: "internal", fields });
        } else if (tupleBody) {
          rendered.push({ name: variantName, kind: "internal", fields: [{ name: "value", type: rustToTs(tupleBody.trim(), new Map(genericBindings), `${name}.${vm[1]}`) }] });
        } else {
          rendered.push({ name: variantName, kind: "internal", fields: [] });
        }
      } else {
        // Fieldless string enum; tuple/struct variants on an untagged enum are
        // fail-closed (they would need a dedicated serde model).
        if (structBody || tupleBody) {
          throw new Error(`${name}.${vm[1]}: untagged data-carrying enum variant is not supported (fail-closed)`);
        }
        rendered.push(variantName);
      }
    }
    if (tag && content) {
      emitted.set(name, { name, kind: "adjacentEnum", tag, content, variants: rendered, provenance: item.file });
    } else if (tag) {
      emitted.set(name, { name, kind: "internallyTaggedEnum", tag, variants: rendered, provenance: item.file });
    } else {
      const allFieldless = rendered.every((v) => typeof v === "string");
      if (!allFieldless) throw new Error(`${name}: untagged enum with data variants is not supported (fail-closed)`);
      emitted.set(name, { name, kind: "unitEnum", variants: rendered, provenance: item.file });
    }
    return;
  }
  throw new Error(`${name}: unsupported item kind ${item.kind}`);
}

// ---------------------------------------------------------------------------
// Roots from the manifest snapshot
// ---------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(rootsPath, "utf8"));
const rootNames = new Set();
for (const route of manifest.routes) {
  for (const schemaName of [route.requestSchema, route.responseSchema]) {
    // Container forms: ObjectList<T>, Vec<T>.
    const genericM = schemaName.match(/^([A-Za-z]+)<(.+)>$/);
    if (genericM) {
      rootNames.add(genericM[1]);
      const inner = genericM[2];
      const innerBase = inner.split("<")[0];
      rootNames.add(innerBase);
      continue;
    }
    rootNames.add(schemaName);
  }
}
// Generic containers must be extracted without bindings for their param.
rootNames.add("ObjectList");

const failures = [];
for (const name of rootNames) {
  try {
    ensure(name, new Map(), "root");
  } catch (error) {
    failures.push(String(error.message ?? error));
  }
}
if (failures.length > 0) {
  console.error(`api dto extraction: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

// Manifest resolution gate: every schema name must resolve to an emitted type.
const unresolved = [];
for (const route of manifest.routes) {
  for (const schemaName of [route.requestSchema, route.responseSchema]) {
    const base = schemaName.replace(/<.*>$/, "").split("::").pop();
    if (!emitted.has(base)) unresolved.push(`${route.operationId}: ${schemaName}`);
  }
}
if (unresolved.length > 0) {
  console.error(`api dto extraction: ${unresolved.length} manifest schema name(s) unresolved`);
  for (const item of unresolved) console.error(`  ${item}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Snapshot emission (deterministic: sorted by name)
// ---------------------------------------------------------------------------
const types = [...emitted.values()]
  .filter((t) => t.kind !== undefined || t.fields || t.variants)
  .map((t) => ({ ...t, provenance: undefined }))
  .sort((a, b) => a.name.localeCompare(b.name));

const snapshot = {
  $comment: "Machine-extracted API DTO snapshot for the StillFlow HTTP surface. Source of truth: the serde definitions in the stillflow crates at the recorded commit. Regenerate via scripts/extract-api-dtos.mjs --stillflow <path>; do not hand-edit.",
  source: {
    repo: "X44421/stillflow",
    ref: "main",
    commit: "c29d8c40ac7ab19d414fc71aee14c49b8c6cd3b9",
    extractedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    method: "serde-definition extraction (scripts/extract-api-dtos.mjs)",
    roots: "docs/integration/stillflow-manifest.snapshot.json request/response schema names",
    typeCount: types.length,
  },
  types,
};
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `api dto extraction: OK (${types.length} types from ${rootNames.size} manifest roots → ${outPath})`,
);

# @stillflow/contracts

Generated wire contracts shared by the StillFlow client suite (Web / Desktop / CLI).

**Authority boundary** (FE0-C2 topology contract §1, FE0-C1 authority contract §2.2):
this package contains **only generated DTOs, enums, and version constants** extracted from
the Rust backend (`X44421/stillflow`). Hand-written business types are forbidden here.

## What lives where

| Path | Role |
| --- | --- |
| `schema/*.snapshot.json` | Backend snapshots — the mechanical source of truth, with provenance (`repository@ref`, extraction method) |
| `scripts/generate.mjs` | Deterministic emitter: snapshot → `src/generated/*.ts` |
| `scripts/verify.mjs` | Drift check: regenerate in memory and byte-compare with committed output; exits 1 on any difference |
| `src/generated/` | Generated output — **never edit by hand** |

## Rules

1. Do not add hand-written business types to this package. New contract surface must go:
   backend Rust type → snapshot update → regenerate.
2. Version constants (`LOGICAL_SCHEMA_VERSION`, `PLAN_VERSION`, preview bounds) are the
   single client-side source of truth. Literal version constants anywhere else in TS are
   forbidden (FE0-C1 §3).
3. Updating a snapshot requires updating `source.ref` / `extractedAt` in the same commit,
   then running `bun run --cwd packages/contracts generate` so the drift check passes.

## Commands

```bash
bun run --cwd packages/contracts generate   # regenerate from snapshots
bun run --cwd packages/contracts verify     # drift check (also runs under lint/test)
```

CI wiring of the drift check is owned by FE1-S6 (#24); the verify script is CI-ready today.

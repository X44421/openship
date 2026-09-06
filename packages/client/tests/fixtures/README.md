# Contract-test fixtures (backend-generated snapshots)

These binary fixtures are produced by the **real** `stillflow-service` wire
encoder (SVC-A1 contract §6.1), not by hand or by the TS decoder itself. The
contract tests in `src/typed-binary.test.ts` assert the decoder against them
(FE1-S4 交付物 4：contract tests 以后端生成快照为基准，不要求活服务器).

| fixture | produced by |
| --- | --- |
| `asset-preview.arrow` | `stillflow_service::wire::encode_preview_view` — 2 batches (2+1 rows), envelope identity present, 1 warning |
| `asset-preview.meta.json` | `serde_json` of the decoded `WireMetadata` (the authoritative metadata JSON shape) |
| `asset-preview-empty.arrow` | same encoder, zero batches (envelope must be `null`) |
| `no-wire-metadata.arrow` | plain `arrow_ipc::StreamWriter` without the `stillflow.wire.v1` key (reader must fail closed) |

Provenance: stillflow `main@e36f099` + closing PR #310 head `51dee80`
(`backend/crates/stillflow-service/src/wire.rs`). Generator (throwaway scratch
crate, kept out of this repo):

```rust
let schema = Arc::new(LogicalSchema::new(vec![
    LogicalField::new(ColumnId::random(), "id", LogicalType::Int64, false)?,
    LogicalField::new(ColumnId::random(), "label", LogicalType::Utf8, true)?,
])?);
let envelope = BatchEnvelope::try_new(schema.clone(), asset_id, sequence, batch)?;
let bytes = stillflow_service::wire::encode_preview_view(ApiResponse::new(request_id, PreviewView {
    schema: (*schema).clone(), batches: envelopes, rows_returned, bytes_returned: 4096,
    rows_truncated: false, bytes_truncated: false, warnings,
}))?;
```

Column ids are random per generation; do not assert on them — assert on the
metadata JSON shape, the envelope identity fields, and the row counts.
Regenerate whenever stillflow's §6.1 framing changes (wire version bump).

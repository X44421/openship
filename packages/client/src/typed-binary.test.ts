import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TypedBinaryWireError,
  decodeTypedBinaryResponse,
} from "./arrow.js";
import {
  ARROW_MEDIA_TYPE,
  binaryResponse,
  jsonResponse,
  errorEnvelope,
} from "./test-support.js";

const FIXTURES = join(__dirname, "..", "tests", "fixtures");
const fixtureBytes = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

// Backend-generated snapshots: the .arrow files are produced by the REAL
// stillflow-service wire encoder (SVC-A1 §6.1) — see tests/fixtures/README.md.
const META = JSON.parse(
  readFileSync(join(FIXTURES, "asset-preview.meta.json"), "utf8"),
);

describe("§6.1 typed-binary decoding against real backend fixtures", () => {
  it("decodes the stillflow encoder's stream with its metadata JSON", async () => {
    const decoded = await decodeTypedBinaryResponse(
      binaryResponse(200, ARROW_MEDIA_TYPE, fixtureBytes("asset-preview.arrow"), META.meta.requestId),
    );
    expect(decoded.metadata).toEqual(META);
    expect(decoded.metadata.envelope).not.toBeNull();
    expect(decoded.metadata.envelope?.sourceAssetId).toBe(
      "7e2a1c0e-5c1e-4a6e-9d0a-3f1b2c4d5e6f",
    );
    expect(decoded.metadata.batches.map((b) => b.rowCount)).toEqual([2, 1]);
    // Payload rows, read-only (FE0-C1 §2.3): no local model, just the table.
    expect(decoded.table.numRows).toBe(3);
    expect(decoded.table.numCols).toBe(2);
  });

  it("decodes the zero-batch stream with a null envelope (§6.1)", async () => {
    const decoded = await decodeTypedBinaryResponse(
      binaryResponse(200, ARROW_MEDIA_TYPE, fixtureBytes("asset-preview-empty.arrow")),
    );
    expect(decoded.metadata.envelope).toBeNull();
    expect(decoded.metadata.batches).toEqual([]);
    expect(decoded.table.numRows).toBe(0);
  });

  it("fails closed on a truncated stream", async () => {
    const bytes = fixtureBytes("asset-preview.arrow");
    const truncated = bytes.slice(0, bytes.length - 64);
    await expect(
      decodeTypedBinaryResponse(binaryResponse(200, ARROW_MEDIA_TYPE, truncated)),
    ).rejects.toBeInstanceOf(TypedBinaryWireError);
  });

  it("fails closed when the schema carries no wire metadata key", async () => {
    await expect(
      decodeTypedBinaryResponse(
        binaryResponse(200, ARROW_MEDIA_TYPE, fixtureBytes("no-wire-metadata.arrow")),
      ),
    ).rejects.toThrow(/no "stillflow\.wire\.v1" metadata/);
  });

  it("fails closed on an unknown wire version", async () => {
    const bytes = fixtureBytes("asset-preview.arrow");
    // Same-length BYTE patch of the metadata JSON inside the schema message
    // (never decode/re-encode the binary: invalid UTF-8 elsewhere would
    // shift offsets). 1 → 9 keeps every flatbuffer offset intact.
    const needle = new TextEncoder().encode('"wireVersion":1');
    let offset = -1;
    outer: for (let i = 0; i <= bytes.length - needle.length; i += 1) {
      for (let j = 0; j < needle.length; j += 1) {
        if (bytes[i + j] !== needle[j]) continue outer;
      }
      offset = i;
      break;
    }
    expect(offset).toBeGreaterThan(-1);
    const patched = bytes.slice();
    patched[offset + needle.length - 1] = 0x39; // '9'
    await expect(
      decodeTypedBinaryResponse(binaryResponse(200, ARROW_MEDIA_TYPE, patched)),
    ).rejects.toThrow(/unknown wire version 9\b/);
  });

  it("refuses a wrong media type before touching the body", async () => {
    await expect(
      decodeTypedBinaryResponse(
        jsonResponse(200, errorEnvelope("11111111-2222-3333-4444-555555555555", "notFound", "x")),
      ),
    ).rejects.toThrow(/expected .*application\/vnd\.apache\.arrow\.stream/);
  });
});

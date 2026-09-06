import { Table, tableFromIPC } from "apache-arrow";
import {
  TYPED_BINARY_MEDIA_TYPE,
  TYPED_BINARY_WIRE_METADATA_KEY,
  TYPED_BINARY_WIRE_VERSION,
  ResponseMetadata,
} from "@stillflow/contracts";
import { StillflowClientError } from "./errors.js";
import type { TransportResponse } from "./transport.js";

/**
 * Typed-binary response decoding for the frozen SVC-A1 §6.1 wire format: one
 * Arrow IPC stream per success response, with all StillFlow metadata under
 * the single schema-message custom-metadata key. The payload batches are
 * consumed as an Apache Arrow `Table` — the client never builds a local
 * model of preview/artifact rows (FE0-C1 §2.2/§4) and never JSON-encodes
 * batches.
 *
 * Reader rules (contract §6.1, all fail closed):
 * 1. the media type must be `application/vnd.apache.arrow.stream`;
 * 2. the schema message must carry the `stillflow.wire.v1` metadata key;
 * 3. `wireVersion` must be recognized;
 * 4. the metadata batch entry count must equal the record-batch message count;
 * 5. every `batches[i].rowCount` must equal `num_rows()` of batch message i.
 */

export class TypedBinaryWireError extends StillflowClientError {
  constructor(message: string, options?: { requestId?: string; cause?: unknown }) {
    super(message, options);
  }
}

/** `WireMetadata` JSON from the schema message (serde camelCase). */
export interface WireMetadataJson {
  readonly wireVersion: number;
  readonly meta: ResponseMetadata;
  readonly envelope: {
    readonly version: number;
    readonly schemaFingerprint: readonly number[];
    readonly sourceAssetId: string;
  } | null;
  readonly batches: readonly {
    readonly sequence: number;
    readonly rowCount: number;
    readonly byteCount: number;
  }[];
  readonly view: Record<string, unknown>;
}

export interface DecodedTypedBinary {
  readonly metadata: WireMetadataJson;
  /** Decoded payload batches; display-only (FE0-C1 §2.3). */
  readonly table: Table;
}

async function* asAsyncIterable(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  yield* stream;
}

export async function decodeTypedBinaryResponse(
  response: TransportResponse,
): Promise<DecodedTypedBinary> {  if (response.contentType.split(";")[0] !== TYPED_BINARY_MEDIA_TYPE) {
    throw new TypedBinaryWireError(
      `expected ${TYPED_BINARY_MEDIA_TYPE}, got "${response.contentType}"`,
      { requestId: response.requestId },
    );
  }
  let table: Table;
  try {
    // Wrap the WHATWG stream in an explicit async iterable: the IPC reader's
    // stream sniffing is unreliable across runtimes (Node vs Bun vs browser).
    table = await tableFromIPC(asAsyncIterable(response.stream()));
  } catch (error) {
    throw new TypedBinaryWireError("body is not a valid Arrow IPC stream", {
      requestId: response.requestId,
      cause: error,
    });
  }
  const raw = table.schema.metadata?.get(TYPED_BINARY_WIRE_METADATA_KEY);
  if (raw === undefined) {
    throw new TypedBinaryWireError(
      `stream schema carries no "${TYPED_BINARY_WIRE_METADATA_KEY}" metadata`,
      { requestId: response.requestId },
    );
  }
  let metadata: WireMetadataJson;
  try {
    metadata = JSON.parse(raw) as WireMetadataJson;
  } catch (error) {
    throw new TypedBinaryWireError("stream metadata is not valid JSON", {
      requestId: response.requestId,
      cause: error,
    });
  }
  if (metadata.wireVersion !== TYPED_BINARY_WIRE_VERSION) {
    throw new TypedBinaryWireError(
      `unknown wire version ${metadata.wireVersion} (client supports ${TYPED_BINARY_WIRE_VERSION})`,
      { requestId: response.requestId },
    );
  }
  // §6.1 reader rules. Reader-artifact note: JS Arrow pads a zero-message
  // stream into one empty record batch, so a zero-entry metadata array is
  // validated as "every visible batch is empty" instead of exact count parity.
  const batches = table.batches;
  if (metadata.batches.length === 0) {
    if (table.numRows !== 0 || batches.some((batch) => batch.numRows !== 0)) {
      throw new TypedBinaryWireError(
        "metadata declares zero batches but the stream carries rows",
        { requestId: response.requestId },
      );
    }
  } else if (metadata.batches.length !== batches.length) {
    throw new TypedBinaryWireError(
      `batch count mismatch: metadata declares ${metadata.batches.length}, stream has ${batches.length}`,
      { requestId: response.requestId },
    );
  }
  for (const [index, entry] of metadata.batches.entries()) {
    const actual = batches[index]?.numRows ?? 0;
    if (entry.rowCount !== actual) {
      throw new TypedBinaryWireError(
        `batch ${index} row count mismatch: metadata declares ${entry.rowCount}, stream has ${actual}`,
        { requestId: response.requestId },
      );
    }
  }
  return { metadata, table };
}

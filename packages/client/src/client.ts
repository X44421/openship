import { API_VERSION } from "@stillflow/contracts";

import { DecodedTypedBinary, decodeTypedBinaryResponse } from "./arrow.js";
import {
  buildQueryString,
  makeEnvelope,
  makeRequestMeta,
  newRequestId,
  withPathParams,
} from "./envelope.js";
import {
  FeatureNotUnlockedError,
  HandshakeRequiredError,
  ProtocolIncompatibleError,
  StillflowApiError,
  StillflowClientError,
  normalizeApiError,
} from "./errors.js";
import {
  Transport,
  TransportResponse,
  readJsonEnvelope,
  resolvePath,
} from "./transport.js";

/**
 * `@stillflow/client` — transport, auth, error normalization, cancel/retry
 * (FE0-C2 §1). The typed surface below covers the unblocked sub-slices of
 * openship#22 (handshake / preview / artifact) plus the reserved interface
 * slots for run and events (openship#22 非目标; ledger rows L5/L6).
 *
 * Fail-closed handshake (FE0-C1 §3): before a successful handshake every
 * operation throws {@link HandshakeRequiredError}; after an incompatible
 * handshake every mutating operation throws
 * {@link ProtocolIncompatibleError} until a compatible handshake succeeds.
 * Read-only display paths stay available on an incompatible server so the
 * upgrade hint can be rendered against live data — they never fall back to
 * any local execution path.
 */

/** §5 default deadlines; client-owned policy (FE0-C1 §5, last row note). */
export interface ClientTimeouts {
  readonly handshakeMs: number;
  readonly previewMs: number;
  readonly artifactListMs: number;
  readonly artifactDetailMs: number;
}

const DEFAULT_TIMEOUTS: ClientTimeouts = {
  handshakeMs: 5_000, // §5: handshake/version 5s
  previewMs: 30_000, // §5: preview 30s (issue-050 deadline)
  artifactListMs: 15_000, // §5: artifact list/detail 15s
  artifactDetailMs: 15_000,
};

export interface StillflowClientOptions {
  /** Single workspace bound to the process (SVC-A1 §4.3). */
  readonly workspaceId: string;
  /** Optional authenticated principal (server authorization mode). */
  readonly principal?: { readonly kind: "member" | "serviceAccount"; readonly id: string };
  readonly timeouts?: Partial<ClientTimeouts>;
}

export type Compatibility =
  | { readonly status: "unverified" }
  | { readonly status: "compatible"; readonly selectedVersion: number }
  | { readonly status: "incompatible"; readonly serverVersion: number | null };

export interface HandshakeView {
  readonly selectedVersion: number;
  readonly manifest: Record<string, unknown>;
}

export interface HandshakeResult {
  readonly compatible: boolean;
  readonly view: HandshakeView;
  readonly hint?: string;
}

export interface PreviewAssetInput {
  readonly connectionId: string;
  readonly assetId: string;
  readonly rowLimit: number;
  readonly byteLimit: number;
  readonly timeoutSeconds?: number;
}

export interface PreviewEngineInput {
  /** Serialized `LogicalPlan` wire shape (from @stillflow/contracts types). */
  readonly plan: Record<string, unknown>;
  readonly targetNodeId: string;
  readonly connectionId: string;
  readonly assetId: string;
  readonly batchSize: number;
  readonly rowLimit: number;
  readonly byteLimit: number;
  readonly timeoutSeconds?: number;
}

export interface ArtifactContentInput {
  readonly bundleId: string;
  readonly artifactId: string;
  /** Kebab-case `ArtifactSectionId` (e.g. "validation-rule-summary"). */
  readonly sectionId: string;
  readonly afterPartitionSequence?: number;
  readonly maxRows: number;
  readonly maxBytes: number;
}

export interface PaginationInput {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface CallOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly idempotencyKey?: string;
  /** Correlated request id override; generated per request when omitted. */
  readonly requestId?: string;
}

export class StillflowClient {
  private compatibility: Compatibility = { status: "unverified" };
  private readonly timeouts: ClientTimeouts;

  constructor(
    private readonly transport: Transport,
    private readonly options: StillflowClientOptions,
  ) {
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
  }

  get state(): Compatibility {
    return this.compatibility;
  }

  /**
   * Session handshake (§5): validates the server contract version against the
   * generated contract. Reports the result and flips the client state; it
   * does not throw on incompatibility — subsequent operations do.
   */
  async handshake(input?: {
    requestedVersion?: number;
    signal?: AbortSignal;
  }): Promise<HandshakeResult> {
    const requestId = newRequestId();
    const meta = makeRequestMeta({
      workspaceId: this.options.workspaceId,
      principal: this.options.principal,
      requestId,
    });
    const body = { requestedVersion: input?.requestedVersion ?? API_VERSION };
    let response: TransportResponse;
    try {
      response = await this.transport.send({
        path: "/v1/handshake",
        method: "POST",
        body: JSON.stringify(makeEnvelope(meta, body)),
        signal: input?.signal,
        timeoutMs: this.timeouts.handshakeMs,
        requestId,
      });
    } catch (error) {
      if (error instanceof StillflowApiError && error.code === "unsupportedVersion") {
        return this.enterIncompatible(null, error.message, requestId);
      }
      throw error;
    }
    if (response.status !== 200) {
      const bytes = await response.bytes();
      const parsed = safeJson(bytes);
      const normalized = normalizeApiError(response.status, parsed);
      if (normalized.code === "unsupportedVersion") {
        return this.enterIncompatible(null, normalized.message, requestId);
      }
      throw normalized;
    }
    const parsed = await readJsonEnvelope<HandshakeView>(response);
    const selected = parsed.body.selectedVersion;
    if (typeof selected !== "number" || selected !== API_VERSION) {
      return this.enterIncompatible(selected ?? null, undefined, requestId);
    }
    this.compatibility = { status: "compatible", selectedVersion: selected };
    return { compatible: true, view: parsed.body };
  }

  /** POST preview routes (§5, 30s default) → decoded §6.1 Arrow stream. */
  async previewAsset(
    input: PreviewAssetInput,
    options?: CallOptions,
  ): Promise<DecodedTypedBinary> {
    this.requireVerified("asset.preview");
    return this.postStream(
      "/v1/assets/preview",
      withPathParams({}, {}),
      {
        connectionId: input.connectionId,
        assetId: input.assetId,
        rowLimit: input.rowLimit,
        byteLimit: input.byteLimit,
        timeoutSeconds: input.timeoutSeconds ?? null,
      },
      options,
      this.timeouts.previewMs,
    );
  }

  async previewEngine(
    input: PreviewEngineInput,
    options?: CallOptions,
  ): Promise<DecodedTypedBinary> {
    this.requireVerified("engine.preview");
    return this.postStream(
      "/v1/engine/preview",
      withPathParams({}, {}),
      {
        plan: input.plan,
        targetNodeId: input.targetNodeId,
        connectionId: input.connectionId,
        assetId: input.assetId,
        batchSize: input.batchSize,
        rowLimit: input.rowLimit,
        byteLimit: input.byteLimit,
        timeoutSeconds: input.timeoutSeconds ?? null,
      },
      options,
      this.timeouts.previewMs,
    );
  }

  /** GET artifact metadata page (§5, 15s default). */
  async artifactList(
    runId: string,
    page?: PaginationInput,
    options?: CallOptions,
  ): Promise<Record<string, unknown>> {
    this.requireVerified("artifact.list");
    return this.getJson(
      resolvePath("/v1/runs/{runId}/artifacts", { runId }),
      withPathParams(page ?? {}, {}),
      options,
      this.timeouts.artifactListMs,
    );
  }

  async artifactRead(
    artifactId: string,
    options?: CallOptions,
  ): Promise<Record<string, unknown>> {
    this.requireVerified("artifact.read");
    return this.getJson(
      resolvePath("/v1/artifacts/{objectId}", { objectId: artifactId }),
      withPathParams({}, {}),
      options,
      this.timeouts.artifactDetailMs,
    );
  }

  /** GET typed-binary content page (§6.1) — paged Arrow stream. */
  async artifactContent(
    input: ArtifactContentInput,
    options?: CallOptions,
  ): Promise<DecodedTypedBinary> {
    this.requireVerified("artifact.content");
    const response = await this.sendGet(
      "/v1/artifacts/content",
      {
        bundleId: input.bundleId,
        artifactId: input.artifactId,
        sectionId: input.sectionId,
        afterPartitionSequence: input.afterPartitionSequence ?? null,
        maxRows: input.maxRows,
        maxBytes: input.maxBytes,
      },
      options,
      this.timeouts.artifactDetailMs,
    );
    return this.streamOrThrow(response);
  }

  /**
   * Streaming export download (§5: 流式下载，不经浏览器内存整包；无默认超时).
   * The consumer owns the `ReadableStream`; nothing is buffered here.
   */
  async artifactDownload(
    exportId: string,
    options?: CallOptions,
  ): Promise<TransportResponse> {
    this.requireVerified("export.download");
    return this.sendGet(
      resolvePath("/v1/exports/{exportId}/download", { exportId }),
      withPathParams({}, {}),
      options,
      undefined,
    );
  }

  // -- Reserved interface slots (openship#22 非目标; ledger L5/L6). --------

  async runSubmit(_input: Record<string, never>): Promise<never> {
    throw this.notUnlocked("run", "L5");
  }

  async runStatus(_input: Record<string, never>): Promise<never> {
    throw this.notUnlocked("run", "L5");
  }

  async runCancel(_input: Record<string, never>): Promise<never> {
    throw this.notUnlocked("run", "L5");
  }

  async eventsStream(_input: Record<string, never>): Promise<never> {
    throw this.notUnlocked("events", "L6");
  }

  async eventsResume(_input: Record<string, never>): Promise<never> {
    throw this.notUnlocked("events", "L6");
  }

  // -- Internals -----------------------------------------------------------

  private notUnlocked(feature: "run" | "events", ledgerRow: string): FeatureNotUnlockedError {
    return new FeatureNotUnlockedError(feature, `X44421/openship ledger ${ledgerRow}`);
  }

  private requireVerified(operation: string): void {
    if (this.compatibility.status === "unverified") {
      throw new HandshakeRequiredError(
        `handshake has not succeeded yet; refusing "${operation}" (FE0-C1 §3 fail-closed)`,
      );
    }
    if (this.compatibility.status === "incompatible") {
      throw new ProtocolIncompatibleError(
        `server contract version is incompatible; "${operation}" is refused`,
        {
          expectedVersion: API_VERSION,
          serverVersion: this.compatibility.serverVersion,
          hint: "upgrade the StillFlow server to a version speaking the client's generated contract",
        },
      );
    }
  }

  private enterIncompatible(
    serverVersion: number | null,
    serverMessage: string | undefined,
    requestId: string,
  ): HandshakeResult {
    this.compatibility = { status: "incompatible", serverVersion };
    return {
      compatible: false,
      view: { selectedVersion: serverVersion ?? -1, manifest: {} },
      hint:
        serverMessage ??
        "server contract version is not compatible with this client; upgrade the server",
    };
  }

  private meta(options?: CallOptions) {
    return makeRequestMeta({
      workspaceId: this.options.workspaceId,
      principal: this.options.principal,
      requestId: options?.requestId,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  private async sendPost(
    path: string,
    pathParams: Record<string, string>,
    body: Record<string, unknown>,
    options: CallOptions | undefined,
    timeoutMs: number | undefined,
  ): Promise<TransportResponse> {
    const meta = this.meta(options);
    const merged = withPathParams(body, pathParams);
    return this.transport.send({
      path,
      method: "POST",
      body: JSON.stringify(makeEnvelope(meta, merged)),
      signal: options?.signal,
      timeoutMs,
      requestId: meta.requestId,
    });
  }

  private async sendGet(
    path: string,
    body: object,
    options: CallOptions | undefined,
    timeoutMs: number | undefined,
  ): Promise<TransportResponse> {
    const meta = this.meta(options);
    return this.transport.send({
      path,
      method: "GET",
      query: buildQueryString(meta, body),
      signal: options?.signal,
      timeoutMs,
      requestId: meta.requestId,
    });
  }

  private async postStream(
    path: string,
    pathParams: Record<string, string>,
    body: Record<string, unknown>,
    options: CallOptions | undefined,
    timeoutMs: number,
  ): Promise<DecodedTypedBinary> {
    const response = await this.sendPost(path, pathParams, body, options, timeoutMs);
    return this.streamOrThrow(response);
  }

  private async getJson(
    path: string,
    body: object,
    options: CallOptions | undefined,
    timeoutMs: number,
  ): Promise<Record<string, unknown>> {
    const response = await this.sendGet(path, body, options, timeoutMs);
    const parsed = await readJsonEnvelope<Record<string, unknown>>(response);
    return parsed.body;
  }

  private async streamOrThrow(response: TransportResponse): Promise<DecodedTypedBinary> {
    if (response.status !== 200) {
      const bytes = await response.bytes();
      const parsed = safeJson(bytes);
      throw normalizeApiError(response.status, parsed);
    }
    return decodeTypedBinaryResponse(response);
  }
}

function safeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export { StillflowApiError, StillflowClientError };

import {
  TransportFailureError,
  normalizeApiError,
} from "./errors.js";

/**
 * Transport boundary (FE0-C1 §5): raw request/response IO only. All envelope
 * construction, carrying rules, error normalization, and deadline policy live
 * in the shared client core, so the Web-remote and Desktop-local transports
 * are equivalent by construction — the §5 table's 差异栏 is structurally
 * empty. The Desktop IPC channel itself is FE4-D1; until then the desktop
 * transport is driven by an injected {@link DesktopIpcBridge}.
 */

export type TransportMethod = "GET" | "POST";

export interface TransportRequest {
  /** Fully resolved path (path parameters already substituted). */
  readonly path: string;
  readonly method: TransportMethod;
  /** Serialized JSON envelope body (POST routes only). */
  readonly body?: string;
  /** Encoded query string (GET routes, SVC-A1 §3.3 reassembly). */
  readonly query?: string;
  /** Cancellation signal; aborts propagate to the in-flight request. */
  readonly signal?: AbortSignal;
  /** Deadline in milliseconds; the transport enforces it. */
  readonly timeoutMs?: number;
  /** Correlation id, surfaced in transport failures. */
  readonly requestId?: string;
}

export interface TransportResponse {
  readonly status: number;
  readonly contentType: string;
  readonly requestId?: string;
  /** Fully-buffered body (JSON envelopes). */
  bytes(): Promise<Uint8Array>;
  /** Streaming body (typed-binary / download routes) — never fully buffered. */
  stream(): ReadableStream<Uint8Array>;
}

export interface Transport {
  send(request: TransportRequest): Promise<TransportResponse>;
}

/** Raw IO bridge for the Desktop-local transport (channel wiring = FE4-D1). */
export interface DesktopIpcBridge {
  send(request: TransportRequest): Promise<TransportResponse>;
}

/** Web-remote HTTP transport over `fetch`. */
export class WebHttpTransport implements Transport {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl: string; fetchImpl?: typeof fetch }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async send(request: TransportRequest): Promise<TransportResponse> {
    const url = `${this.baseUrl}${request.path}${request.query ? `?${request.query}` : ""}`;
    const controller = new AbortController();
    const timeoutSignal =
      request.timeoutMs === undefined ? undefined : AbortSignal.timeout(request.timeoutMs);
    const signals: AbortSignal[] = [controller.signal];
    if (request.signal) signals.push(request.signal);
    if (timeoutSignal) signals.push(timeoutSignal);
    const signal =
      typeof AbortSignal.any === "function"
        ? AbortSignal.any(signals)
        : combineSignalsManually(controller, signals, request.requestId);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: request.method,
        headers:
          request.method === "POST"
            ? { "content-type": "application/json" }
            : undefined,
        body: request.body,
        signal,
      });
    } catch (error) {
      const aborted = (request.signal?.aborted ?? false) || controller.signal.aborted;
      const timedOut =
        !aborted &&
        (timeoutSignal?.aborted ?? false) &&
        (isTimeoutError(error) || timeoutSignal?.reason === undefined);
      throw transportFailure(error, request, { aborted, timedOut });
    }
    return toTransportResponse(response, request);
  }
}

/**
 * Desktop-local transport: identical envelope/error/cancellation semantics,
 * different raw IO (injected bridge; the concrete IPC channel is FE4-D1).
 */
export class DesktopLocalTransport implements Transport {
  constructor(private readonly bridge: DesktopIpcBridge) {}

  send(request: TransportRequest): Promise<TransportResponse> {
    return this.bridge.send(request);
  }
}

async function toTransportResponse(
  response: Response,
  request: TransportRequest,
): Promise<TransportResponse> {
  const requestId = response.headers.get("x-request-id") ?? request.requestId;
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    requestId,
    bytes: async () => {
      try {
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        throw transportFailure(error, request, {
          aborted: request.signal?.aborted === true,
          timedOut: false,
        });
      }
    },
    stream: () => {
      if (response.body === null) {
        throw new TransportFailureError("response carries no body stream", {
          requestId,
        });
      }
      return response.body as ReadableStream<Uint8Array>;
    },
  };
}

function transportFailure(
  error: unknown,
  request: TransportRequest,
  flags: { aborted: boolean; timedOut: boolean },
): TransportFailureError {
  if (error instanceof TransportFailureError) return error;
  return new TransportFailureError(
    flags.timedOut
      ? `request timed out after ${request.timeoutMs}ms: ${request.method} ${request.path}`
      : `transport failure: ${request.method} ${request.path}`,
    {
      requestId: request.requestId,
      timedOut: flags.timedOut,
      aborted: flags.aborted,
      cause: error,
    },
  );
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

interface Combiner {
  signal: AbortSignal;
}

function combineSignalsManually(
  controller: AbortController,
  signals: AbortSignal[],
  requestId: string | undefined,
): AbortSignal {
  for (const signal of signals) {
    if (signal === controller.signal) continue;
    signal.addEventListener(
      "abort",
      () => {
        const reason =
          signal.reason ??
          new TransportFailureError("request aborted", {
            requestId,
            aborted: true,
          });
        controller.abort(reason);
      },
      { once: true },
    );
  }
  return controller.signal;
}

/** Reads a JSON envelope response; non-2xx normalizes into typed errors. */
export async function readJsonEnvelope<T>(
  response: TransportResponse,
): Promise<{ status: number; body: T; requestId?: string }> {
  const bytes = await response.bytes();
  const requestId = response.requestId;
  if (response.status < 200 || response.status >= 300) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      parsed = null;
    }
    throw normalizeApiError(response.status, parsed);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new TransportFailureError("response body is not valid JSON", {
      requestId,
      cause: error,
    });
  }
  const envelope = parsed as { meta?: { requestId?: string }; body?: T };
  return { status: response.status, body: envelope.body as T, requestId: envelope.meta?.requestId ?? requestId };
}

/** Resolves `{placeholder}` segments in a manifest path. */
export function resolvePath(
  path: string,
  params: Record<string, string>,
): string {
  return path.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`path parameter "${name}" missing for ${path}`);
    }
    return encodeURIComponent(value);
  });
}

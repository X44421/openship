import { API_VERSION, RequestMetadata, RequestPrincipal } from "@stillflow/contracts";

/**
 * Envelope construction for the SVC-A1 transport contract.
 *
 * - POST manifest routes carry the full `ApiRequest<T>` envelope as the JSON
 *   body (SVC-A1 §3.3).
 * - GET manifest routes reassemble the envelope from query parameters: the
 *   meta keys plus the top-level body fields by their camelCase names. The
 *   server JSON-parses each value when possible and otherwise takes it as a
 *   raw string, so the client sends strings raw (never quoted) and every
 *   non-string value JSON-encoded. `fetch()` forbids GET bodies, which is why
 *   this rule exists (SVC-A1 §3.3).
 */

/** Meta keys reassembled into the envelope by the server (SVC-A1 §3.3). */
const META_KEYS = ["apiVersion", "requestId", "workspaceId", "idempotencyKey", "principal"] as const;

export interface RequestMetaInput {
  readonly workspaceId: string;
  /** Correlation id; generated per request when omitted. */
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly principal?: RequestPrincipal;
}

/** Builds the frozen `RequestMetadata` (version constant from @stillflow/contracts). */
export function makeRequestMeta(input: RequestMetaInput): RequestMetadata {
  const meta: RequestMetadata = {
    apiVersion: API_VERSION,
    requestId: input.requestId ?? newRequestId(),
    workspaceId: input.workspaceId,
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.principal !== undefined ? { principal: input.principal } : {}),
  };
  return meta;
}

/** Per-request correlation id (trace id贯穿 FE0-C1 §3). */
export function newRequestId(): string {
  if (globalThis.crypto === undefined) {
    throw new Error("crypto.randomUUID is unavailable in this runtime");
  }
  return globalThis.crypto.randomUUID();
}

export interface ApiRequestWire<T> {
  readonly meta: RequestMetadata;
  readonly body: T;
}

/** Full POST envelope (SVC-A1 §3.3 non-GET carrying rule). */
export function makeEnvelope<T>(meta: RequestMetadata, body: T): ApiRequestWire<T> {
  return { meta, body };
}

function isMetaKey(key: string): key is (typeof META_KEYS)[number] {
  return (META_KEYS as readonly string[]).includes(key);
}

function encodeQueryValue(value: unknown): string {
  // Strings go raw (the server takes them as strings); every other JSON
  // value goes JSON-encoded so the server's "JSON-parsed when possible"
  // reassembly (loose_value) reconstructs it exactly. encodeURIComponent —
  // not URLSearchParams — because the server maps '+' to a space before
  // JSON parsing, which would corrupt JSON payloads.
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return encodeURIComponent(text);
}

/**
 * Reassembles a GET query string from the envelope meta keys plus the
 * top-level body fields (SVC-A1 §3.3). `undefined` fields are omitted;
 * `null` is sent as JSON `null` (the server preserves it).
 */
export function buildQueryString(
  meta: RequestMetadata,
  body: object,
): string {
  const pairs: string[] = [];
  const metaRecord = meta as unknown as Record<string, unknown>;
  for (const key of META_KEYS) {
    const value = metaRecord[key];
    if (value === undefined) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeQueryValue(value)}`);
  }
  for (const [key, value] of Object.entries(body)) {
    if (isMetaKey(key)) {
      throw new Error(`body field "${key}" collides with an envelope meta key (§3.3)`);
    }
    if (value === undefined) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeQueryValue(value)}`);
  }
  return pairs.join("&");
}

/**
 * Manifest path parameters are injected into the body object as strings
 * (SVC-A1 §3.3: "manifest 路径参数注入 body") and override same-named body
 * fields, matching the adapter's insert-after-body order in
 * `parse_body`/`parse_query_envelope`.
 */
export function withPathParams<T extends object>(
  body: T,
  pathParams: Record<string, string>,
): T {
  return { ...body, ...pathParams } as T;
}

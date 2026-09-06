import { ApiErrorCode, API_ERROR_HTTP_STATUS } from "@stillflow/contracts";

/**
 * Typed error surface (FE0-C1 §3): the server `code`/`message` pair is the
 * authoritative error contract and the HTTP status is advisory (SVC-A1 §3.2),
 * so normalization keys on the code, never on the status. Unknown codes are
 * treated as server errors and passed through verbatim — never reinterpreted
 * locally (FE0-C1 §3).
 *
 * Every error carries the correlation id (`requestId`) the client assigned to
 * the request, echoed by the server response/error envelope.
 */

export class StillflowClientError extends Error {
  /** Correlation id from the envelope meta (echoed by the server). */
  readonly requestId?: string;

  constructor(
    message: string,
    options?: { requestId?: string; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.requestId = options?.requestId;
  }
}

/** Network-level failure: connection loss, reset, timeout, or abort. */
export class TransportFailureError extends StillflowClientError {
  readonly timedOut: boolean;
  readonly aborted: boolean;

  constructor(
    message: string,
    options: { requestId?: string; timedOut?: boolean; aborted?: boolean; cause?: unknown },
  ) {
    super(message, options);
    this.timedOut = options.timedOut ?? false;
    this.aborted = options.aborted ?? false;
  }
}

/** Handshake has not succeeded yet; every operation is refused (FE0-C1 §3). */
export class HandshakeRequiredError extends StillflowClientError {}

/**
 * Handshake fail-closed (FE0-C1 §3/§7): the server contract version is not
 * compatible with the generated contract this client was built against. All
 * mutating operations stay disabled until a compatible handshake succeeds.
 */
export class ProtocolIncompatibleError extends StillflowClientError {
  readonly expectedVersion: number;
  readonly serverVersion: number | null;
  readonly hint: string;

  constructor(
    message: string,
    options: {
      requestId?: string;
      expectedVersion: number;
      serverVersion: number | null;
      hint: string;
    },
  ) {
    super(message, options);
    this.expectedVersion = options.expectedVersion;
    this.serverVersion = options.serverVersion;
    this.hint = options.hint;
  }
}

/**
 * Reserved interface slot for a sub-slice whose upstream dependency row is
 * not yet unlocked in the cross-repo dependency ledger (openship#22 非目标).
 */
export class FeatureNotUnlockedError extends StillflowClientError {
  readonly feature: "run" | "events";
  readonly ledgerRow: string;

  constructor(
    feature: "run" | "events",
    ledgerRow: string,
    options?: { requestId?: string },
  ) {
    super(
      `feature "${feature}" is a reserved interface slot; upstream dependency not unlocked (ledger ${ledgerRow})`,
      options,
    );
    this.feature = feature;
    this.ledgerRow = ledgerRow;
  }
}

/** Base for every normalized server error envelope. */
export class StillflowApiError extends StillflowClientError {
  /** Verbatim server code string (`ApiErrorCode` when known). */
  readonly code: string;
  /** Advisory; never used for classification (SVC-A1 §3.2). */
  readonly httpStatus?: number;

  constructor(
    message: string,
    options: { code: string; httpStatus?: number; requestId?: string; cause?: unknown },
  ) {
    super(message, options);
    this.code = options.code;
    this.httpStatus = options.httpStatus;
  }
}

export class UnsupportedVersionError extends StillflowApiError {}
export class InvalidRequestError extends StillflowApiError {}
export class NotFoundError extends StillflowApiError {}
export class ConflictError extends StillflowApiError {}
export class LimitExceededError extends StillflowApiError {}
export class UnauthorizedError extends StillflowApiError {}
export class InternalServerError extends StillflowApiError {}

/** Unknown server code: passed through verbatim, never reinterpreted (FE0-C1 §3). */
export class UnknownServerError extends StillflowApiError {}

const CODE_CLASSES: Record<ApiErrorCode, new (...args: ConstructorParameters<typeof StillflowApiError>) => StillflowApiError> = {
  unsupportedVersion: UnsupportedVersionError,
  invalidRequest: InvalidRequestError,
  notFound: NotFoundError,
  conflict: ConflictError,
  limitExceeded: LimitExceededError,
  unauthorized: UnauthorizedError,
  internal: InternalServerError,
};

/** Structural shape of the frozen `ApiErrorResponse` envelope. */
export interface ApiErrorEnvelope {
  readonly meta?: { readonly requestId?: string };
  readonly error?: { readonly code?: string; readonly message?: string };
}

/**
 * Normalizes one `ApiErrorResponse` body + advisory status into the typed
 * error hierarchy. Known codes map to their classes regardless of the status
 * (the status is advisory); unknown codes fall through to
 * {@link UnknownServerError} with the server code and message preserved.
 */
export function normalizeApiError(
  httpStatus: number,
  body: unknown,
): StillflowApiError {
  const envelope = (body ?? {}) as ApiErrorEnvelope;
  const requestId = envelope.meta?.requestId;
  const code = envelope.error?.code;
  const message = envelope.error?.message ?? "server returned an error envelope";
  if (typeof code !== "string" || code.length === 0) {
    return new UnknownServerError(
      message,
      { code: "<missing>", httpStatus, requestId },
    );
  }
  const known = (API_ERROR_HTTP_STATUS as Record<string, number>)[code] !== undefined;
  const ctor = known
    ? CODE_CLASSES[code as ApiErrorCode]
    : UnknownServerError;
  return new ctor(message, { code, httpStatus, requestId });
}

export { API_ERROR_HTTP_STATUS };

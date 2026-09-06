import { TYPED_BINARY_MEDIA_TYPE } from "@stillflow/contracts";
import type { Transport, TransportRequest, TransportResponse } from "./transport.js";
import { TransportFailureError } from "./errors.js";

/** Shared test doubles: a scripted transport plus canned responses. */

export class MockTransport implements Transport {
  readonly requests: TransportRequest[] = [];

  constructor(
    private readonly responder: (
      request: TransportRequest,
      index: number,
    ) => TransportResponse | Promise<TransportResponse>,
  ) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const index = this.requests.push(request) - 1;
    return this.responder(request, index);
  }
}

export function jsonResponse(
  status: number,
  body: unknown,
  requestId?: string,
): TransportResponse {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return {
    status,
    contentType: "application/json",
    requestId,
    bytes: async () => bytes,
    stream: () => new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

export function binaryResponse(
  status: number,
  contentType: string,
  bytes: Uint8Array,
  requestId?: string,
): TransportResponse {
  return {
    status,
    contentType,
    requestId,
    bytes: async () => bytes,
    stream: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
  };
}

export const ARROW_MEDIA_TYPE = TYPED_BINARY_MEDIA_TYPE;

export function errorEnvelope(
  requestId: string,
  code: string,
  message: string,
): unknown {
  return {
    meta: { apiVersion: 1, requestId },
    error: { code, message },
  };
}

export function transportFailure(request: TransportRequest): TransportFailureError {
  return new TransportFailureError(`connection lost: ${request.method} ${request.path}`, {
    requestId: request.requestId,
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API_VERSION } from "@stillflow/contracts";

import { StillflowClient } from "./client.js";
import {
  FeatureNotUnlockedError,
  HandshakeRequiredError,
  ProtocolIncompatibleError,
  TransportFailureError,
} from "./errors.js";
import { TypedBinaryWireError } from "./arrow.js";
import { newRequestId } from "./envelope.js";
import {
  ARROW_MEDIA_TYPE,
  MockTransport,
  binaryResponse,
  errorEnvelope,
  jsonResponse,
  transportFailure,
} from "./test-support.js";
import { WebHttpTransport, type TransportResponse } from "./transport.js";

const FIXTURES = join(__dirname, "..", "tests", "fixtures");
const WORKSPACE = "00000000-0000-0000-0000-00000000c0ff";
const REQUEST_ID = "11111111-2222-3333-4444-555555555555";

const fixtureArrow = () =>
  new Uint8Array(readFileSync(join(FIXTURES, "asset-preview.arrow")));

function compatibleHandshake() {
  return jsonResponse(
    200,
    {
      meta: { apiVersion: API_VERSION, requestId: REQUEST_ID },
      body: { selectedVersion: API_VERSION, manifest: { apiVersion: API_VERSION } },
    },
    REQUEST_ID,
  );
}

function client(transport: MockTransport) {
  return new StillflowClient(transport, { workspaceId: WORKSPACE });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("handshake fail-closed (FE0-C1 §3)", () => {
  it("refuses every operation before a handshake", async () => {
    const transport = new MockTransport(() => {
      throw new Error("must not be called before handshake");
    });
    const c = client(transport);
    await expect(c.previewAsset({ connectionId: "x", assetId: "y", rowLimit: 10, byteLimit: 10 }))
      .rejects.toBeInstanceOf(HandshakeRequiredError);
    expect(transport.requests).toHaveLength(0);
  });

  it("marks the client compatible when the server speaks the generated contract version", async () => {
    const transport = new MockTransport((request, index) => {
      if (index === 0) {
        // The handshake POST carries the full envelope with the generated version.
        expect(request.path).toBe("/v1/handshake");
        const envelope = JSON.parse(request.body ?? "{}");
        expect(envelope.meta.apiVersion).toBe(API_VERSION);
        expect(envelope.body.requestedVersion).toBe(API_VERSION);
        return compatibleHandshake();
      }
      return binaryResponse(200, ARROW_MEDIA_TYPE, fixtureArrow(), REQUEST_ID);
    });
    const c = client(transport);
    const result = await c.handshake();
    expect(result.compatible).toBe(true);
    expect(c.state).toEqual({ status: "compatible", selectedVersion: API_VERSION });
    // A read path works after a compatible handshake.
    const decoded = await c.previewAsset({
      connectionId: "00000000-0000-0000-0000-00000000a001",
      assetId: "00000000-0000-0000-0000-00000000a002",
      rowLimit: 100,
      byteLimit: 1048576,
    });
    expect(decoded.metadata.batches.map((b) => b.rowCount)).toEqual([2, 1]);
  });

  it("fails closed with an upgrade hint when the server is on another version", async () => {
    const transport = new MockTransport(() =>
      jsonResponse(
        200,
        {
          meta: { apiVersion: 2, requestId: REQUEST_ID },
          body: { selectedVersion: 2, manifest: { apiVersion: 2 } },
        },
        REQUEST_ID,
      ),
    );
    const c = client(transport);
    const result = await c.handshake();
    expect(result.compatible).toBe(false);
    expect(c.state).toEqual({ status: "incompatible", serverVersion: 2 });
    // Mutating operations are disabled...
    await expect(
      c.artifactContent({
        bundleId: "00000000-0000-0000-0000-00000000b001",
        artifactId: "00000000-0000-0000-0000-00000000b002",
        sectionId: "validation-rule-summary",
        maxRows: 100,
        maxBytes: 1048576,
      }),
    ).rejects.toMatchObject({
      expectedVersion: API_VERSION,
      serverVersion: 2,
    });
    await expect(
      c.previewAsset({ connectionId: "x", assetId: "y", rowLimit: 1, byteLimit: 1 }),
    ).rejects.toBeInstanceOf(ProtocolIncompatibleError);
    // ...and no request left the client after the failed handshake.
    expect(transport.requests).toHaveLength(1);
  });

  it("fails closed when the server rejects the requested version (unsupportedVersion)", async () => {
    const transport = new MockTransport(() =>
      jsonResponse(
        400,
        errorEnvelope(REQUEST_ID, "unsupportedVersion", "server speaks v1 only"),
        REQUEST_ID,
      ),
    );
    const c = client(transport);
    const result = await c.handshake();
    expect(result.compatible).toBe(false);
    expect(result.hint).toContain("v1 only");
    expect(c.state).toEqual({ status: "incompatible", serverVersion: null });
    await expect(
      c.artifactList("00000000-0000-0000-0000-00000000c001"),
    ).rejects.toBeInstanceOf(ProtocolIncompatibleError);
  });
});

describe("reserved interface slots (openship#22 非目标; ledger L5/L6)", () => {
  it("exposes typed not-unlocked errors for run and events", async () => {
    const c = client(new MockTransport(() => compatibleHandshake()));
    await c.handshake();
    await expect(c.runSubmit({})).rejects.toMatchObject({
      feature: "run",
      ledgerRow: "X44421/openship ledger L5",
    });
    await expect(c.runStatus({})).rejects.toBeInstanceOf(FeatureNotUnlockedError);
    await expect(c.runCancel({})).rejects.toBeInstanceOf(FeatureNotUnlockedError);
    await expect(c.eventsStream({})).rejects.toMatchObject({
      feature: "events",
      ledgerRow: "X44421/openship ledger L6",
    });
    await expect(c.eventsResume({})).rejects.toBeInstanceOf(FeatureNotUnlockedError);
  });
});

describe("cancellation and deadlines (§5, WebHttpTransport)", () => {
  it("propagates abort into a typed transport failure", async () => {
    const controller = new AbortController();
    const hanging = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const transport = new WebHttpTransport({
      baseUrl: "http://127.0.0.1:9",
      fetchImpl: hanging as unknown as typeof fetch,
    });
    const c = new StillflowClient(transport, {
      workspaceId: WORKSPACE,
      timeouts: { handshakeMs: 10_000 },
    });
    const pending = c.handshake({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({
      aborted: true,
      timedOut: false,
    });
  });

  it("enforces the §5 deadline as a typed timeout", async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const timedOut =
            init.signal?.reason instanceof DOMException && init.signal.reason.name === "TimeoutError";
          reject(
            timedOut
              ? new DOMException("timed out", "TimeoutError")
              : new DOMException("aborted", "AbortError"),
          );
        });
      });
    const transport = new WebHttpTransport({
      baseUrl: "http://127.0.0.1:9",
      fetchImpl: hanging,
    });
    const c = new StillflowClient(transport, {
      workspaceId: WORKSPACE,
      timeouts: { handshakeMs: 20 },
    });
    await expect(c.handshake()).rejects.toMatchObject({ timedOut: true });
  });
});

describe("disconnect recovery and idempotency (§5)", () => {
  it("replays a safe GET after a connection loss without duplicating state", async () => {
    let calls = 0;
    const transport = new MockTransport((request) => {
      if (request.path === "/v1/handshake") return compatibleHandshake();
      calls += 1;
      if (calls === 1) throw transportFailure(request);
      return jsonResponse(
        200,
        { meta: { apiVersion: API_VERSION, requestId: REQUEST_ID }, body: { runs: [], next: null } },
        REQUEST_ID,
      );
    });
    const c = client(transport);
    await c.handshake();
    // Pin the correlation id so the replay is byte-identical on the wire.
    const requestId = newRequestId();
    // First attempt loses the connection mid-flight...
    await expect(
      c.artifactList("00000000-0000-0000-0000-00000000d001", { limit: 10 }, { requestId }),
    ).rejects.toBeInstanceOf(TransportFailureError);
    // ...and the caller-owned replay is byte-identical: same query, no side
    // effects (idempotent read; mutations dedup server-side via the key).
    const page = await c.artifactList(
      "00000000-0000-0000-0000-00000000d001",
      { limit: 10 },
      { requestId },
    );
    expect(page).toEqual({ runs: [], next: null });
    expect(transport.requests[1].query).toBe(transport.requests[2].query);
    expect(calls).toBe(2);
  });

  it("keeps the idempotency key stable across submit retries (dedup is server-owned)", async () => {
    const transport = new MockTransport((request) => {
      if (request.path === "/v1/handshake") return compatibleHandshake();
      return jsonResponse(
        200,
        { meta: { apiVersion: API_VERSION, requestId: REQUEST_ID }, body: {} },
        REQUEST_ID,
      );
    });
    const c = client(transport);
    await c.handshake();
    void c; // The reserved runSubmit slot refuses by design; envelope-level
    // idempotency is asserted on the wire: a retried POST with the same key
    // produces the identical envelope bytes.
    const { makeEnvelope, makeRequestMeta } = await import("./envelope.js");
    const meta = makeRequestMeta({ workspaceId: WORKSPACE, idempotencyKey: "dedup-1" });
    const first = JSON.stringify(makeEnvelope(meta, { jobId: "j-1" }));
    const meta2 = makeRequestMeta({
      workspaceId: WORKSPACE,
      idempotencyKey: "dedup-1",
      requestId: meta.requestId,
    });
    const second = JSON.stringify(makeEnvelope(meta2, { jobId: "j-1" }));
    expect(second).toBe(first);
  });

  it("surfaces a mid-stream disconnect as a typed failure (recovery is cursor-based)", async () => {
    const transport = new MockTransport((request) => {
      if (request.path === "/v1/handshake") return compatibleHandshake();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const bytes = fixtureArrow();
          controller.enqueue(bytes.slice(0, 100));
          controller.error(new Error("connection reset"));
        },
      });
      const response: TransportResponse = {
        status: 200,
        contentType: ARROW_MEDIA_TYPE,
        requestId: REQUEST_ID,
        bytes: async () => {
          throw new TransportFailureError("connection reset mid-stream", { requestId: REQUEST_ID });
        },
        stream: () => stream,
      };
      return response;
    });
    const c = client(transport);
    await c.handshake();
    await expect(
      c.previewAsset({ connectionId: "x", assetId: "y", rowLimit: 10, byteLimit: 10 }),
    ).rejects.toBeInstanceOf(TypedBinaryWireError);
  });
});

describe("GET carrying rule over the wire (SVC-A1 §3.3)", () => {
  it("sends pagination as reassembled query parameters", async () => {
    const transport = new MockTransport((request) => {
      if (request.path === "/v1/handshake") return compatibleHandshake();
      expect(request.method).toBe("GET");
      expect(request.query).toContain("limit=10");
      expect(request.query).toContain(`workspaceId=${WORKSPACE}`);
      expect(request.body).toBeUndefined();
      return jsonResponse(
        200,
        { meta: { apiVersion: API_VERSION, requestId: REQUEST_ID }, body: { runs: [] } },
        REQUEST_ID,
      );
    });
    const c = client(transport);
    await c.handshake();
    await c.artifactList("00000000-0000-0000-0000-00000000d001", { limit: 10 });
  });
});

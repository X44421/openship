import { describe, expect, it } from "vitest";

import {
  buildQueryString,
  makeEnvelope,
  makeRequestMeta,
  newRequestId,
  withPathParams,
} from "./envelope.js";
import { API_VERSION } from "@stillflow/contracts";

const WORKSPACE = "00000000-0000-0000-0000-00000000c0ff";

describe("request metadata (SVC-A1 §3.3 envelope)", () => {
  it("carries the generated contract version as the single source", () => {
    const meta = makeRequestMeta({ workspaceId: WORKSPACE });
    expect(meta.apiVersion).toBe(API_VERSION);
    expect(meta.workspaceId).toBe(WORKSPACE);
  });

  it("generates a distinct correlation id per request and honors overrides", () => {
    const first = makeRequestMeta({ workspaceId: WORKSPACE });
    const second = makeRequestMeta({ workspaceId: WORKSPACE });
    expect(first.requestId).not.toEqual(second.requestId);
    expect(first.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const overridden = makeRequestMeta({
      workspaceId: WORKSPACE,
      requestId: "11111111-2222-3333-4444-555555555555",
    });
    expect(overridden.requestId).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("newRequestId is unique across calls", () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });
});

describe("GET query reassembly (SVC-A1 §3.3 carrying rule)", () => {
  it("emits meta keys first, then body fields, strings raw", () => {
    const meta = makeRequestMeta({
      workspaceId: WORKSPACE,
      requestId: "11111111-2222-3333-4444-555555555555",
    });
    const query = buildQueryString(meta, { limit: 25, filter: "alpha beta" });
    expect(query).toBe(
      `apiVersion=${API_VERSION}` +
        `&requestId=11111111-2222-3333-4444-555555555555` +
        `&workspaceId=${WORKSPACE}` +
        `&limit=25&filter=alpha%20beta`,
    );
  });

  it("JSON-encodes non-string values so the server's loose_value round-trips", () => {
    const meta = makeRequestMeta({ workspaceId: WORKSPACE });
    const query = buildQueryString(meta, {
      flags: null,
      nested: { afterPartitionSequence: null },
      enabled: true,
    });
    expect(query).toContain("flags=null");
    expect(query).toContain(encodeURIComponent(JSON.stringify({ afterPartitionSequence: null })));
    expect(query).toContain("enabled=true");
  });

  it("keeps JSON-looking strings raw (server takes them as strings)", () => {
    const meta = makeRequestMeta({ workspaceId: WORKSPACE });
    const query = buildQueryString(meta, { label: "123", note: '{"a":1}' });
    expect(query).toContain(`label=123`);
    expect(query).toContain(encodeURIComponent('{"a":1}'));
  });

  it("percent-encodes '+' so the server's space mapping cannot corrupt payloads", () => {
    const meta = makeRequestMeta({ workspaceId: WORKSPACE });
    const query = buildQueryString(meta, { note: "a+b" });
    expect(query).toContain("note=a%2Bb");
  });

  it("refuses body fields that collide with meta keys", () => {
    const meta = makeRequestMeta({ workspaceId: WORKSPACE });
    expect(() => buildQueryString(meta, { workspaceId: "x" })).toThrow(/collides/);
  });

  it("carries the optional idempotency key in meta, not body", () => {
    const meta = makeRequestMeta({
      workspaceId: WORKSPACE,
      idempotencyKey: "svc-a1-dedup-1",
    });
    const query = buildQueryString(meta, {});
    expect(query).toContain("idempotencyKey=svc-a1-dedup-1");
  });
});

describe("POST envelope + path parameter injection", () => {
  it("wraps the body under the frozen meta/body envelope", () => {
    const meta = makeRequestMeta({ workspaceId: WORKSPACE });
    const envelope = makeEnvelope(meta, { requestedVersion: API_VERSION });
    expect(envelope).toEqual({
      meta,
      body: { requestedVersion: API_VERSION },
    });
  });

  it("manifest path parameters override same-named body fields (adapter order)", () => {
    const merged = withPathParams({ objectId: "from-body" }, { objectId: "from-path" });
    expect(merged.objectId).toBe("from-path");
  });
});

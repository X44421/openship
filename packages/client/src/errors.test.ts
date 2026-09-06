import { describe, expect, it } from "vitest";

import {
  ConflictError,
  InternalServerError,
  InvalidRequestError,
  LimitExceededError,
  NotFoundError,
  StillflowApiError,
  UnknownServerError,
  UnsupportedVersionError,
  UnauthorizedError,
  normalizeApiError,
} from "./errors.js";

const CASES: readonly [
  code: string,
  cls: new (...args: ConstructorParameters<typeof StillflowApiError>) => StillflowApiError,
][] = [
  ["unsupportedVersion", UnsupportedVersionError],
  ["invalidRequest", InvalidRequestError],
  ["notFound", NotFoundError],
  ["conflict", ConflictError],
  ["limitExceeded", LimitExceededError],
  ["unauthorized", UnauthorizedError],
  ["internal", InternalServerError],
];

describe("typed error normalization (SVC-A1 §3.2 + FE0-C1 §3)", () => {
  for (const [code, cls] of CASES) {
    it(`maps "${code}" to ${cls.name} with the request id echoed`, () => {
      const error = normalizeApiError(599, {
        meta: { apiVersion: 1, requestId: "11111111-2222-3333-4444-555555555555" },
        error: { code, message: "server says so" },
      });
      expect(error).toBeInstanceOf(cls);
      expect(error.code).toBe(code);
      expect(error.message).toBe("server says so");
      // The HTTP status is advisory (SVC-A1 §3.2) — recorded, never classified.
      expect(error.httpStatus).toBe(599);
      expect(error.requestId).toBe("11111111-2222-3333-4444-555555555555");
    });
  }

  it("passes unknown codes through verbatim without local reinterpretation", () => {
    const error = normalizeApiError(418, {
      meta: { apiVersion: 1, requestId: "11111111-2222-3333-4444-555555555555" },
      error: { code: "quantumFluxOverflow", message: "原样透传" },
    });
    expect(error).toBeInstanceOf(UnknownServerError);
    expect(error.code).toBe("quantumFluxOverflow");
    expect(error.message).toBe("原样透传");
  });

  it("survives a malformed error envelope", () => {
    const error = normalizeApiError(500, { meta: {} });
    expect(error).toBeInstanceOf(UnknownServerError);
    expect(error.code).toBe("<missing>");
  });

  it("classifies by code, never by status (status is advisory)", () => {
    const error = normalizeApiError(200, {
      meta: { apiVersion: 1, requestId: "00000000-0000-0000-0000-000000000000" },
      error: { code: "conflict", message: "409 in disguise" },
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.httpStatus).toBe(200);
  });
});

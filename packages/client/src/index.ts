// @stillflow/client — transport, auth, error normalization, cancel/retry
// (FE1-S4, openship#22). The transport surface satisfies the dual-transport
// equivalence table frozen in docs/issues/issue-011-client-authority-boundary-contract.md §5;
// the typed-binary decoding implements the SVC-A1 §6.1 wire format
// (stillflow docs/issues/issue-303-svc-a1-http-service-entry-contract.md).
export const PACKAGE_NAME = "@stillflow/client" as const;

export {
  StillflowClient,
  type StillflowClientOptions,
  type Compatibility,
  type HandshakeResult,
  type HandshakeView,
  type PreviewAssetInput,
  type PreviewEngineInput,
  type ArtifactContentInput,
  type PaginationInput,
  type CallOptions,
  type ClientTimeouts,
} from "./client.js";
export {
  DesktopLocalTransport,
  WebHttpTransport,
  readJsonEnvelope,
  resolvePath,
  type DesktopIpcBridge,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from "./transport.js";
export {
  ConflictError,
  FeatureNotUnlockedError,
  HandshakeRequiredError,
  InternalServerError,
  InvalidRequestError,
  LimitExceededError,
  NotFoundError,
  ProtocolIncompatibleError,
  StillflowApiError,
  StillflowClientError,
  TransportFailureError,
  UnknownServerError,
  UnauthorizedError,
  UnsupportedVersionError,
  normalizeApiError,
} from "./errors.js";
export {
  TypedBinaryWireError,
  decodeTypedBinaryResponse,
  type DecodedTypedBinary,
  type WireMetadataJson,
} from "./arrow.js";
export {
  buildQueryString,
  makeEnvelope,
  makeRequestMeta,
  newRequestId,
  withPathParams,
  type ApiRequestWire,
  type RequestMetaInput,
} from "./envelope.js";

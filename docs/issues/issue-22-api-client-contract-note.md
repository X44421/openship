# FE1-S4 — API 客户端合同落实记录（contract note）

> Status: Implemented · Part of [openship#22](https://github.com/X44421/openship/issues/22)
> 上位合同：[FE0-C1 客户端权威边界合同](issue-011-client-authority-boundary-contract.md)（§3 协议、§5 等价接口表）
> 跨仓对齐：stillflow SVC-A1 冻结合同 §3.2/§3.3/§6.1（[X44421/stillflow](https://github.com/X44421/stillflow) `docs/issues/issue-303-svc-a1-http-service-entry-contract.md`，PR-1 #306 merge `e36f099`，收口 PR #310——PR 正文完成报告记录时点 head `51dee80`，实际合入 head `de9de99`（仅一行测试代码差异，编码器字节等价），merge `2c801dfd`）

## 1. 等价接口表逐行落实（FE0-C1 §5）

差异栏为空：双 transport 共享同一个 client core（envelope 构造、§3.3 携带规则、typed error 归一化、deadline 策略），`WebHttpTransport` 与 `DesktopLocalTransport` 只是两个 raw-IO 适配器——等价性由构造保证，不靠对齐清单。

| 操作 | 客户端 API | Web 远程 | Desktop 本地 | 错误语义 | 取消语义 | 默认超时 | 差异 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| handshake/version | `client.handshake()` → 兼容性状态机 | `POST /v1/handshake`（envelope body） | 同一 envelope 经注入的 `DesktopIpcBridge` | 不兼容 → `ProtocolIncompatibleError`（写操作全部禁用 + 升级提示）；服务端 400 `unsupportedVersion` 同路径 | `signal` 透传 | 5s | 空 |
| preview(request) | `client.previewAsset()` / `previewEngine()` | `POST /v1/assets/preview`、`POST /v1/engine/preview`；成功体 = §6.1 Arrow IPC 流（`application/vnd.apache.arrow.stream`） | 同 | 服务端错误按 code 归一化（status 只记录不分类） | abort → `TransportFailureError{aborted}` | 30s | 空 |
| artifact list/detail | `client.artifactList(runId, page)` / `artifactRead(id)` | `GET /v1/runs/{runId}/artifacts`、`GET /v1/artifacts/{objectId}`（§3.3 query 重装） | 同 | 同上 | 同上 | 15s | 空 |
| artifact content（§6.1 分页流） | `client.artifactContent()` → `{ metadata, table }` | `GET /v1/artifacts/content`（query 重装；成功体 = Arrow 流） | 同 | 同上 | 同上 | 15s | 空 |
| artifact download | `client.artifactDownload(exportId)` → 原始 `ReadableStream`（不在 client 内整包缓冲） | `GET /v1/exports/{exportId}/download` | 文件系统直取由 bridge 实现 | 下载失败 typed error | 可取消 | 无（流式） | 空 |
| run submit/status/cancel | `client.runSubmit/runStatus/runCancel` | **接口位**：抛 `FeatureNotUnlockedError`（ledger L5） | 同 | 同左 | n/a | n/a | 空（两侧同为未解锁占位） |
| events(stream/resume) | `client.eventsStream/eventsResume` | **接口位**：抛 `FeatureNotUnlockedError`（ledger L6） | 同 | 同左 | n/a | n/a | 空（同上） |

§5 原表的"SSE/分块响应"在 SVC-A1 §6.1 冻结后落地为 Arrow IPC 流响应；§5"心跳 15s"属 FE3-R2 事件流范围，本单接口位不实现。

## 2. 新增 transport 命令清单（对照 stillflow manifest，PR-1 48 条 + 收口 90 条）

- `POST /v1/handshake`（§4.2 ready 前唯一调用）
- `POST /v1/assets/preview`、`POST /v1/engine/preview`（§6.1 Arrow 流）
- `GET /v1/runs/{runId}/artifacts`、`GET /v1/artifacts/{objectId}`、`GET /v1/artifacts/content`（§6.1 Arrow 流）、`GET /v1/exports/{exportId}/download`（原始流）
- 预留（未发请求）：`POST /v1/jobs`（run submit）、`GET /v1/jobs/{objectId}`（status）、`POST /v1/jobs/{jobId}/cancel`、`GET /v1/events`、`GET /v1/events/stream`（SSE + cursor）

## 3. 协议要点与落点

- **版本单一来源（FE0-C1 §3）**：`API_VERSION`、`TYPED_BINARY_WIRE_VERSION`、§6.1 元数据键与 media type、§3.2 状态表全部进入 `@stillflow/contracts` 生成物（快照 ref 更新至 stillflow `main@e36f099` + 收口 PR #310 head）；TS 源码零字面量版本常量（测试断言护栏）。
- **携带规则（SVC-A1 §3.3）**：POST = 完整 envelope body；GET = meta 键 + body 字段重装进 query，字符串裸传、非字符串 JSON 编码、`+` 一律 `%2B`（服务端先 `%`/`+` 解码再 JSON 解析，`URLSearchParams` 会破坏 JSON payload）；manifest 路径参数注入 body 且覆盖同名 query/body 值（对齐 adapter 顺序）。
- **typed error（FE0-C1 §3）**：按 `ApiErrorCode` 归类为 7 个 error 类；status 只记录不参与分类；未知 code → `UnknownServerError` 原样透传（code + message 不改写）。correlation id：客户端每请求生成 UUID 放入 `meta.requestId`，服务端 envelope 回显值贯穿到 error 对象；调用方可显式钉住同一 id 以获得字节级一致的幂等重放。
- **handshake fail-closed（FE0-C1 §3/§7）**：握手成功前所有操作抛 `HandshakeRequiredError`；握手后不兼容 → 所有变更类操作（`ProtocolIncompatibleError`，附 expectedVersion/serverVersion/升级提示）被禁，读路径保留以便在真实数据上渲染升级提示，绝不降级到任何本地执行路径。
- **§6.1 解码（typed binary）**：`decodeTypedBinaryResponse` 校验 media type、schema 元数据键、`wireVersion`、batch 计数与逐批 `rowCount`，任一失败即 `TypedBinaryWireError`。读取端注意：JS Arrow 会把零消息流垫成单个空 batch，故 `batches: []` 的元数据按"所有可见 batch 均为空行"校验（读取端工件，不影响线上格式合同）。
- **FE0-C1 §2 禁令**：不实现 Preview 结果本地模型（payload 只以 Apache Arrow `Table` 只读透出）；不重算 fingerprint/digest；不本地截断行数；schema 推断不覆盖服务端 schema。

## 4. 依赖披露

- 运行时新增 **`apache-arrow`**（§6.1 Arrow IPC 流解码所必需的标准读取器）；dev 新增 `vitest`（仓库既有测试惯例，apps/api、packages/core 同款）。
- `@stillflow/contracts` 快照与生成器扩展：`generate.mjs` 常量渲染支持字符串/对象（原实现仅数字）；新增 `RequestMetadata`/`ResponseMetadata`/`ApiErrorResponse`/`ApiErrorCode`/`RequestPrincipal*` 类型与上列常量；`verify.mjs` drift 校验通过。

## 5. 测试三件套映射（openship#22 验收标准）

- **contract tests（后端生成快照基准，无活服务器）**：`src/typed-binary.test.ts` 消费 `tests/fixtures/*.arrow`——由真实 `stillflow-service` wire 编码器产出（含生成器代码存证的 README）；`src/envelope.test.ts` 钉死 §3.3 携带规则与 envelope 形状。
- **协议不兼容 fail-closed**：`src/client.test.ts`（版本不匹配 → 状态翻转 + 写禁用断言；服务端拒绝 requestedVersion → 同路径）。
- **断线恢复 / abort / timeout / 幂等 / 分页 / trace**：`src/client.test.ts`（连接丢失后字节级一致重放、abort 传播、§5 deadline 超时、幂等键信封稳定、分页 query 断言、requestId 贯穿断言）；`src/errors.test.ts`（typed error 全表）。

# 客户端权威边界合同（FE0-C1）

> Status: Frozen · Part of [Epic #1](https://github.com/X44421/openship/issues/issues/1) Phase 0 · 交付 issue：[X44421/openship#11](https://github.com/X44421/openship/issues/11)
> 风险分级：medium（验收路径 A）· 基线：openship `main@ff33c31…`；stillflow 事实基线 `main@f16666e…`（2026-08-22）
> 上位规则：[acceptance-paths](../governance/acceptance-paths.md) §4 判定表（本文件即「改变显示字段权威来源」类工作的冻结合同载体）

## 1. 目标与授权范围

冻结三类字段与计算的归属、schema/version/error/event 兼容协议、canonical 重算禁令及其守卫设计、双 transport 等价接口。授权产出仅本合同文档；守卫代码与生成管道归 FE1-S1/S6，本期零实现。

## 2. 三类字段与计算清单

### 2.1 Rust-only（只能由 stillflow 计算，客户端只读展示）

| 值 | 权威产生地（证据） |
| --- | --- |
| 行数上限的强制与截断标记 | `stillflow-core/src/domain/preview.rs`：`DEFAULT_ROW_LIMIT=1_000 / MAX_ROW_LIMIT=10_000 / MAX_BYTE_LIMIT=50MiB` |
| 抽样策略执行 | 同上 `SamplingStrategy` |
| plan fingerprint / canonical plan digest | `stillflow-storage/src/digest.rs::ContentDigest([u8;32])`；`verification.rs::ArtifactProvenanceDraft.plan_fingerprint / canonical_plan_digest` |
| Plan DAG 权威校验 | stillflow-plan crate（issue-023 合同系） |
| Artifact 计数族 | `verification.rs::ArtifactSummary`：row_count、stored_byte_count、partition_count、finding/warning/error/duplicate_count |
| lineage 集合与时间戳 | `ArtifactProvenanceInput`：run_id/bundle_id/artifact_id/session_id/lineage(BTreeSet)/created_at/started_at/committed_at |
| 引擎标识 | `engine_contract_version`、`engine_build` |
| Run 状态机 | E4-S2（`X44421/stillflow#80`，未合并 → 台账 L5）；合并前客户端不得假设任何状态语义 |

### 2.2 Generated（从 Rust/API schema 生成或机械校验，禁止手写维护）

线格式 DTO：`LogicalSchema`/`LogicalField`/`ColumnId`/`LogicalType`、`ScalarValue`（tagged kind+value）、Preview 请求/结果形状、ArtifactSummary/Provenance 形状、error envelope、event envelope。

反例存档：openship `packages/core/src/clean/types.ts` 为手写副本且常量已漂移（500 行/1 MiB vs 上表 1,000–10,000 行/50 MiB），按 [cross-repo-prototype-boundaries.md](../inventory/cross-repo-prototype-boundaries.md) B1/B5 处置。

**时点声明**：`PreviewResult` 的 Rust 结构体尚未存在（E3 运行时在未合并的 L1/L2），其 TS 生成物待解锁后补齐；在此之前客户端不得实现任何 Preview 结果本地模型。

### 2.3 Client-only（允许本地计算）

展示格式化（数字/字节/时间本地化）、列宽排序等视图缓存、URL 路由参数、UI 偏好类本地存储、乐观 UI 标记（must 可被服务端纠正）、即时 UX 校验提示（must 显式标注非权威）。

## 3. schema / version / error / event 协议

- **handshake**：会话建立时客户端 must 校验服务端 contract version；不兼容 → **fail closed**：禁用全部写操作、给出升级提示，must not 静默降级到任何本地执行路径（B2 执行器为已记录反例）。
- **version 单一来源**：LOGICAL_SCHEMA_VERSION / PLAN_VERSION 以生成合同为唯一来源；TS 内不得再出现字面量版本常量。
- **error envelope**：typed error + trace/correlation id；未知错误码一律按服务端错误处理并原样透传展示，禁止本地重解释。
- **event envelope**：流式事件带 cursor；乱序丢弃、重复去重的具体规则在 FE3-R2 冻结，本合同只定原则：客户端不得因事件流故障而伪造状态。

## 4. canonical 重算禁令与守卫设计

禁令清单（客户端出现即为违约）：`planFingerprint()` 类指纹计算、Plan DAG 权威校验复刻、digest 重算比对并修正显示、对行数的本地截断宣称、schema 推断覆盖服务端 schema。

守卫设计（FE1-S1/S6 落地，此处冻结设计）：

| 守卫 | 规则名（建议） | 检查位置 | 失败行为 |
| --- | --- | --- | --- |
| ESLint 封锁 clean 引擎导入 | `no-clean-engine-imports`（no-restricted-imports 封 `@repo/core` 的 clean 子路径） | apps/* 全量 | lint fail |
| CI 模式扫描 | grep `planFingerprint\|createHash\|MAX_PREVIEW_ROWS` 于 apps/*（白名单：空） | CI step | build fail |
| 合同漂移检查 | 生成类型 vs 后端 JSON 快照比对 | CI step（FE1-S6） | drift fail |

## 5. 双 transport 等价接口表

Web 远程 HTTP 与 Desktop 本地 transport 必须逐行等价；差异栏必须为空或附理由。

| 操作 | Web 远程 | Desktop 本地 | 错误语义 | 取消语义 | 默认超时 |
| --- | --- | --- | --- | --- | --- |
| handshake/version | GET /contract-version | 本地 IPC version 握手 | 同一 typed error 映射 | 不适用 | 5s |
| preview(request) | POST + SSE/分块响应 | IPC 流式调用 | 服务端错误原样映射 | abort → 后端取消传播 | 30s（issue-050 deadline） |
| artifact list/detail | GET 分页 | IPC 分页 | 同左 | n/a | 15s |
| artifact download | 流式下载（不经浏览器内存整包） | 文件系统直取 | 下载失败 typed error | 可取消 | 无（流式） |
| run submit/status/cancel | POST/GET/POST | IPC 对应三操作 | 幂等键冲突可辨识 | 取消须确认到达 | status 轮询退避由 client 包统一定义 |
| events(stream/resume) | SSE + cursor | IPC 订阅 + cursor | 断线恢复语义一致 | unsubscribe | 心跳 15s |

## 6. 附录：端到端字段溯源（每值单源验证）

1. **Preview 行值**：引擎执行（Rust）→ Preview 结果（L1/L2 解锁后生成 DTO）→ 客户端仅格式化渲染。行数完整性由服务端上限与截断标记声明，客户端不得自行截断后宣称完整。
2. **Artifact digest**：storage 层 `ContentDigest` 计算 → `ArtifactProvenance.plan_fingerprint/canonical_plan_digest` → 客户端展示原值并提供复制；禁止重算比对后「纠正」显示。
3. **Run 状态**：API 返回 `status`（语义待 E4-S2/L5）→ 客户端徽标仅做显示映射，不推断中间态；刷新/重连后以服务端为准。

## 7. 兼容性决策

生成合同版本不匹配 = fail closed（§3）；新增可选字段向后兼容；字段删除/改名 = 主版本升级并要求客户端同步发版。过渡期（生成管道落地前）仍按现行为准，但**禁止新增**任何手写合同副本。

## 8. 验收对照（派发单六条）

三类清单覆盖且每字段恰归一类（§2）✓ · 三条溯源成立（§6）✓ · fail-closed 定义（§3/§7）✓ · 守卫设计可执行（§4）✓ · 双 transport 表逐项对齐（§5，差异栏空）✓ · link-check 见 PR。

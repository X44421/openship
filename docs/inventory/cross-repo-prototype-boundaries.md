# 跨仓库原型边界盘点

> Part of FE0-D1（#10）· 证据基线：openship 工作分支 `docs/issue-010-rebind-stillflow-79`（自 `main@97974a1` 切出）+ stillflow `main@f16666e59896e2d8bae3b79e188b8f567bb8c534` · 检视时点 2026-08-22
> 上位文档：[Epic #1](https://github.com/X44421/openship/issues/1) 产品对象映射与不可破坏约束；[台账](../governance/ledger.md) L3。

## 1. 目的

在 openship 改造开工前，盘点两个原型中一切「客户端执行了应由 stillflow 权威执行的能力」的位置，给出归属裁决，直接约束 FE5 退役切片。本文件只记录事实与裁决，不排弃用顺序（→ FE0-D0 的 `safe-deprecation-order.md`）。

## 2. A 面 · stillflow 根级前端原型（旧 Web UI）

| # | 事实 | 证据 | 归属裁决 |
| --- | --- | --- | --- |
| A1 | 根级 Vite/React 应用即产品前端本体：`index.html → src/main.tsx`，构建配置 `vite.config.ts` | stillflow 仓库根目录实文件（2026-08-22 检视） | FE5-M1「从旧 StillFlow 前端切换」的退役对象；openship 新客户端就绪并验收前不得删除 |
| A2 | `package.json` 依赖 `@duckdb/duckdb-wasm@^1.33.1-dev57.0` —— **浏览器内 DuckDB 执行分析** | stillflow `package.json` 依赖声明 | 客户端执行面。迁移后必须由服务端 Preview（stillflow issue-050 合同）替代；**禁止**把 duckdb-wasm 带进新客户端套件 |
| A3 | 该原型的完整盘点与弃用计划已由 F0-D0 承接 | `X44421/stillflow#79`（已于 2026-08-22T10:13:07Z 重绑至 `main@f16666e…`，[勘误评论](https://github.com/X44421/stillflow/issues/79#issuecomment-5379712254)） | #79 产出物是本文件 §2 的下游细化；两处结论冲突时以 #79 盘点为准并回改本表 |

## 3. B 面 · openship 原型越界能力清单

### 3.1 核心 发现：TS 平行合同 + 清洗执行器（`packages/core/src/clean/`）

| # | 位置 | 类别 | 事实（检视时点证据） | 归属裁决 |
| --- | --- | --- | --- | --- |
| B1 | `packages/core/src/clean/types.ts` | 平行合同 | 文件头自述「Engine-independent cleaning contracts, **aligned with stillflow-core / stillflow-plan wire format**」，手写 `LogicalSchema` / `LogicalPlan` / `Expr` / `Rule` 线格式副本（929 行模块群） | must 改为由 Rust/API schema **生成**的合同（Epic 约束：「TypeScript 合同必须从 Rust/API schema 生成或机械校验」）；手写副本在 FE1-S1 落地后删除 |
| B2 | `packages/core/src/clean/execute.ts` | 第二执行引擎 | 真实执行的清洗变换器：消费 `LogicalPlan`/`Rule`/`TableBatch` 并产出 `PreviewResult`（import 块实证），非纯类型 | FE5-D3 删除对象；替代路径 = 真实 Preview/Run API。在此之前不得新增调用方 |
| B3 | `packages/core/src/clean/validate.ts` | canonical 重算 | 导出 `planFingerprint()`——**在 TS 内计算 plan fingerprint**，直触 Epic 约束「canonical identity、digest、fingerprint 只由 StillFlow 计算」 | 随 FE5-D3 删除；过渡期 fingerprint 一律以后端返回值为准、客户端仅展示 |
| B4 | `packages/core/src/clean/validate.ts` | 权威校验复制 | `validatePlan()` 在客户端复刻 Plan DAG 校验 | 客户端仅可做即时 UX 校验且必须明示「服务端结果为准」（acceptance-paths 判定表）；该实现随 B2 同片退役 |
| B5 | `packages/core/src/clean/types.ts` 常量区 | 合同漂移实锤 | TS：`MAX_PREVIEW_ROWS = 500`、`MAX_PREVIEW_BYTES = 1_048_576`；stillflow E3-C0 冻结合同：1,000/10,000 行、8 MiB/50 MiB | **平行手写合同必然漂移的直接证据**，佐证 B1 的生成化裁决；漂移数值禁止以任何形式「对齐补丁」维持 |
| B6 | `packages/core/src/clean/sample.ts` | fixture 入生产面 | 「Fixture aligned with stillflow `sample-customers`（bounded, dirty on purpose）」被 clean 模块加载（`loadSampleAsset`） | fixture must 迁入 `dev-fixtures` 并断开生产 import（FE1-S5）；生产 bundle 扫描纳入 CI 门（FE1-S6） |

### 3.2 消费链

- `apps/dashboard/src/studio/`：清洗 Plan 工作台（基于 `@xyflow/react`）已经存在，通过拖拽 op（MIME `application/stillflow-op`）驱动 core/clean——这是 FE2-P1/P2 的天然基础，**retain/adapt**；但其数据面必须整体切换到生成合同 + 真实 API，B2/B3 退役后 studio 不得再有本地执行回退。
- `@repo/core` 另被 dashboard 多个非清洗模块引用（import-project、routing 等）；那些用法与本盘点无关，D0 全量盘点时分列。

### 3.3 广度扫描补充

扫描深度声明：本节为单轮定向扫描（grep 定位 + 抽样开文件确认），非全量盘点；系统性逐文件盘点由 FE0-D0 承接。

| # | 位置 | 类别 | 事实 | 归属裁决 |
| --- | --- | --- | --- | --- |
| B7 | `apps/dashboard/src/components/monitoring/fixtures.ts` | mock 入生产面 | 同时被 `apps/dashboard/src/app/(dashboard)/projects/[id]/components/MonitoringTab.tsx`（**真实项目页签**）与 `dev/monitoring/MonitoringPreview` 引用 | FE1-S5 隔离进 `dev-fixtures` 并断开生产 import；MonitoringTab 的数据面切换是 Phase 2 任务的前置事实 |
| B8 | `apps/dashboard/src/hooks/useAttentionFeed.ts` / `usePtyConnection.ts` / `useInfraFleet.ts` 等 6 文件 | 本地持久化 | 浏览器本地存储使用点；`theme-provider` / `monitoring/VisitorMap` / `CollapsibleCard` 属 UI 偏好（可 retain），前三个存在业务数据缓存嫌疑 | D0 盘点逐文件裁决；新客户端规则：仅 UI 偏好可入本地存储，业务数据一律服务端权威 |
| B9 | 状态机 | 显式转移表 | `ALLOWED_TRANSITIONS` / `canTransition` 类模式定向搜索零命中 | openship 原型无显式 TS 状态机表；风险集中在 §3.1 执行器而非状态编码 |
| B10 | `apps/api/package.json` | 服务端栈事实 | hono ^4.12 + better-auth ^1.5（drizzle adapter）+ bullmq ^5.70 + ioredis ^5.10 + typebox 校验 | FE5-D2 退役对象的依赖图根；记录供 FE0-C2 拓扑与 FE0-D0 盘点引用 |
| B11 | `apps/desktop` | 桌面壳现状 | `main: dist/main/index.js`，运行时依赖仅 `@repo/core`、`@repo/onboarding` | 无成熟壳框架痕迹；壳选型归 FE4-D1，此处仅记录现状 |

### 3.4 扫描方法

`grep -rlE` 定向模式：`mock|fixture|fallback|simulat`、`localStorage|sessionStorage|indexedDB`、`ALLOWED_TRANSITIONS|canTransition`、`createHash|sha256|fingerprint|digest`；排除 node_modules/.next/dist 与测试文件；命中后抽样打开确认。已知盲区：静默 fallback 的逐个 catch 块核验未完成（D0 补齐）。

## 4. C 面 · 跨仓耦合现状

`grep -ri "stillflow" .`（除 node_modules/.git）仅命中 §3 所列文件——全部是**字符串级对齐注释与 MIME 类型名**，无包依赖、无网络调用、无子模块。结论：

- 两仓当前**零构建耦合**；
- 改造期唯一合法耦合点是 FE1-S1 的 generated contracts；任何其他形式的耦合（复制类型、常量同步脚本、协议注释对齐）都在禁用清单上。

## 5. 对 FE5 退役任务的约束输出

| 约束 | 来源 |
| --- | --- |
| 执行引擎整体退役：B2/B3/B4/B5 必须同片处理，不得分批留半活状态 | §3.1 |
| 手写合同 B1 的删除以前置生成合同落地为触发条件（REPLACE-FIRST） | §3.1 B1 |
| fixture B6 先隔离进 dev-fixtures 再断 import，最后删文件 | §3.1 B6 |
| stillflow 侧旧前端（A1/A2）按 #79 弃用计划执行，openship 客户端验收完成前不动 | §2 |
| 以上任何切片的顺序与回滚点由 FE0-D0 `safe-deprecation-order.md` 统一编排 | §1 |

## 6. 凭证索引

- stillflow#79 勘误评论：<https://github.com/X44421/stillflow/issues/79#issuecomment-5379712254>（2026-08-22T10:13:07Z）
- 台账 L3 行更新：本分支同 PR 内修改 `docs/governance/ledger.md`
- 本文件所有路径均可在检视分支工作树中复核；行号以检视时点为准

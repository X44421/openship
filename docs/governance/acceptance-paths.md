# 双验收路径：合同变更 vs 客户端实现

> Status: Accepted · Part of #1（Phase 0 · FE0-G0.3）
> 上位规则：[派发生命周期](./dispatch-lifecycle.md)、[分支与 PR 政策](./branch-and-pr-policy.md) §3。

## 1. 客户端侧「合同」的定义清单

下列对象的**变更**走路径 A；仅**消费**它们走路径 B。

| 合同对象 | 权威来源 / 冻结产物位置 |
| --- | --- |
| Generated contracts 的消费方式 | 由 stillflow Rust/API schema 生成或机械校验的 TS 合同；消费规则冻结于路径 A 合同文档（`docs/issues/`） |
| Transport 接口等价性 | Web 远程 HTTP 与 Desktop 本地 transport 的等价接口定义（FE0-C1 产物） |
| 包拓扑与依赖方向 | FE0-C2 冻结的拓扑文档 |
| 前端对象模型 / IA | FE0-C0 冻结的显示模型、路由、生命周期文档 |
| 设计 tokens 结构 | FE1-S2 产物；token **结构**属合同，**取值**调整属实现 |
| schema/version/error/event 协议 | FE0-C1 冻结的协议文档 |

## 2. 路径 A（合同变更）分级流程

| 级别 | 典型情形 | 流程 |
| --- | --- | --- |
| A-low | 合同文档勘误、无语义变化的澄清 | PR → CI |
| A-medium | 在既有接口后新增能力：新增可选字段消费、新增 transport 命令、token 结构新增项 | contract note（`docs/issues/issue-<NNN>-*-contract.md`）→ 实现 → review → CI |
| A-high | 改变显示值的权威来源、破坏 transport 等价性、反转包依赖方向、修改 schema/version/error 协议、新增本地持久化格式 | 冻结合同 → 实现 → 架构评审 → CI → 最终合同核对 |

冻结合同落盘位置：`docs/issues/issue-<NNN>-<slug>-contract.md`（与 stillflow 惯例一致）。

## 3. 路径 B（客户端实现）流程与凭证矩阵

流程：派发单 → 实现 → 交互/UI 验收 → CI。

| 变更类型 | 必需凭证 |
| --- | --- |
| 页面 / 交互变更 | 截图或 e2e 录制（before/after） |
| 新增组件 | Storybook 条目 + 交互状态覆盖说明 |
| 键盘 / 可访问性 | 键盘走查记录 + axe（或同类）扫描输出 |
| 数据展示正确性 | 真实 API 响应的网络面板 trace + 渲染结果截图 |
| 构建影响 | typecheck/build 原文输出 |

## 4. 强制走路径 A 的判定表

| 变更类型 | 判定 | 理由 |
| --- | --- | --- |
| 改变某显示字段的权威来源 | A-high | 触碰唯一权威来源原则（Epic 权威边界） |
| 新增或反转包依赖方向 | A-high | 拓扑合同（FE0-C2） |
| 修改生成合同的获取 / 校验方式 | A-medium | 消费方式属合同对象 |
| 引入新的本地持久化格式或存储 key 结构 | A-high | 升级兼容与数据迁移风险 |
| 新增 transport 命令 / 事件类型 | A-medium | 接口等价性面扩大 |
| 设计 token 结构变化 | A-medium | tokens 结构属合同；仅取值调整 → B |
| 新增页面 / 组件消费既有对象模型 | B | 纯消费，无合同面变化 |

## 5. 证据不可互替声明

UI 截图不能替代合同评审；合同评审不能替代交互验收。两条路径的凭证清单分别独立列全，任何一方不得以「另一方已验证」为由缺项。

## 6. 纸面路由演示

### 6.1 路径 B 演示 — FE2-P3（真实 E3 Preview 集成）

路由结论：**B**（消费已冻结的 Preview 合同，无客户端合同面变更）。应产生凭证：

1. 节点选择切换的网络面板 trace（证明请求去重与 abort 取消）；
2. 乱序响应注入的 e2e 断言（旧响应不覆盖当前选择）；
3. bounded sample / schema delta / warnings / memory-law 错误四类渲染截图；
4. 前端 simulator 未参与 contract evidence 的声明（CI 扫描输出）。

### 6.2 路径 A 演示 — FE0-C1（Rust/客户端权威边界冻结）

路由结论：**A-high**（定义权威来源与协议本身）。应产生文书：

1. 冻结合同 `docs/issues/issue-<NNN>-authority-boundary-contract.md`（Rust-only / generated / client-only 三类字段清单、协议、守卫）；
2. 架构评审记录（评审人、SHA、结论）；
3. lint/test 守卫的实现 PR（禁止客户端重算 canonical 值）；
4. Preview、Run、Artifact 各一条端到端字段溯源报告。

## 7. Phase 1–3 真实任务路由结论

| 任务 | 路由 | 理由 |
| --- | --- | --- |
| FE1-S3（Workspace 应用壳） | B | 消费既有对象模型与路由；导航/边界属交互验收 |
| FE1-S4（StillFlow API 客户端） | A-medium | transport 接口等价性与 typed error 属合同面 |
| FE2-P2（Operator Catalog / Inspector） | B | schema 驱动 UI 消费后端既有 schema；「未知 operator fail-closed」纳入 B 验收断言 |
| FE3-R2（Event Stream） | B + A-medium 备注 | 流式渲染与 bounded rendering 走 B；cursor/resume 语义若超出已发布 API 文档则该子项升级 A-medium |

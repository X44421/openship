# 派发生命周期与任务标识规范

> Status: Accepted · Part of #1（Phase 0 · FE0-G0.1）
> 适用范围：X44421/openship 内 Epic #1 及其全部子任务的执行与验收。Epic 范围外的工作流仍以 [CONTRIBUTING.md](../../CONTRIBUTING.md) 为准。

## 1. 目的

使任何 agent 或人类贡献者在不依赖口头约定的前提下完成 认领 → 实现 → 验收 → 交付 的全过程。所有状态转移必须有客观触发条件与可点击凭证；无法给出凭证的转移视为未发生。

## 2. 角色

| 角色 | 职责 | 限制 |
| --- | --- | --- |
| 维护者（dispatcher） | 发布派发单、REBIND 裁决、取消、合并 PR | —— |
| 执行者（executor） | `/claim` 认领、实现、自检、开 Draft PR、发布 DONE 报告 | claim 必须声明身份 |
| 独立验收者（acceptor） | 逐项核验验收标准并出具 ACCEPTED 结论 | 不得是该任务的执行者 |

一个实体可顺序担任不同角色，但同一任务中「执行」与「独立验收」must 分离；单人运营时维护者可兼任验收者，且 must 在验收评论中显式声明兼任。

## 3. 状态机

```text
DISPATCHED ──/claim──▶ CLAIMED ──Draft PR──▶ IN_REVIEW ──验收通过──▶ ACCEPTED ──merge──▶ DONE
    │                    │                     │
    └──前置未满足────────┴─────────────────────┴──▶ BLOCKED ──前置解除──▶ 回到原状态
CLAIMED/IN_REVIEW ──base 漂移──▶ REBIND ──维护者裁决──▶ CLAIMED（新 base）／ CANCELLED
≤IN_REVIEW 的任意状态 ──维护者明示──▶ CANCELLED
```

## 4. 凭证类型

| 代号 | 类型 | 形态要求 |
| --- | --- | --- |
| E1 | 评论锚 | issue 评论的永久链接 |
| E2 | PR 事件 | PR URL 及其时间线事件 |
| E3 | commit | 完整 SHA（40 位），不得用短 SHA 替代 |
| E4 | 命令输出 | 带时间戳的原文输出，禁止转述或摘要 |
| E5 | 台账引用 | [ledger.md](./ledger.md) 行号 + 对应核验输出 |

## 5. 转移表

| 从 → 到 | 客观触发条件 | 操作角色 | 必需凭证 |
| --- | --- | --- | --- |
| DISPATCHED → CLAIMED | 发布合规 `/claim`（身份、计划分支、expected head 三要素齐备），且发布时 remote `main` == expected head | 执行者 | E1 + E4（`git ls-remote` 输出） |
| CLAIMED → BLOCKED | 任一依赖经台账核验为未满足 | 执行者 / 维护者 | E5 |
| BLOCKED → 原状态 | 依赖解除有核验输出证明；期间 base 若漂移 must 先走 REBIND | 执行者 | E4 / E5 |
| CLAIMED → IN_REVIEW | Draft PR 开立且回链 issue，交付物草稿齐备 | 执行者 | E2 |
| CLAIMED / IN_REVIEW → REBIND | 任一核验点发现 remote `main` ≠ expected head | 执行者 | E4 + 重绑记录（见 §7） |
| REBIND → CLAIMED | 维护者裁决 rebase 继续，expected head 更新为新 SHA | 维护者 | E1（裁决评论） |
| REBIND → CANCELLED | 维护者裁决重新派发或放弃 | 维护者 | E1 |
| IN_REVIEW → ACCEPTED | 验收标准逐条满足且凭证全部可点击 | 独立验收者 | E1（验收评论，逐条勾选） |
| ACCEPTED → DONE | PR 以政策声明的 merge 方式合入 `main` 且 DONE 报告已发布 | 维护者 + 执行者 | E3（merge commit SHA）+ E1（DONE 报告） |
| ≤IN_REVIEW → CANCELLED | 维护者明示取消（重复派发 / 范围失效等）并说明理由 | 维护者 | E1 |

## 6. 各状态行为规则

- **DISPATCHED**：只有维护者可修改派发单正文；执行者只读。
- **CLAIMED**：执行者在认领分支上工作；禁止向 `main` 直接推送；距上次 expected-head 核验超过一个工作日再继续工作时，must 重跑核验。
- **IN_REVIEW**：除验收者要求的修正外不再扩大范围；每次 push 后 must 在 issue 评论记录新 SHA。
- **BLOCKED**：禁止产生新的实现提交；允许只读调研。
- **REBIND**：立即停止一切 push；按模板填写重绑记录。
- **ACCEPTED / DONE**：终态。后续缺陷走新派发单，不得复用原 Task ID。

## 7. REBIND 子流程

1. 核验点：claim 时、每次 push 前、Ready 转换前，以及任何时点的怀疑。
2. 执行者停止工作，按 [rebind-record-template](./templates/rebind-record-template.md) 在 issue 发布记录。
3. 维护者裁决：

   | 裁决 | 适用条件 | 结果 |
   | --- | --- | --- |
   | rebase 继续 | 变更语义不受新 base 影响 | expected head 更新为新 SHA，原 claim 继续有效 |
   | 重新派发 | 新 base 使范围失效 | 原任务 CANCELLED，另发新派发单 |
   | 取消 | 工作不再必要 | CANCELLED 并归档 |

4. 裁决后执行者 must 在新 base 上重跑受影响的检查并把原文输出补进 issue。

SHA 快照只是核验时点的证据。Epic #1 原文：「以上 SHA 是本 Epic 创建时的状态快照，不是永久假设」。

## 8. 任务 ID 规则

- 文法：`FE<phase>-<code>`，phase ∈ 0–5；`<code>` = 字母前缀 + 序号（G/D/C/S/A/P/R/Q/X/J/W/M + 数字），与 Epic #1 清单一一对应。
- 子任务：父 ID 追加 `.N` 自 `.1` 递增。
- 分配权威：顶层 ID 仅可由 Epic #1 正文及其修订评论新增；子任务 ID 由父任务的派发单分配。
- ID 一经派发不得复用，CANCELLED 后亦然。
- 跨仓引用 must 带仓库限定（文字形式如 `X44421/stillflow#79`）。

| 示例 ID | 解析 |
| --- | --- |
| `FE0-G0.1` | Phase 0 · FE0-G0（治理基线）的第 1 个子任务，即本文件所属交付 |
| `FE2-P3` | Phase 2 顶层任务 P3（真实 E3 Preview 集成），未拆分子任务 |
| `FE5-M1.2` | （假想示例）Phase 5 · M1（从旧前端切换）的第 2 个子任务 |

## 9. DONE 报告与回滚

进入 DONE 前，执行者 must 按 [done-report-template](./templates/done-report-template.md) 在 issue 发布 DONE 报告。「回滚点」一节：文档任务是 revert 目标 commit；代码任务还须说明数据与兼容影响。

## 10. 与 stillflow 仓库工作流的关系

- 风险分级、contract-first、11 行交接等词汇对齐 stillflow 仓库的 `AGENTS.md` 与 `docs/development/ai-development-workflow.md`；两仓各自执行各自的流程文件，互不覆写。
- 跨仓等待关系一律通过 [跨仓库依赖台账](./cross-repo-dependency-ledger.md) 表达；issue 中只写「等后端就绪」这类不可核验表述视为无效依赖声明。

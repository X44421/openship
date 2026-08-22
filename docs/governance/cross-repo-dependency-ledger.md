# 跨仓库依赖台账协议

> Status: Accepted · Part of #1（Phase 0 · FE0-G0.4）
> 台账数据：[ledger.md](./ledger.md)。上位规则：[派发生命周期](./dispatch-lifecycle.md) §5（BLOCKED/REBIND 凭证）。

## 1. 记录语法

- issue 正文或评论中的阻塞声明：`BLOCKED-BY: X44421/stillflow#<编号>`。
- 台账行（ledger.md）：每行一个上游依赖，字段见 ledger.md 表头。
- 只写「等后端就绪」而无台账行引用的依赖声明视为无效（lifecycle §10）。

## 2. 状态枚举与判据

| 状态 | 客观判据 | 说明 |
| --- | --- | --- |
| `WAITING` | 上游 issue/PR 处于 OPEN 且未合并（`state != MERGED` 或 `mergedAt == null`） | 不得开工对应任务 |
| `MERGED` | 上游 PR `state == "MERGED"` 且 `mergeCommit.oid` 出现在上游默认分支历史中 | 代码已进上游 main，但**不代表客户端可端到端使用** |
| `AVAILABLE-IN-RELEASE` | 能力可被客户端端到端演练：API endpoint 可达，或包含该能力的 release tag 版本 ≤ 客户端 pin 的最低版本 | 解除阻塞的唯一充分状态 |

补充判据：

- 本地桌面开发场景下，「merged 进上游 main 且本地进程含该能力」视为 `AVAILABLE-IN-DEV`——它允许开发调试，但 Web 远程场景仍按 `WAITING/MERGED` 对待；台账行必须写明适用场景，禁止混用。
- 「PR merged ≠ API available」是默认假设；从 `MERGED` 推进到 `AVAILABLE-IN-RELEASE` 必须有独立的可用性证据（endpoint 探活输出或 release notes 引用），不得自动推断。

## 3. 核验时点

| 时点 | 动作 |
| --- | --- |
| `/claim` 时 | 重跑受影响台账行的核验命令，输出贴入认领评论 |
| Draft → Ready 前 | 全部关联行重跑一次；任一行非 UNBLOCKED 等价状态则不得转 Ready |
| REBIND 时 | 新 base 上重跑全部关联行并更新「最近核验」列 |
| 台账行变更时 | 见 §4 更新协议 |

## 4. 更新协议

- **谁**：任何执行者 may 提请更新（issue 评论附新鲜命令输出）；维护者通过文档 PR 使 ledger.md 变更生效。
- **何时必须更新**：§3 各时点；以及 Epic #1 基线快照与本台账冲突被发现时。
- **在哪声明**：ledger.md 对应行的「最近核验」列 + 关联 issue 的评论锚点。
- SHA 快照只是核验时点的证据（Epic #1：「不是永久假设」）；台账行的可信度来自「最近核验」的新鲜度，而非创建时的值。

## 5. 与 Epic 基线节的关系

Epic #1「基线与当前依赖状态」一节是本台账的初始事实来源之一；两者不一致时，以**核验时间较新者**为准，并在另一处同步修正（修正动作本身走文档 PR）。

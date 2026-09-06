# 跨仓库依赖台账

> 初始化：2026-08-22（ox-alpha，随 FE0-G0.4 交付）。协议：[cross-repo-dependency-ledger.md](./cross-repo-dependency-ledger.md)。
> 与 Epic #1「基线与当前依赖状态」一致性：2026-09-06T06:40:45Z 例行核验后刷新 L1/L2/L3/L5（此前 2026-08-22 快照已与现实冲突：#71/#53 已 MERGED、#79 已 CLOSED、#80 已 CLOSED 且经 #175 落地）；L4/L6 复核未变。

| 行号 | 依赖项 | 类型 | 受影响任务 | 当前状态 | 判据说明 | 核验命令 | 最近核验（UTC） | 核验人 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | `X44421/stillflow#71` | PR（merged；原 merge commit 被历史重构孤立，内容经载体入 main，见判据） | FE2-P3 | `MERGED` | GitHub `state=MERGED, mergedAt=2026-08-23T06:46:49Z`，但原 mergeCommit `90fb878e…` 不在当前 main 历史（compare=diverged，main 历史后续重构）；E3 memory-law 内容已随 #53 merge commit `c0e82803…` 进入 main（`0d60a43`/`ed7a71c`/`8058b20` 等提交在 main 祖先链可核）；`AVAILABLE-IN-RELEASE` 未判定（对齐 L4 口径） | `gh pr view 71 --repo X44421/stillflow --json state,mergedAt,mergeCommit`；`gh api repos/X44421/stillflow/compare/90fb878e2ace78a6e1c2698014bca5461f19db59...main` | 2026-09-06T06:40:45Z | X44421 |
| L2 | `X44421/stillflow#53` | PR（merged；E3 栈载体） | FE2-P3 | `MERGED` | `state=MERGED, mergedAt=2026-08-23T08:00:28Z, mergeCommit=c0e82803…`，已在上游 main 历史；#71 栈内容同经该 merge 进入；`AVAILABLE-IN-RELEASE` 未判定（对齐 L4 口径） | `gh pr view 53 --repo X44421/stillflow --json state,mergedAt,mergeCommit` | 2026-09-06T06:40:45Z | X44421 |
| L3 | `X44421/stillflow#79` | issue（closed，completed；经切片 PR 交付） | FE0-D1（已 DONE，openship#10）、FE5-M1 | `MERGED` | `#79 state=CLOSED（state_reason=completed）`；交付切片 PR #83（`d3c07601…`）/#84（`7c5f163a…`）/#87（`ea54a526…`）均 merged 且已在上游 main 历史；FE5 删除任务仍以后续台账核验为准 | `gh issue view 79 --repo X44421/stillflow --json state,title`；`gh pr view 83 --repo X44421/stillflow --json state,mergedAt,mergeCommit`（#84/#87 同） | 2026-09-06T06:40:45Z | X44421 |
| L4 | E4-S1（Artifact/VerificationBundle 基础，`X44421/stillflow#74`） | capability | FE3-A1 | `MERGED` | `state=MERGED, mergedAt=2026-08-22T08:32:03Z, mergeCommit=f16666e5…`；**非** `AVAILABLE-IN-RELEASE`：服务 API 尚未发布，客户端无法端到端演练 | `gh pr view 74 --repo X44421/stillflow --json state,mergedAt,mergeCommit` | 2026-08-22T09:23:38Z | ox-alpha |
| L5 | E4-S2（VerificationBundle 物化，`X44421/stillflow#80`） | capability | FE3-A1（后续）、FE3-R1（间接）、FE1-S4（run 接口位，间接） | `MERGED` | `#80 state=CLOSED（state_reason=completed）`；落地载体 PR `X44421/stillflow#175`（`state=MERGED, mergedAt=2026-08-29T09:53:00Z, mergeCommit=533f75ba…`，已在上游 main 历史；#91 为 closed-unmerged 历史证据）；`AVAILABLE-IN-RELEASE` 未判定——服务 API 发布面尚未提供（对齐 L4 口径）；run 接口位激活仍需 `AVAILABLE-IN-RELEASE` 证据（协议 §2），Run API 面属 L6/E5 跟踪 | `gh issue view 80 --repo X44421/stillflow --json state,title`；`gh pr view 175 --repo X44421/stillflow --json state,mergedAt,mergeCommit` | 2026-09-06T06:40:45Z | X44421 |
| L6 | E5（持久化 / Run / Artifact API 面） | capability | FE2-P4、FE3-R1、FE3-A1 | `WAITING` | 尚无单一实现跟踪 issue；锚定上游执行台账 `X44421/stillflow#81`（open）；下次核验落定具体编号 | `gh issue view 81 --repo X44421/stillflow --json state,title` | 2026-08-22T09:23:38Z | ox-alpha |

## 核验输出存证（2026-08-22T09:23:38Z 采集）

L1 / L2：

```json
{"isDraft":true,"mergedAt":null,"state":"OPEN","title":"engine: restore E3 Preview memory-law and envelope invariants"}
{"isDraft":true,"mergedAt":null,"state":"OPEN","title":"engine: implement bounded node-level Preview runtime (E3)"}
```

L3：

```json
{"state":"OPEN","title":"frontend: inventory prototype boundaries and plan safe code deprecation (F0-D0)"}
```

L4：

```json
{"mergeCommit":{"oid":"f16666e59896e2d8bae3b79e188b8f567bb8c534"},"mergedAt":"2026-08-22T08:32:03Z","state":"MERGED","title":"storage: implement Artifact and VerificationBundle foundations (E4-S1)"}
```

L5 / L6（定位输出）：

```text
80 [open] engine: implement deterministic VerificationBundle materialization (E4-S2)
81 [open] [Epic] Complete StillFlow backend roadmap and execution ledger
```

## 核验输出存证（2026-09-06T06:40:45Z 采集，L1/L2/L3/L5 刷新）

L1 / L2：

```json
{"mergeCommit":{"oid":"90fb878e2ace78a6e1c2698014bca5461f19db59"},"mergedAt":"2026-08-23T06:46:49Z","state":"MERGED"}
{"mergeCommit":{"oid":"c0e828031f0141fa89e6b525b4314ebabd5f4f4e"},"mergedAt":"2026-08-23T08:00:28Z","state":"MERGED"}
```

L1 例外核验（原 mergeCommit 与当前 main 关系，`gh api repos/X44421/stillflow/compare/90fb878e…...main`）：

```json
{"status":"diverged","ahead_by":305,"behind_by":24}
```

内容载体核验：`git merge-base --is-ancestor 0d60a43 origin/main` → yes（0d60a43 等 E3 memory-law 提交位于 `c0e82803…`（#53 merge）祖先链内）。

L3：

```json
{"state":"closed","state_reason":"completed"}
```

```text
d3c07601fa6102999486728ba32ab0b2f2f87a7d ancestor=YES   ← PR #83
7c5f163aa2b60a32955e088edc66910a5ce70d1d ancestor=YES   ← PR #84
ea54a526bf1ad1d7b3a1e962e237172a7c32ed0a ancestor=YES   ← PR #87
```

L5：

```json
{"state":"CLOSED","title":"engine: implement deterministic VerificationBundle materialization (E4-S2)"}
{"mergeCommit":{"oid":"533f75badbb46f75ceb453dcf2f5e54b1384caaa"},"mergedAt":"2026-08-29T09:53:00Z","state":"MERGED"}
```

L4 / L6 复核（未变更）：`f16666e5…` 仍为 main 祖先（L4 判据成立）；`#81 state=OPEN`（L6 判据成立）。

## 使用说明

1. 认领受影响任务前，重跑该行核验命令并贴入认领评论（协议 §3）。
2. 状态变更走文档 PR 更新本表，并在关联 issue 留评论锚点（协议 §4）。

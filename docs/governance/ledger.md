# 跨仓库依赖台账

> 初始化：2026-08-22（ox-alpha，随 FE0-G0.4 交付）。协议：[cross-repo-dependency-ledger.md](./cross-repo-dependency-ledger.md)。
> 与 Epic #1「基线与当前依赖状态」一致性：一致（#71/#53 仍 Draft、#79 OPEN 且已重绑至 f16666e、E4-S1 已于 2026-08-22T08:32Z 合并）。

| 行号 | 依赖项 | 类型 | 受影响任务 | 当前状态 | 判据说明 | 核验命令 | 最近核验（UTC） | 核验人 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | `X44421/stillflow#71` | PR（draft） | FE2-P3 | `WAITING` | `state=OPEN, isDraft=true, mergedAt=null` | `gh pr view 71 --repo X44421/stillflow --json state,isDraft,mergedAt` | 2026-08-22T09:23:38Z | ox-alpha |
| L2 | `X44421/stillflow#53` | PR（draft，被 #71 堆叠） | FE2-P3 | `WAITING` | `state=OPEN, isDraft=true, mergedAt=null` | `gh pr view 53 --repo X44421/stillflow --json state,isDraft,mergedAt` | 2026-08-22T09:23:38Z | ox-alpha |
| L3 | `X44421/stillflow#79` | issue（open，**已重绑**） | FE0-D1（重绑已完成）、FE5-M1 | `WAITING` | `state=OPEN`；base 已由 `9891dcf…` 重绑至 `main@f16666e…`（[勘误评论](https://github.com/X44421/stillflow/issues/79#issuecomment-5379712254)，2026-08-22T10:13:07Z）；盘点本体未执行，仍不得约束 FE5 删除任务 | `gh issue view 79 --repo X44421/stillflow --json state,title` | 2026-08-22T10:13:07Z | ox-alpha |
| L4 | E4-S1（Artifact/VerificationBundle 基础，`X44421/stillflow#74`） | capability | FE3-A1 | `MERGED` | `state=MERGED, mergedAt=2026-08-22T08:32:03Z, mergeCommit=f16666e5…`；**非** `AVAILABLE-IN-RELEASE`：服务 API 尚未发布，客户端无法端到端演练 | `gh pr view 74 --repo X44421/stillflow --json state,mergedAt,mergeCommit` | 2026-08-22T09:23:38Z | ox-alpha |
| L5 | E4-S2（VerificationBundle 物化，`X44421/stillflow#80`） | capability | FE3-A1（后续）、FE3-R1（间接） | `WAITING` | `#80 state=OPEN`；Run API 能力未就绪 | `gh issue view 80 --repo X44421/stillflow --json state,title` | 2026-08-22T09:23:38Z | ox-alpha |
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

## 使用说明

1. 认领受影响任务前，重跑该行核验命令并贴入认领评论（协议 §3）。
2. 状态变更走文档 PR 更新本表，并在关联 issue 留评论锚点（协议 §4）。

# 跨仓库依赖台账

> 初始化：2026-08-22（ox-alpha，随 FE0-G0.4 交付）。协议：[cross-repo-dependency-ledger.md](./cross-repo-dependency-ledger.md)。
> 与 Epic #1「基线与当前依赖状态」一致性：2026-09-06T06:40:45Z 刷新 L1/L2/L3/L5（见下存证）；2026-09-06T12:54Z（FE1-G1 #28，REBIND 后新 base `e93722e`）按 SVC-A1/SVC-A2 后的服务实测重写 L4/L5/L6 可用性分层（`MERGED` / `AVAILABLE-IN-DEV` / 非 `AVAILABLE-IN-RELEASE` 三态分离，场景写明）。

| 行号 | 依赖项 | 类型 | 受影响任务 | 当前状态 | 判据说明 | 核验命令 | 最近核验（UTC） | 核验人 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | `X44421/stillflow#71` | PR（merged；原 merge commit 被历史重构孤立，内容经载体入 main，见判据） | FE2-P3 | `MERGED` | GitHub `state=MERGED, mergedAt=2026-08-23T06:46:49Z`，但原 mergeCommit `90fb878e…` 不在当前 main 历史（compare=diverged，main 历史后续重构）；E3 memory-law 内容已随 #53 merge commit `c0e82803…` 进入 main（`0d60a43`/`ed7a71c`/`8058b20` 等提交在 main 祖先链可核）；`AVAILABLE-IN-RELEASE` 未判定（对齐 L4 口径） | `gh pr view 71 --repo X44421/stillflow --json state,mergedAt,mergeCommit`；`gh api repos/X44421/stillflow/compare/90fb878e2ace78a6e1c2698014bca5461f19db59...main` | 2026-09-06T06:40:45Z | X44421 |
| L2 | `X44421/stillflow#53` | PR（merged；E3 栈载体） | FE2-P3 | `MERGED` | `state=MERGED, mergedAt=2026-08-23T08:00:28Z, mergeCommit=c0e82803…`，已在上游 main 历史；#71 栈内容同经该 merge 进入；`AVAILABLE-IN-RELEASE` 未判定（对齐 L4 口径） | `gh pr view 53 --repo X44421/stillflow --json state,mergedAt,mergeCommit` | 2026-09-06T06:40:45Z | X44421 |
| L3 | `X44421/stillflow#79` | issue（closed，completed；经切片 PR 交付） | FE0-D1（已 DONE，openship#10）、FE5-M1 | `MERGED` | `#79 state=CLOSED（state_reason=completed）`；交付切片 PR #83（`d3c07601…`）/#84（`7c5f163a…`）/#87（`ea54a526…`）均 merged 且已在上游 main 历史；FE5 删除任务仍以后续台账核验为准 | `gh issue view 79 --repo X44421/stillflow --json state,title`；`gh pr view 83 --repo X44421/stillflow --json state,mergedAt,mergeCommit`（#84/#87 同） | 2026-09-06T06:40:45Z | X44421 |
| L4 | E4-S1（Artifact/VerificationBundle 基础，`X44421/stillflow#74`） | capability | FE3-A1、FE1-I1（openship#30） | `MERGED` + `AVAILABLE-IN-DEV`（本地）；非 `AVAILABLE-IN-RELEASE` | merged：`state=MERGED, mergedAt=2026-08-22T08:32:03Z, mergeCommit=f16666e5…`（main 祖先可核）。本地/dev：`stillflow-server` @ main `c29d8c4…` 活性探针握手 200、manifest 90 条（`/v1/artifacts` 2 条路由），artifact 元数据/内容路由真实可达（内容可达性由 SVC-A2 #316 完成）。release：StillFlow **无任何 GitHub Releases**（`gh api …/releases` 计数 0，2026-09-06）→ 依协议 §2 不得推定 `AVAILABLE-IN-RELEASE`。适用场景：**本地桌面开发**；Web 远程/release 场景按 `MERGED`（非解锁态）对待，禁止混用 | `gh pr view 74 --repo X44421/stillflow --json state,mergedAt,mergeCommit`；`gh api repos/X44421/stillflow/releases --jq 'length'`；活性探针输出见 #28 closeout | 2026-09-06T12:54:05Z | X44421 |
| L5 | E4-S2（VerificationBundle 物化，`X44421/stillflow#80`） | capability | FE3-A1（后续）、FE3-R1（间接）、FE1-S4→FE1-I1（run 接口位，间接） | `MERGED` + `AVAILABLE-IN-DEV`（本地）；非 `AVAILABLE-IN-RELEASE` | merged：`#80 state=CLOSED（completed）`，载体 PR #175（mergeCommit `533f75ba…` 在 main 历史；#91 为 closed-unmerged 历史证据）。本地/dev：SVC-A2（PR #316，merge `17942f4…`）为 verification 报告产物补建 ArtifactRef 后，`artifact.content`（§6.1 Arrow 流）对该产物类别可达成功（exact-head 验收回执 + 活性探针 200 @ main `c29d8c4…`）。release：StillFlow 无任何 GitHub Releases（计数 0）→ 非 `AVAILABLE-IN-RELEASE`。适用场景：本地桌面开发；Web 远程/release 按非解锁态对待 | `gh issue view 80 --repo X44421/stillflow --json state,title`；`gh pr view 175 --repo X44421/stillflow --json state,mergedAt,mergeCommit`；`gh pr view 316 --repo X44421/stillflow --json state,mergedAt,mergeCommit` | 2026-09-06T12:54:05Z | X44421 |
| L6 | E5（持久化 / Run / Artifact API 面） | capability | FE2-P4、FE3-R1、FE3-R2（间接）、FE3-A1、FE1-I1（openship#30） | `MERGED` + `AVAILABLE-IN-DEV`（本地）；非 `AVAILABLE-IN-RELEASE` | 落地链（替代原「#81 未知占位」）：E5-A1 版本化 API + E5-G1 运行时 e2e → SVC-A1 HTTP 服务入口（PR-1 #306 merge `e36f099…` + 收口 #310 merge `2c801dfd…`，100% manifest 覆盖 + SSE）→ SVC-A2 #316（merge `17942f4…`，报告产物 ref）——全部在 main 祖先链（observed main `c29d8c4…`）。本地/dev：活性探针（`stillflow-server` @ `c29d8c4…`）握手 200、manifest **90 条**（jobs 4 / runs 3 / events 1 / artifacts 2 / exports 8 / plans 8 / datasets 5 / assets 4）、`/v1/events` 空页 200（§3.2 envelope）。release：StillFlow 无任何 GitHub Releases（计数 0）→ 非 `AVAILABLE-IN-RELEASE`。适用场景：本地桌面开发；Web 远程/release 按非解锁态对待 | `gh pr view 306 --repo X44421/stillflow --json state,mergedAt,mergeCommit`（#310/#316 同）；`git ls-remote https://github.com/X44421/stillflow main`；活性探针输出见 #28 closeout | 2026-09-06T12:54:05Z | X44421 |

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

## 核验输出存证（2026-09-06T12:54:05Z 采集，FE1-G1 #28 · REBIND 后）

两仓 observed main（E4，`git ls-remote` 原文）：

```text
openship  main → e93722e8e20a9b10c0ef607db10e21908e0e40dc
stillflow main → c29d8c40ac7ab19d414fc71aee14c49b8c6cd3b9（#320 仅退役根前端原型，服务/manifest 不受影响，路由数仍 90）
```

release 空态证明：

```text
gh api repos/X44421/stillflow/releases --jq 'length'  →  0
```

stillflow-server 活性探针（本地构建 @ stillflow main `c29d8c4…`，`local-trusted` 单 workspace 绑定）：

```text
POST /v1/handshake  → HTTP 200
  selectedVersion: 1 | manifest apiVersion: 1 | manifest route count: 90
  家族分布（路由数）：handshake 1 · assets 4 · engine 1 · datasets 5 · plans 8 ·
  jobs 4 · events 1 · artifacts 2 · runs 3 · exports 8 · quality 1 · drift 2 ·
  workspaces 3（其余为 sessions/connections/verification 等面）
GET /v1/events?streamKind=job&…  → HTTP 200，§3.2 envelope 空页（{"events":[],"nextSequence":null}）
完整握手响应（含 manifest 全量）存验收机 /tmp/g1-probe/handshake.json；探针时间 2026-09-06T12:53:30Z–12:54:05Z
```

e2e/验收链佐证（local/dev 可用性的测试级证据）：SVC-A1 e2e T1–T7（真实 TCP：握手/客户端闭环/取消/事件分页+SSE/SIGTERM/重启/manifest 90 条双向断言）+ SVC-A2 `artifact.content` 对 verification 报告产物可达（PR #310 fail-closed 留痕 → #316 翻转为成功路径），详见各 exact-head 验收回执。

L4 / L5 / L6 判据 JSON：

```json
{"mergeCommit":{"oid":"f16666e59896e2d8bae3b79e188b8f567bb8c534"},"mergedAt":"2026-08-22T08:32:03Z","state":"MERGED"}
{"state":"CLOSED","title":"engine: implement deterministic VerificationBundle materialization (E4-S2)"}
{"mergeCommit":{"oid":"533f75badbb46f75ceb453dcf2f5e54b1384caaa"},"mergedAt":"2026-08-29T09:53:00Z","state":"MERGED"}
{"mergeCommit":{"oid":"e36f099f0c3e412cd46d485ae748c1397f51ef08"},"mergedAt":"2026-09-06T00:54:44Z","state":"MERGED"}
{"mergeCommit":{"oid":"2c801dfdfd372b8a3fbd5600cfef95d4d642f271"},"mergedAt":"2026-09-06T06:58:56Z","state":"MERGED"}
{"mergeCommit":{"oid":"17942f4c0da29de1d582577b0b09bd038562a55f"},"mergedAt":"2026-09-06T08:39:37Z","state":"MERGED"}
```

## 使用说明

1. 认领受影响任务前，重跑该行核验命令并贴入认领评论（协议 §3）。
2. 状态变更走文档 PR 更新本表，并在关联 issue 留评论锚点（协议 §4）。

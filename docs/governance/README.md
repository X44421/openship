# 治理快速索引

> Part of FE0-G0.5（#6）——治理演练交付物。一页索引，细节一律以链接目标为准。

## 新任务上手五步

1. 查 [台账](./ledger.md)：依赖是否 UNBLOCKED 等价状态；
2. 用 [派发单模板](./templates/dispatch-issue-template.md) 发派发单（绑定 expected head）；
3. 执行者 `/claim` 并跑 `git ls-remote https://github.com/X44421/openship main` 复核；
4. 按 [分支与 PR 政策](./branch-and-pr-policy.md) 开分支、提 Draft PR；
5. 验收后按 [DONE 报告模板](./templates/done-report-template.md) 收尾。

## 状态流转

完整状态机、转移表与凭证分类：[dispatch-lifecycle.md](./dispatch-lifecycle.md) §3–§5。

```text
DISPATCHED → CLAIMED → IN_REVIEW → ACCEPTED → DONE
     异常：BLOCKED / REBIND / CANCELLED（见 lifecycle §5 转移表）
```

## 分支与 PR 速查

- 分支文法：`<feat|fix|docs|chore>/issue-<NNN>-<short-slug>`，自最新 accepted `main` 切出
- merge 方式：squash，subject 带 `(#NN)`；禁止直推 `main`
- docs-only 治理分组：单 PR 可覆盖多个治理 issue，条件见 [政策 §4](./branch-and-pr-policy.md)
- 机械检查表（C1–C5）：[政策 §6](./branch-and-pr-policy.md)

## 双验收路径速查

- 消费既有对象 → **路径 B**（交互/UI 验收）；变更下列对象 → **路径 A**（合同流程）：
  generated contracts 消费方式 · transport 等价性 · 包拓扑方向 · 对象模型/IA 冻结文档 · tokens 结构 · schema/version/error 协议
- 强制路径 A 判定表：[acceptance-paths.md §4](./acceptance-paths.md)；证据不可互替声明见其 §5

## 跨仓依赖速查

- 状态枚举：`WAITING / MERGED / AVAILABLE-IN-RELEASE`，判据见 [协议 §2](./cross-repo-dependency-ledger.md)；默认假设「PR merged ≠ API available」
- 核验时点：claim 时 + Ready 前（[协议 §3](./cross-repo-dependency-ledger.md)）
- 示例命令：

  ```bash
  gh pr view 71 --repo X44421/stillflow --json state,isDraft,mergedAt
  ```

- 当前数据：[ledger.md](./ledger.md)（L1–L6）

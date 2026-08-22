# DONE 报告模板

> Part of FE0-G0.1（#2）。进入 DONE 状态前在原 issue 以此结构发布报告。
> 结构与 stillflow 仓库 11 行交接格式逐字段兼容，另加「验收凭证」「回滚点」两节（差异见表 1）。

## 骨架（复制以下整块）

```markdown
## DONE 报告 — <Task ID>

Modified files: <仓库内相对路径列表>
New dependencies: <新增依赖及用途；无则写「无」>
Public API changes: <公开面变化；docs-only 任务写「无（docs-only）」>
unwrap / expect usage: <计数与位置；非代码任务写「不适用」，不得省略本行>
TODO items: <遗留 TODO 及跟踪位置；无则写「无」>
Test results: <逐条命令 + 结果原文或 CI run 链接；文档任务可用链接检查/lint 输出替代，见规则 R1>
Contract deviations: <与冻结合同/派发单的差异；无则写「无」>
Remaining risks: <已知残余风险及观察方式>
Branch name: <分支名>
Commit SHA: <最终完整 SHA>
验收凭证: <验收评论与 PR 事件链接清单>
回滚点: <revert 目标 commit + 一句话影响说明>
```

## 规则

- **R1（文档任务替代规则）**：Test results 行可用「相对链接检查 + markdown lint（若配置）」的原文输出替代代码测试结果，其余字段一律保留。
- **R2**：任何一行都不得删除或改为 N/A 以外的占位；「不适用」也是信息。
- **R3**：Commit SHA 必须是合并进 `main` 的最终 merge commit（squash 场景即 squash 后的 SHA）；PR 分支上的 SHA 无效。

## 表 1 · 与 stillflow 11 行交接结构的映射

| 本模板 | stillflow 交接结构 | 差异说明 |
| --- | --- | --- |
| Modified files … Commit SHA（前 10 行） | 同名字段 | 逐字段一致 |
| Test results | Test results | 新增替代规则 R1（文档任务） |
| unwrap / expect usage | unwrap / expect usage | 新增「不适用」语义（非代码任务），字段不删 |
| 验收凭证 | （无对应） | 新增：ACCEPTED 结论的 E1 锚点 |
| 回滚点 | （无对应） | 新增：lifecycle §9 要求 |

## 填写示例（文档任务）

```markdown
## DONE 报告 — FE0-G0.1

Modified files: docs/governance/dispatch-lifecycle.md, docs/governance/templates/{dispatch-issue,done-report,rebind-record}-template.md
New dependencies: 无
Public API changes: 无（docs-only）
unwrap / expect usage: 不适用
TODO items: 无
Test results: link-check 输出 7/7 OK（2026-08-22T09:41:00Z，见验收凭证第 2 条）
Contract deviations: 无
Remaining risks: 模板首次实战反馈由 FE0-G0.5 收集
Branch name: docs/issue-002-governance-baseline
Commit SHA: <merge 后回填>
验收凭证: 验收评论 #issuecomment-xxx；link-check 输出评论 #issuecomment-yyy
回滚点: revert <merge SHA>，纯文档变更无数据影响
```

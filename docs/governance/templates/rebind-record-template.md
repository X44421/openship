# 重绑记录模板（REBIND Record）

> Part of FE0-G0.1（#2）。触发 REBIND 时在原 issue 以此结构发布记录，然后停止一切 push 等待维护者裁决（lifecycle §7）。

## 骨架（复制以下整块）

```markdown
## REBIND 记录 — <Task ID>

发现时点: <claim 复核 | push 前 | Ready 前 | 其他（说明）>
旧 base（expected head）: `<sha>`
新 base: `<sha>`（`git ls-remote https://github.com/X44421/openship main` 输出原文见下）
失配原因初判: <上游合并了哪些内容 / force-push / 分支重整>
影响面评估:
- rebase 冲突: <预计无 | 列出可能冲突文件>
- 合同/依赖变化: <新 base 是否引入影响本任务范围的合同或台账行变化>
- 凭证有效性: <已发布的 E1–E5 凭证哪些仍有效、哪些需重取>
处置请求: <请求裁决：rebase 继续 | 重新派发 | 取消>
```

并在记录下方粘贴 `git ls-remote` 的**完整原文输出**（E4 要求，带时间戳）。

## 规则

- **R1**：REBIND 记录发布后到维护者裁决前，禁止任何 push 与新的实现提交。
- **R2**：「影响面评估」不得留空；无法判断的项写「未评估 + 原因」，不得写「应该没影响」。
- **R3**：裁决为 rebase 继续后，执行者 must 在新 base 上重跑受影响的检查并补发 E4 输出。

## 填写示例

```markdown
## REBIND 记录 — FE2-P3

发现时点: Ready 前
旧 base（expected head）: `023dd1a2b94adf119291ddb6a1370616c26ea227`
新 base: `<新 SHA>`（ls-remote 输出见下）
失配原因初判: 上游合入了 stillflow#53 相关的 API schema 变更
影响面评估:
- rebase 预计无冲突（本分支仅改 docs/governance/）
- 合同/依赖变化: 台账 L1/L2 行状态需更新（#53 可能已 MERGED）
- 凭证有效性: 原 CLAIM 评论仍有效；link-check 输出需重跑
处置请求: rebase 继续
```

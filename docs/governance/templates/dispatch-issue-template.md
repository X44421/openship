# 派发单模板

> Part of FE0-G0.1（#2）。新建派发单时复制下方骨架填入 issue 正文；字段说明见表 1。

## 骨架（复制以下整块）

```markdown
> **Part of** #1（Phase <P> · <Task ID>）· **风险**：<low | medium | high>
> **派发状态**：<READY | BLOCKED-BY: …> · **基线绑定（expected head）**：`openship/main@<sha>`（<YYYY-MM-DD> 核验）

## 目标
<一句话说明本任务为什么存在、完成后世界有何不同>

## 交付物
<路径级清单：每个仓库内文件或一次评审产出一行>

## 非目标
<明确不做的事；防止范围蔓延与后续争议>

## 约束
<normative 清单，用 must / must not / may>

## 验收标准
- [ ] <每条都可客观检验：给出检查命令、可点击产物或判定规则；禁用「正确完成」「合理即可」>

## CLAIM 方式
评论 `/claim`，附：执行者标识、计划分支名、expected head。
CLAIM 后立即 `git ls-remote https://github.com/X44421/openship main` 复核；
失配即停，按 [rebind-record-template](../templates/rebind-record-template.md) 走 REBIND。

## 依赖
<BLOCKED-BY: Task ID 或 X44421/stillflow#N；无前置写「无前置依赖」>
```

## 表 1 · 字段填写说明

| 字段 | 填写说明 | 示例 |
| --- | --- | --- |
| Task ID | 按 lifecycle §8 文法；子任务 `.N` 递增 | `FE0-G0.1` |
| 风险 | low=仅文档/私有改动；medium=触及客户端合同对象；high=改权威来源/拓扑/协议 | `low` |
| 基线绑定 | 发布派发单时的 `main` 完整 SHA + 核验日期；只是时点证据 | `openship/main@023dd1a…` |
| 目标 | 一句话，可含对上游 issue 的限定引用 | 「建立统一派发状态流转…」 |
| 交付物 | 相对路径精确到文件；评审产出写「××× 评论」 | `docs/governance/lifecycle.md` |
| 非目标 | 用「→ FE?-??」指向承接该工作的任务 | 「不定义分支细则（→ FE0-G0.2）」 |
| 验收标准 | checkbox 形式；每条附证据形态（命令输出/链接/截图） | 「相对链接全部可达（附检查输出）」 |
| 依赖 | 只写可核验项，语法见 ledger 协议 | `BLOCKED-BY: FE0-G0.1–G0.4 全部 DONE` |

## 填写示例（节选自 FE0-G0.5）

> **Part of** #1（Phase 0 · FE0-G0.5）· **风险**：low
> **派发状态**：BLOCKED-BY: FE0-G0.1 / G0.2 / G0.3 / G0.4 全部 DONE · **基线绑定（expected head）**：开工时按 REBIND 规则以最新 `openship/main` 为准

## 验收标准
- [ ] 时间线上每个状态转换都有可点击凭证（E1/E2/E3）
- [ ] 全程未使用任何口头约定传递必要信息

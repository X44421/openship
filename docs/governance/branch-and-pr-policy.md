# 分支、提交与 PR 流转政策

> Status: Accepted · Part of #1（Phase 0 · FE0-G0.2）
> 适用范围：Epic #1 全部工作。范围外以 [CONTRIBUTING.md](../../CONTRIBUTING.md) 为准；冲突裁决见 §6。

## 1. 分支命名

- 文法：`<type>/issue-<NNN>-<short-slug>`，其中
  - `<type>` ∈ `feat | fix | docs | chore`（沿用仓库既有前缀集，CONTRIBUTING §Conventions）；
  - `<NNN>` 为本分支锚定的 openship issue 号，三位零填充；
  - `<short-slug>` 为小写字母数字与连字符。
- 一律自最新 accepted `main` 切出；切出前 must 核验 remote head 并把输出贴入认领评论。
- 一个 issue 一个分支。例外：docs-only 治理分组 PR 锚定组内最小编号 issue，其余 issue 在 PR body 逐一列出（§4）。
- stacked PR 必须在 body 第一行显式声明 base 分支；base 合并后按 stillflow 同名规则 rebase/rebuild 回 `main`。

正则：`^(feat|fix|docs|chore)/issue-[0-9]{3}-[a-z0-9-]+$`

示例：`docs/issue-002-governance-baseline`

## 2. 提交粒度

- Conventional Commits（沿用 CONTRIBUTING §Conventions）：`feat: fix: docs: chore:`，subject 追加 `(#NN)` 引用锚定 issue。
- 原子性：一次提交只建立**一个不变量**或一组不可拆分的文档章节；格式化噪音 must not 与语义变更混入同一提交。
- 禁止「顺手修」无关文件的 lint/prettier 漂移——CONTRIBUTING 质量条款照常适用。

## 3. Draft → Ready → merge

| 变更类型 | 转 Ready 前必须通过 |
| --- | --- |
| 纯文档（本政策治理范围） | 相对链接检查（§7 C4）+ markdown 渲染自查 |
| 前端代码 | `bun run --cwd <workspace> lint` + typecheck + 受影响交互测试 |
| 跨 workspace / 构建 | `bun run test` + `bun run build` |

通用规则：

- Draft 直到所需检查通过且验收凭证齐全，才可转 Ready。
- merge 方式：**squash merge**，subject 保留 `(#NN)` 引用。
- 禁止直接 push `main`。
- 每个 PR 至少一名维护者评审通过方可合并；独立验收者结论（ACCEPTED）先于合并。

## 4. docs-only 治理 PR 分组条款

单个治理 PR may 覆盖多个紧密耦合的治理 issue，当且仅当：

1. PR body 逐一列出全部覆盖的 issue 编号；
2. diff 中不含任何实现变更（代码、构建脚本、CI 配置、fixtures）；
3. 组内每个 issue 各自保留独立验收评论。

对齐 stillflow 仓库 AGENTS.md 的同名规则，跨仓行为一致。

## 5. 与 CONTRIBUTING.md 差异清单

| CONTRIBUTING 条款 | 本政策处理 | 说明 |
| --- | --- | --- |
| §Conventions 分支前缀 `feat/fix/docs/chore` | **兼容扩展**：追加 `/issue-NNN-slug` 锚定段，前缀集不变 | 不引入 stillflow 的 `agent/` 前缀，避免双轨 |
| §Conventions Conventional Commits | 沿用，subject 加 `(#NN)` | 仅追加引用段 |
| §Before you open a pull request「issue first」 | **收紧**：Epic #1 范围的工作还需派发单 + 基线绑定（见 lifecycle） | issue 单独不再构成开工依据 |
| §Pull request quality bar「One change per PR」 | 沿用 + §4 分组例外 | 例外条件显式列举 |
| §Verification「Green before you open」（bun test/lint/format 全量） | 按变更类型矩阵裁剪（§3 表） | 纯文档 PR 不强跑全量测试套件 |
| §Using AI assistants | 沿用；另加 lifecycle `/claim` 身份声明要求 | 执行者身份可审计 |

冲突裁决：Epic #1 范围内，本政策与 CONTRIBUTING 不一致时以**更严格者**为准；范围外一律 CONTRIBUTING。

## 6. 机械检查表

| 代号 | 规则 | 检查方式 | 状态 |
| --- | --- | --- | --- |
| C1 | 分支名合规 | `git rev-parse --abbrev-ref HEAD \| grep -P '^(feat\|fix\|docs\|chore)/issue-[0-9]{3}-[a-z0-9-]+$'` | 本期人工执行于验收流程；CI step 为建议 |
| C2 | main 保护（禁直推） | GitHub 分支保护设置 | 建议（仓库设置项，不在文档 PR 范围内落地） |
| C3 | squash merge | GitHub 仓库设置 | 建议 |
| C4 | 文档相对链接可达 | 见 [验收路径](./acceptance-paths.md) 附录命令 | 本期落地（每次纯文档 PR 验收必跑） |
| C5 | 提交原子性 | 评审逐 commit 审阅 | 人工，长期 |

标注「建议」的条目不阻塞本次交付，由维护者决定何时落入仓库设置。

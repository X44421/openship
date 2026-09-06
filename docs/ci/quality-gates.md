# CI 质量门 Runbook

> Status: Accepted · Part of [FE1-S6（#24）](https://github.com/X44421/openship/issues/24)
> 权威面：[.github/workflows/ci.yml](../../.github/workflows/ci.yml)。本文件是每个必需检查的失败诊断指引与豁免政策的唯一说明。
> 设计约束：必需检查**一律不设 `paths:` 过滤**——路径过滤的必需检查对被排除的 PR 永不报告，PR 会带着不可见的原因永远无法合并（见 ci.yml 头注）。

## 必需检查总览

| Job 名 | 检查内容 | 本文件小节 |
| --- | --- | --- |
| Dependency boundaries | 拓扑守卫双层（词法脚本 + ESLint AST） | [§Dependency boundaries](#dependency-boundaries) |
| Typecheck | apps/api tsc + apps/dashboard tsc（fumadocs 过滤） | [§Typecheck](#typecheck) |
| Test | `turbo run test`（vitest，`@repo/email` 显式排除） | [§Test](#test) |
| Contracts drift | 生成合同与快照逐字节比对 | [§Contracts drift](#contracts-drift) |
| Secret scan | git 全部跟踪文件的凭据形状扫描 | [§Secret scan](#secret-scan) |
| Dependency audit & licenses | OSV 已知漏洞审计 + 许可允许表 | [§Dependency audit](#dependency-audit) / [§License scan](#license-scan) |
| Bundle analysis | 生产 bundle 字节预算 | [§Bundle analysis](#bundle-analysis) |
| （Bundle analysis / Build 矩阵内 step）Production bundle scan | 生产产物 fixture/mock 引用扫描 | [§Production bundle scan](#production-bundle-scan) |
| Build (web/desktop/cli) | 三端构建矩阵 | [§Build matrix](#build-matrix) |
| E2E (real Docker) | 手动 / tag 触发（不在 PR 必需清单内） | [§E2E](#e2e-real-docker) |

## Dependency boundaries

**做什么**：FE1-S1 冻结拓扑（`docs/issues/issue-013-package-topology-contract.md` §2）双层执行——`scripts/check-dependency-boundaries.mjs`（零依赖词法扫描，install 前运行）+ `bun run lint:boundaries`（ESLint `no-restricted-imports` 边集 + 本地 `no-clean-engine-imports` 规则，`--no-inline-config` 不可被 inline 注释压制）。

**失败诊断**：输出会指出违规边与文件。生产代码导入 `@repo/core` 的 clean 子树、或任何逆拓扑边 → 删除该导入；确需新增授权边 → 先修订 FE0-C2 拓扑合同再动代码。蓄意混淆形态（`String.raw`、运行时拼串）不在守卫范围（静态不可判定边界，见 #19 验收记录）。

## Typecheck

**做什么**：`apps/api` 的 `tsc --noEmit`；`apps/dashboard` 的 `tsc --noEmit` 并**过滤 fumadocs 预存错误**（`grep -v fumadocs`，其余 `error TS` 仍会失败）。

**失败诊断**：api 报错 → 修类型；dashboard 报错且行内含 `fumadocs` → 属预存基线（勿改生成物）；非 fumadocs 报错 → 修类型。仓库没有 `turbo typecheck` task；本 job 即权威 typecheck 面。

## Test

**做什么**：根脚本 `bun run test` = `turbo run test --filter=!@repo/email --concurrency=1`。`@repo/email` 被显式排除：其 package 无 test script、属 FE5 退役序列的遗留应用；排除是**成文决定**，不是静默跳过。

**失败诊断**：本地复跑 `bun run --cwd <pkg> test`。时序敏感用例（如 `health-watch.test.ts`）在满载并行下可能 flake——先隔离复跑确认，再判断是否回归。

## Contracts drift

**做什么**：`bun run --cwd packages/contracts verify`——把 `src/generated/wire.ts` 与 `schema/logical-schema.snapshot.json` 的生成输出逐字节比对。

**失败诊断**：只允许一条修复路径——`bun run --cwd packages/contracts generate` 重新生成，**禁止手改生成物**。上游（stillflow）合同演进时：更新快照 ref → 重新生成 → drift 过 → 在 PR 中引用上游 merge commit。

## Secret scan

**做什么**：`node scripts/check-secrets.mjs` 零依赖扫描 `git ls-files` 全部文本文件，只命中**高置信**凭据形状（AWS AKIA、私钥含 body、GitHub/Slack/Google/Anthropic/OpenAI token、高熵凭据赋值）。install 前运行——依赖安装坏了它也必须能跑。

**失败诊断与豁免政策**：

1. 命中是真凭据 → 立即吊销并从历史清除（本扫描不解决历史泄漏，只防新增）；
2. 命中是测试 fixture / 占位文本 → 在**同一行**加内联标记 `secret-scan:allow(<具体理由>)`，并在 PR 描述列出；无理由的标记本身即违规；
3. 私钥检查要求 header 后跟 ≥40 位 base64 body——占位符/i18n 模板/覆盖断言只有 header 不会命中，因此**没有**私钥类豁免。

## Dependency audit

**做什么**：`node scripts/check-dependency-vulnerabilities.mjs` 零依赖遍历所有已安装树（根 + 各 workspace 的 node_modules，跳过构建产物目录），对每个 `name@version` 查询 OSV batch API。**API 不可达 = 失败**（fail-closed，不可检查 ≠ 通过）。

**失败诊断与豁免政策**：

1. 优先处置：依赖补丁升级（lockfile/manifest PR）或根 `package.json` `overrides` 提升传递依赖；
2. 无上游修复、或升级被消费者 range 阻断时 → 在 `scripts/check-dependency-vulnerabilities.mjs` 的 `IGNORES` 加 `package@GHSA-id` 条目 + **具体理由**（影响面、为何不升级、追踪点），PR 描述列出；`IGNORES` 之外任何漏洞一律失败；
3. 当前已复核豁免见脚本内 `IGNORES`（esbuild dev-server 类 ×2、tar 7.5.x 线 ×12、image-size 无修复 ×2、extract-zip 无修复 ×1）。

## License scan

**做什么**：`node scripts/check-licenses.mjs`——第一方 manifest（apps/packages/fixtures）必须携带允许表内的 SPDX 表达式（缺失字段继承根 Apache-2.0，声明了则必须过表）；第三方（node_modules）每个 `name@version` 必须在 `ALLOWLIST` 或带理由的 `ALLOWANCES`（绑定**精确许可串**）内。

**失败诊断与豁免政策**：新增依赖引入未知许可 → 查上游 LICENSE 属实后在脚本 `ALLOWANCES` 加 `name → {license, reason}` 并在 PR 描述列出；许可串变更后原豁免自动失效（按精确串绑定），再次失败需重新复核。

## Bundle analysis

**做什么**：`node scripts/analyze-bundles.mjs [target...]`——度量生产输出字节并对照 `BUDGETS` 冻结预算（排除 `cache/`、`node_modules` 段）。中心 job 度量 api/dashboard/client；web/cli 由构建矩阵各自度量。

**失败诊断与豁免政策**：超预算 → 先找无谓体积（依赖误入 bundle、未压缩资产）；确属正当增长 → 在脚本中提高该项预算并在 PR 描述写明「哪个功能、新实测值」——预算上调本身是 PR 可见变更。

## Production bundle scan

**做什么**：`node scripts/check-production-bundle.mjs <输出目录>...`（FE1-S5 #23 交付）——扫描目标拓扑生产面（dashboard 的 `.next`、desktop 的 `dist`、cli 的 `dist`）中的 fixture/mock 标记：`@stillflow/dev-fixtures`、`fixtureId`、`SAMPLE_CUSTOMER`、`MOCK_VARIANTS`、`preview-fixtures`、`openship-dev-mode`、`/constants/mock`。该 step 挂在 Bundle analysis job（dashboard 面）与 Build 矩阵 desktop/cli leg 内。

**失败诊断与豁免政策**：

1. 唯一路径豁免：dashboard 的 **`/dev/` 路由段**（`app/(dashboard)/dev/**`）——开发专用检视面（如 `/dev/monitoring`），其页面 chunk 合法携带预览 fixtures；豁免按路径段机械生效，不按文件名或内容；
2. 标记清单（`MARKERS`）的增删是 PR 可见变更，每项需附理由；
3. 命中后：从生产面移除引用（fixture 数据改经 dev-only 路由或测试注入）；dev 专有 UI（如 dev 横幅）必须依赖 `NODE_ENV` 内联使标记被 tree-shake。

## Build matrix

**做什么**：三端各一 leg——web（`next build` + 自身预算）、desktop（`electron-forge package` 打包冒烟；签名/公证/更新通道 → FE4-D1）、cli（tsup 构建 + 自身预算）。

**失败诊断**：web 失败多为 Next 配置/类型；desktop 失败查 electron 下载（runner 网络）与 forge 配置；cli 失败查 tsup 入口。任一 leg 红 = 门红（`fail-fast: false` 保证其余 leg 仍产出日志）。

## E2E (real Docker)

**手动 / tag 触发**（`workflow_dispatch`、`v*` tag），**不在 PR 必需清单**。`RUN_DOCKER_E2E=1` 使无 daemon 时显式失败而非静默 skip。发布可恢复性由 tag 运行把关（见 ci.yml `e2e-docker` 注释）。

## 与 PR 模板的一致性

`.github/pull_request_template.md` 的 Quality gates 一节逐条列出上表必需检查，PR 作者在描述中确认本 PR 已通过（或说明为何不适用）。两者不一致时以 ci.yml 为权威，并走文档 PR 修模板/本文件（协议：台账/文档变更走 PR + 锚点评论）。

# 安全弃用顺序（FE0-D0）

> Part of [Epic #1](https://github.com/X44421/openship/issues/9) · 输入：[openship-inventory.md](./openship-inventory.md)、[cross-repo-prototype-boundaries.md](./cross-repo-prototype-boundaries.md) §5
> 原则：每片独立可评审、可回滚；替代路径验收完成前不动删除键；root 共享文件（package.json / lockfile / CI）为独占写锁，禁并行改。

| 切片 | 内容（inventory 行） | 触发条件（前置） | 验证 | 回滚点 |
| --- | --- | --- | --- | --- |
| S1 fixture 隔离 | B7 monitoring/fixtures.ts、E5 clean/sample.ts、根 `fixtures/` | `dev-fixtures` 包落地（FE1-S1/S5）且生产 bundle 扫描就绪 | bundle 扫描零命中 + 页面走查 | revert 单 commit |
| S2 手写合同替换 | E4 types.ts 平行副本 | generated contracts 发布并过漂移检查（FE1-S1/S6） | 类型对拍 + 引用全量切换 | revert 单 commit |
| S3 执行引擎退役 | E1/E2/E3 execute+validate+fingerprint；studio 本地回退断开 | L1/L2（Preview）可用；Run 语义按 L5 就绪度分批 | CI 引擎扫描零命中（FE0-C1 §4 守卫）；e2e 走真实 API | revert 单 commit |
| S4 旧业务页面退役 | dashboard 内 monitoring/billing/projects/deployments 等页面 | FE0-C0 page-migration-map 全覆盖 + 替代页面独立验收 | e2e 无悬挂路由/import 搜索存证 | 每页一 commit 可单独 revert |
| S5 服务端分片退役 | api 的 auth/workspace/billing 控制面 + packages/db schema + compose 对应服务 | 对应客户端能力（FE4-W1 等）由 stillflow 承接且数据迁移说明成文 | 分片清单逐项验收 + 双写禁令检查 | 每片含数据迁移回滚说明 |
| S6 adapters 退役 | packages/adapters 全部子树 | 其唯一消费方 api/cli 的旧命令已下线（S5 后） | import 搜索零命中 + build 绿 | revert 单 commit |
| S7 邮件子系统退役 | apps/email + packages/db-email | 无业务引用窗口期声明 | 服务下线观察窗 + 数据归档说明 | 归档镜像恢复 |
| S8 营销站处置 | apps/web | FE5-R1 品牌/包名迁移完成，新落地页裁决 | 品牌验收单 | revert 单 commit |

## 禁则

- 任何两片禁止共享同一次 PR；root 共享文件改动串行化；
- S3 未完成前，studio 不得出现「API 不可用时回退本地执行」的任何代码路径；
- undecided 行（ui/onboarding/fixtures）在转正前不得进入任何切片范围。

## 顺序依据

S1→S2→S3 按边界盘点 §5 的约束推导（先隔离假数据、再换合同、最后删引擎）；S4–S8 依赖递减：每片的前置都是前一阶段建立的目标物。切片与 Epic FE5-D1/D2/D3/R1/M1 的映射在对应任务派发时逐一对齐。

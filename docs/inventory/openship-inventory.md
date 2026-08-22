# Openship 全仓能力与边界盘点（FE0-D0）

> Part of [Epic #1](https://github.com/X44421/openship/issues/1) Phase 0 · 交付 issue：X44421/openship#9
> 证据基线：`main@ff33c31…` 工作树 + 各 `package.json` 声明（2026-08-22 检视）· 方法与盲区声明见 §4

## 1. Workspace 成员盘点表

标注五值：retain（直接保留）/ adapt（改造后复用）/ replace(由目标物替代) / delete（退役）/ undecided。

| 路径 | 职责 | 标注 | evidence | owner / 后续 |
| --- | --- | --- | --- | --- |
| `apps/dashboard` | Next.js 运营台：projects/deployments/billing/monitoring 等业务页 + `src/studio` 清洗工作台（xyflow） | **adapt** —— StillFlow Web 客户端基座；页面级去留由 FE0-C0 映射裁决；studio 为 FE2-P1/P2 基础 | `package.json`（next/react/ag-grid-react/@xyflow/react/chartjs）；`src/studio/StudioApp.tsx` | FE2-P1/P2、FE5-D1 |
| `apps/web` | 营销落地站（landing） | **replace** —— 客户端套件不含营销站；品牌落地页在 FE5-R1 一并裁决 | `package.json`（next/react/zod）；`src/components/landing/*` | FE5-R1 |
| `apps/api` | Hono API：auth(better-auth/drizzle)、队列(bullmq/ioredis)、typebox 校验 | **replace** —— 权威后端 = stillflow-api(Rust)；本服务随 FE5-D2 分片退役，反向代理/静态托管职责是否保留 → C2 拓扑裁决 | `package.json` deps；`docker-compose.yml` service `api` | FE5-D2、FE0-C2 |
| `apps/cli` | `openship` CLI（commander）：deploy/manage/open | **adapt** —— FE4-C1 headless 客户端骨架可复用，业务命令重写为 import/profile/preview/run/export | `package.json` bin/commander | FE4-C1 |
| `apps/desktop` | Electron 桌面壳（electron-forge 打包 deb/dmg/rpm/zip），加载已部署 dashboard | **adapt** —— FE4-D1 本地 shell 基座；壳选型与本地进程模型按 Epic 重定义 | `package.json` devDeps electron+forge 全家桶、description「Electron wrapper for the deployed…」 | FE4-D1、FE0-C2 |
| `apps/email` | 自托管邮件（iRedMail 引擎 + Zero 邮件面） | **delete** —— 与客户端套件无关 | `package.json` description | 维护者 / FE5-D2 尾片 |
| `packages/core` | 共享核心库（access-grants/audit-taxonomy/app-templates/**clean**/utils 等） | **adapt**（拆解）—— 非 clean 工具按引用迁往 client/ui 包后原位退役 | `src/` 目录清单（ls 输出存证） | FE1-S1/S2 |
| `packages/core/src/clean` | **TS 清洗平行合同 + 执行器 + fingerprint**（929 行） | **delete** —— 第二执行引擎，见边界盘点 B1–B6 | [cross-repo-prototype-boundaries.md](./cross-repo-prototype-boundaries.md) §3.1 | FE5-D3 |
| `packages/ui` | 共享 React UI 组件 | **undecided** —— 组件清单未检视，无法判定 retain 还是并入 studio-ui | 缺证据：组件导出面未枚举 | 前端负责人 / FE1-S2 开工时定 |
| `packages/adapters` | 部署编排：archive/backup/dockerfile/infra/runtime/toolchain/system | **delete** —— 旧 Deployment 后端能力本体，FE5-D2 对象 | `src/` 子目录清单（ls 存证） | FE5-D2 |
| `packages/db` | drizzle Postgres schema（控制面数据） | **delete** —— 权威存储改 stillflow SQLite/Parquet；数据迁移说明归各删除切片 | `package.json`（drizzle-orm/kit）；docker-compose `postgres` | FE5-D2 |
| `packages/db-email` | vmail.* 邮件库 schema（自述 byte-compatible） | **delete** —— 随 apps/email | `package.json` description | FE5-D2 尾片 |
| `packages/onboarding` | onboarding 流程共享逻辑 | **undecided** —— 是否进入客户端套件属产品裁决 | 引用方：dashboard/desktop/cli | 维护者 / FE0-C0 时定 |
| `fixtures/`（根目录） | 原型样例数据 | **undecided** —— 内容未检视；去向 dev-fixtures 或 delete | 根目录 ls | FE1-S5 |

## 2. 根级基础设施盘点

| 路径 | 职责 | 标注 | evidence |
| --- | --- | --- | --- |
| `docker-compose.yml` | postgres/redis/api/dashboard/web 五服务编排 | **replace** —— 目标形态为 stillflow 本地进程 + 新客户端；编排重写归 FE4-D1 | services 列表 grep 存证 |
| `.github/workflows/ci.yml` | root npm ci/typecheck/build 门禁 | **adapt** —— FE1-S6 按 Web/Desktop/CLI 矩阵重写；过渡期保持绿 | workflow 文件 |
| `.github/workflows/{docker-images,release}.yml` | 镜像与发布 | **undecided** —— 发布形态待 FE5-R1 | workflow 文件存在性 |

## 3. TypeScript 内的第二执行引擎清单（FE5-D3 直接输入）

| # | 位置 | 能力 | 处置 |
| --- | --- | --- | --- |
| E1 | `packages/core/src/clean/execute.ts` | LogicalPlan/Rule 在 TS 内真实执行变换 | 删除；替代 = Preview/Run API |
| E2 | `packages/core/src/clean/validate.ts::planFingerprint` | TS 计算 plan fingerprint（canonical 违规） | 删除；fingerprint 只读后端值 |
| E3 | `packages/core/src/clean/validate.ts::validatePlan` | Plan DAG 校验复刻 | 删除；客户端仅非权威即时校验 |
| E4 | `packages/core/src/clean/types.ts` | 手写 wire 合同副本（常量漂移实锤：500 行/1 MiB vs 后端 1,000–10,000 行/50 MiB） | 由生成合同替代后删除 |
| E5 | `packages/core/src/clean/sample.ts` | 生产可达 fixture（aligned with stillflow sample-customers） | 先隔离 dev-fixtures 再断 import |

候选扫描声明：对 core 其余文件做 `groupBy|aggregat|pivot` 词法扫描命中 utils/errors/host-firewall/compose-spec/proxy-settings/object-storage 六文件，抽样确认为部署语义的聚合（错误聚合等），非数据引擎；全量机械复核由 FE0-C1 §4 的 CI 扫描守卫落地后长期承担。监控类 fixtures（B7）不属于引擎但属生产可达 mock，一并受 FE1-S5 管辖。

## 4. 方法与盲区

- 盘点行 evidence 以 package.json 声明、目录清单与定向 grep 为准；**未逐文件通读任何模块**；
- 已知盲区：ui 组件面、onboarding 功能面、fixtures/ 目录内容、静默 fallback 逐 catch 核验——全部对应 undecided 行或后续任务，禁止据此整目录删除；
- 与 [cross-repo-prototype-boundaries.md](./cross-repo-prototype-boundaries.md) 的关系：该文件提供越界深查（B 面），本表提供全覆盖面；冲突时以更细证据的一方为准并回改另一方。

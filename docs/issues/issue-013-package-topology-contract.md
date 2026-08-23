# 目标包拓扑合同（FE0-C2）

> Status: Draft-Frozen · Part of [Epic #1](https://github.com/X44421/openship/issues/1) Phase 0 · 交付 issue：X44421/openship#13
> 输入：FE0-D0 盘点标注、依赖图（声明级边全量）；权威边界 = FE0-C1 合同

## 1. 目标包职责矩阵

| 包 | 职责 | 权威边界 |
| --- | --- | --- |
| `@stillflow/contracts`（新） | 由 Rust/API schema 生成或机械校验的 DTO/枚举/版本常量 | 只含生成物；禁手写业务类型 |
| `@stillflow/client`（新） | transport、认证、错误归一化、取消/重试、双 transport 适配 | 消费 contracts；禁 UI、禁本地执行 |
| `@stillflow/studio-ui`（新） | 无业务权威逻辑的 UI 组件（表格/检查器/图编辑/diff/事件流/错误边界） | 消费 contracts 类型；禁网络调用 |
| `@stillflow/dev-fixtures`（新） | 测试/Storybook/开发入口专用数据工厂 | 生产入口禁 import（CI 扫描） |
| `apps/web-client`（由 dashboard 改造） | Web 客户端应用壳与页面 | 消费 client+studio-ui；禁直连裸 HTTP、禁 clean 引擎 |
| `apps/desktop` | 本地 shell（Electron 基座，FE4-D1 重定义） | 经 client 的本地 transport；禁第二套协议 |
| `apps/cli` | headless import/profile/preview/run/export | 复用 client+contracts；输出稳定 JSON |
| 旧 `@repo/core` | 按引用拆解后退役 | clean 子树即删（FE5-D3）；其余工具迁入上述新包 |
| 旧 `@repo/ui` | 组件清单复核后并入 studio-ui 或保留别名过渡 | FE1-S2 裁决 |
| 旧 `packages/{api,db,adapters,email,db-email,onboarding,web}` | 退役对象（见盘点表） | 不进入目标拓扑 |

## 2. 依赖方向

允许（→ = 依赖）：

```text
web-client / desktop / cli  →  client →  contracts
web-client                  →  studio-ui → contracts
dev-fixtures                →  contracts（仅测试/开发入口引用 fixtures）
```

禁止：

- 任何包 → `apps/*`（应用不可被依赖）；
- `contracts` / `studio-ui` / `client` → `dev-fixtures`；
- client/studio-ui 之间互相依赖（client 不依赖 UI，UI 不发请求）；
- 一切对新 `@stillflow/*` 之外旧包（`@repo/core` 等）的新增依赖（存量按切片消化）；
- desktop/cli 绕过 client 直连 HTTP/IPC。

违规处置：依赖 lint（FE1-S1 落地草案：eslint no-restricted-imports + boundaries 检查脚本）→ CI fail。

## 3. 重命名与发布兼容策略

- 旧包不重命名、不发版：以「新增 @stillflow/* + 存量切片退役」避免大范围 rename 噪声（Epic 约束）；
- `@repo/ui` 若保留，过渡期 alias `@stillflow/studio-ui` 可与之并存，但禁止互相 import；
- workspace 外发布（npm）非本期目标：全部 workspace:* 内联；未来发布需主版本对齐 stillflow 合同版本。

## 4. 复用与隔离清单（对 D0 标注逐行对照）

| D0 行 | D0 标注 | 拓扑裁决 | 出入说明 |
| --- | --- | --- | --- |
| apps/dashboard | adapt | → web-client 基座 | 一致 |
| apps/cli | adapt | → cli 基座 | 一致 |
| apps/desktop | adapt | → desktop 基座 | 一致；壳重定义归 FE4-D1 |
| apps/web | replace | 不入拓扑 | 一致 |
| apps/api、packages/db、adapters、email、db-email | delete | 不入拓扑 | 一致 |
| packages/core | adapt（拆解） | clean 删、工具迁 client/ui | 一致；迁移映射在 FE1-S1 执行单中列明 |
| packages/ui | undecided | 暂不入拓扑，FE1-S2 开工时定 | 一致（undecided 不入是保守执行） |
| packages/onboarding | undecided | 暂不入拓扑 | 一致 |
| fixtures/ | undecided | 归 dev-fixtures 或删，FE1-S5 定 | 一致 |

## 5. 无环证明

对 §1–§2 的目标拓扑边集做静态检查（ad-hoc 脚本，拓扑序存在性判定），输出原文存证于 issue #13。目标边集：`{web-client→client, web-client→studio-ui, desktop→client, cli→client, client→contracts, studio-ui→contracts, dev-fixtures→contracts}` —— 显然 DAG（contracts 为唯一汇）；脚本输出作为机械凭证。

## 6. 验收对照

职责矩阵一行一签 ✓ · 方向表+违规处置 ✓ · 重命名/兼容策略 ✓ · 与 D0 逐行对照零未解释出入 ✓ · 无环证明 ✓ · link-check 见 PR。

# 前端对象模型与信息架构合同（FE0-C0）

> Status: Draft-Frozen · Part of [Epic #1](https://github.com/X44421/openship/issues/1) Phase 0 · 交付 issue：X44421/openship#12
> 前置事实输入：FE0-D0 `all-routes.txt`（72 条路由）、`openship-inventory.md`；权威来源约束 = FE0-C1 冻结合同 §2

## 1. 对象显示模型（十一对象）

| 对象 | 显示字段（来源均为服务端/C1 分类，另注者除外） | ID 方案 | 主路由 | 生命周期要点 |
| --- | --- | --- | --- | --- |
| Workspace | name、role、member-count | 服务端 UUID | `/`（单工作区 v1，切换入口预留） | 成员变更走邀请流 |
| Asset（Connector） | 类型、名称、状态、凭据**引用存在性**（凭据值永不显示） | UUID | `/connectors`、`/connectors/[id]` | 创建→测试连接→可用/失败；删除需无引用检查 |
| Dataset | 名称、LogicalSchema（生成合同）、row/byte 计数、来源 lineage 摘要 | UUID | `/datasets`、`/datasets/[id]` | 版本只增；大表虚拟化+服务端分页（FE2-D1） |
| Session | 状态（active/locked/readonly）、归属 dataset | UUID | `/datasets/[id]?session=[sid]`（dataset 详情内会话轴） | 创建→编辑→锁定→只读归档 |
| Plan | 图编辑模型（客户端）↔ canonical plan（服务端）；fingerprint 只读展示 | UUID | `/plans`、`/plans/[id]`（Studio） | 草稿自动保存；版本历史服务端权威（FE2-P4） |
| Preview | bounded rows、schema delta、warnings、truncation/scan/exhausted 标记 | 无独立持久对象（请求作用域） | 附着于 Plan Studio 节点面板 | 结果随节点选择；旧响应不得覆盖当前选择（FE2-P3 断言） |
| Run | status、参数摘要、时间戳族、错误分类 | UUID | `/runs`、`/runs/[id]` | 提交（幂等键）→运行→成功/失败/取消；语义细节按 L5 合同解锁后复核 |
| Artifact | kind、digest（ContentDigest 展示原值）、计数族、lineage、兼容性 | UUID | `/artifacts`、`/artifacts/[id]` | 只读；下载走流式 |
| Finding | severity、字段/行定位、来源 run/plan 引用、disposition | UUID | `/findings`（及 dataset/run 详情联动过滤） | open→acknowledged/dismissed（权限与审计在服务端） |
| Profile | 列级分布、缺失率、异常值、版本间 drift | 以 dataset 版本为锚 | `/datasets/[id]/profile` | 随版本快照；阈值提示为展示逻辑 |
| Export | 目标格式/目的地、任务状态、产物链接 | UUID | `/exports` | 提交→运行→可下载；大文件流式不经浏览器内存整包 |

## 2. 全局状态语义（五态）

| 态 | 全局规则 |
| --- | --- |
| 空态 | 每列表/详情必须给「下一步动作」入口（如 connectors 空 → 创建连接器引导） |
| 加载 | 骨架屏；同一视图禁止叠加多次 loading 指示；分页续载不整屏替换 |
| 失败 | typed error 原样呈现 + 重试入口 + trace id 可复制；禁止静默回退假数据 |
| 权限不足 | 服务端 403 语义驱动 UI 禁用态并说明所需能力；客户端不做本地权限推断 |
| 恢复 | 断线重连后全量对账当前视图；乐观标记必须被服务端状态收敛 |

## 3. 导航关系

```mermaid
graph LR
  WS[Workspace/] --> CONN[/connectors]
  WS --> DS[/datasets]
  DS --> DID["/datasets/[id]"]
  DID --> PROF[profile]
  DID --> SES[Session 轴]
  SES --> PLAN[/plans/studio]
  PLAN --> PREV[Preview 面板]
  PLAN --> RUNS[/runs]
  RUNS --> RID["/runs/[id]"]
  RID --> ART[/artifacts]
  ART --> EXP[/exports]
  DID --> FND[/findings]
  WS --> SET[/settings·members]
```

## 4. 兼容跳转与迁移指标

旧路由命中退役项时 302 到映射目标并在 query 带 `__migrated_from=`，埋点统计迁移命中率（FE5-D1 验收输入）。映射表见 [page-migration-map.md](../inventory/page-migration-map.md)。

## 5. 验收对照

十一对象全覆盖 ✓ · 字段权威来源与 C1 §2 一致（冲突即停条款生效中，本稿零冲突）✓ · 路由可追溯 ✓ · 五态齐全 ✓ · 孤立页面禁令由映射表机械比对 ✓

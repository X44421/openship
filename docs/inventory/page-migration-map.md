# 旧页面迁移映射表（FE0-C0）

> 输入：`all-routes.txt` 72 条（dashboard 50 + web 22；全量清单元数据见 [all-routes.txt](./all-routes.txt)）· 判定统计：{'adapt': 22, 'undecided': 6, 'retire': 22, 'replace': 22}
> 规则：retire 项上线时 302 至映射目标（或产品首页）并带 `__migrated_from=` 埋点；undecided 禁止进入 FE5-D1 删除切片。

| 旧路由 | 判定 | 去向 | 备注 |
| --- | --- | --- | --- |
| `dashboard/(auth)/forgot-password` | adapt | 新认证页组 |  |
| `dashboard/(auth)/login` | adapt | /login |  |
| `dashboard/(auth)/register` | adapt | /register |  |
| `dashboard/(auth)/reset-password` | adapt | 新认证页组 |  |
| `dashboard/(auth)/select-organization` | undecided | 多工作区语义 v1 未定（Epic 单工作区） |  |
| `dashboard/(auth)/verify-email` | adapt | 新认证页组 |  |
| `dashboard/(dashboard)` | adapt | / 工作区首页 |  |
| `dashboard/(dashboard)/(deployment)/build/[id]` | retire | Run Center /runs 替代 | FE5-D1 |
| `dashboard/(dashboard)/(deployment)/deploy/[slug]` | retire | 部署向导由 Import Wizard(FE2-A2)+Run 提交替代 | FE5-D1 |
| `dashboard/(dashboard)/(deployment)/deploy/mail` | retire | 邮件子系统 S7 |  |
| `dashboard/(dashboard)/apps` | retire | 旧应用目录（含 mail 安装）随邮件子系统退役 | S7 |
| `dashboard/(dashboard)/apps/new` | retire |  |  |
| `dashboard/(dashboard)/apps/new/[appId]` | retire |  |  |
| `dashboard/(dashboard)/apps/new/mail` | retire |  |  |
| `dashboard/(dashboard)/audit` | adapt | /provenance（FE4-A1） |  |
| `dashboard/(dashboard)/backups` | adapt | /artifacts（Snapshot/Artifact 视图） |  |
| `dashboard/(dashboard)/backups/[id]` | adapt | /artifacts/[id] |  |
| `dashboard/(dashboard)/billing` | retire | 客户端套件无 Billing 对象；商业化归独立产品面（维护者确认） |  |
| `dashboard/(dashboard)/billing/[tab]` | retire |  |  |
| `dashboard/(dashboard)/deployments` | retire | /runs 替代（FE3-R1） | FE5-D1 |
| `dashboard/(dashboard)/dev/attention` | retire | 开发期工具页 |  |
| `dashboard/(dashboard)/dev/issues` | retire | 开发期工具页；质量发现归 /findings |  |
| `dashboard/(dashboard)/dev/monitoring` | retire | 开发预览页；正式能力在 /profiles |  |
| `dashboard/(dashboard)/domains` | retire | 域名管理属旧部署产品 |  |
| `dashboard/(dashboard)/emails` | retire | 邮件子系统 S7 |  |
| `dashboard/(dashboard)/emails/webmail` | retire | S7 |  |
| `dashboard/(dashboard)/issues` | adapt | /findings（FE3-Q1） |  |
| `dashboard/(dashboard)/jobs` | adapt | /automations（FE4-J1） |  |
| `dashboard/(dashboard)/jobs/[key]` | adapt | /automations/[id] |  |
| `dashboard/(dashboard)/jobs/[key]/edit` | adapt | /automations/[id]/edit |  |
| `dashboard/(dashboard)/jobs/new` | adapt | /automations/new |  |
| `dashboard/(dashboard)/library` | adapt | /connectors（Library→Assets/Connectors 映射） |  |
| `dashboard/(dashboard)/members` | adapt | /settings/members（FE4-W1） |  |
| `dashboard/(dashboard)/monitoring` | adapt | /profiles（Monitoring→Profile/Drift 映射） |  |
| `dashboard/(dashboard)/pipelines` | adapt | /plans（Pipelines→Cleaning Plan Studio） |  |
| `dashboard/(dashboard)/projects` | adapt | /datasets（Projects→Dataset/Session 映射） |  |
| `dashboard/(dashboard)/projects/[id]/[[...slug]]` | adapt | /datasets/[id] |  |
| `dashboard/(dashboard)/servers` | retire | 服务器管理属旧部署产品；来源配置归 /connectors |  |
| `dashboard/(dashboard)/servers/[serverId]` | retire |  |  |
| `dashboard/(dashboard)/servers/new` | retire |  |  |
| `dashboard/(dashboard)/settings` | adapt | /settings |  |
| `dashboard/(dashboard)/settings/migration/switch-back` | retire | 旧迁移回退页，一次性功能已过窗口 |  |
| `dashboard/(onboarding)/onboarding` | undecided | onboarding 产品裁决（inventory 同标 undecided） |  |
| `dashboard/accept-invite/[id]` | adapt | /settings/members（邀请流） |  |
| `dashboard/auth/callback/close` | retire | OAuth 回调按新认证流重设计 |  |
| `dashboard/auth/callback/install` | retire |  |  |
| `dashboard/authorize` | undecided | owner=维护者：MCP/OAuth 授权面是否进客户端套件 |  |
| `dashboard/cloud-authorize` | undecided | 同 authorize |  |
| `dashboard/cloud-connect-callback` | undecided | 同 authorize |  |
| `dashboard/mcp/authorize` | undecided | 同 authorize（MCP 面向 AI 客户端，或与 C1 守卫相关联保留） |  |
| `web/(docs)/docs/[[...slug]]` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/about` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/contact` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/features` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/features/[slug]` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/mail` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/mail/setup-guide/android` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/mail/setup-guide/desktop` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/mail/setup-guide/ios` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/mail/setup-guide/nodemailer` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/pricing` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/privacy` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/roadmap` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/terms` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/(marketing)/trust` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/changelog` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/changelog/[slug]` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/download` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/login` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/resources` | replace | FE5-R1 品牌/落地页裁决 |  |
| `web/(site)/resources/[...slug]` | replace | FE5-R1 品牌/落地页裁决 |  |

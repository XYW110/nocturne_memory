# PRD 缺失功能差距分析

## Goal

从代码逆向工程出所有已实现的功能集合，减去历史 PRD 中已经记录的部分，得到尚未被任何 PRD 记录的缺失功能清单。为后续文档补齐提供完整的依据。

## 背景

### 项目架构

nocturne_memory 是一个 AI Agent 灵魂记忆管理系统，包含：
- **后端**：FastAPI + MCP Server（Model Context Protocol）
- **前端**：React + Tailwind CSS Web Dashboard
- **数据存储**：SQLite/PostgreSQL + edges 表（记忆节点）

### 已有 PRD 记录的功能

| PRD | 文件 | 覆盖范围 |
|-----|------|----------|
| 记忆模板系统 | `.trellis/tasks/archive/2026-06/06-27-memory-templates/prd.md` | 模板结构、关系类型、六维情感、locked 保护、MCP 反知识污染、模板相关 API |
| 情感面板重构 | `.trellis/tasks/archive/2026-06/06-29-emotion-panel-redesign/prd.md` | 情感面板拆分到独立 /soul 页面、二级 Tab 结构 |
| 前端 UI 统一 | `.trellis/tasks/archive/2026-06/06-30-frontend-ui-unify/prd.md` | CSS 变量、Tailwind theme、全站基础色统一 |

---

## 缺失功能清单（Gap List）

以下功能在代码中已实现，但未在任何 PRD 中记录。

### 一、Review/Changeset 审查系统

**概述**：基于变更组（Group）的记忆变更审查机制，AI 通过 MCP 写入的记忆变更会进入待审查队列，人工可查看 diff、回滚或批准。

**前端 API 调用**（`frontend/src/lib/api.js`）：
- `getGroups()` — `GET /review/groups` — 获取待审查变更组列表
- `getGroupDiff(nodeUuid)` — `GET /review/groups/{nodeUuid}/diff` — 获取变更组详情（before/after diff）
- `rollbackGroup(nodeUuid)` — `POST /review/groups/{nodeUuid}/rollback` — 回滚变更组（拒绝）
- `approveGroup(nodeUuid)` — `DELETE /review/groups/{nodeUuid}` — 批准变更组（整合进记忆）
- `clearAll()` — `DELETE /review` — 清空所有待审查变更

**前端页面**：`frontend/src/features/review/ReviewPage.jsx`
- 变更组列表（左侧）
- DiffViewer 显示变更详情（右侧）
- 操作按钮：回滚、批准、清空全部
- 状态：loading、error、diffError

**组件依赖**：
- `SnapshotList` — 变更组列表组件
- `DiffViewer` — 差异对比查看器
- `ConfirmModal` — 操作确认弹窗

---

### 二、Preset 预设管理系统

**概述**：用户可创建、编辑、激活预设配置，预设包含 boot_uris 等配置项，可快速切换不同场景的记忆启动配置。

**前端 API 调用**：
- `listPresets()` — `GET /presets` — 列出所有预设
- `createPreset(data)` — `POST /presets` — 创建新预设
- `updatePreset(id, data)` — `PUT /presets/{id}` — 更新预设
- `deletePreset(id)` — `DELETE /presets/{id}` — 删除预设
- `activatePreset(id)` — `POST /presets/{id}/activate` — 激活预设
- `duplicatePreset(id, newName)` — `POST /presets/{id}/duplicate` — 复制预设

**前端页面**：`frontend/src/features/settings/PresetsSection.jsx`
- PresetEditor 子组件：编辑预设内容（boot_uris 配置）
- Namespace 级别 URI 配置
- 拖拽排序 URI
- 保存、删除、激活、复制操作

---

### 三、Database 数据库管理

**概述**：支持 SQLite 和 PostgreSQL 两种数据库，提供连接测试、创建新库、打开数据库文件夹等功能。

**前端 API 调用**：
- `getDatabaseStatus()` — `GET /settings/database/status` — 获取数据库状态
- `testDatabase(database_url)` — `POST /settings/database/test` — 测试数据库连接
- `createDatabase(path)` — `POST /settings/database/create` — 创建新数据库
- `openDbFolder()` — `POST /settings/database/open-folder` — 打开数据库文件夹

**前端页面**：`frontend/src/features/settings/DatabaseSection.jsx`
- 数据库类型切换（SQLite / PostgreSQL）
- SQLite 路径输入
- PostgreSQL URL 输入
- 测试连接按钮
- 测试+保存按钮
- 创建新库按钮
- 连接状态显示（成功/失败）

---

### 四、Boot URIs 启动 URI 管理

**概述**：配置 AI 启动时默认读取的记忆 URI 列表，支持全局配置和 namespace 级别覆盖。

**前端 API 调用**：
- `getSettingsBootUris()` — `GET /settings/boot-uris` — 获取当前 namespace 的 boot URIs
- `setSettingsBootUris(uris)` — `PUT /settings/boot-uris` — 设置当前 namespace 的 boot URIs
- `toggleSettingsBootUri(uri, enabled)` — `PATCH /settings/boot-uris` — 切换单个 URI 启用状态
- `getAllBootUris()` — `GET /settings/boot-uris/all` — 获取所有 namespace 的 boot URIs
- `setBootUrisForNs(namespace, uris)` — `PUT /settings/boot-uris/ns/{namespace}` — 设置指定 namespace 的 boot URIs
- `deleteBootUrisForNs(namespace)` — `DELETE /settings/boot-uris/ns/{namespace}` — 删除 namespace 的 boot URIs 配置

**前端页面**：`frontend/src/features/settings/BootUrisSection.jsx`
- NamespaceBootPanel 子组件：每个 namespace 的 URI 配置面板
- URI 添加、删除、拖拽排序
- Namespace 折叠/展开
- 删除 namespace override
- 默认 namespace 常开

---

### 五、Server/General Settings 服务器设置

**概述**：服务器运行参数配置，包括端口、自动打开浏览器、主机绑定、API Token、语言设置、MCP readonly 模式等。

**前端 API 调用**：
- `getSettings()` — `GET /settings` — 获取所有设置
- `updateSettings(data)` — `PUT /settings` — 更新设置

**配置项**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `web_port` | number | Web 服务器端口（可 locked by Docker） |
| `auto_open_browser` | bool | 启动时自动打开浏览器 |
| `host` | string | 主机绑定地址（127.0.0.1 / 0.0.0.0） |
| `api_token` | string | API 认证 Token |
| `locale` | string | 语言设置（auto/en/zh） |
| `public_readonly_mcp` | bool | 公开 readonly MCP 模式 |

**前端页面**：
- `ServerSection.jsx` — 端口、自动打开浏览器
- `LocaleSection.jsx` — 语言选择（自动/中文/英文）
- `AdvancedSection.jsx` — host、token、MCP readonly 模式

---

### 六、Custom Template 自定义模板管理

**概述**：用户可创建、编辑、删除自定义模板，支持 init-existing（无需模板初始化）和 reset-existing（重置已有灵魂）。

**前端 API 调用**：
- `createCustomTemplate(data)` — `POST /templates/custom` — 创建自定义模板
- `updateCustomTemplate(id, data)` — `PUT /templates/custom/{id}` — 更新自定义模板
- `deleteCustomTemplate(id, namespace)` — `DELETE /templates/custom/{id}` — 删除自定义模板
- `initExistingSoul(relationship, namespace)` — `POST /templates/init-existing` — 初始化已有灵魂
- `resetExistingSoul(relationship, persona, namespace)` — `POST /templates/reset-existing` — 重置已有灵魂

**说明**：PRD1 模板系统的 Out of Scope 明确指出「用户自定义模板导出、模板编辑 UI」不在范围，但代码已实现完整的自定义模板 CRUD。

---

### 七、Domain Management 域管理

**概述**：记忆域（domain）的创建和删除，每个域是一个独立的记忆分区（如 core、work、personal）。

**前端 API 调用**：
- `getDomains()` — `GET /browse/domains` — 获取域列表
- `addDomain(domain)` — `POST /browse/domains` — 创建新域
- `removeDomain(domain)` — `DELETE /browse/domains/{domain}` — 删除域

**前端页面**：`MemoryBrowser.jsx` 中的域管理区域
- 域列表侧边栏
- 添加域输入框
- 删除域确认弹窗

---

### 八、Namespace Management 命名空间管理

**概述**：多命名空间支持，每个 namespace 独立存储记忆，支持切换和 namespace 级别配置。

**前端 API 调用**：
- `getNamespaces()` — `GET /browse/namespaces` — 获取命名空间列表

**特性**：
- 命名空间切换时自动重定向到根域
- Session-based 重定向 TTL（30s）
- Namespace header（X-Namespace）自动附加到 API 请求

---

### 九、Memory Node Operations 记忆节点操作（扩展）

**概述**：基础记忆 CRUD 外的扩展操作，包括重命名、别名、搜索。

**前端 API 调用**：
- `renameNode(data)` — `POST /browse/node/rename` — 重命名节点（返回新路径）
- `addAlias(data)` — `POST /browse/node/alias` — 添加别名
- `searchMemories(q, {domain, limit})` — `GET /browse/search` — 搜索记忆

**前端组件**：
- `AliasManager.jsx` — 别名管理
- `KeywordManager.jsx` — 关键词管理
- 搜索框实时搜索（debounce）

---

### 十、Maintenance 维护系统

**概述**：孤儿节点清理、访问日志统计与清理，用于数据库维护。

**前端 API 调用**（直接使用 api 对象）：
- `api.get('/maintenance/orphans')` — 获取孤儿节点列表
- `api.get('/maintenance/orphans/{id}')` — 获取孤儿详情
- `api.delete('/maintenance/orphans/{id}')` — 删除孤儿
- `api.get('/maintenance/access-logs/stats')` — 获取访问日志统计
- `api.delete('/maintenance/access-logs', {keep_days})` — 清理访问日志

**前端页面**：`frontend/src/features/maintenance/MaintenancePage.jsx`
- 孤儿节点分组显示（deprecated / orphaned）
- 按 migration target 分组
- 批量选择删除
- 单个展开查看详情
- 恢复孤儿（Undo2）
- 访问日志统计卡片
- 清理日志（输入保留天数）

**孤儿分类**：
- `deprecated` — 已废弃节点（有 migration_target）
- `orphaned` — 真正孤儿（无父节点）

---

### 十一、i18n/Internationalization 国际化

**概述**：react-i18next 集成，支持中英双语，自动检测浏览器语言。

**配置**：
- 语言选项：auto（浏览器检测）、en、zh
- 所有 UI 文本通过 `t()` 函数翻译
- 翻译键命名空间：`app.*`, `settings.*`, `memory.*`, `review.*`, `maintenance.*`

---

### 十二、Authentication 认证系统

**概述**：Bearer Token 认证，401 自动处理。

**机制**：
- Token 存储在 localStorage（`api_token`）
- 请求拦截器自动附加 `Authorization: Bearer {token}`
- 401 响应触发 `AUTH_ERROR_EVENT` 事件，清除 token
- 前端监听事件，触发重新认证流程

---

### 十三、MCP Tool Extensions MCP 工具扩展

**概述**：PRD1 已记录基础 MCP 工具（read/create/update/delete_memory），但以下扩展工具未记录：

| 工具 | 位置 | 说明 |
|------|------|------|
| `manage_triggers` | mcp_server.py:1000 | 添加/删除记忆触发关键词 |
| `search_memory` | mcp_server.py:1123 | 搜索记忆内容 |
| `add_alias` | mcp_server.py:891 | 添加记忆别名（另有 REST API） |

**触发器管理**：
- keywords 添加（触发条件）
- keywords 删除
- Glossary 语义锚点绑定

---

### 十四、Frontend Sub-Components 前端子组件

**概述**：主要页面下的大量子组件未在 PRD 中记录。

**Memory Browser 子组件**（`frontend/src/features/memory/components/`）：
- `CreateMemoryModal.jsx` — 创建记忆弹窗
- `AliasManager.jsx` — 别名管理
- `PriorityBadge.jsx` — 优先级标签显示
- `GlossaryHighlighter.jsx` — 术语高亮组件
- `KeywordManager.jsx` — 触发关键词管理
- `MemorySidebar.jsx` — 记忆侧边栏（域列表）
- `Breadcrumb.jsx` — 面包屑导航
- `NodeGridCard.jsx` — 网格卡片视图

**Shared Components**（`frontend/src/components/`）：
- `Toast` — 通知系统
- `ConfirmModal` — 确认弹窗
- `PromptModal` — 输入弹窗
- `DiffViewer` — 差异查看器
- `SnapshotList` — 快照列表

---

### 十五、Settings Sub-Sections 设置子面板

**概述**：Settings Drawer 的子分区组件。

**组件列表**：
- `Section.jsx` — 通用分区容器（icon + title + collapsible）
- `ServerSection.jsx` — 服务器配置（端口、自动打开）
- `DatabaseSection.jsx` — 数据库配置（类型、连接测试）
- `PresetsSection.jsx` — 预设管理（CRUD、激活）
- `BootUrisSection.jsx` — 启动 URI 配置（namespace 级别）
- `LocaleSection.jsx` — 语言设置
- `AdvancedSection.jsx` — 高级设置（host、token、MCP readonly）

---

## 已记录但代码未实现的功能

暂未发现。所有 PRD 中记录的功能在代码中均有对应实现。

---

## 建议

### 优先级排序

| 优先级 | 功能模块 | 原因 |
|--------|----------|------|
| P0 | Review/Changeset 系统 | 核心安全机制，AI 写入需人工审查 |
| P0 | Maintenance 维护系统 | 数据完整性保障 |
| P1 | Preset/Boot URIs 管理 | 配置管理核心功能 |
| P1 | Database 管理 | 多数据库支持是关键特性 |
| P2 | Custom Template 管理 | PRD1 明确 Out of Scope，需补充 |
| P2 | Domain/Namespace 管理 | 多租户/多域支持 |
| P3 | Memory Node 扩展操作 | 增强功能 |
| P3 | MCP Tool 扩展 | MCP 工具完整性 |
| P3 | Settings 子面板 | UI 细节 |

### 后续任务建议

1. **Review System PRD**：单独任务，详细记录变更审查机制
2. **Maintenance PRD**：单独任务，记录孤儿清理和日志管理
3. **Settings Management PRD**：合并 Preset/Boot URIs/Database/Server/Locale/Advanced
4. **Custom Template PRD**：补充 PRD1 Out of Scope 部分

---

## Acceptance Criteria

- [ ] 每个 Gap 功能模块有清晰的概述和 API/组件清单
- [ ] 交叉对比历史 PRD，标记已记录 vs 未记录
- [ ] 无遗漏：所有代码文件已扫描
- [ ] 建议部分有优先级排序和后续任务拆分建议

---

## Notes

- 本文档作为差距分析依据，后续每个 Gap 模块应拆分为独立 PRD 任务
- PRD1 的 Out of Scope 部分（自定义模板）已实现，需补充文档
- MCP 工具扩展（manage_triggers、search_memory）需补充到 MCP 工具规范文档

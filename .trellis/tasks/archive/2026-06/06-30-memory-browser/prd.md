# Memory Browser 记忆浏览器 PRD

## Goal

Memory Browser 是 nocturne_memory 的核心浏览页面，提供树形导航、记忆节点查看/编辑/创建/删除、域名管理、命名空间切换、全文搜索的统一界面。用户通过侧边栏选择域和路径，在主区域查看节点内容、子节点网格，并进行增删改查操作。

## Requirements

### 一、Domain Management 域管理

**概述**：域（domain）是记忆的顶层分区（如 `core`、`work`、`personal`），每个域下拥有独立的记忆树。域列表由全局配置 `valid_domains` 管理。

**功能点**：
- **域列表显示**：侧边栏顶部展示所有域，每个域显示名称（首字母大写）和根节点数量徽章
- **域树展开**：点击域可展开/折叠其根级子节点树，支持懒加载（`nav_only=true`）
- **空域降级**：当域无根节点时，`rootCount` 为 0，列表项显示半透明样式
- **core 兜底**：`valid_domains` 至少包含 `"core"`，列表为空时仍显示一个 `core` 条目
- **添加域**：侧边栏底部 "添加域" 按钮，展开输入框 → 验证名称格式 `/^[a-z][a-z0-9_]*$/` → 调用 `addDomain()` → 成功后自动导航到新域根路径
- **删除域**：仅非 `core` 域可删除。在域根路径的空状态页面有删除按钮；弹出二次确认弹窗
- **删除域校验**：后端检查域是否在使用中（有路径记录）、是否被任何预设的 boot URIs 引用
- **域切换重定向**：删除域后自动选择第一个可用域，如果没有则回退到 `core`

### 二、Namespace Management 命名空间管理

**概述**：多命名空间支持，每个 namespace 拥有独立的数据集，前端通过 localStorage `selected_namespace` 和请求头 `X-Namespace` 实现隔离。

**功能点**：
- **命名空间列表获取**：`GET /browse/namespaces` 返回 `Path` 表中所有不同的 namespace 值
- **请求头自动附加**：`api.js` 请求拦截器自动从 `localStorage.selected_namespace` 读取并设置 `X-Namespace` 头（`/review` 路由除外）
- **命名空间切换重定向**：
  - 切换时写入 `sessionStorage`：`nocturne:namespace-switch-root-redirect`（含时间戳）
  - 浏览器刷新后加载页面前检查此标记，TTL 为 30 秒内执行根域重定向
  - `consumeNamespaceSwitchRedirect()` 函数消费 sessionStorage 标记并返回是否应重定向
- **后端 contextvars 隔离**：`NamespaceMiddleware` 从请求头/query 参数提取 namespace，写入 contextvars，下游查询自动 scoped
- **SSE/MCP 兼容**：`NamespaceMiddleware` 额外处理 SSE 连接的 session_id namespace 持久化

### 三、Memory Node Operations 记忆节点操作

#### 3.1 节点浏览
- **路径导航**：URL search params `?domain=xxx&path=xxx` 决定当前视图
- **节点数据获取**：`GET /browse/node?domain=&path=` 返回 `{ node, children, breadcrumbs }`
- **虚拟根节点**：当 `path=""` 且根路径无实际记忆时，返回虚拟根节点（`is_virtual: true`）
- **子节点网格**：子节点按 priority 升序排列，以 1-4 列响应式网格展示卡片

#### 3.2 节点编辑
- **标题重命名**：通过 `renameNode()` 调用 `POST /browse/node/rename`，重命名标题时同步更新 URL path
- **内容编辑**：textarea 编辑 content，`PUT /browse/node` 更新
- **优先级编辑**：数字输入框，非负整数
- **disclosure 编辑**：文本输入框，标记敏感/警告信息
- **保存逻辑**：如果标题未变则直接 `PUT`；如果标题变更则先 `renameNode` 再 `PUT` 其余字段到新路径

#### 3.3 节点创建
- **CreateMemoryModal**：全屏居中弹窗，必填 `content` 和 `disclosure`，可选 `title` 和 `priority`
- **创建 API**：`POST /browse/node`（绕过 changeset/review，人工编辑路径）
- **title 校验**：`/^[a-zA-Z0-9_-]+$/`
- **创建完成后**：关闭弹窗并刷新当前节点数据

#### 3.4 节点删除
- **删除确认弹窗**：显示 `domain://path` URI，警告不可逆
- **删除 API**：`DELETE /browse/node?domain=&path=`
- **删除后行为**：导航到父路径（`path` 的最后一个 `/` 之前）
- **同时清理**：删除后后端自动清除 boot URIs 中对该 URI 的引用

#### 3.5 锁定/解锁
- **API**：`PATCH /browse/node/locked`
- **UI**：Lock/Unlock 按钮切换，锁定时显示琥珀色边框样式
- **语义**：被锁定的记忆节点不能被 AI 通过 MCP 工具修改或删除

#### 3.6 Search 搜索
- **搜索框**：主区域顶部右侧，`placeholder` 通过 i18n 翻译
- **debounce 机制**：
  - 300ms debounce（`setTimeout`）
  - 序列号 `searchSeqRef` 防止竞态：只有最新请求的结果才被接受
- **搜索结果展示**：替换主内容区，列表显示匹配项的 name、uri、priority badge、snippet、disclosure
- **点击结果**：清除搜索并导航到对应 `(domain, path)`
- **清空搜索**：输入框右侧 X 按钮或结果页 "返回" 按钮

#### 3.7 别名管理（AliasManager）
- **显示当前别名**：节点详情的别名标签列表
- **添加别名**：级联路径选择器 + 叶节点名称输入 + disclosure + priority → `POST /browse/node/alias`
- **删除别名**：点击 X → 二次确认（"确认/取消"）→ `DELETE /browse/node`
- **跨域别名支持**：可选择不同 domain 下的路径作为别名

#### 3.8 关键词管理（KeywordManager）
- **显示当前关键词**：节点详情的术语标签列表（琥珀色）
- **添加关键词**：内联输入框，回车或点击保存 → `POST /browse/glossary`
- **删除关键词**：点击 X → `DELETE /browse/glossary`

### 四、Frontend Sub-Components 前端子组件

| 组件 | 文件 | 功能 |
|------|------|------|
| `CreateMemoryModal` | `CreateMemoryModal.jsx` | 创建记忆弹窗：父路径显示、title/priority/disclosure/content 输入、textarea 自适应高度 |
| `AliasManager` | `AliasManager.jsx` | 别名管理：级联下拉路径选择器 + 叶节点输入 + disclosure/priority 输入、删除二次确认 |
| `PriorityBadge` | `PriorityBadge.jsx` | 优先级标签：0=玫瑰色、1-2=琥珀色、3-5=天蓝色，支持 sm/lg 两尺寸 |
| `GlossaryHighlighter` | `GlossaryHighlighter.jsx` | 术语高亮：在内容中标记 glossary keywords（琥珀色下划线），点击弹出节点列表定位浮窗 |
| `KeywordManager` | `KeywordManager.jsx` | 触发关键词管理：内联添加/删除 glossary keywords |
| `MemorySidebar` | `MemorySidebar.jsx` | 记忆侧边栏：`DomainNode`（域级树）+ `TreeNode`（节点级树），支持递归懒加载 |
| `Breadcrumb` | `Breadcrumb.jsx` | 面包屑导航：Home 按钮 + `/>` 路径分段，当前段高亮 |
| `NodeGridCard` | `NodeGridCard.jsx` | 子节点网格卡片：图标（Folder/FileText）、名称、跨域标签、锁定标记、priority badge、disclosure 摘要、content snippet、boot toggle |

#### 4.1 GlossaryHighlighter 详细行为
- **匹配算法**：`findAllOccurrences()` 通过 `indexOf` 在内容中查找所有 glossary keyword 出现位置，取 no-overlap 最长匹配
- **Popover**：`GlossaryPopup` 组件通过 `createPortal` 渲染到 `document.body`，显示匹配节点的 URI 列表和 content_snippet
- **自身过滤**：不显示当前节点的 glossary 匹配（排除 `node_uuid` 自身）
- **位置自适应**：弹窗宽度 `288px`，自动左右/上下调整防止溢出视口

#### 4.2 MemorySidebar 详细行为
- **DomainNode**：域列表项，`ChevronRight` 可展开/折叠，`Database` 图标，显示 rootCount
- **TreeNode**：递归组件，支持缩进层级 `level * 12 + 8` px
- **懒加载**：`expanded && !fetched && hasChildren` 时调用 `GET /browse/node?nav_only=true`
- **自动展开**：当前激活路径的祖先自动展开
- **点击行为**：当前激活项点击 → toggle 展开；其他项点击 → navigate

## API Specification

所有端点前缀：`/api/browse`（前端 `api.js` 通过 `axios.create({ baseURL: '/api' })` 自动拼接）

### 命名空间

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/browse/namespaces` | — | `string[]` | 返回 Path 表中所有 distinct namespace |

### 域管理

| Method | Path | Request | Response | 说明 |
|--------|------|---------|----------|------|
| `GET` | `/browse/domains` | — | `[{domain, root_count}]` | 从 valid_domains 配置 + DB 统计生成 |
| `POST` | `/browse/domains` | `{domain: string}` | `{success, domain, added: bool}` | 添加域到 valid_domains 配置 |
| `DELETE` | `/browse/domains/{domain}` | — | `{success, domain}` | 删除域（校验无数据且无 boot URI 引用） |

### 节点读写

| Method | Path | Request (Query/Body) | Response | 说明 |
|--------|------|----------------------|----------|------|
| `GET` | `/browse/node` | `?domain=core&path=&nav_only=false` | `{node, children[], breadcrumbs[]}` | 获取节点及子节点 |
| `PUT` | `/browse/node` | `?domain=&path=` + `{content?, priority?, disclosure?}` | `{success, memory_id}` | 更新节点内容 |
| `POST` | `/browse/node` | `{parent_path, content, priority, disclosure, title?, domain}` | `{success, uri, memory_id}` | 创建新记忆节点 |
| `DELETE` | `/browse/node` | `?domain=&path=` | `{success, uri}` | 删除节点（清除关联 boot URI） |

### 节点操作扩展

| Method | Path | Request (Body) | Response | 说明 |
|--------|------|----------------|----------|------|
| `POST` | `/browse/node/alias` | `{new_path, target_path, disclosure, new_domain, target_domain, priority}` | `{success, uri}` | 为已有节点添加别名路径 |
| `POST` | `/browse/node/rename` | `{path, new_name, domain}` | `{success, old_uri, new_uri, old_path, new_path}` | 重命名节点（级联重命名子树 + 更新 boot URIs） |
| `PATCH` | `/browse/node/locked` | `{path, domain, locked}` | `{success, path, domain, locked}` | 锁定/解锁节点（防止 AI 修改） |

### Glossary 术语

| Method | Path | Request (Body) | Response | 说明 |
|--------|------|----------------|----------|------|
| `GET` | `/browse/glossary` | — | `{glossary}` | 获取所有 glossary keywords |
| `POST` | `/browse/glossary` | `{keyword, node_uuid}` | `{success, ...}` | 绑定 keyword 到节点 |
| `DELETE` | `/browse/glossary` | `{keyword, node_uuid}` | `{success}` | 解除 keyword 绑定 |

### Search 搜索

| Method | Path | Request (Query) | Response | 说明 |
|--------|------|-----------------|----------|------|
| `GET` | `/browse/search` | `?q=&domain=&limit=20` | `{query, results[], count}` | 全文搜索（FTS 索引） |

### GET /browse/node 响应结构

```json
{
  "node": {
    "path": "nocturne",
    "domain": "core",
    "uri": "core://nocturne",
    "name": "nocturne",
    "content": "...",
    "priority": 0,
    "disclosure": "some warning",
    "locked": false,
    "created_at": "2026-...",
    "is_virtual": false,
    "aliases": ["core://alt/path"],
    "node_uuid": "uuid-string",
    "glossary_keywords": ["keyword1", "keyword2"],
    "glossary_matches": [{"keyword": "kw", "nodes": [{"uri": "...", "content_snippet": "...", "node_uuid": "..."}]}]
  },
  "children": [{
    "domain": "core",
    "path": "nocturne/salem",
    "uri": "core://nocturne/salem",
    "name": "salem",
    "priority": 2,
    "disclosure": "...",
    "locked": false,
    "content_snippet": "...",
    "approx_children_count": 3
  }],
  "breadcrumbs": [
    {"path": "", "label": "root"},
    {"path": "nocturne", "label": "nocturne"}
  ]
}
```

### 请求头约定

- **`X-Namespace`**：所有请求自动附加（除非手动设置），值来自 `localStorage.selected_namespace`
- **`Authorization`**：`Bearer {localStorage.api_token}`，401 时清除 token 并触发 `AUTH_ERROR_EVENT`

## UI Specification

### 页面布局（MemoryBrowser.jsx）

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌─────────────────────────────────────────┐ │
│ │   Sidebar    │ │            Main Area                     │ │
│ │   (w-64)     │ │                                          │ │
│ │              │ │ ┌── Breadcrumb ────── [Search Input] ──┐ │ │
│ │  Header      │ │ │                                      │ │ │
│ │  ──────────  │ │ └──────────────────────────────────────┘ │ │
│ │  Domain List │ │                                          │ │
│ │   • core     │ │ ┌── Node Detail ───────────────────────┐ │ │
│ │     └ tree   │ │ │ Title | Priority | Lock | Actions    │ │ │
│ │   • work     │ │ │ AliasManager | KeywordManager        │ │ │
│ │   • personal │ │ │ Content (GlossaryHighlighter)        │ │ │
│ │              │ │ └──────────────────────────────────────┘ │ │
│ │  [+ Add]     │ │                                          │ │
│ │              │ │ ┌── Children Grid ─────────────────────┐ │ │
│ │  ──────────  │ │ │ NodeGridCard × N (1-4 columns)      │ │ │
│ │  Current     │ │ └──────────────────────────────────────┘ │ │
│ │  Path Info   │ │                                          │ │
│ └──────────────┘ └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 侧边栏 (Sidebar)

- 宽度固定 `w-64`，flex-shrink-0
- 顶部：标题图标 `Cpu` + "灵魂记忆浏览器" 主副标题
- 中部可滚动区域：
  - "记忆域" 标题
  - 域列表（`DomainNode`），可展开的树形菜单
  - 域添加按钮/输入框
- 底部固定：当前路径信息卡片 `{domain}://{path || "root"}`

### 主区域 (Main Area)

- **顶部工具栏**（`h-14` sticky）：面包屑导航 + 右侧搜索框（`w-72`）
- **搜索状态**：`searchResults !== null` 时主内容区替换为搜索结果列表，正常内容区 `hidden`
- **正常状态**：
  - 节点详情区（`node` 存在时）：标题行（editing/viewing）、disclosure 警告、别名和关键词管理、正文内容（GlossaryHighlighter 渲染）
  - 子节点网格区（`children.length > 0` 时）：`NodeGridCard` 网格
  - 空状态：文件夹图标 + 提示文案 + 非 core 域的删除按钮

### 编辑模式 (Editing Mode)

- 标题变为 `<input>` 输入框
- 正文区在可编辑 textarea（`h-96`）和只读 GlossaryHighlighter 之间切换
- 展开编辑面板：Priority 数字输入 + Disclosure 文本输入（2 列网格）
- 操作按钮切换：编辑/删除/创建 → 取消(X)/保存(Save)
- 虚拟节点（`is_virtual`）不可编辑

### 弹窗 (Modals/Dialogs)

1. **CreateMemoryModal**：全屏遮罩 `z-50`，居中弹窗，5 个字段
2. **Delete Node Confirm**：全屏遮罩 `z-50`，危险操作确认
3. **Delete Domain Confirm**：全屏遮罩 `z-50`，域删除确认
4. **Glossary Popup**：Portal 渲染到 body，`z-[100]`，跟随点击位置

### 状态管理

- URL Search Params 驱动导航（`domain`, `path`）
- 组件内 `useState` 管理所有状态（无全局 store）
- `currentRouteRef` 用于 `refreshData()` 时的竞态防护
- `consumeNamespaceSwitchRedirect()` 在加载前检查 sessionStorage

## Data Flow

### 域名层级
```
valid_domains: ["core", "work", "personal"]
    │
    ├── core://
    │   ├── nocturne
    │   │   ├── salem
    │   │   └── abyssal_whisper
    │   └── my_user
    │
    ├── work://
    │   └── project_alpha
    │
    └── personal://
        └── journal
```

### 命名空间切换流程
```
1. 用户在 Settings/Namespace 选择器切换 namespace
2. Settings 组件写入 localStorage.selected_namespace = "new-ns"
3. 写入 sessionStorage: { "nocturne:namespace-switch-root-redirect": { at: Date.now() } }
4. 前端硬刷新 (location.reload 或 navigate)
5. MemoryBrowser 加载:
   → consumeNamespaceSwitchRedirect() 检查 sessionStorage
   → 若 TTL < 30s: getDomains() → chooseRootDomain() → redirect to root domain
   → 否则: 正常加载当前 URL params
6. 后续所有 API 请求自动携带 X-Namespace header
```

### 节点路径导航流程
```
用户点击侧边栏/面包屑/搜索结果/网格卡片
    → navigateTo(newPath, newDomain)
    → setSearchParams({ domain, path })
    → useEffect([domain, path]) 触发
    → GET /browse/node?domain=&path=
    → setData({ node, children, breadcrumbs })
    → 组件重新渲染
```

### search debounce 流程
```
用户输入搜索词
    → handleSearch(query)
    → 清除旧 timeout
    → searchSeqRef++（递增序列号）
    → 300ms setTimeout
    → searchMemories(query.trim())
    → 检查 seq === searchSeqRef.current（防止竞态）
    → setSearchResults(results)
```

## Acceptance Criteria

### 域管理
- [ ] 侧边栏显示所有 valid_domains 域及其 rootCount
- [ ] 可展开/折叠域的根级子节点树
- [ ] 可添加新域（自动验证命名格式）
- [ ] 可在空域页面删除非 core 域（二次确认弹窗）
- [ ] core 域不可删除
- [ ] 添加域后自动导航到新域根路径

### 命名空间
- [ ] `GET /browse/namespaces` 返回正确的 namespace 列表
- [ ] 切换 namespace 后 30s 内刷新会自动重定向到根域
- [ ] 所有 `/browse` 请求自动携带 `X-Namespace` 头
- [ ] 不同 namespace 下的域/节点数据隔离

### 节点浏览
- [ ] 点击侧边栏域/节点可正确导航
- [ ] 面包屑正确显示当前路径层级
- [ ] 子节点按 priority 排序显示为网格卡片
- [ ] 空路径显示虚拟根节点或实际根节点
- [ ] 虚拟根节点不可编辑

### 节点编辑
- [ ] 可编辑节点 content、priority、disclosure
- [ ] 标题重命名后 URL 自动跟随新路径
- [ ] 锁定/解锁按钮正常工作
- [ ] 保存失败时显示 toast 错误提示

### 节点创建/删除
- [ ] CreateMemoryModal 弹窗正常打开、关闭、提交
- [ ] 创建必须填写 content 和 disclosure
- [ ] 创建后自动刷新当前节点数据
- [ ] 删除确认弹窗显示 URI 后确认删除
- [ ] 删除后导航到父路径

### 搜索
- [ ] 搜索框输入时有 300ms debounce
- [ ] 搜索结果替换主内容区显示
- [ ] 搜索结果项显示 name、uri、priority badge、snippet、disclosure
- [ ] 点击搜索结果正确导航
- [ ] 快速连续搜索时只显示最新结果
- [ ] 清除搜索恢复正常视图

### 子组件
- [ ] AliasManager 可添加/删除别名，级联路径选择正常工作
- [ ] KeywordManager 可添加/删除 glossary keywords
- [ ] GlossaryHighlighter 正确高亮内容中的关键词
- [ ] GlossaryPopup 点击高亮词后正确弹出并显示关联节点
- [ ] PriorityBadge 根据值显示正确颜色和尺寸
- [ ] NodeGridCard 显示节点卡片，hover 有动画效果
- [ ] Breadcrumb 导航正确，当前段高亮

### Boot URI 集成
- [ ] 节点详情页 Boot URI toggle 按钮正常工作
- [ ] 网格卡片上的 Boot URI toggle 正常工作（hover 显示）
- [ ] boot URI 状态（在列表中/不在列表中）正确反映

## Dependencies

- **后端**：FastAPI `browse.py` 路由（`/browse/node`, `/browse/domains`, `/browse/namespaces`, `/browse/search`, `/browse/glossary`, `/browse/node/alias`, `/browse/node/rename`, `/browse/node/locked`）
- **数据层**：`GraphService`（get_memory_by_path, create_memory, update_memory, get_children, add_path, remove_path）
- **数据层**：`GlossaryService`（get_all_glossary, find_glossary_in_content, add_glossary_keyword, remove_glossary_keyword）
- **数据层**：`SearchIndexer`（search with FTS）
- **中间件**：`NamespaceMiddleware`（contextvars namespace 隔离）
- **配置**：`config.valid_domains`
- **前端**：React Router (`useSearchParams`), axios, lucide-react, clsx, react-i18next
- **共享组件**：`Toast`, `useLocale`
- **API 层**：`frontend/src/lib/api.js`（api instance, getDomains, addDomain, removeDomain, getNamespaces, searchMemories, createMemory, renameNode, addAlias, deleteNode, toggleNodeLocked, getSettingsBootUris, toggleSettingsBootUri）

## Notes

1. **搜索 debounce 机制**：使用 `useRef` 保存 timeout ID 和序列号。每次新搜索递增 `searchSeqRef`，请求返回时检查序列号是否匹配，不匹配则丢弃结果。debounce 时间固定 300ms。

2. **命名空间切换重定向**：`consumeNamespaceSwitchRedirect()` 消费一次性 sessionStorage 标记，30s TTL 过期则忽略。这确保了切换 namespace 后刷新页面能回到正确的根域。

3. **虚拟根节点**：当 `path=""` 且该路径无实际记忆时，后端返回虚拟节点（`is_virtual: true`, `created_at: null`）。虚拟节点不可编辑、不可删除。

4. **nav_only 参数**：侧边栏的树形导航使用 `GET /browse/node?nav_only=true`，跳过 glossary 匹配等昂贵处理，只获取子节点列表。

5. **根路径自身节点隐藏**：当 `path=""` 且根路径有实际记忆时，后端在 children 列表中排除自身节点，防止导航循环。

6. **重命名原子性**：`renameNode` 后端先 `add_path` 创建新路径，再 `remove_path` 删除旧路径。如果第二步失败会回滚第一步创建的路径，防止产生孤立双路径。

7. **域删除约束**：删除域前检查：(1) Path 表中是否有该域的记录（status 409）；(2) 所有预设的 boot URIs 中是否有引用该域的 URI（status 409）。

8. **i18n 翻译键**：Memory Browser 使用命名空间 `memory.*` 下的翻译键，包括 `sidebar.*`, `domains.*`, `search.*`, `edit.*`, `create.*`, `alias.*`, `keywords.*`, `delete.*`, `locked.*`, `boot.*`, `card.*`, `grid.*`, `empty.*`, `status.*`。

9. **子组件名称映射**：
   - `MemorySidebar.jsx` 的默认导出是 `DomainNode`（不是 `MemorySidebar`）
   - `MemoryBrowser.jsx` 中 `import DomainNode from "./components/MemorySidebar"`

10. **API 绕过 changeset**：`POST /browse/node`、`POST /browse/node/alias`、`POST /browse/node/rename`、`POST /browse/glossary`、`DELETE /browse/node`、`DELETE /browse/glossary` 均为人工操作端点，绕过 Review/Changeset 队列。

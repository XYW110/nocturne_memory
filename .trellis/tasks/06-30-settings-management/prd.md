# Settings Management PRD - 设置管理系统（6 合 1）

## Goal

Settings 系统提供统一的配置管理界面，让用户能够安全、直观地配置和管理 Nocturne Memory 的各项运行参数。系统涵盖服务器设置、数据库管理、启动预设、多命名空间启动 URI、语言本地化和高级安全设置六大核心模块，通过抽屉式 UI 实现集中式管理。

**核心价值**：
1. **配置中心化**：所有运行时配置统一存储在 `config.json` 中，替代传统 `.env` 文件
2. **可视化配置**：通过 React UI 组件让复杂配置变得直观易操作
3. **安全隔离**：区分 Docker 环境锁定字段、本地开发灵活性
4. **即改即生效**：大部分设置无需重启服务器，语言设置即时生效
5. **预设系统集成**：Preset 与 Boot URI 管理紧密集成，支持命名空间隔离

## Requirements

### 1. Server/General Settings 服务器/通用设置
- **Web 端口配置**：允许修改后端服务的监听端口 (1-65535)
  - Docker 环境中锁定，防止端口冲突
- **自动打开浏览器**：控制启动时是否自动打开浏览器
- **配置文件路径显示**：显示当前 `config.json` 的完整路径
- **保存状态反馈**：显示"需要重启"警告提示
- **Docker 环境识别**：自动检测 Docker 环境并锁定相关字段

### 2. Database Management 数据库管理
- **数据库类型切换**：支持 SQLite 和 PostgreSQL 两种数据库引擎
- **SQLite 配置**：
  - 文件路径输入，支持相对/绝对路径
  - 创建新数据库功能
  - 数据库文件夹打开功能
- **PostgreSQL 配置**：
  - 连接 URL 输入，自动隐藏密码显示
- **数据库状态监控**：
  - 显示当前数据库类型、路径/连接 URL
  - SQLite：显示文件大小和存在状态
  - 刷新状态功能
- **连接测试**：实时测试数据库连接有效性
- **连接测试+保存**：测试成功自动保存配置

### 3. Preset Management 预设管理
- **预设列表**：展示所有预设，标识当前激活的预设
- **预设操作**：
  - 激活预设（自动停用其他预设）
  - 编辑预设（修改名称和启动 URI）
  - 复制预设（自动生成中文/英文后缀）
  - 删除预设（禁止删除激活中的预设）
  - 重置为默认值（还原默认启动 URI）
- **预设编辑器**：
  - 预设名称编辑
  - 按命名空间分组管理启动 URI
  - 默认命名空间 (空字符串) 和自定义命名空间支持
  - URI 拖拽排序功能
  - URI 格式验证（`protocol://path` 格式）
- **新预设创建**：基于默认灵魂模板启动 URI 创建新预设

### 4. Boot URIs Management 启动 URI 管理
- **多命名空间支持**：按命名空间分组管理启动 URI
- **默认命名空间**：特殊的空字符串命名空间，作为回退默认值
- **URI 管理功能**：
  - 添加/删除 URI
  - URI 拖拽重新排序
  - 命名空间新增/删除
- **视图控制**：每个命名空间可折叠/展开
- **自动发现**：自动获取系统中已存在的命名空间列表
- **即时保存**：每个命名空间的修改独立保存

### 5. Locale Settings 语言设置
- **语言切换**：支持 "auto"（自动检测）、"en"（英语）、"zh"（中文）
- **即时生效**：语言切换无需重启服务器
- **状态同步**：语言变更后保持其他标签页状态不变
- **自动检测**：`auto` 选项根据浏览器语言自动选择

### 6. Advanced Settings 高级设置
- **主机绑定配置**：
  - 默认 `127.0.0.1`（仅本机访问）
  - 可修改为 `0.0.0.0`（允许局域网/远程访问）
  - Docker 环境中锁定
- **API Token 管理**：
  - 远程访问时强制要求设置 Token
  - Token 生成器（32 字节随机十六进制）
  - Token 显示/隐藏切换
  - Token 复制功能
- **公共只读 MCP**：启用/禁用公共只读 MCP 服务器访问
- **安全性检查**：
  - 远程访问时必须设置 Token
  - Docker 环境字段锁定警告

## API Specification

### Settings 通用 API
- **GET /api/settings** - 获取所有设置
  - Response: `{ "settings": {...}, "config_path": "...", "locked_fields": [...] }`
  - locked_fields: Docker 环境下返回 `["web_port", "host"]`

- **PUT /api/settings** - 更新设置
  - Request Body: `SettingsUpdate` 模型（部分字段可空）
  - Response: `{ "success": true, "updated": [...], "needs_restart": boolean }`
  - 特殊处理：`locale` 字段可设为 `null` 表示自动检测

### Database API
- **GET /api/settings/database/status** - 获取数据库状态
  - Response: `{ "type": "sqlite"/"postgresql", "path": "...", "size_display": "...", "url_masked": "..." }`

- **POST /api/settings/database/test** - 测试数据库连接
  - Request Body: `{ "database_url": "..." }`
  - Response: `{ "success": true/false, "message": "..." }`

- **POST /api/settings/database/create** - 创建新 SQLite 数据库
  - Request Body: `{ "path": "..." }`
  - Response: `{ "success": true, "database_url": "...", "path": "..." }`

- **POST /api/settings/database/open-folder** - 打开数据库文件夹
  - Response: `{ "success": true }`
  - 仅支持 SQLite，Docker 中不支持

### Boot URI API
- **GET /api/settings/boot-uris** - 获取当前命名空间的启动 URI
  - Response: `{ "uris": [...] }`

- **PUT /api/settings/boot-uris** - 设置当前命名空间的启动 URI
  - Request Body: `{ "uris": [...] }`
  - Response: `{ "success": true, "uris": [...] }`

- **PATCH /api/settings/boot-uris** - 切换单个 URI
  - Request Body: `{ "uri": "...", "enabled": boolean }`
  - Response: `{ "success": true, "uris": [...] }`

- **GET /api/settings/boot-uris/all** - 获取所有命名空间的启动 URI
  - Response: `{ "boot_uris": { "namespace": [...], ... } }`

- **PUT /api/settings/boot-uris/ns/{namespace}** - 设置特定命名空间的启动 URI
  - URL 编码：空命名空间使用 `_ns_default_0x7f3a9e` 占位符
  - Response: `{ "success": true, "namespace": "...", "uris": [...] }`

- **DELETE /api/settings/boot-uris/ns/{namespace}** - 删除命名空间覆盖
  - 禁止删除默认命名空间（空字符串）
  - Response: `{ "success": true, "namespace": "..." }`

### Preset API
- **GET /api/presets** - 获取所有预设
  - Response: `{ "presets": [{ "id": 1, "name": "...", "boot_uris": {...}, "is_active": boolean }, ...] }`

- **POST /api/presets** - 创建预设
  - Request Body: `{ "name": "...", "boot_uris": {...}, "activate": false }`
  - Response: 预设对象

- **PUT /api/presets/{id}** - 更新预设
  - Request Body: `{ "name": "...", "boot_uris": {...} }`（可选字段）
  - Response: 更新后的预设对象

- **DELETE /api/presets/{id}** - 删除预设
  - 禁止删除激活中的预设
  - Response: `{ "success": true }`

- **POST /api/presets/{id}/activate** - 激活预设
  - Response: 激活后的预设对象

- **POST /api/presets/{id}/duplicate** - 复制预设
  - Request Body: `{ "new_name": "..." }`
  - Response: 新预设对象

### 相关 API
- **GET /api/browse/namespaces** - 获取所有命名空间列表
  - Response: `[...]`
  - 用于 Boot URI 管理的命名空间自动发现

## UI Specification

### SettingsDrawer 布局结构
```
SettingsDrawer (600px 右侧抽屉)
├── 标题栏
│   ├── 标题："Settings"
│   ├── 副标题："Configure server, database, and memory settings"
│   └── 关闭按钮 (X)
├── 标签导航 (3个标签页)
│   ├── General (Settings图标)
│   ├── Database (Database图标)
│   └── Memory (Layers图标)
└── 内容区域
    ├── General 标签页
    │   ├── Server Section (服务器配置)
    │   ├── Locale Section (语言设置)
    │   └── Advanced Section (高级设置)
    ├── Database 标签页
    │   └── Database Section (数据库配置)
    └── Memory 标签页
        └── Presets Section (预设管理)
```

### Section 组件通用设计
- **可折叠区域**：标题栏 + 展开/折叠图标
- **统一视觉风格**：深色背景、边框、圆角、阴影
- **响应式交互**：悬停效果、过渡动画

### 各 Section 详细设计

#### ServerSection
- **端口输入**：数字输入框，32 字符宽度
- **自动打开浏览器**：切换开关控件
- **Docker 锁定提示**：当 `web_port` 被锁定时显示提示文字
- **配置文件路径**：在底部显示 `config.json` 路径
- **保存按钮**：仅当有修改时显示，包含重启警告

#### DatabaseSection
- **状态卡片**：显示当前数据库类型、路径、大小
  - SQLite：路径、文件大小、打开文件夹按钮
  - PostgreSQL：掩码后的连接 URL
- **数据库类型切换**：SQLite/PostgreSQL 按钮组
- **连接输入**：
  - SQLite：文件路径输入框
  - PostgreSQL：连接 URL 输入框
- **测试按钮**：
  - 无修改时："Test Connection"
  - 有修改时："Test & Save"
- **测试结果反馈**：成功/失败图标 + 消息
- **新建数据库**（仅 SQLite）：
  - 新路径输入框
  - "Create" 按钮

#### PresetsSection
- **预设列表**：卡片式布局，激活预设高亮显示
- **预设卡片**：
  - 预设名称 + 激活状态徽章
  - URI 数量统计
  - 操作按钮：激活、重置、编辑、复制、删除
- **编辑器模式**：
  - 名称输入框
  - 按命名空间分组的 URI 列表
  - 拖拽排序手柄
  - 添加命名空间功能
  - 保存/取消按钮

#### BootUrisSection
- **命名空间面板**：每个命名空间独立面板
- **默认命名空间**：特殊标识，不能删除
- **URI 列表**：
  - 可拖拽排序
  - 每行显示 URI，带删除按钮
- **添加 URI 输入框**：每个命名空间独立
- **添加命名空间**：
  - 从已知命名空间选择
  - 或输入自定义命名空间
- **保存机制**：每个命名空间独立保存按钮

#### LocaleSection
- **语言选择器**：下拉选择框（auto/en/zh）
- **即时保存**：选择后立即显示保存按钮
- **最小化刷新**：语言变更时避免重新加载其他配置

#### AdvancedSection
- **主机绑定输入框**：文本输入，monospace 字体
- **远程模式检测**：当主机不是 localhost 时显示 Token 区域
- **Token 管理区域**：
  - 密码输入框（可切换显示）
  - 生成按钮（32字节随机）
  - 复制按钮
- **公共只读 MCP 开关**：红色主题切换开关
- **安全警告**：远程模式且无 Token 时显示警告

## Configuration Schema

### config.json 完整配置项

```json
{
  "database_url": "sqlite+aiosqlite:///path/to/database.db",
  "db_pool_size": 5,
  "db_max_overflow": 5,
  "valid_domains": ["core", "writer", "game", "notes", "narrative"],
  "boot_uris": {
    "": ["core://agent", "core://my_user", "core://agent/my_user"],
    "namespace1": ["core://custom1", "core://custom2"]
  },
  "host": "127.0.0.1",
  "web_port": 8233,
  "auto_open_browser": true,
  "api_token": null,
  "cors_origins": null,
  "public_readonly_mcp": false,
  "locale": null
}
```

### 字段详细说明

| 字段名 | 类型 | 默认值 | 说明 | Docker 锁定 |
|--------|------|--------|------|-------------|
| `database_url` | string | `sqlite+aiosqlite:///demo.db` | 数据库连接 URL | 否 |
| `db_pool_size` | int | 5 | 数据库连接池大小 | 否 |
| `db_max_overflow` | int | 5 | 数据库最大溢出连接数 | 否 |
| `valid_domains` | string[] | `["core", "writer", "game", "notes", "narrative"]` | 有效域名列表 | 否 |
| `boot_uris` | object | `{"": ["core://agent", "core://my_user", "core://agent/my_user"]}` | 按命名空间分组的启动 URI | 否 |
| `host` | string | `"127.0.0.1"` | 服务器绑定主机 | 是 |
| `web_port` | int | 8233 | Web 服务器端口 | 是 |
| `auto_open_browser` | boolean | true | 启动时自动打开浏览器 | 否 |
| `api_token` | string/null | null | API 访问令牌 | 否 |
| `cors_origins` | string/null | null | CORS 允许来源 | 否 |
| `public_readonly_mcp` | boolean | false | 启用公共只读 MCP | 否 |
| `locale` | string/null | null | 语言代码，null 表示自动检测 | 否 |

### 环境变量映射

| 环境变量 | 配置字段 | 转换规则 |
|----------|----------|----------|
| `DATABASE_URL` | `database_url` | 直接使用 |
| `VALID_DOMAINS` | `valid_domains` | 逗号分隔转数组 |
| `HOST` | `host` | 直接使用 |
| `WEB_PORT` | `web_port` | 整数转换 |
| `PORT` | `web_port` | 整数转换（备用） |
| `AUTO_OPEN_BROWSER` | `auto_open_browser` | 布尔值转换 |
| `API_TOKEN` | `api_token` | 直接使用 |
| `CORS_ORIGINS` | `cors_origins` | 直接使用 |
| `PUBLIC_READONLY_MCP` | `public_readonly_mcp` | 布尔值转换 |
| `LOCALE` | `locale` | 直接使用 |
| `CORE_MEMORY_URIS` | `boot_uris[""]` | 逗号分隔转数组 |
| `CORE_MEMORY_URIS__{ns}` | `boot_uris[ns]` | 逗号分隔转数组 |

## Acceptance Criteria

### 功能验收标准

#### Server/General Settings
- [ ] 端口输入框只接受 1-65535 的整数
- [ ] Docker 环境中端口字段被禁用并显示提示
- [ ] 自动打开浏览器开关正常工作
- [ ] 配置文件路径正确显示
- [ ] 修改后显示保存按钮和重启警告
- [ ] 保存成功后有正确反馈

#### Database Management
- [ ] SQLite/PostgreSQL 切换功能正常
- [ ] SQLite 路径输入支持相对/绝对路径
- [ ] PostgreSQL URL 输入掩码显示密码
- [ ] 数据库状态正确显示（类型、路径、大小）
- [ ] 测试连接功能返回正确结果
- [ ] 创建新数据库功能正常
- [ ] 打开文件夹功能正常工作（非 Docker 环境）

#### Preset Management
- [ ] 预设列表正确加载和显示
- [ ] 激活预设功能正确切换激活状态
- [ ] 编辑预设能保存名称和启动 URI 修改
- [ ] 复制预设生成正确后缀名称
- [ ] 删除预设有确认对话框，不能删除激活的预设
- [ ] 重置预设恢复默认启动 URI
- [ ] URI 拖拽排序功能正常
- [ ] 命名空间管理功能正常

#### Boot URIs Management
- [ ] 默认命名空间正确显示和标识
- [ ] 多命名空间面板正确渲染
- [ ] URI 拖拽排序功能正常
- [ ] 添加/删除 URI 功能正常
- [ ] 添加/删除命名空间功能正常
- [ ] 已知命名空间自动发现和选择
- [ ] 每个命名空间独立保存功能正常

#### Locale Settings
- [ ] 语言切换下拉框三种选项正常
- [ ] 选择语言后立即显示保存按钮
- [ ] 保存后界面语言即时切换
- [ ] 语言变更不影响其他标签页状态
- [ ] `auto` 选项正确触发自动检测

#### Advanced Settings
- [ ] 主机输入框接受有效 IP 地址
- [ ] Docker 环境中主机字段被禁用
- [ ] 远程模式检测正确（非 localhost 时显示 Token 区域）
- [ ] Token 生成器生成 32 字节随机字符串
- [ ] Token 显示/隐藏切换功能正常
- [ ] Token 复制功能正常
- [ ] 远程模式无 Token 时显示警告
- [ ] 公共只读 MCP 开关正常切换

### 集成验收标准
- [ ] 所有 API 调用正确处理错误和加载状态
- [ ] 抽屉式 UI 正确打开/关闭，动画流畅
- [ ] 标签页切换功能正常
- [ ] 移动端响应式布局正常
- [ ] 暗色主题样式一致

### 安全验收标准
- [ ] Docker 环境字段锁定功能正常
- [ ] 远程模式强制 Token 验证正常
- [ ] Token 输入框默认隐藏内容
- [ ] 敏感操作（删除预设）有确认对话框
- [ ] API 调用有适当的错误处理和用户反馈

## Dependencies

### 前端组件依赖
- **SettingsDrawer 依赖**：
  - `Section` 通用分区组件
  - `ServerSection`、`DatabaseSection`、`PresetsSection`、`BootUrisSection`、`LocaleSection`、`AdvancedSection`
  - `Toast` 通知组件
  - `ConfirmModal` 确认对话框

### 后端 API 依赖
- `backend/api/settings.py`：设置管理核心 API
- `backend/api/presets.py`：预设管理 API
-## `backend/config.py`：配置管理模块
- `backend/db/preset_service.py`：预设数据库服务

### 第三方依赖
- **前端**：
  - `react-i18next`：国际化支持
  - `lucide-react`：图标库
  - `axios`：HTTP 客户端
  - `clsx`：CSS 类名工具

- **后端**：
  - `pydantic`：请求/响应模型验证
  - `sqlalchemy`：数据库连接测试

### 环境依赖
- **Docker 识别**：依赖 `/.dockerenv` 文件存在检测
- **文件系统**：依赖 `config.json` 文件读写权限
- **浏览器 API**：`navigator.clipboard`（Token 复制功能）

## Notes

### Preset 与 Boot URIs 的关系
1. **预设是模板**：Preset 存储了完整的启动 URI 配置（多命名空间）
2. **Boot URIs 是运行时配置**：当前命名空间使用的启动 URI 来自激活的预设
3. **激活机制**：激活预设时，会将该预设的 `boot_uris` 复制到 `config.json` 的 `boot_uris` 字段
4. **UI 分离**：
   - `PresetsSection` 管理预设模板（创建、编辑、删除）
   - `BootUrisSection` 管理当前配置（查看、微调）
5. **同步更新**：修改激活的预设会自动更新 `config.json` 中的 `boot_uris`

### Docker 环境约束
1. **锁定字段**：`host` 和 `web_port` 在 Docker 环境中被锁定
   - 原因：Docker 容器通常通过环境变量配置这些值
   - 实现：检测 `/.dockerenv` 文件存在
   - UI 表现：字段禁用 + 提示文字
2. **文件夹打开限制**：Docker 中无法打开数据库文件夹（权限和容器隔离）
3. **默认配置**：Docker 无配置时使用特殊默认值：
   - `host: "0.0.0.0"`（允许容器访问）
   - `auto_open_browser: false`（容器内无浏览器）
   - `database_url: "sqlite+aiosqlite:////app/data/nocturne.db"`（绝对路径）

### 配置迁移策略
1. **`.env` → `config.json`**：单向迁移，只读 `.env`，写入 `config.json`
2. **环境变量优先**：Docker 中通过环境变量生成 `config.json`
3. **demo.db 迁移**：自动从 `demo.db` 复制到用户数据库防止 Git 覆盖
4. **配置优先级**：`config.json` > 环境变量 > `.env` > 默认值

### 国际化注意事项
1. **即时切换**：语言设置无需重启，利用 `i18n.changeLanguage()`
2. **状态保持**：语言变更时避免重新加载整个设置状态
3. **翻译键前缀**：
   - `app.settings.*`：UI 文本
   - `settings.*`：各模块特定文本
   - `api.settings.*`：API 错误消息

### 安全最佳实践
1. **Token 安全**：
   - 最小长度 32 字符
   - 远程模式强制设置
   - 默认隐藏显示
2. **输入验证**：
   - URI 格式：`protocol://path` 正则验证
   - 端口范围：1-65535
   - 预设名称非空
3. **操作保护**：
   - 删除操作需要确认
   - 不能删除激活的预设
   - 不能删除默认命名空间

### 性能考虑
1. **批量操作**：Boot URI 多命名空间使用批量 API 调用
2. **缓存利用**：后端配置使用进程内缓存
3. **懒加载**：设置抽屉打开时才加载数据
4. **状态管理**：避免不必要的重渲染，使用 `useCallback` 和 `useMemo`

### 可维护性设计
1. **组件分离**：每个 Section 独立组件，职责单一
2. **API 抽象**：`api.js` 集中管理所有 API 调用
3. **配置集中**：所有配置通过 `config.json` 统一管理
4. **错误处理**：统一 Toast 通知和错误反馈机制
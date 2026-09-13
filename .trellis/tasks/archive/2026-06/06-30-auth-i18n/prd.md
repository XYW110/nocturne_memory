# Auth & i18n 认证与国际化 PRD

## Goal

为 Nocturne Memory 系统提供安全的 API 访问控制和完整的中英双语界面支持。**Auth**（认证）负责保护所有 API 端点免受未授权访问，**i18n**（国际化）确保前端 Dashboard 和后端 API 错误消息都能以用户首选语言呈现。

两个子系统在代码中均已完整实现，本文档作为它们的正式规格说明。

---

## Requirements

### Authentication 认证功能

| ID | 需求 | 说明 |
|----|------|------|
| A1 | Bearer Token 认证 | 所有 API 请求必须携带 `Authorization: Bearer <token>` 头 |
| A2 | Token 存储 | Token 存储在 `localStorage` 的 `api_token` 键中 |
| A3 | 请求拦截器自动附加 | axios 请求拦截器自动从 localStorage 读取 token 并附加到每个请求 |
| A4 | 401 自动处理 | 响应拦截器检测 401 → 清除 token → 触发 AUTH_ERROR_EVENT |
| A5 | Token 认证界面 | TokenAuth 组件提供 Token 输入表单，验证后进入主界面 |
| A6 | URL Token 注入 | 支持通过 `?token=xxx` 查询参数传入 token（用于 Docker/自动化部署） |
| A7 | 网络鉴权强制 | `enforce_network_auth()` 在服务启动时检查：远程模式（host≠127.0.0.1）下必须设置 token |
| A8 | Token 安全比较 | 使用 `secrets.compare_digest()` 防止时序攻击 |
| A9 | 路径排除 | `/health` 和 `/api/health` 端点免于认证检查 |
| A10 | Token 最短长度 | Token 不得少于 32 字符 |

### i18n 国际化功能

| ID | 需求 | 说明 |
|----|------|------|
| I1 | 前端双语支持 | 支持英文（en）和中文（zh）两种语言 |
| I2 | react-i18next 集成 | 所有 UI 文本通过 `t()` 函数翻译 |
| I3 | 语言自动检测 | `detectLocale()` 优先级链：Settings 中的 locale → 浏览器语言 → 英文回退 |
| I4 | 语言手动切换 | Settings Drawer 中的 LocaleSection 提供 auto/en/zh 三种选项 |
| I5 | 语言设置持久化 | locale 值存储在 `config.json` 的 `locale` 字段 |
| I6 | 前端翻译键命名空间 | `app.*`, `auth.*`, `settings.*`, `memory.*`, `review.*`, `maintenance.*`, `snapshot.*`, `diff.*` |
| I7 | 后端翻译系统 | `locales/` 包提供轻量级 `t()` 函数，支持 dot-notation 键查找 |
| I8 | 后端 Accept-Language | `LocaleMiddleware` 解析 HTTP 请求的 `Accept-Language` 头，设置 per-request locale |
| I9 | 后端静默回退 | 未翻译的键返回键名本身，不抛异常 |
| I10 | MCP 固定英文 | MCP/stdio 路径（无 HTTP 头）始终返回英文 |

---

## Auth Specification

### 1. Token 存储

```
localStorage key: "api_token"
value: 配置中的 token 明文（如 "s3cr3t-t0k3n-with-at-least-32-chars"）
```

- Token 在 `TokenAuth` 提交时写入 localStorage（`frontend/src/components/TokenAuth.jsx:22`）
- Token 在 401 响应时由 axios 拦截器清除（`frontend/src/lib/api.js:30`）
- Token 可通过 URL 查询参数 `?token=xxx` 注入（`frontend/src/App.jsx:36-49` `consumeTokenFromUrl()`）

### 2. 请求拦截器

**文件**: `frontend/src/lib/api.js:10-23`

```
axios request interceptor:
  1. 从 localStorage 读取 "api_token"
  2. 若存在 → 设置 Authorization: Bearer {token}
  3. 检查是否已设置 X-Namespace 头
  4. 若未设置 → 从 localStorage 读取 "selected_namespace"
  5. 若非 /review 路径 → 附加 X-Namespace 头
```

Token 附加对所有 `/api/*` 请求全局生效（axios.create({ baseURL: '/api' })）。

### 3. 401 处理

**文件**: `frontend/src/lib/api.js:26-35`

```
axios response interceptor (error handler):
  if (error.response.status === 401):
    1. localStorage.removeItem('api_token')
    2. window.dispatchEvent(new CustomEvent('nocturne:auth-error'))
    3. return Promise.reject(error)
```

### 4. AUTH_ERROR_EVENT

- **常量名**: `AUTH_ERROR_EVENT = 'nocturne:auth-error'`（`frontend/src/lib/api.js:3`）
- **触发位置**: axios 响应拦截器（401 时）
- **监听位置**: `App.jsx:318-323` — `useEffect` 中 `addEventListener`
- **处理函数**: `handleAuthError` → 设置 `isAuthenticated = false` → 渲染 `TokenAuth` 组件

### 5. 认证流程（时序）

```
App mount
  → consumeTokenFromUrl(): 检查 URL 是否有 ?token=
  → 检查 localStorage 是否有 api_token
  → isAuthenticated = true/false

如果 isAuthenticated = false:
  → 渲染 TokenAuth 组件
  → 用户输入 token → handleSubmit()
    → localStorage.setItem('api_token', trimmed)
    → 调用 getDomains() 验证
    → 成功 → onAuthenticated() → isAuthenticated = true
    → 失败 (401) → localStorage.removeItem('api_token') → 显示错误

如果 isAuthenticated = true:
  → 发送 checkAuthStatus() 探测请求
  → 200 → 进入主界面
  → 401 → 触发 handleAuthError → 回到 TokenAuth
  → 无响应 → 显示连接错误页面

运行时 401:
  → axios 拦截器 → 清除 token → 派发 AUTH_ERROR_EVENT
  → App.handleAuthError → isAuthenticated = false
  → 重新渲染 TokenAuth
```

### 6. 后端 BearerTokenAuthMiddleware

**文件**: `backend/auth.py:79-116`

```
BearerTokenAuthMiddleware:
  - ASGI 中间件，在请求到达路由前执行
  - 从 config.json 读取 api_token
  - 若未设置 token → 放行（pass-through）
  - 若非 HTTP scope → 放行
  - 若路径在 excluded_paths 中 → 放行（默认 ["/api/health", "/health"]）
  - 否则:
    1. 读取 Authorization 头
    2. 必须以 "Bearer " 开头
    3. 提取 token 部分
    4. 使用 secrets.compare_digest() 比较（防时序攻击）
    5. 不匹配 → 返回 401 {"detail": "Unauthorized"}
```

**中间件嵌套顺序**（`backend/web_app.py:147-151`）:
```
NamespaceMiddleware(
  LocaleMiddleware(
    BearerTokenAuthMiddleware(inner, excluded_paths=["/api/health", "/health"])
  )
)
```

### 7. enforce_network_auth() 启动检查

**文件**: `backend/auth.py:136-192`

在 `main.py` 和 `run_sse.py` 启动时调用：
- Token 存在但 < 32 字符 → RuntimeError
- Token 存在且 host ≠ localhost → 打印提示（远程模式启用认证）
- Token 不存在且 host = localhost → 警告（建议设置 token）
- Token 不存在且 host ≠ localhost → RuntimeError（拒绝启动）

---

## i18n Specification

### 1. 语言选项

| 选项值 | 显示名称 | 含义 |
|--------|----------|------|
| `auto` | Auto / Browser Default / 自动检测（跟随浏览器） | config.json 中 locale=null，前端根据浏览器语言 + Settings locale 回退 |
| `en` | English (en) | 英文界面 |
| `zh` | 中文 (zh) | 中文界面 |

**locale 存储在 config.json 中**:
- `locale` 字段 → `null` = auto, `"en"` = 英文, `"zh"` = 中文
- 通过 `PUT /settings` 的 `locale` 字段更新

### 2. 翻译键命名空间

前端翻译文件位于 `frontend/src/i18n/en.json` 和 `zh.json`。

| 命名空间 | 用途 | 示例键 |
|----------|------|--------|
| `app.nav.*` | 导航栏 | `app.nav.brand`, `app.nav.review` |
| `app.soul.*` | 灵魂页面标签 | `app.soul.tab_birth` |
| `app.settings.*` | 设置抽屉分区标题 | `app.settings.section_server` |
| `app.error.*` | 连接错误页面 | `app.error.connection_refused` |
| `app.loading.*` | 加载状态 | `app.loading.connecting` |
| `auth.*` | Token 认证界面 | `auth.title`, `auth.token_label` |
| `settings.server.*` | 服务器配置 | `settings.server.port_label` |
| `settings.database.*` | 数据库配置 | `settings.database.type_label` |
| `settings.boot_uris.*` | 启动 URI 配置 | `settings.boot_uris.empty` |
| `settings.presets.*` | 预设管理 | `settings.presets.description` |
| `settings.domains.*` | 域名管理 | `settings.domains.placeholder` |
| `settings.advanced.*` | 高级选项 | `settings.advanced.token_label` |
| `settings.locale.*` | 语言设置 | `settings.locale.label` |
| `settings.soul.*` | 灵魂模板 | `settings.soul.description` |
| `settings.emotion.*` | 情感配置 | `settings.emotion.description` |
| `settings.relationship.*` | 关系管理 | `settings.relationship.current_title` |
| `memory.*` | 记忆浏览器 | `memory.search.placeholder` |
| `review.*` | 审查系统 | `review.sidebar.title` |
| `maintenance.*` | 维护系统 | `maintenance.header.title` |
| `snapshot.*` | 快照显示 | `snapshot.action_created` |
| `diff.*` | 差异比较 | `diff.no_changes` |

### 3. 语言自动检测（detectLocale）

**文件**: `frontend/src/i18n/index.js:30-44`

```
detectLocale():
  1. 调用 GET /settings 获取配置
  2. 若 res.data.settings?.locale 存在 → i18n.changeLanguage(locale)
  3. 若 locale 未设置（null）→ detectBrowserLocale()
     - 读取 navigator.language → 提取主语言标签
     - 若在 SUPPORTED 列表中 → 使用浏览器语言
     - 否则 → 回退 'en'
  4. i18n.changeLanguage(detected)
```

**调用时机**: `App.jsx:325-329` → 认证成功后且 loading 完成时调用

### 4. react-i18next 配置

**文件**: `frontend/src/i18n/index.js:7-17`

```javascript
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: 'en',           // 默认语言
  fallbackLng: 'en',   // 回退语言
  interpolation: {
    escapeValue: false, // React 已处理 XSS
  },
})
```

**语言切换副作用**: `frontend/src/i18n/index.js:19-21`
```javascript
i18n.on('languageChanged', (lng) => {
  api.defaults.headers.common['Accept-Language'] = lng
})
```

### 5. useLocale Hook

**文件**: `frontend/src/i18n/useLocale.js`

```javascript
export function useLocale() {
  const { t, i18n } = useTranslation()
  return { t, locale: i18n.language }
}
```

提供便捷的 `{ t, locale }` 解构使用。

### 6. LocaleSection 组件

**文件**: `frontend/src/features/settings/LocaleSection.jsx`

- 下拉选择：auto / en / zh
- `auto` 选项 → `onSave({ locale: null })`（写入 config.json 为 null）
- `en/zh` 选项 → `onSave({ locale: 'en' })` 或 `onSave({ locale: 'zh' })`
- 保存成功后 SettingsDrawer 调用 `detectLocale()` 重新检测并切换语言

### 7. 后端翻译系统

**文件**: `backend/locales/__init__.py`

```
t(key, locale=None):
  1. 解析 locale（None → get_request_locale() → config.get_locale() → "en"）
  2. 若 locale == "en" → 查 en.json → 命中返回翻译 → 未命中返回 key 本身
  3. 其他 locale → 查对应的 zh.json → 命中返回 → 未命中回退 en.json → 仍未命中返回 key
```

**LocaleMiddleware**（`backend/locales/middleware.py`）:
- 解析 `Accept-Language` 头
- 取第一个语言标签的 primary subtag
- 验证是否在 `KNOWN_LOCALES = frozenset({"en", "zh"})` 中
- 设置 `contextvars.ContextVar` 为请求 scope 的生命周期

**语言解析优先级链**:
```
Accept-Language 头 → LocaleMiddleware 解析
                    → contextvars.ContextVar (per-request)
                    → config.get_locale() (config.json)
                    → "en" (fallback)
```

### 8. 翻译键命名（后端）

后端翻译文件位于 `backend/locales/en.json` 和 `zh.json`。

| 命名空间 | 示例键 |
|----------|--------|
| `api.browse.*` | `api.browse.path_not_found` |
| `api.review.*` | `api.review.no_changes_for_node` |
| `api.settings.*` | `api.settings.token_required` |

**模板语法**: `{variable}` — 使用 `str.format()` 插入变量。

---

## API Specification

### GET /settings

获取包含 locale 和 api_token 在内的所有设置。

**Response**:
```json
{
  "settings": {
    "api_token": "s3cr3t...",
    "locale": "zh",         // null = auto, "en", "zh"
    "web_port": 8080,
    "host": "127.0.0.1",
    ...
  },
  "config_path": "/path/to/config.json",
  "locked_fields": ["web_port", "host"]  // Docker 环境
}
```

### PUT /settings

更新设置，包括 `locale` 和 `api_token`。

**Request** (partial update):
```json
{
  "locale": "zh"             // null = auto / "en" / "zh"
}
```

**验证规则**:
- `locale`: 允许设为 `null`（清除以启用 auto）
- `api_token`: 不为空时必须 ≥ 32 字符
- 远程模式（host ≠ 127.0.0.1）下，不能将 `api_token` 清空

**Response**:
```json
{
  "success": true,
  "updated": ["locale"],
  "needs_restart": false     // locale 变更无需重启
}
```

### Authorization Header 格式

所有受保护端点要求:
```
Authorization: Bearer <api_token>
```

**排除列表**（无需认证）:
- `GET /health`
- `GET /api/health`
- 前端静态文件（SPA fallback routing）

---

## Acceptance Criteria

### Auth

- [ ] `TokenAuth` 组件正确渲染 Token 输入表单（中英文均测试）
- [ ] 输入正确 token 后调用 `getDomains()` 验证 → 成功进入主界面
- [ ] 输入错误 token → 显示 "Invalid token" 错误信息
- [ ] 无 token 时访问 `/api/*` → 后端返回 401 → 前端清除 token → 显示 TokenAuth
- [ ] URL `?token=xxx` 参数正确注入 localStorage 并跳过认证界面
- [ ] token 有效期：401 时 axios 拦截器清除 localStorage
- [ ] `AUTH_ERROR_EVENT` 触发后 App 切换回认证界面
- [ ] 后端 `enforce_network_auth()` 在远程模式下拒绝无 token 启动
- [ ] `secrets.compare_digest()` 防御时序攻击（单元测试覆盖）
- [ ] `/health` 和 `/api/health` 免于认证检查
- [ ] Docker 环境下 `host` 和 `web_port` 被锁定

### i18n

- [ ] 前端默认英文 → 浏览器设为英文 → 页面显示英文
- [ ] 浏览器设为中文 → 默认检测为中文 → 页面显示中文
- [ ] Settings 中设置 `locale=zh` → 刷新后页面显示中文（覆盖浏览器检测）
- [ ] Settings 中设置 `locale=auto`（null）→ 回退到浏览器检测
- [ ] 所有 UI 文本均有中英文翻译（`t()` 无 fallback 到 key 本身）
- [ ] 语言切换后 `Accept-Language` 头更新
- [ ] `useLocale()` hook 正确返回 `{ t, locale }`
- [ ] 后端 API 错误消息根据 `Accept-Language` / locale 设置返回对应语言
- [ ] 后端翻译键缺失时静默回退到键名本身
- [ ] MCP/stdio 路径始终返回英文
- [ ] `i18n.test.js` smoke tests 通过（默认英文 / 切换中文）

---

## Dependencies

### Auth 依赖

- **前端**: `axios`（HTTP 请求库）
- **后端**: `secrets`（Python 标准库），`starlette`（ASGI 框架）
- **存储**: `localStorage`（浏览器），`config.json`（服务端配置文件）
- **层级关系**: `BearerTokenAuthMiddleware` → `LocaleMiddleware` → `NamespaceMiddleware`（ASGI 中间件链）

### i18n 依赖

- **前端依赖**:
  - `i18next` — 翻译框架核心
  - `react-i18next` — React 绑定
  - `lucide-react` — 图标库（不受 i18n 影响）
- **后端依赖**: 无第三方依赖（自研轻量级 `locales/` 包，使用 `json` + `contextvars`）
- **存储**: `config.json` 的 `locale` 字段
- **测试**: `vitest`（前端 i18n smoke tests）

### 跨系统关系

- **i18n ↔ Auth**: TokenAuth 界面文本全部国际化（`auth.*` 命名空间）
- **i18n ↔ Settings**: locale 值通过 `PUT /settings` 持久化
- **Auth ↔ Settings**: api_token 通过 `PUT /settings` 持久化，AdvancedSection 提供 Token 管理 UI
- **Auth ↔ MCP**: `enforce_network_auth()` 打印 MCP 客户端配置提示

---

## Notes

1. **两个系统的独立性**: Auth 和 i18n 是两个正交的子系统。本 PRD 将其合并因为它们在父任务 PRD 中一同被标记为"已实现但未记录"，且代码规模适中。

2. **locale 的 auto 语义**: `config.json` 中 `locale=null` 表示 "auto"。前端 `detectLocale()` 发现 locale 为 null 时不立即使用 settings 中的值，而是回退到浏览器检测。这允许用户在 Settings 中清除语言选择后回到自动检测模式。

3. **英文为正则语言（Canonical）**: 前端 `en.json` 中的所有翻译键和值构成权威文档。中文 `zh.json` 仅包含差异部分。后端 `locales/__init__.py` 中 `t()` 也优先查 en.json。

4. **LocaleMiddleware 与 detectLocale 的双重检测**:
   - 前端 `detectLocale()` 读取 Settings locale → 浏览器语言 → 英文
   - 后端 `LocaleMiddleware` 读取 `Accept-Language` 头 → 英文
   - 前端 `i18n.on('languageChanged')` 设置 `Accept-Language` 头，使两者保持一致

5. **Token 安全特性**:
   - 使用 `secrets.compare_digest()` 防时序攻击
   - Token 最短长度 32 字符（启动时 + PUT /settings 时均校验）
   - Docker 环境中 `enforce_network_auth()` 提供专门的错误提示

6. **相关文件**:

   **前端 Auth**:
   - `frontend/src/lib/api.js` — AUTH_ERROR_EVENT, axios 拦截器, Token/Namaspace 附加
   - `frontend/src/components/TokenAuth.jsx` — Token 输入认证界面
   - `frontend/src/App.jsx` — 认证状态管理, consumeTokenFromUrl, AUTH_ERROR_EVENT 监听
   - `frontend/src/features/settings/AdvancedSection.jsx` — Token 管理 UI（生成/复制）

   **前端 i18n**:
   - `frontend/src/i18n/index.js` — i18next 初始化, detectLocale, Accept-Language 同步
   - `frontend/src/i18n/useLocale.js` — useLocale hook
   - `frontend/src/i18n/en.json` — 英文翻译（574 行，8 个命名空间）
   - `frontend/src/i18n/zh.json` — 中文翻译
   - `frontend/src/i18n/i18n.test.js` — Smoke tests
   - `frontend/src/features/settings/LocaleSection.jsx` — 语言选择 UI
   - `frontend/src/main.jsx` — i18n 初始化入口

   **后端 Auth**:
   - `backend/auth.py` — BearerTokenAuthMiddleware, verify_token, enforce_network_auth
   - `backend/web_app.py` — 中间件组装（BearerTokenAuthMiddleware → LocaleMiddleware → NamespaceMiddleware）
   - `backend/main.py` — enforce_network_auth 调用入口
   - `backend/tests/unit/test_auth.py` — Auth 单元测试

   **后端 i18n**:
   - `backend/locales/__init__.py` — t() 翻译函数, JSON 加载, 三级回退
   - `backend/locales/middleware.py` — LocaleMiddleware, Accept-Language 解析
   - `backend/locales/en.json` — 后端英文翻译（API 消息）
   - `backend/locales/zh.json` — 后端中文翻译
   - `backend/config.py:310-312` — get_locale() 函数

   **共享**:
   - `backend/api/settings.py` — locale 和 api_token 的读写端点

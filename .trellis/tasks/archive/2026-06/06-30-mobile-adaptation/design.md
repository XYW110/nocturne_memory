# 手机端网页适配 — 技术设计

## 1. 架构边界

### 1.1 桌面端与手机端的隔离原则

```
                    BrowserRouter (App.jsx)
                    ┌──────────────────────────────────────────┐
                    │  DeviceDetector (useEffect 入口)          │
                    │  ┌──────────────────────────────────────┐ │
                    │  │ UA检测 → 手机访问非 /m/*? → replace  │ │
                    │  │ 桌面访问 /m/*?     → replace → /     │ │
                    │  │ localStorage preference 可覆盖       │ │
                    │  └──────────────────────────────────────┘ │
                    │                                          │
                    │  <Routes>                                │
                    │  ┌───────────────────┐                   │
                    │  │ /review           │ → ReviewPage      │
                    │  │ /memory           │ → MemoryBrowser   │
                    │  │ /soul             │ → SoulPage        │
                    │  │ /maintenance      │ → MaintenancePage │
                    │  │ /m/*              │ → MobileLayout    │
                    │  └───────────────────┘                   │
                    │  <SettingsDrawer />                      │
                    │  <ToastContainer />                      │
                    └──────────────────────────────────────────┘
```

**核心原则**:
- 桌面端和手机端使用**完全独立的路由前缀**，Layout 互不嵌套
- 桌面端 `Layout` 不做任何改动（满足 R5.1）
- 手机端在 `MobileLayout` 内部自建二级 `<Routes>`，包含 `/m/*` 子路由
- 共享组件（Toast、ConfirmModal、PromptModal、TokenAuth、DiffViewer、SnapshotList）直接复用（满足 R5.2）
- API 客户端（`api.js`）零改动复用

### 1.2 文件组织

```
frontend/src/
├── App.jsx                          # 设备检测、路由分发（改动）
├── features/
│   └── mobile/                      # 新增目录
│       ├── MobileLayout.jsx         # 底部 Tab 栏 + 顶部标题栏 + 子路由
│       ├── MobileReview.jsx         # 审查移动版
│       ├── MobileMemory.jsx         # 记忆浏览移动版
│       ├── MobileSoul.jsx           # 灵魂移动版
│       ├── MobileMaintenance.jsx    # 维护移动版
│       └── MobileSettings.jsx       # 设置移动版
├── i18n/
│   └── locales/
│       ├── zh/
│       │   └── mobile.json          # 新增
│       └── en/
│           └── mobile.json          # 新增
├── components/                      # 不变（复用）
├── lib/
│   └── api.js                       # 不变（复用）
└── index.css                        # 新增 safe-area 相关 CSS 变量
```

## 2. 路由设计

### 2.1 路由表

| 路径 | 组件 | 说明 |
|------|------|------|
| `/review` 等 | 现有桌面端路由 | 原封不动 |
| `/m/` | `<Navigate to="/m/review" replace />` | 默认跳转 |
| `/m/review` | `MobileReview` | 审查列表移动版 |
| `/m/memory` | `MobileMemory` | 记忆浏览移动版 |
| `/m/soul` | `MobileSoul` | 灵魂移动版 |
| `/m/maintenance` | `MobileMaintenance` | 维护移动版 |
| `/m/settings` | `MobileSettings` | 设置移动版 |

### 2.2 路由实现方式

在 `App.jsx` 的 `<BrowserRouter>` 内部，保持现有桌面端 `<Routes>` 不变，并在其后追加 `/m/*` 路由：

```jsx
<BrowserRouter>
  <Routes>
    {/* 桌面端路由 — 不变 */}
    <Route path="/" element={<Navigate to="/review" replace />} />
    <Route path="/review" element={<DesktopLayout><ReviewPage /></DesktopLayout>} />
    {/* ...其他桌面端路由 */}
    
    {/* 手机端路由 */}
    <Route path="/m/*" element={<MobileLayout />} />
  </Routes>
  <SettingsDrawer />
  <ToastContainer />
</BrowserRouter>
```

**关键决策**: 桌面端路由包裹在 `DesktopLayout` 中（从当前 `Layout` 组件抽取），手机端使用 `MobileLayout`。设备检测在 `useEffect` 中根据当前 `pathname` 决定是否重定向，**不在 Router 层面做条件渲染**。

### 2.3 MobileLayout 内部子路由

`MobileLayout.jsx` 内部使用 `<Routes>` 渲染 5 个子页面：

```jsx
function MobileLayout() {
  return (
    <div className="mobile-layout-container">
      <TopBar />          {/* 标题 + 命名空间下拉 */}
      <div className="mobile-content">
        <Routes>
          <Route index element={<Navigate to="/m/review" replace />} />
          <Route path="review" element={<MobileReview />} />
          <Route path="memory" element={<MobileMemory />} />
          <Route path="soul" element={<MobileSoul />} />
          <Route path="maintenance" element={<MobileMaintenance />} />
          <Route path="settings" element={<MobileSettings />} />
        </Routes>
      </div>
      <BottomTabBar />     {/* 4 Tab 底部固定栏 */}
    </div>
  );
}
```

## 3. 设备检测与重定向

### 3.1 检测逻辑

```js
// 文件：App.jsx useEffect 入口
const isMobileDevice = () => {
  const ua = navigator.userAgent;
  return /Mobile|Android|iPhone|iPad|WebOS/i.test(ua);
};

const getPreference = () => 
  localStorage.getItem('mobile_preference') || 'auto';

const shouldRedirectToMobile = (pathname) => {
  if (getPreference() === 'desktop') return false;
  if (getPreference() === 'mobile') return true;
  // 'auto' 模式
  const isMobile = isMobileDevice();
  const isMobilePath = pathname.startsWith('/m/');
  return isMobile ? !isMobilePath : isMobilePath;
};
```

### 3.2 重定向数据流

```
用户打开 URL
    ↓
App.jsx useEffect 执行
    ↓
shouldRedirectToMobile(location.pathname)
    ↓                          ↓
true: replace → /m/*       false: 正常渲染
    ↓                          ↓
MobileLayout 渲染           DesktopLayout 渲染
```

### 3.3 手动切换入口

在 `MobileLayout` 底部提供"切换到桌面版"链接，在 `DesktopLayout` 底部提供"切换到手机版"链接（不显眼位置）：

- 点击时设置 `localStorage.setItem('mobile_preference', 'desktop'/'mobile')` 并 `window.location.replace('/')` / `window.location.replace('/m/review')`
- 桌面端入口放在页面底部 footer 区域，手机端入口放在设置页面或底部栏溢出菜单

### 3.4 localStorage 键规范

| 键 | 类型 | 说明 |
|----|------|------|
| `mobile_preference` | `'auto' \| 'mobile' \| 'desktop'` | 用户设备偏好，默认 `'auto'` |
| `selected_namespace` | `string` | 现有命名空间键，复用不改 |

## 4. MobileLayout 组件设计

### 4.1 布局结构

```
┌─────────────────────────┐
│ Top Bar (h-12)          │ ← 固定顶部
│ [页面标题]  [命名空间▼] │
├─────────────────────────┤
│                         │
│ Content Area            │ ← flex-1, overflow-y-auto
│ (子路由渲染区)          │
│                         │
│                         │
├─────────────────────────┤
│ Bottom Tab Bar (h-14)   │ ← 固定底部
│ 📋审查  🧠记忆  💫灵魂  🔧维护 │
│ padding-bottom:         │
│ env(safe-area-inset-bottom) │
└─────────────────────────┘
```

### 4.2 CSS 约束

- 整体容器 `h-screen flex flex-col`
- 顶部栏 `h-12 flex-shrink-0`，`bg-nocturne-bg-secondary`
- 内容区 `flex-1 min-h-0 overflow-y-auto`
- 底部 Tab 栏 `h-14 flex-shrink-0`，`pb-[env(safe-area-inset-bottom,0px)]`
- 底部栏实际高度 = 56px (h-14) + env(safe-area-inset-bottom)

### 4.3 底部 Tab 栏样式

```jsx
const tabs = [
  { id: 'review',      path: '/m/review',      icon: ShieldCheck, color: 'indigo',  label: '审查' },
  { id: 'memory',      path: '/m/memory',      icon: Database,     color: 'indigo',  label: '记忆' },
  { id: 'soul',        path: '/m/soul',        icon: Heart,        color: 'rose',    label: '灵魂' },
  { id: 'maintenance', path: '/m/maintenance', icon: Sparkles,     color: 'amber',   label: '维护' },
];
```

每个 Tab：
- 宽度均分 (`flex-1`)
- 当前页高亮：顶部 2px 色条 (`border-t-2 border-{color}-500`) + 图标/文字着色
- 非当前页：图标/文字 `text-nocturne-text-muted`
- 整体容器 `bg-nocturne-bg-secondary border-t border-[var(--color-border)]`

### 4.4 顶部标题栏

- 左侧：当前页面标题（`t('mobile.nav.{page}')`）
- 右侧：`NamespaceSelector` 组件（从 App.jsx 的 NamespaceSelector 提取为独立组件并复用，或内联简化版）

## 5. 手机端页面组件设计

### 5.1 MobileReview — 审查移动版

**数据源**: 复用 `getGroups()`, `getGroupDiff()`, `rollbackGroup()`, `approveGroup()`, `clearAll()`（API 不变）

**布局**:
```
┌─────────────────────────┐
│ Top Bar: "审查" [命名空间▼] │
├─────────────────────────┤
│ 变更组列表（全屏占满）    │
│ ┌─────────────────────┐ │
│ │ [🔵created] uri...  │ │ ← 点击进入详情
│ │  nodes · 3 rows     │ │
│ ├─────────────────────┤ │
│ │ [🔴deleted] uri...  │ │
│ │  edges · 1 row     │ │
│ ├─────────────────────┤ │
│ │ ...                 │ │
│ └─────────────────────┘ │
│                         │
│ [全部集成] 按钮（底部固定）│
├─────────────────────────┤
│ Bottom Tab Bar          │
└─────────────────────────┘
```

**详情页（点击展开后）**:
- 全屏覆盖，顶部有 `< 返回` 按钮
- DiffViewer 渲染内容变化
- 底部固定操作按钮：[驳回] [集成]
- 元数据变更（metadata changes）以紧凑卡片展示

**关键约束**:
- 不显示桌面端的 w-72 侧边栏
- SnapshotList 扁平化为全宽列表项
- 变更组卡片内容精简：类型图标 + action badge + display_uri（截断） + row_count

### 5.2 MobileMemory — 记忆浏览移动版

**数据源**: 复用 `getDomains()`, `searchMemories()`, `getSettingsBootUris()`, 节点详情 API

**布局**:
```
┌─────────────────────────┐
│ Top Bar: "记忆" [命名空间▼] │
├─────────────────────────┤
│ [域名▼: core] [🔍 搜索...] │ ← 固定顶部
├─────────────────────────┤
│ ┌─────────┐ ┌─────────┐ │
│ │ 卡片 1   │ │ 卡片 2   │ │ ← grid-cols-1
│ │ content  │ │ content  │ │   卡片流
│ └─────────┘ └─────────┘ │
│ ┌─────────┐             │
│ │ 卡片 3   │             │
│ └─────────┘             │
├─────────────────────────┤
│ Bottom Tab Bar          │
└─────────────────────────┘
```

**关键约束**:
- **无树形侧边栏** — PRD 决策：树形导航在手机上效率低
- 域名通过下拉选择器切换（复用 getDomains API）
- 搜索框支持全文检索
- 节点详情：点击卡片进入全屏详情页（顶部 `< 返回`）
- 复用 `NodeGridCard` 组件渲染每个记忆卡片

### 5.3 MobileSoul — 灵魂移动版

**数据源**: 复用 `SoulPage` 内所有子组件（`EmotionPanel`, `EmotionLedger`, `TemplatesSection`, `RelationshipPanel`）

**布局**:
```
┌─────────────────────────┐
│ Top Bar: "灵魂" [命名空间▼]│
├─────────────────────────┤
│ [诞生] [情感] [关系]     │ ← Tab 切换栏（水平滚动）
├─────────────────────────┤
│ 当前 Tab 内容            │
│ （TemplatesSection /    │
│  EmotionPanel+EmotionLedger /
│  RelationshipPanel）    │
│                         │
│ ────── 关于我 ──────    │
│ [⚙ 设置] → /m/settings  │ ← 设置入口
├─────────────────────────┤
│ Bottom Tab Bar          │
└─────────────────────────┘
```

**关键约束**:
- 复用 `SoulPage` 的 Tab 逻辑，但改为**水平滚动**的 Tab 栏（手机上 3 个 Tab 足够）
- `TemplatesSection`、`EmotionPanel`、`EmotionLedger`、`RelationshipPanel` 直接复用
- 设置入口放在内容区域底部（"关于我"区域下方），用图标+文字链接到 `/m/settings`
- `soulVersion` 刷新触发器逻辑保持不变

### 5.4 MobileMaintenance — 维护移动版

**数据源**: 复用 `MaintenancePage` 所有 API 调用

**布局**:
```
┌─────────────────────────┐
│ Top Bar: "维护" [命名空间▼]│
├─────────────────────────┤
│ 统计栏                   │
│ [废弃: 12] [孤儿: 5]    │
├─────────────────────────┤
│ 孤儿/废弃列表            │ ← 单列
│ ┌─────────────────────┐ │
│ │ □ [废弃] content...  │ │ ← 长按多选
│ ├─────────────────────┤ │
│ │ □ [孤儿] content...  │ │
│ ├─────────────────────┤ │
│ │ ...                 │ │
│ └─────────────────────┘ │
│                         │
│ [删除选中 (3)]（底部固定）│
├─────────────────────────┤
│ Bottom Tab Bar          │
└─────────────────────────┘
```

**关键约束**:
- 无侧边栏分组 — 所有项扁平列表（或简单分段：废弃区 + 孤儿区）
- **长按多选模式**：替代桌面端的 checkbox 多选
  - `onTouchStart` + timer → 长按 500ms 触发选择模式
  - 选择模式下，点击切换选中（视觉：蓝色边框+勾标记）
  - 底部浮现"删除选中 (N)"按钮
- 保留 `ConfirmModal` 确认删除
- 复原表单（`RestoreForm`）可在点击详情后展开显示

### 5.5 MobileSettings — 设置移动版

**数据源**: 复用 `SettingsDrawer` 所有子 Section 组件和数据加载逻辑

**布局**:
```
┌─────────────────────────┐
│ Top Bar: "← 设置"        │ ← 独立的顶部栏（无命名空间）
├─────────────────────────┤
│ ▼ 数据库                 │ ← Section 分区折叠
│   状态信息 / 操作按钮     │    复用 Section.jsx
├─────────────────────────┤
│ ▼ 启动 URI               │
│   BootUrisSection 内容   │
├─────────────────────────┤
│ ▼ 预设管理               │
│   PresetsSection 内容    │
├─────────────────────────┤
│ ▼ 服务器                 │
│   ServerSection 内容     │
├─────────────────────────┤
│ ▼ 语言                   │
│   LocaleSection 内容     │
├─────────────────────────┤
│ ▼ 高级                   │
│   AdvancedSection 内容   │
├─────────────────────────┤
│ Bottom Tab Bar          │
└─────────────────────────┘
```

**关键约束**:
- 全屏页面，宽度 100vw
- 复用 `Section.jsx` 折叠组件（已有展开/折叠逻辑）
- 复用 `DatabaseSection`, `BootUrisSection`, `PresetsSection`, `ServerSection`, `LocaleSection`, `AdvancedSection`
- 顶部返回按钮回到 `/m/soul`（因为设置从 Soul 进入）
- 底部 Tab 栏**不包含设置入口** — 设置通过 Soul 页进入

## 6. 数据流契约

### 6.1 API 调用 — 零改动

所有手机端页面直接复用 `frontend/src/lib/api.js` 中的 API 函数。Token、namespace 拦截器逻辑不变。

### 6.2 命名空间

每个手机页面顶部的命名空间下拉独立选择，采用与桌面端相同的 localStorage 机制：
- 键名：`selected_namespace`（复用现有键）
- 读写：通过 `localStorage.getItem/setItem`，axios 拦截器自动附加 `X-Namespace` header
- 注意：切换 namespace 时触发 `window.location.reload()`（与现有逻辑一致）

**简化方案**: 直接将 App.jsx 中的 `NamespaceSelector` 组件提取为独立组件 `src/components/NamespaceSelector.jsx`，桌面端和手机端都引用它。

### 6.3 Settings 事件

手机端不需要桌面端的 `open-settings` CustomEvent 机制，因为 `/m/settings` 是独立路由页面。但保留 `open-settings` 事件监听以防桌面端代码引用。

### 6.4 Toast 与 Modal

- `toast()` 函数 — 全局 CustomEvent 机制不变，直接调用
- `ToastContainer` — 在 `App.jsx` 顶层挂载一次（已存在），手机端页面自动享受
- `ConfirmModal` / `PromptModal` — 作为组件直接引用即可，无任何改动

## 7. i18n 设计

### 7.1 命名空间结构

```
frontend/src/i18n/locales/
├── zh.json                    # 现有翻译（不变）
├── en.json                    # 现有翻译（不变）
├── zh/
│   └── mobile.json            # 新增
└── en/
    └── mobile.json            # 新增
```

### 7.2 i18n 初始化配置

修改 `frontend/src/i18n/index.js`，在 `resources` 中增加 `mobile` 命名空间：

```js
import zhMobile from './locales/zh/mobile.json';
import enMobile from './locales/en/mobile.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en, mobile: enMobile },
    zh: { translation: zh, mobile: zhMobile },
  },
  // ...其他配置不变
});
```

### 7.3 使用方式

手机端组件中使用 `useTranslation('mobile')` 获取移动端翻译：

```jsx
const { t } = useTranslation('mobile');
// t('nav.review') → "审查"
// t('review.action.approve') → "集成"
```

### 7.4 翻译键设计（精简示例）

```json
// zh/mobile.json
{
  "nav": {
    "review": "审查",
    "memory": "记忆",
    "soul": "灵魂",
    "maintenance": "维护",
    "settings": "设置",
    "switchDesktop": "桌面版",
    "switchMobile": "手机版"
  },
  "review": {
    "title": "变更审查",
    "empty": "暂无变更",
    "action": {
      "approve": "集成",
      "reject": "驳回",
      "integrateAll": "全部集成"
    }
  },
  "memory": {
    "title": "记忆浏览",
    "search": "搜索记忆...",
    "domainLabel": "域名"
  },
  "soul": {
    "title": "灵魂",
    "tabBirth": "诞生",
    "tabEmotion": "情感",
    "tabRelation": "关系",
    "settingsEntry": "⚙ 设置"
  },
  "maintenance": {
    "title": "维护",
    "deleteSelected": "删除选中 ({{count}})",
    "selectMode": "长按选择"
  },
  "settings": {
    "title": "设置",
    "back": "返回"
  },
  "common": {
    "back": "返回",
    "loading": "加载中...",
    "error": "出错了",
    "retry": "重试"
  }
}
```

## 8. 组件树

```
App.jsx
├── DeviceDetector (useEffect — UA检测 + 重定向)
├── BrowserRouter
│   ├── DesktopLayout (现有 Layout 组件重命名/抽取)
│   │   ├── TopNavigationBar (不变)
│   │   ├── <Routes> (桌面端路由，不变)
│   │   │   ├── / → Navigate /review
│   │   │   ├── /review → ReviewPage
│   │   │   ├── /memory → MemoryBrowser
│   │   │   ├── /soul → SoulPage
│   │   │   └── /maintenance → MaintenancePage
│   │   └── "切换到手机版" (不显眼链接)
│   ├── MobileLayout (新增)
│   │   ├── TopBar (+ NamespaceSelector/返回按钮)
│   │   ├── <Routes> (手机端子路由)
│   │   │   ├── /m/ → Navigate /m/review
│   │   │   ├── /m/review → MobileReview
│   │   │   ├── /m/memory → MobileMemory
│   │   │   ├── /m/soul → MobileSoul
│   │   │   ├── /m/maintenance → MobileMaintenance
│   │   │   └── /m/settings → MobileSettings
│   │   ├── BottomTabBar (4 Tab)
│   │   └── "切换到桌面版" 链接
│   ├── SettingsDrawer (不变，桌面端使用)
│   └── ToastContainer (不变，全局)
├── TokenAuth (未认证时渲染，不变)
└── Loading/Error 状态 (不变)
```

## 9. CSS 适配

### 9.1 Safe Area 变量

在 `index.css` 中新增：

```css
:root {
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
}
```

### 9.2 移动端全局样式

```css
/* 防止 iOS 橡皮筋效果导致页面抖动 */
.mobile-layout-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 移动端输入框字体不小于 16px，避免 iOS 缩放 */
@media (max-width: 768px) {
  input, select, textarea {
    font-size: 16px !important;
  }
}
```

### 9.3 触摸优化

- 所有可点击元素最小触摸区域 44×44px（Apple HIG）
- 列表项使用 `cursor-pointer select-none`
- 长按选择使用 `onTouchStart` + `setTimeout` 实现
- 滚动区域使用 `-webkit-overflow-scrolling: touch`

## 10. 桌面端 Layout 调整

### 10.1 需要的最小改动

将现有 `Layout` 组件重命名为 `DesktopLayout`（或保持 Layout 名称，仅在内部判断），核心改动：

1. **App.jsx 路由重构**: 将 `<Layout />` 包裹模式改为显式路由包裹，使 `/m/*` 路由不被桌面端 Layout 嵌套
2. **转换方式**: 
   - 当前模式：`<BrowserRouter><Layout /></BrowserRouter>`，其中 Layout 内部渲染 `<Routes>`
   - 新模式：`<BrowserRouter><Routes><Route path="/" element={<DesktopLayout><Outlet /></DesktopLayout>}>...</Route><Route path="/m/*" element={<MobileLayout />} /></Routes></BrowserRouter>`
   - **或者更简单的做法**：在 Layout 中根据 `pathname.startsWith('/m/')` 条件渲染 MobileLayout，路径非 `/m/*` 时渲染现有桌面端布局

### 10.2 推荐方案（最小改动）

在 `App.jsx` 中保持 `Layout` 组件，内部根据 pathname 分流：

```jsx
function Layout() {
  const location = useLocation();
  const isMobileRoute = location.pathname.startsWith('/m/');
  
  if (isMobileRoute) {
    return <MobileLayout />;
  }
  
  // 现有桌面端布局代码完全不变
  return ( /* 现有 JSX */ );
}
```

**优势**: 桌面端 Layout 代码零改动，满足 R5.1。

### 10.3 "切换到桌面版/手机版"入口

- 手机端：在 `MobileLayout` 底部 Tab 栏上方或设置页面提供 `localStorage.setItem('mobile_preference', 'desktop')` + `window.location.replace('/')`
- 桌面端：在页面底部 footer 提供不显眼的 `localStorage.setItem('mobile_preference', 'mobile')` + `window.location.replace('/m/review')`

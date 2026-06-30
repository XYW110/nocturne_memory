# 手机端网页适配 — 实施计划

## 实施顺序总览

```
Phase 1 (基础设施)           Phase 2 (路由与布局)        Phase 3 (逐页面实现)
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Step 1: i18n    │         │ Step 3: Layout   │         │ Step 5: 5页面   │
│ mobile.json     │ ──────▶ │ 路由分发         │ ──────▶ │ 逐个实现        │
│                 │         │ + 设备检测重定向  │         │                 │
│ Step 2: CSS     │         │ + DesktopLayout  │         │ Step 6: 手动    │
│ safe-area 变量  │         │ + MobileLayout   │         │ 切换入口        │
│ 触摸优化        │         │ + BottomTabBar   │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                                                   │
                                                          Step 7: 构建验证
```

## Step 1: 创建 i18n 移动端翻译文件 (R8)

### 1.1 创建目录

```bash
mkdir -p frontend/src/i18n/locales/zh
mkdir -p frontend/src/i18n/locales/en
```

### 1.2 创建 `frontend/src/i18n/locales/zh/mobile.json`

完整翻译键包含所有 5 个页面 + 公共文本。键名保持简短，适应移动端宽度。

### 1.3 创建 `frontend/src/i18n/locales/en/mobile.json`

对应的英文翻译。

### 1.4 修改 `frontend/src/i18n/index.js`

在 `resources` 配置中增加 `mobile` 命名空间：

```js
import zhMobile from './locales/zh/mobile.json'
import enMobile from './locales/en/mobile.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en, mobile: enMobile },
    zh: { translation: zh, mobile: zhMobile },
  },
  // 其他不变
});
```

**验证**: `i18n` 对象应能访问 `mobile` 命名空间的键。

## Step 2: 添加移动端 CSS (R3.2)

### 2.1 修改 `frontend/src/index.css`

在 `:root` 块末尾追加：

```css
--safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
--safe-area-inset-top: env(safe-area-inset-top, 0px);
```

在文件末尾追加移动端全局样式：

```css
/* 移动端全局样式 */
@media (max-width: 768px) {
  input, select, textarea {
    font-size: 16px !important;
  }
}

/* 移动端布局容器：防止 iOS 弹性滚动 */
.mobile-layout-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

/* 底部 Tab 栏基础样式 */
.mobile-tab-bar {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* 触摸友好：最小触摸区域 */
@media (pointer: coarse) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}

/* 隐藏桌面端滚动条在移动端 */
@media (max-width: 768px) {
  .custom-scrollbar::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
}
```

**验证**: 在 Chrome DevTools 中模拟 iPhone，检查 CSS 变量是否生效。

## Step 3: 改造 App.jsx — 路由与设备检测 (R1, R2, R5)

### 3.1 提取 NamespaceSelector 为独立组件

当前 `NamespaceSelector` 在 `App.jsx` 中定义为私有函数（第 62-150 行）。将其提取为 `frontend/src/components/NamespaceSelector.jsx`，桌面端和手机端都引用。

**新文件**: `frontend/src/components/NamespaceSelector.jsx`
- 从 App.jsx 第 62-150 行提取完整代码
- 导出 `default function NamespaceSelector()`
- 移除对 `selected_namespace` localStorage 的依赖外泄 — 组件自管理

### 3.2 添加设备检测逻辑

在 `App.jsx` 顶部 `consumeTokenFromUrl` 之后添加：

```js
// 设备检测
const isMobileDevice = () => {
  const ua = navigator.userAgent;
  return /Mobile|Android|iPhone|iPad|WebOS/i.test(ua);
};

const getMobilePreference = () =>
  localStorage.getItem('mobile_preference') || 'auto';

// 设备重定向
function useDeviceRedirect() {
  const location = useLocation();

  useEffect(() => {
    const pref = getMobilePreference();
    const isMobile = isMobileDevice();
    const isMobilePath = location.pathname.startsWith('/m/');

    let shouldRedirect = false;
    let targetPath = '';

    if (pref === 'mobile') {
      // 强制手机端
      if (!isMobilePath) {
        shouldRedirect = true;
        // 映射桌面端路径到移动端
        const mapping = {
          '/review': '/m/review',
          '/memory': '/m/memory',
          '/soul': '/m/soul',
          '/maintenance': '/m/maintenance',
        };
        const match = Object.entries(mapping).find(([k]) => 
          location.pathname.startsWith(k)
        );
        targetPath = match ? match[1] : '/m/review';
      }
    } else if (pref === 'desktop') {
      // 强制桌面端
      if (isMobilePath) {
        shouldRedirect = true;
        targetPath = '/review';
      }
    } else {
      // auto 模式
      if (isMobile && !isMobilePath) {
        shouldRedirect = true;
        targetPath = '/m/review';
      } else if (!isMobile && isMobilePath) {
        shouldRedirect = true;
        targetPath = '/review';
      }
    }

    if (shouldRedirect) {
      window.location.replace(targetPath);
    }
  }, [location.pathname]);
}
```

### 3.3 修改 Layout 组件 — 增加分流

在现有的 `Layout` 函数开头增加 `/m/*` 路由分流：

```jsx
function Layout() {
  const location = useLocation();
  const isMobileRoute = location.pathname.startsWith('/m/');

  if (isMobileRoute) {
    return <MobileLayout />;
  }

  // === 以下为现有桌面端代码，完全不变 ===
  const { t } = useTranslation();
  // ... 现有 JSX
}
```

### 3.4 在 App 组件中引入 useDeviceRedirect

```jsx
function App() {
  // ... 现有认证逻辑不变
  useDeviceRedirect(); // 新增：在 BrowserRouter 内部调用
  // ...
}
```

**关键**: `useDeviceRedirect` 必须在 `BrowserRouter` 内部（因为用了 `useLocation`），且仅在已认证状态下生效。建议在 `Layout` 组件内调用，或放在 `BrowserRouter` 包裹后的组件中。

**最佳方案**: 将 `useDeviceRedirect` 放在 `Layout` 组件内部（因为 Layout 在 BrowserRouter 内且包含了所有路由逻辑）。

### 3.5 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `App.jsx` | 修改 | 提取 NamespaceSelector → 组件引用；Layout 增加分流；添加 useDeviceRedirect |
| `components/NamespaceSelector.jsx` | 新建 | 从 App.jsx 提取 |
| `features/mobile/MobileLayout.jsx` | 新建 | 下文 Step 4 创建 |

**验证**: 
- 桌面端打开 `http://localhost:3000/` → 正常显示桌面端
- Chrome DevTools 模拟 iPhone 打开 → 自动跳转到 `/m/review`
- 手动访问 `/m/review` 在桌面端 → 自动跳转回 `/review`

## Step 4: 创建 MobileLayout (R3, R6)

### 4.1 创建 `frontend/src/features/mobile/MobileLayout.jsx`

完整实现底部 Tab 栏 + 顶部标题栏 + 子路由。

**组件结构**:

```jsx
import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Database, Heart, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import NamespaceSelector from '../../components/NamespaceSelector';
import MobileReview from './MobileReview';
import MobileMemory from './MobileMemory';
import MobileSoul from './MobileSoul';
import MobileMaintenance from './MobileMaintenance';
import MobileSettings from './MobileSettings';

const TABS = [
  { id: 'review', path: '/m/review', icon: ShieldCheck, color: 'indigo' },
  { id: 'memory', path: '/m/memory', icon: Database, color: 'indigo' },
  { id: 'soul', path: '/m/soul', icon: Heart, color: 'rose' },
  { id: 'maintenance', path: '/m/maintenance', icon: Sparkles, color: 'amber' },
];

// 不需要命名空间的页面
const NO_NAMESPACE_PATHS = ['/m/settings'];

export default function MobileLayout() {
  const { t } = useTranslation('mobile');
  const location = useLocation();
  const showNamespace = !NO_NAMESPACE_PATHS.includes(location.pathname);
  const isSettings = location.pathname === '/m/settings';

  return (
    <div className="mobile-layout-container flex flex-col bg-nocturne-bg-primary text-nocturne-text-primary">
      {/* Top Bar */}
      <div className="h-12 flex-shrink-0 border-b border-[var(--color-border)] bg-nocturne-bg-secondary flex items-center px-4 gap-3">
        {isSettings ? (
          <NavLink to="/m/soul" className="text-nocturne-text-secondary hover:text-nocturne-text-primary p-1">
            ← <span className="text-sm">{t('settings.back')}</span>
          </NavLink>
        ) : (
          <span className="text-sm font-semibold truncate">
            {t(`nav.${TABS.find(tab => location.pathname.startsWith(tab.path))?.id || 'review'}`)}
          </span>
        )}
        <div className="ml-auto">
          {showNamespace && <NamespaceSelector />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="/m/review" replace />} />
          <Route path="review" element={<MobileReview />} />
          <Route path="memory" element={<MobileMemory />} />
          <Route path="soul" element={<MobileSoul />} />
          <Route path="maintenance" element={<MobileMaintenance />} />
          <Route path="settings" element={<MobileSettings />} />
        </Routes>
      </div>

      {/* Bottom Tab Bar */}
      <nav className="mobile-tab-bar h-14 flex-shrink-0 border-t border-[var(--color-border)] bg-nocturne-bg-secondary flex">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                'border-t-2',
                isActive
                  ? `border-${tab.color}-500 text-${tab.color}-400`
                  : 'border-transparent text-nocturne-text-muted'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] leading-none">{t(`nav.${tab.id}`)}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
```

**注意**: 底部 Tab 栏中 Memory Tab 用 `indigo`（而非 `emerald`），因为 `emerald` 用于 NodeGridCard 内容，Tab 栏统一用 indigo 色系以维持视觉一致性。

### 4.2 手动切换入口

在 MobileLayout 底部 Tab 栏上方或 Settings 页面内添加：

```jsx
<button
  onClick={() => {
    localStorage.setItem('mobile_preference', 'desktop');
    window.location.replace('/');
  }}
  className="text-[10px] text-nocturne-text-muted hover:text-nocturne-text-secondary py-1"
>
  {t('nav.switchDesktop')}
</button>
```

**验证**:
- 底部 Tab 栏正确显示 4 个图标
- Tab 切换无白屏
- 当前页高亮正确
- Chrome DevTools 中模拟 iPhone，检查 safe-area 生效

## Step 5: 实现 5 个手机端页面 (R4)

按复杂度递增顺序实施：

### 5.1 MobileSettings（最简单，优先）

**文件**: `frontend/src/features/mobile/MobileSettings.jsx`

**实现策略**: 包装现有 SettingsDrawer 的 Section 组件，去掉抽屉壳，改为全屏页面。

**关键点**:
- 复用 `Section`, `DatabaseSection`, `BootUrisSection`, `PresetsSection`, `ServerSection`, `LocaleSection`, `AdvancedSection`
- 使用与 `SettingsDrawer` 相同的数据加载逻辑（`loadAll` callback）
- 页面宽度 100vw，不设置 max-w 限制
- 顶部返回按钮 → `/m/soul`

**参考**:
- SettingsDrawer.jsx:23-222 — 完整的数据加载和 Section 渲染逻辑
- Section.jsx — 折叠组件

### 5.2 MobileSoul

**文件**: `frontend/src/features/mobile/MobileSoul.jsx`

**实现策略**: SoulPage 的移动端变体，复用所有子组件。

**关键点**:
- Tab 切换（诞生/情感/关系）改为水平排列，放顶部
- 复用 `TemplatesSection`, `EmotionPanel`, `EmotionLedger`, `RelationshipPanel`
- `soulVersion` 刷新触发器保持
- 设置入口：在内容底部放置链接按钮 → `/m/settings`

**参考**:
- SoulPage.jsx:1-87 — Tab 切换 + 子组件加载

### 5.3 MobileReview

**文件**: `frontend/src/features/mobile/MobileReview.jsx`

**实现策略**: ReviewPage 的移动端简化版。

**关键点**:
- 变更组列表全屏，隐藏侧边栏
- 每个变更组卡片包含：action badge + display_uri + row_count
- 点击进入全屏详情页（顶栏 `← 返回`）
- 详情页底部固定：`[驳回] [集成]` 按钮
- 复用 `DiffViewer`, `ConfirmModal`, `toast`

**参考**:
- ReviewPage.jsx:1-462 — 完整的数据加载、diff 渲染、操作逻辑
- SnapshotList.jsx — 列表项渲染（可复用或内联简化）

### 5.4 MobileMemory

**文件**: `frontend/src/features/mobile/MobileMemory.jsx`

**实现策略**: MemoryBrowser 移动版，无侧边栏树。

**关键点**:
- 顶部固定：域名下拉 + 搜索框
- 卡片流 `grid-cols-1`，复用 `NodeGridCard` 组件
- 点击进入节点详情全屏页，顶部 `< 返回`
- 域名下拉通过 `getDomains()` API 获取

**参考**:
- MemoryBrowser.jsx — 数据加载、搜索、节点操作
- NodeGridCard.jsx — 记忆卡片组件（直接复用）

### 5.5 MobileMaintenance

**文件**: `frontend/src/features/mobile/MobileMaintenance.jsx`

**实现策略**: MaintenancePage 移动版，长按多选。

**关键点**:
- 单列扁平列表（废弃区 + 孤儿区分段）
- **长按多选**：
  - 使用 `onTouchStart` + `setTimeout(500ms)` 触发选择模式
  - 选择模式下点击切换选中状态
  - 底部浮现"删除选中 (N)"按钮
- 点击展开详情（复用现有 diff 逻辑）
- 复原表单可折叠在详情下方

**参考**:
- MaintenancePage.jsx:1-1020 — 完整的数据加载、分组、多选、复原逻辑

## Step 6: 桌面端手动切换入口 (R1.5)

### 6.1 桌面端"切换到手机版"

在 `Layout` 组件的底部（Settings 按钮旁边或单独 footer）添加：

```jsx
<button
  onClick={() => {
    localStorage.setItem('mobile_preference', 'mobile');
    window.location.replace('/m/review');
  }}
  className="text-[10px] text-nocturne-text-muted hover:text-nocturne-text-secondary"
>
  📱 手机版
</button>
```

### 6.2 手机端"切换到桌面版"

在 `MobileLayout` 的 Settings 页面底部添加（或底部 Tab 栏上方）：

```jsx
<button
  onClick={() => {
    localStorage.setItem('mobile_preference', 'desktop');
    window.location.replace('/review');
  }}
  className="text-[10px] text-nocturne-text-muted hover:text-nocturne-text-secondary"
>
  🖥 {t('nav.switchDesktop')}
</button>
```

**验证**: 
- 点击"切换到桌面版"后，刷新页面不再自动跳回手机版
- 清除 `mobile_preference` localStorage 后恢复自动检测

## Step 7: 构建验证与质量检查

### 7.1 构建

```bash
cd frontend
npm run build
```

期望：0 错误，0 警告（或仅预先存在的警告）。

### 7.2 功能验证清单

| AC | 验证内容 | 验证方式 |
|----|---------|---------|
| AC1 | 手机打开首页 → `/m/review` | Chrome DevTools iPhone 模拟 |
| AC2 | 桌面打开 `/m/review` → `/review` | 桌面浏览器 |
| AC3 | "切换到桌面版"后不再跳转 | 点击 → 刷新 → 仍在桌面版 |
| AC4 | Tab 切换流畅无白屏 | 4 个 Tab 依次点击 |
| AC5 | iPhone 底部不被遮挡 | DevTools iPhone 模拟 + 检查 safe-area |
| AC6 | 各页面核心功能可用 | 5 页面功能逐一测试 |
| AC7 | 桌面端功能不变 | 桌面端所有页面无变化 |
| AC8 | 构建通过 0 错误 | `npm run build` |

### 7.3 IDE 诊断

```bash
# 运行构建后检查
npm run build 2>&1
```

检查 `frontend/src/features/mobile/` 目录下所有文件是否有 TypeScript/ESLint 错误。

## 风险点与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| NamespaceSelector 提取破坏桌面端 | 桌面端命名空间切换失效 | 提取后先在桌面端验证，保持接口一致 |
| MobileLayout 中 Routes 嵌套导致路由冲突 | 页面无法渲染 | 使用相对路径 (`review` 而非 `/m/review`) |
| safe-area-inset-bottom 在非 iPhone 设备上不生效 | Android 底部被遮挡 | 使用 fallback 值 `0px`，并在真实设备上测试 |
| 长按多选与点击展开冲突 | 交互混乱 | 使用 `onTouchStart` timer 区分短按/长按，参考 iOS 交互规范 |
| 共享组件（DiffViewer）在窄屏溢出 | 内容不可读 | DiffViewer 使用 `overflow-x-auto` 或调整为移动端列布局 |
| SoulPage 的 EmoitionLedger 表格在手机上太宽 | 表格溢出 | 使用 `overflow-x-auto` 包裹，或改为卡片式渲染 |

## 文件变更清单

### 新建文件

| 文件 | 行数估算 | 说明 |
|------|---------|------|
| `features/mobile/MobileLayout.jsx` | ~100 | 底部 Tab 栏 + 顶部标题栏 + 子路由 |
| `features/mobile/MobileReview.jsx` | ~200 | 审查移动版 |
| `features/mobile/MobileMemory.jsx` | ~220 | 记忆浏览移动版 |
| `features/mobile/MobileSoul.jsx` | ~150 | 灵魂移动版 |
| `features/mobile/MobileMaintenance.jsx` | ~180 | 维护移动版 |
| `features/mobile/MobileSettings.jsx` | ~120 | 设置移动版 |
| `components/NamespaceSelector.jsx` | ~100 | 从 App.jsx 提取 |
| `i18n/locales/zh/mobile.json` | ~60 | 中文翻译 |
| `i18n/locales/en/mobile.json` | ~60 | 英文翻译 |

### 修改文件

| 文件 | 改动范围 | 说明 |
|------|---------|------|
| `App.jsx` | 提取 NamespaceSelector (删 ~90 行)，增加 Layout 分流 (+5 行)，增加设备检测 (+50 行) | 路由分发 |
| `i18n/index.js` | 增加 mobile 命名空间 (+4 行) | i18n 配置 |
| `index.css` | 增加 safe-area 变量 + 移动端样式 (+30 行) | CSS |

### 预估总代码量

- **新建**: ~1,090 行
- **修改**: ~30 行（净增加，扣除提取的代码）
- **总计新增**: ~1,120 行

## 实施时间估算

| Step | 工作内容 | 预估时间 |
|------|---------|---------|
| Step 1 | i18n 翻译文件 | 15 min |
| Step 2 | CSS 适配 | 10 min |
| Step 3 | App.jsx 改造 | 30 min |
| Step 4 | MobileLayout | 30 min |
| Step 5.1 | MobileSettings | 30 min |
| Step 5.2 | MobileSoul | 25 min |
| Step 5.3 | MobileReview | 40 min |
| Step 5.4 | MobileMemory | 35 min |
| Step 5.5 | MobileMaintenance | 40 min |
| Step 6 | 手动切换入口 | 10 min |
| Step 7 | 构建验证 + 修复 | 20 min |
| **合计** | | **~4.5 h** |

## 验收标准

- [ ] AC1: iPhone/Android 真机或 Chrome DevTools 模拟打开首页 → 自动跳转 `/m/review`
- [ ] AC2: 桌面端浏览器打开 `/m/review` → 自动跳转回 `/review`
- [ ] AC3: 点击"切换到桌面版"后不再自动跳转，刷新仍在桌面版
- [ ] AC4: 底部 Tab 栏在 5 页面间切换流畅，无白屏
- [ ] AC5: 底部 Tab 栏不被 iPhone 底部横条遮挡
- [ ] AC6: 各手机页面核心功能可用
- [ ] AC7: 桌面端所有功能和 UI 不变
- [ ] AC8: 构建通过，0 错误

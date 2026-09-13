# Implement: 灵魂页面重构

## 实施步骤

### Step 1: 新建 features/soul/ 目录和 SoulPage.jsx

- 创建 `frontend/src/features/soul/SoulPage.jsx`
- 页面入口组件：二级 Tab（诞生/情感/关系）+ `soulVersion` state
- Tab 切换 UI 参考现有 SettingsDrawer 的 Tab 样式
- 暂用空内容占位，后续步骤填充子组件

### Step 2: 拆分 EmotionDashboard → EmotionPanel + EmotionLedger

- 创建 `frontend/src/features/soul/EmotionPanel.jsx`
  - 从 `EmotionDashboard.jsx` 提取 `barColor`、`DimensionBar`、当前值加载和渲染逻辑
  - API: `getEmotion()`
  - Props: `refreshTrigger`
- 创建 `frontend/src/features/soul/EmotionLedger.jsx`
  - 从 `EmotionDashboard.jsx` 提取 `LedgerEntry`、账单加载和渲染逻辑
  - API: `getEmotionLedger()`
  - Props: `refreshTrigger`

### Step 3: 移动 TemplatesSection 和 RelationshipPanel

- `git mv frontend/src/features/settings/TemplatesSection.jsx frontend/src/features/soul/TemplatesSection.jsx`
- `git mv frontend/src/features/settings/RelationshipPanel.jsx frontend/src/features/soul/RelationshipPanel.jsx`
- 修正两个文件内部的相对 import 路径（`../../lib/api` → `../../lib/api` 不变，`./Section` 等如有引用需检查）

### Step 4: 删除 EmotionDashboard.jsx

- 确认无其他文件引用 `EmotionDashboard`
- 删除 `frontend/src/features/settings/EmotionDashboard.jsx`

### Step 5: 在 SoulPage 中集成子组件

- `SoulPage.jsx` 引入 `TemplatesSection`、`EmotionPanel`、`EmotionLedger`、`RelationshipPanel`
- 实现 Tab 切换渲染逻辑
- `TemplatesSection` 的 `onBorn` 回调 → `setSoulVersion(v => v + 1)`
- 三个子组件接收 `refreshTrigger={soulVersion}`

### Step 6: 路由和导航栏注册

- `App.jsx`:
  - import `SoulPage`
  - Routes 新增 `<Route path="/soul" element={<SoulPage />} />`
  - 导航栏新增 NavLink: Heart 图标, `app.nav.soul`, rose 激活色
  - NamespaceSelector 显示条件更新: 排除 `/soul`（与 `/memory` 一致）
  - 检查默认重定向 `/` → `/review` 是否需要调整（不改）

### Step 7: 清理 SettingsDrawer

- `SettingsDrawer.jsx`:
  - 移除 `soul` Tab 定义
  - 移除 `EmotionDashboard`、`RelationshipPanel`、`TemplatesSection` 的 import
  - 移除 `soulVersion` state
  - 移除 `Sparkles`、`Heart`、`Users` 图标 import（如不再使用）
  - Tab 列表减为 3 个

### Step 8: i18n 新增导航键

- `frontend/src/i18n/zh.json`: `app.nav.soul`: "灵魂"
- `frontend/src/i18n/en.json`: `app.nav.soul`: "Soul"

### Step 9: 检查残留引用

- 全局搜索 `EmotionDashboard` 确认无残留引用
- 全局搜索 `settings/TemplatesSection`、`settings/RelationshipPanel` 确认 import 路径已更新
- 检查 `SettingsDrawer.jsx` 中 `tab_soul`、`section_soul`、`section_emotion`、`section_relationship` i18n 键是否可清理（如不再使用）

### Step 10: 构建验证

```bash
cd frontend && npm run build
```

修复任何编译错误或 import 残留。

## 验证命令

```bash
# 构建验证
cd frontend && npm run build

# 搜索残留引用
rg "EmotionDashboard" frontend/src/
rg "settings/TemplatesSection" frontend/src/
rg "settings/RelationshipPanel" frontend/src/
rg "settings/EmotionDashboard" frontend/src/
```

## 风险文件

| 文件 | 风险 | 回滚点 |
|------|------|--------|
| `App.jsx` | 路由和导航栏变更 | git revert |
| `SettingsDrawer.jsx` | 移除 soul Tab | git revert |
| `TemplatesSection.jsx` | 移动后 import 路径 | git mv 回原位 |
| `RelationshipPanel.jsx` | 移动后 import 路径 | git mv 回原位 |
| `i18n/zh.json` / `en.json` | 新增键 | git revert |

## 前置检查

- [ ] 确认 `TemplatesSection.jsx` 和 `RelationshipPanel.jsx` 内部 import 路径（移动后是否需要修正）
- [ ] 确认 `SettingsDrawer.jsx` 中 `soulVersion` 是否有其他依赖
- [ ] 确认 `EmotionDashboard.jsx` 没有被其他文件引用（搜索结果已确认仅 SettingsDrawer 引用）

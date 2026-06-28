# Design: 灵魂页面重构

## 架构变更

### 路由变更

```
// App.jsx 路由表
旧: / → /review, /memory, /maintenance  +  SettingsDrawer (soul tab 内嵌)
新: / → /review, /memory, /soul, /maintenance  +  SettingsDrawer (无 soul tab)
```

新增路由 `/soul` → `<SoulPage />`，插入位置在 `/memory` 和 `/maintenance` 之间。

### 导航栏变更

```
旧: Review | Memory | Maintenance | Settings
新: Review | Memory | 灵魂 | Maintenance | Settings
```

| 属性 | 值 |
|------|-----|
| 路径 | `/soul` |
| 图标 | `Heart` (lucide-react) |
| i18n key | `app.nav.soul` |
| 激活色 | `rose` |
| NamespaceSelector 显示条件 | 非 `/review` 且非 `/maintenance`（与 Memory 一致） |

### SoulPage 组件结构

```
SoulPage
├── state: activeTab ('birth' | 'emotion' | 'relationship'), soulVersion (number)
├── 二级 Tab 栏: 诞生 / 情感 / 关系
├── activeTab === 'birth'
│   └── TemplatesSection  onBorn={() => setSoulVersion(v => v + 1)}
├── activeTab === 'emotion'
│   ├── EmotionPanel  refreshTrigger={soulVersion}   ← 上方
│   └── EmotionLedger  refreshTrigger={soulVersion}  ← 下方
└── activeTab === 'relationship'
    └── RelationshipPanel  refreshTrigger={soulVersion}
```

### 组件拆分

#### EmotionPanel.jsx（新建，从 EmotionDashboard.jsx 拆出）

- **职责**: 加载并展示 6 个情感维度的当前值
- **API**: `getEmotion()`
- **Props**: `refreshTrigger`
- **内部 state**: `values`, `loading`, `error`
- **UI**: DimensionBar 子组件（保留现有进度条逻辑），刷新按钮
- **来源**: EmotionDashboard.jsx 的 L71-L107（load 函数的 getEmotion 部分）+ L109-L122（DimensionBar 渲染）

#### EmotionLedger.jsx（新建，从 EmotionDashboard.jsx 拆出）

- **职责**: 加载并展示情感变更历史时间线
- **API**: `getEmotionLedger()`
- **Props**: `refreshTrigger`
- **内部 state**: `entries`, `loading`, `error`
- **UI**: LedgerEntry 子组件（保留现有展开/折叠逻辑），空状态提示
- **来源**: EmotionDashboard.jsx 的 L74-L87（load 函数的 getEmotionLedger 部分）+ L124-L136（LedgerEntry 渲染）

#### 共享子组件

- `DimensionBar` — 移入 `EmotionPanel.jsx` 内部（仅此处使用）
- `LedgerEntry` — 移入 `EmotionLedger.jsx` 内部（仅此处使用）
- `barColor` 工具函数 — 移入 `EmotionPanel.jsx` 内部

### SettingsDrawer 变更

- 移除 `soul` Tab 定义
- 移除 `EmotionDashboard`、`RelationshipPanel`、`TemplatesSection` 的 import
- 移除 `soulVersion` state 及 `onBorn` 回调链
- Tab 列表从 4 个减为 3 个：general / database / memory
- 保留 `Section.jsx` 通用组件（其他 Tab 仍在用）

### 文件移动

```
settings/TemplatesSection.jsx  → soul/TemplatesSection.jsx
settings/RelationshipPanel.jsx → soul/RelationshipPanel.jsx
settings/EmotionDashboard.jsx  → 删除（拆分为 soul/EmotionPanel.jsx + soul/EmotionLedger.jsx）
```

### i18n 变更

**新增**:
- `app.nav.soul`: "灵魂" / "Soul"

**迁移**（从 `settings.emotion.*` 移到 `soul.emotion.*`，或保留原键不迁移以减少改动量）:

保留原 `settings.emotion.*` 键不迁移——组件内部 i18n 路径不变，只改组件物理位置。原因：
1. 减少改动范围，降低出错风险
2. i18n 键的 namespace 不需要和组件目录名严格对应
3. 未来如需迁移可单独做

### 数据流

```
SoulPage
  │ soulVersion state
  │
  ├─ TemplatesSection
  │    └── onBorn() → setSoulVersion(v => v + 1)
  │
  ├─ EmotionPanel
  │    └── useEffect [refreshTrigger] → getEmotion()
  │
  ├─ EmotionLedger
  │    └── useEffect [refreshTrigger] → getEmotionLedger()
  │
  └─ RelationshipPanel
       └── useEffect [refreshTrigger] → getCurrentRelationship() + listRelationshipRequests()
```

灵魂诞生 → `soulVersion` 自增 → 三个子组件的 `useEffect` 同时触发 → 各自独立重新加载数据。

## 兼容性

- 后端 API 零变更
- 现有 `/review`、`/memory`、`/maintenance` 路由不受影响
- Settings Drawer 的 general / database / memory Tab 不受影响
- `getEmotion` / `getEmotionLedger` API 函数签名不变
- 翻译键路径不变（`settings.emotion.*` 保留）

## 回滚

纯前端改动，回滚方式：
1. `git revert` 对应 commit
2. 无数据库迁移需要回滚

# 前端情感面板重构

## Goal

将情感仪表盘（当前数值）和情感账单（变更历史）从堆叠在同一个 `EmotionDashboard.jsx` 组件中拆分出来，重新规划前端信息架构，让用户能更清晰、独立地查看情感状态和审计历史。

## 背景（已确认事实）

- 当前 `EmotionDashboard.jsx`（140 行）同时承载两块功能：
  1. **情感仪表盘** — 6 个维度的进度条（trust/closeness/respect/dependency/security/resonance）
  2. **情感变更账单** — 可展开的时间线列表（`LedgerEntry` 子组件）
- 该组件被 `SettingsDrawer.jsx` 的 `soul` Tab 引用，与 `TemplatesSection` 和 `RelationshipPanel` 并列
- 后端 API 已就绪：`GET /emotion`（当前值）、`GET /emotion/ledger`（历史记录）
- 前端 API 封装在 `frontend/src/lib/api.js` 中：`getEmotion()` 和 `getEmotionLedger()`
- i18n 翻译键已存在：`settings.emotion.*`（含 `ledger_title`、`ledger_empty` 等）

## Requirements

- 将 Settings Drawer 中 `soul` Tab 的三个面板（TemplatesSection、EmotionDashboard、RelationshipPanel）升级为独立顶级页面
- Settings Drawer 移除 `soul` Tab，回归纯配置语义（仅保留 general / database / memory）
- 顶部导航栏新增入口
- 情感仪表盘（当前值）与情感账单（变更历史）在新的顶级页面中拆分为独立区域

## Acceptance Criteria

- [ ] 顶部导航栏有新的独立入口指向灵魂页面
- [ ] 灵魂页面包含模板/诞生、情感状态、情感账单、关系管理
- [ ] 情感仪表盘和情感账单不再是同一个组件内的堆叠区块
- [ ] Settings Drawer 不再包含 soul Tab
- [ ] 灵魂诞生后情感和关系面板仍能自动刷新（refreshTrigger 联动不丢失）
- [ ] 现有 i18n 翻译键不丢失，新增键有中英双语

## Out of Scope

- 后端 API 变更（后端已就绪，本次纯前端重构）
- 后端数据模型或 `emotion_service.py` 逻辑变更
- PresetsSection / BootUrisSection / DatabaseSection 等 Settings 内的配置面板不动

## 已确认的设计决策

1. **范围**：情感 + 关系 + 模板 三个面板全部从 Settings Drawer 升级为独立顶级页面
2. **路由**：单路由 `/soul`，页内二级 Tab 切换（"诞生" / "情感" / "关系"）
3. **Settings Drawer**：移除 soul Tab，仅保留 general / database / memory

## 已确认的设计决策（续）

4. **情感 Tab 布局**：上下分区，上方 `EmotionPanel`（当前值 6 维度进度条），下方 `EmotionLedger`（变更账单时间线）。两个独立组件，各自管理数据加载和刷新状态，共享 `refreshTrigger`

5. **导航入口**：名称"灵魂"（`app.nav.soul`），Heart 图标，rose 主题色。Maintenance 保留 Sparkles 不变

6. **目录结构**：新建 `frontend/src/features/soul/` 目录，组件平铺：
   ```
   frontend/src/features/soul/
   ├── SoulPage.jsx           ← 页面入口（二级 Tab + soulVersion state）
   ├── TemplatesSection.jsx   ← 从 settings/ 移入
   ├── EmotionPanel.jsx       ← 从 EmotionDashboard.jsx 拆出的当前值面板
   ├── EmotionLedger.jsx      ← 从 EmotionDashboard.jsx 拆出的账单
   └── RelationshipPanel.jsx  ← 从 settings/ 移入
   ```
   `EmotionDashboard.jsx` 删除，`settings/` 只保留真正的配置组件

## Open Questions

- 无（所有设计决策已确认，待编写 design.md 和 implement.md）

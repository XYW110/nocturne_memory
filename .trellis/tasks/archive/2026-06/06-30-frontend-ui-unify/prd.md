# 网页端 UI 风格统一

## Goal

提升网页端整体操作体验，通过统一全站颜色主题和视觉风格，降低不同页面之间的视觉割裂感。

## 已确认事实

- 当前 App 使用顶部水平导航栏：Review / Memory / 灵魂 / Maintenance / Settings。
- 各页面视觉风格不统一：背景色、文字色、边框色、卡片背景均使用不同硬编码值。
- Tailwind 配置目前为空，无自定义 design tokens。

## 已确认决策

| 项目 | 决策 |
|------|------|
| 导航结构 | 保持顶部水平导航栏不变，优化样式 |
| 颜色策略 | 各页面保留强调色，仅统一基础色 |
| 颜色管理 | 引入 CSS 变量 + Tailwind theme extend |
| 基础色调 | 维持极暗色系（`#07070D` 系列） |
| 统一范围 | 全部：背景、文字、边框、卡片、按钮、表单、滚动条、空/加载状态 |

## Requirements

1. 在 `tailwind.config.js` 中定义语义化颜色 token（CSS 变量）。
2. 在 `index.css` 中全局声明 CSS 变量。
3. 逐页面替换硬编码颜色为语义化 token。
4. 提取共用基础组件样式（按钮、输入框、卡片面板、空状态、加载态）。
5. 导航栏样式优化。

## Acceptance Criteria

- [ ] `tailwind.config.js` 包含完整的 `theme.extend.colors` 语义化色板。
- [ ] 所有 5 个页面（Review、Memory、Soul、Maintenance、SettingsDrawer）使用统一的基础色变量。
- [ ] 各页面强调色保持不变（indigo / amber / rose）。
- [ ] 构建通过，无样式回归。
- [ ] 导航栏样式统一且与整体风格协调。

## Notes

- 各页面强调色对应：Review→indigo, Memory→indigo, Soul→rose, Maintenance→amber, Settings→slate
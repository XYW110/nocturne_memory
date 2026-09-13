# 手机端网页适配 — 独立 /m/* 路由和移动端 UI

## Goal

为 Nocturne Memory 提供手机端专用的 Web 界面。桌面端和手机端使用各自独立的页面组件和 Layout，互不干扰，各自演进。用户在手机上打开任意 URL 时自动检测并重定向到 `/m/*` 路由。

## 核心决策（已确认）

| 决策 | 选项 | 原因 |
|------|------|------|
| 路由策略 | 独立 `/m/*` 前缀路由表 | 改动隔离，各自独立演进 |
| 设备检测 | 前端 User-Agent 检测 + localStorage 记忆 | 零后端改动 |
| 手机导航 | 底部 Tab 栏（4 个图标 Tab） | 拇指热区友好，内容区最大化 |
| i18n | 新增 `mobile.*` 命名空间，短文本键 | 适应手机屏幕宽度 |
| 设置入口 | Soul 页面内部入口 | 语义自然，Tab 栏不拥挤 |
| Memory 浏览 | 域名下拉 + 卡片流（无树形侧边栏） | 手机树形导航效率低 |
| 命名空间 | 各页面顶部独立下拉选择器 | 各页面可能不同 namespace |
| 实施策略 | 全部一次实施 | 基础设施搭好后各页面独立并行 |

## Requirements

### R1: 设备检测与重定向

- [ ] R1.1: App.jsx 入口检测 `navigator.userAgent`，匹配 Mobile/Android/iPhone/iPad/WebOS 关键字
- [ ] R1.2: 手机访问非 `/m/*` URL 时，自动 `window.location.replace()` 重定向到对应 `/m/*` 路由
- [ ] R1.3: 桌面端访问 `/m/*` URL 时，自动重定向回 `/`（桌面路由）
- [ ] R1.4: localStorage 存储用户手动选择的设备偏好（`mobile_preference: 'auto' | 'mobile' | 'desktop'`），偏好为 'desktop' 时跳过自动重定向
- [ ] R1.5: 页面底部提供手动切换入口（"切换到桌面版" / "切换到手机版"）

### R2: 手机端路由表 `/m/*`

- [ ] R2.1: `/m/` 或 `/m/review` — 审查列表（移动版）
- [ ] R2.2: `/m/memory` — 记忆浏览（移动版）
- [ ] R2.3: `/m/soul` — 灵魂（移动版）
- [ ] R2.4: `/m/maintenance` — 维护（移动版）
- [ ] R2.5: `/m/settings` — 设置（移动版）

### R3: 手机端 Layout — 底部 Tab 栏

- [ ] R3.1: 底部固定 Tab 栏，4 个图标 Tab：📋 审查、🧠 记忆、💫 灵魂、🔧 维护
- [ ] R3.2: Tab 栏高度 ≤ 56px，带 safe-area-inset-bottom 适配（iPhone 刘海屏）
- [ ] R3.3: 当前页 Tab 高亮（nocturne 强调色 + 顶部 2px 色条）
- [ ] R3.4: 顶部标题栏（显示当前页面名称，含命名空间下拉选择器）

### R4: 手机端各页面适配

- [ ] R4.1: Review 移动版 — 变更组全屏列表，点击进入 diff 详情（全屏），操作按钮底部固定
- [ ] R4.2: Memory 移动版 — 域名下拉选择器 + 搜索框置顶，卡片网格 `grid-cols-1`，节点详情整页（无树形侧边栏）
- [ ] R4.3: Soul 移动版 — Tab 切换（Emotion/Templates/Relationships），堆叠布局，内含设置入口
- [ ] R4.4: Maintenance 移动版 — 孤儿单列列表，点击进详情，批量操作用长按多选模式
- [ ] R4.5: Settings 移动版 — 全屏页面，分区折叠（Section 组件已有），宽度 100vw

### R5: 不影响桌面端

- [ ] R5.1: 桌面端路由、导航栏、布局不做任何改动
- [ ] R5.2: 共享组件（ConfirmModal/Toast/TokenAuth）保持不变，手机端也复用

### R6: 命名空间切换

- [ ] R6.1: 每个手机页面顶部独立放命名空间下拉选择器，不全局共享

### R7: 设置入口

- [ ] R7.1: 手机端设置放在 Soul 页面内部入口（"关于我"区域下方），点击进入全屏设置页

### R8: i18n 移动端命名空间

- [ ] R8.1: 新增 `mobile.*` 翻译命名空间，使用短文本键
- [ ] R8.2: 翻译文件：`frontend/src/i18n/locales/zh/mobile.json` 和 `en/mobile.json`

## Acceptance Criteria

- [ ] AC1: 用 iPhone/Android 真机或 Chrome DevTools 模拟打开首页，自动跳转到 `/m/review`
- [ ] AC2: 桌面端浏览器打开 `/m/review`，自动跳转回 `/review`
- [ ] AC3: 点击"切换到桌面版"后，不再自动跳转，刷新页面仍在桌面版
- [ ] AC4: 底部 Tab 栏在 5 个页面间切换流畅，无白屏
- [ ] AC5: 底部 Tab 栏不被 iPhone 底部横条遮挡（safe-area-inset-bottom）
- [ ] AC6: 各手机页面核心功能可用（Review 审查、Memory 浏览、Soul 查看、Maintenance 清理、Settings 配置）
- [ ] AC7: 桌面端所有功能和 UI 不变
- [ ] AC8: 构建通过，0 错误

## Notes

- 移动端页面可直接复用现有 API 调用（`frontend/src/lib/api.js`），不需要新后端
- 移动端共享组件（Toast、ConfirmModal 等）直接复用，它们的 `max-w-md mx-4` 已经手机友好
- 移动端页面放在 `frontend/src/features/mobile/` 目录下，命名如 `MobileReview.jsx`
- 移动端 Layout 组件放在 `frontend/src/features/mobile/MobileLayout.jsx`

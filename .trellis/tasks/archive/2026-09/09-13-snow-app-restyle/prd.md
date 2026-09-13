# snow-app 风格落地 nocturne_memory 前端

## Goal

将 snow-app 的设计语言(悬浮岛布局、设计令牌、单色克制语义色)落地到 nocturne_memory 前端:先建 CSS 变量令牌层,再用 OpenDesign 出关键页面原型,拉回代码替换现有样式。

## 背景

2026-09-12 头脑风暴会话(sess_2a9a7ef)已完整解析 [MayDay-wpf/snow-app](https://github.com/MayDay-wpf/snow-app) 的设计语言,结论如下(来源:其 `tokens.css`、`styles.css` 与主题预设源码):

- **悬浮岛布局**(核心识别特征):浅灰蓝底座 `#eef2f7`(暗色 `#050505`),侧栏/主内容/右侧面板是三块独立圆角卡片,外边距与间隙 10px,顶栏也是独立小岛卡片并与下方对齐
- **岛质感**:半透明表面 `rgba(255,255,255,0.78)` + 分层柔和阴影 + 内侧 1px 高光 `--island-shadow: 0 14px 34px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.72)`;面板圆角 16px
- **色彩**:主强调色即文字色(近黑 `#111827`),语义色(绿/红/蓝/琥珀)只作状态点缀且是"浅底+深字"胶囊;文字四级灰 `#111827 → #374151 → #6b7280 → #9ca3af`;暗色主题为纯中性黑(`#0a0a0a/#111/#1a1a1a`)+ GitHub 风蓝 `#58a6ff`
- **细节**:圆角梯度 6/8/12/16px;字号偏小(10–13px);`tabular-nums` 数字;hover 轻灰底 `#f3f4f6`;focus ring 6% 透明黑;过渡 0.12–0.2s ease;大面积毛玻璃禁用,仅小悬浮元素保留 `blur(18px) saturate(1.16)`

## Requirements

1. 建立项目级 **CSS 变量设计令牌层**,收敛 snow-app 的色彩/圆角/阴影/间距/字号体系,支持 `data-theme` 切换亮/暗
2. 用 **OpenDesign** 生成 snow-app 风格的关键页面原型(Review 审核页、Memory 浏览页、设置抽屉),拉回原型代码
3. 将令牌层 + 原型样式落地到现有前端组件,替换现有 slate/indigo 深色风格

## Constraints

- **不改业务逻辑**:只动样式与布局外壳,不动数据流、API、路由、鉴权逻辑
- **保留现有组件结构与 data-testid**:测试依赖这些选择器
- **Tailwind 保留**:令牌以 CSS 变量注入,组件可继续用 Tailwind 原子类(含 `var(--token)` 任意值语法),不引入新 UI 库
- 亮色为默认主题(snow-app 标志性外观),暗色令牌同步提供
- 不大面积使用毛玻璃(沿用 snow-app 的性能取舍)

## Acceptance Criteria

- [ ] `frontend/src/styles/tokens.css` 存在,含色彩/圆角/阴影/间距/字号完整变量集,`:root` 亮色 + `[data-theme="dark"]` 暗色
- [ ] 整体布局呈"悬浮岛"形态:底座浅灰蓝,顶栏与内容面板为独立圆角卡片岛,间隙 10px
- [ ] Review、Memory、Maintenance 三个页面与 SettingsDrawer、Toast、TokenAuth 均使用令牌配色,无残留 slate-800/indigo 旧深色主题
- [ ] 前端 build 通过;现有测试不因 data-testid 变动而失败
- [ ] OpenDesign 原型项目存在,原型代码已拉回,来源记录在 design.md

# Design: snow-app 风格落地

## 总体思路

三层落地:令牌层(CSS 变量)→ 布局外壳(悬浮岛)→ 组件重肤(替换旧深色类名)。OpenDesign 负责"关键页面的目标态长什么样",落地时以令牌 + 布局模式为准,原型代码作参考蓝本而非逐字节拷贝。

## 1. 令牌层 `frontend/src/styles/tokens.css`

结构对齐 snow-app 的 `tokens.css`,全部为 CSS 变量:

```
:root {                    /* 亮色(默认)= snow-app 原版 */
  --bg-base: #eef2f7;                 /* 底座 */
  --surface: rgba(255,255,255,0.78);  /* 岛表面 */
  --surface-solid: #ffffff;
  --surface-hover: #f3f4f6;
  --text-primary: #111827;            /* 主强调色 = 文字色 */
  --text-secondary: #374151;
  --text-muted: #6b7280;
  --text-faint: #9ca3af;
  --accent: var(--text-primary);
  --semantic-success-bg/-fg, --semantic-danger-bg/-fg,
  --semantic-info-bg/-fg, --semantic-warning-bg/-fg   /* 浅底深字胶囊 */
  --border: rgba(15,23,42,0.08);
  --radius-sm/md/lg/xl: 6/8/12/16px;
  --island-shadow, --island-shadow-soft, --focus-ring;
  --gap-island: 10px;
  --transition: 0.15s ease;
  --font-size-*, --blur-popover: blur(18px) saturate(1.16);
}
[data-theme="dark"] {      /* 纯中性黑 + GitHub 风蓝 */
  --bg-base: #050505;
  --surface: #0a0a0a / #111 / #1a1a1a 三级;
  --text-primary: #f3f4f6 → 四级反转;
  --accent: #58a6ff;
  --island-shadow 暗色版;
}
```

主题切换:`document.documentElement.dataset.theme = 'dark' | 'light'`,默认 light;本期只交付令牌与钩子,不做设置界面里的主题切换入口(可后续任务)。

## 2. 布局外壳

- `App.jsx` Layout:底座 `--bg-base` + padding 10px;顶栏改为独立岛卡片(rounded-16、`--surface`、`--island-shadow`),内容区面板化
- 导航激活态:去 indigo 下划线,改为近黑文字 + 浅灰胶囊底
- 三个 feature 页面内部容器:现有满铺面板改为岛卡片(内存浏览的三栏结构最贴合 snow-app 原型)
- Tailwind 侧通过任意值语法消费令牌,如 `bg-[var(--surface)] text-[var(--text-primary)] rounded-[var(--radius-xl)]`
- `index.css` 引入 tokens.css,滚动条改用令牌色

## 3. OpenDesign 原型

- 项目:`snow-app-style-nocturne`;入口 `index.html` 单页,覆盖 Review 页(审核队列 + diff 视图)+ Memory 浏览页(三栏:域/记忆列表/详情)+ 设置抽屉
- prompt 中内嵌上述令牌值与悬浮岛布局规则,要求纯 HTML/CSS(无框架依赖),类名语义化,便于提取样式规则回填
- 拉回方式:`get_artifact` 取全部文件 → 样式规则映射到 tokens.css 与组件类名;原型 HTML 存档到任务目录 `prototype/` 作对照

## 4. 落地顺序与兼容

1. tokens.css + index.css 接线(不影响现有深色外观,先 Neutral)
2. App.jsx 布局外壳换岛式
3. 逐页换肤:Memory(结构最复杂)→ Review → Maintenance → 组件(TokenAuth/Toast/ConfirmModal/PromptModal/SnapshotList/DiffViewer)→ SettingsDrawer
4. 语义色只保留状态用途(成功/危险/警告胶囊),替换现有 emerald/red/amber 大面积用法

回滚:纯样式改动,`git checkout -- frontend/src` 即可整体回滚;分步提交可在任一步停下。

## 5. 风险

- 组件数量多、类名替换量大 → 用子代理实施 + grep 验收(slate-/indigo-/emerald- 等残留为 0,`index.css`/布局类除外)
- OpenDesign 原型与真实数据结构差异 → 原型只取视觉规则,不取数据假设
- 深色主题本期不接入 UI 开关,只保证令牌完整 → 在 PRD 验收项中不含主题切换功能

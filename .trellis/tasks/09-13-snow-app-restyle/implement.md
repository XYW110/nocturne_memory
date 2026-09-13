# Implement: snow-app 风格落地

## 执行清单(有序)

### Step 0: OpenDesign 原型(main agent,实施前完成)
- [ ] `create_project` 建 snow-app-style-nocturne 项目
- [ ] `start_run` 生成原型(prompt 内嵌令牌值 + 悬浮岛布局规则,纯 HTML/CSS,覆盖 Review / Memory 三栏 / 设置抽屉)
- [ ] `get_run` 轮询至成功 → `get_artifact` 拉回全部文件
- [ ] 原型文件存档到 `.trellis/tasks/09-13-snow-app-restyle/prototype/`

### Step 1: 令牌层
- [ ] 新建 `frontend/src/styles/tokens.css`(:root 亮色 + [data-theme="dark"] 暗色,变量集见 design.md §1)
- [ ] `frontend/src/index.css` 引入 tokens.css,滚动条/全局底色改令牌
- 验证:`pnpm --dir frontend build`(或项目等效 build)

### Step 2: 布局外壳
- [ ] `App.jsx` Layout 改岛式:底座 `bg-[var(--bg-base)]` + 10px 间隙,顶栏独立岛卡片,导航激活态改近黑胶囊
- 验证:build 通过 + 手动查看 `/review` 顶栏形态

### Step 3: 页面换肤(可拆多个子代理批次)
- [ ] Memory 浏览页(MemoryBrowser + features/memory/components)
- [ ] Review 页(ReviewPage)
- [ ] Maintenance 页
- [ ] 通用组件:TokenAuth、Toast、ConfirmModal、PromptModal、SnapshotList、DiffViewer
- [ ] SettingsDrawer 及 settings/* 各 Section
- 规则:只换类名/样式,不动逻辑与 data-testid;slate/indigo/emerald 等旧配色类全部替换为令牌任意值类;语义色仅用于状态胶囊

### Step 4: 验收检查
- [ ] `grep -rE "slate-[0-9]|indigo-[0-9]|emerald-[0-9]|amber-[0-9]" frontend/src --include="*.jsx"` 残留 = 0(语义胶囊令牌类除外)
- [ ] build 通过;`pnpm --dir frontend test`(如存在)
- [ ] 派发 trellis-check 全量检查

## 验证命令

```bash
pnpm --dir frontend build
pnpm --dir frontend test   # 如配置了测试
grep -rE "slate-|indigo-|emerald-|amber-" frontend/src --include="*.jsx" -l
```

## 回滚点

- Step 1 后:`git checkout -- frontend/src/index.css && rm frontend/src/styles/tokens.css`
- Step 2-3 后:`git checkout -- frontend/src`

## 子代理派发

- 实施:trellis-implement,prompt 首行 `Active task: <task.py current 输出路径>`,附 design.md §1 令牌表与换肤规则
- 检查:trellis-check,验收标准对齐 prd.md Acceptance Criteria

## Step 5: 设计体系回灌(2026-09-13 追加)

设计体系 user:snow-app 后续扩充了 12 套主题预设与响应式令牌,项目端未同步。本轮回灌:

- [ ] tokens.css 全量同步:以设计体系 `C:/Users/I/AppData/Roaming/Open Design/.../data/design-systems/snow-app/tokens.css` 为准整体替换 `frontend/src/styles/tokens.css`(基线值相同,向后兼容;新增 data-preset 预设块、--content-max/--tap-target/--surface-active/--surface-chrome/--selection-bg、响应式 @media 块)
- [ ] 响应式落地:App.jsx 布局外壳 + MemoryBrowser/ReviewPage 三栏结构补 @media(≤1024 右栏收起、≤720 顶栏紧缩 + gap 8px、≤640 单列堆叠);行/按钮 min-height 用 var(--tap-target);内容列 max-width 用 var(--content-max)
- [ ] 暗色接线:App.jsx 挂载时读 localStorage('theme') 应用 documentElement.dataset.theme;SettingsDrawer 增加外观行(亮/暗切换),持久化回 localStorage;i18n 补 key
- [ ] 验收:build + vitest 通过;data-testid 与业务逻辑零改动(新增的主题切换状态除外);grep 旧调色板类仍为 0

## Step 6: 预设切换 UI(2026-09-13 追加)

- [ ] lib/theme.js 扩展:getPreset/setPreset(localStorage 'preset',默认 'snow',非法值回退),setPreset 同步 documentElement.dataset.preset('snow' 时移除属性);useTheme hook 扩展返回 preset
- [ ] SettingsDrawer 外观行扩展:亮/暗切换旁加预设选择器(12 个预设的色卡网格或下拉,色卡用各预设 --bg-base/--surface/--accent 内联示意),选择即应用并持久化
- [ ] i18n:app.settings.themePreset(主题预设/Theme preset)等 key(zh/en)
- [ ] 验收:build + vitest 通过;data-testid 无增删;业务逻辑零改动(theme 模块及抽屉 UI 除外);切换 nord 后页面整体换肤

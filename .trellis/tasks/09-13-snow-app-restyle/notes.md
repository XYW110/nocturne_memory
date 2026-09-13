# Notes

## 2026-09-13: OpenDesign 个人设计体系

任务产物之外,把 snow-app 风格沉淀为 OpenDesign 个人设计体系:

- 位置: `C:\Users\I\AppData\Roaming\Open Design\namespaces\release-stable-win\data\design-systems\snow-app\`(manifest.json + DESIGN.md + tokens.css + metadata.json)
- 正式 id: `user:snow-app`,状态 published(metadata.json 声明;draft 无法挂载项目)
- 挂载方式: create_project(designSystem="user:snow-app"),或在 OpenDesign UI 中为项目选择 "Snow App";运行时自动注入 DESIGN.md + tokens.css
- 验证: 测试项目 snow-app-ds-verify-12ea 冒烟生成成功,designSystemSelectionSource=project,产出页面全部消费令牌、无自造色值
- 注意: `od design-systems import-local` 会复制包并生成新 id,容易产生重复条目;直接在 data/design-systems/ 下管理文件夹即可(daemon 实时扫描,改动无需重启)
- 运行时依赖: 该设计体系的产出质量依赖 agent 运行时;当前用 opencode + senseaudio/glm-5.3-flash(项目级 opencode.json 含 key,勿入库)

## 2026-09-13: 补全 12 套主题预设

- snow-app 实际内置 **12 套预设**(THEME_PRESETS 注册表,亮/暗成对共 24 套调色板),此前"20+"是误记
- 12 套已全部抽入 `user:snow-app` 的 tokens.css:`[data-preset="<id>"]` 变量块,与 `[data-theme="dark"]` 可组合;snow 为默认不发块;与 Snow 基线相同字段做差量省略
- 字段映射: appBg→--bg-base、bgPrimary→--surface、bgSecondary/Tertiary→--surface-2/3、bgHover→--surface-hover、bgActive→--surface-active(新增)、chromeBg→--surface-chrome(新增)、borderColor/Subtle→--border/-strong、text 四级→--text-*、accentGreen/Red/Blue(bg/text)→--semantic-success/danger/info、selectionBg→--selection-bg(新增)、focusRing→--focus-ring;--semantic-warning-* 各预设沿用 snow 默认
- DESIGN.md 增补 "Theme Presets" 章节;manifest description 已更新
- 验证: daemon `design-systems show` 摘要更新;冒烟生成(verify 项目)同时渲染 nord 暗色/gruvbox 亮色/tokyo-night 暗色三张设置岛卡,调色板值与源码一致(#2e3440/#282828/#1a1b26 等)
- 坑: opencode 会话续接时出现过"声称已写文件但实际无 write 工具调用"的假完成,重跑时明确要求 write + 自查后解决;design-system 变更通过 promptCache.changedSections=["design-system"] 确认注入,无需重启 daemon
- 提取/生成脚本存档: `.trellis/tasks/09-13-snow-app-restyle/design-system/`(extract_presets.py、generate_preset_css.py、presets.json、themePresets.tmp.ts、tokens.css 副本)

## 2026-09-13: 补响应式(平板/移动端)

- 依据 snow-app 原版 styles.css 的 36 条 media query 实测(非发明):断点 920/820/720/640px,宽屏 1024/1280/1440/1920/2560px 内容钳制(860→1400px),窄屏双侧面板自动收起、模态近全幅(12px inset)、prefers-reduced-motion
- tokens.css 追加响应式块:--content-max 五档钳制、≤720px --gap-island 8px、--tap-target 梯度(32→36→40,pointer:coarse 时 44px)、reduced-motion 置零 --transition-fast;断点参考变量 --bp-tablet/phablet/mobile(注明 @media 内不能用 var)
- DESIGN.md 增补 "Responsive & Device Adaptation" 章节:≥1440 宽屏 / 1024-1439 桌面三岛 / 721-1023 平板横屏(右栏收 slide-over)/ ≤720 顶栏紧缩 / ≤640 单列堆叠+页面滚动+模态变 sheet
- 验证: 冒烟生成页面含全部 @media 层级与 18 处新令牌引用,运行 succeeded + deliverableValid
- 已知瑕疵: `od design-systems show` 的 body 字段是导入时快照,不反映后续编辑;但运行时注入读实时文件(digest 变化已证实)

## 2026-09-13: Step 5 回灌完成(提交 3e3f2d5)

- tokens.css 与设计体系字节级一致(629 行,含 12 预设块 + 响应式 + 可选令牌);暗色语义胶囊随之切到 DS 规范深色调值
- 响应式:Tailwind 任意变体字面断点(max-[1024px]/max-[720px]/max-[640px]),与 --bp-* 参考一致;桌面 ≥1025px 类名零变更
- 暗色接线:lib/theme.js(useTheme hook + localStorage 'theme',默认 light);SettingsDrawer 外观行;app.settings.appearance/themeLight/themeDark(zh/en)
- trellis-check 全过:var() 审计 28/28、testid 无增删、逻辑漂移仅限 theme 模块及其两处消费点;spec design-tokens.md 同步更新
- 已知非阻塞:useTheme 为组件实例级状态,Layout 与 Drawer 各自订阅(CSS 驱动故无不一致);未来若出现第二个主题消费者应升为 context/module 状态

## 2026-09-13: Step 6 预设切换 UI 完成(提交 a6f0be0)

- lib/theme.js 扩展 getPreset/setPreset/PRESET_IDS(localStorage 'preset',回退 snow,data-preset 挂 documentElement);SettingsDrawer 外观行新增 12 色卡预设选择器;i18n app.settings.themePreset
- trellis-check 抓到严重 bug:setPresetAndState 忽略入参导致选择器完全失效,已修;4 个色卡预览色误用 --text-primary 已校正(只有 google/cream 覆盖 --accent)
- 浏览器实测又抓到暗藏问题:frontend/index.html body 残留 bg-slate-900/text-slate-200(历次 grep 只扫 *.jsx 漏掉),把 body 背景钉死在 #0f172a,遮蔽一切预设/暗色基色——已改令牌类。教训:调色板残留检查必须覆盖 .html 与 .js,不能只扫 .jsx
- 验证:nord 选中后 data-preset=nord、body bg=#e2e7ee、跨刷新持久;build+vitest 通过

## 2026-09-13: 移动端排版修复(提交后追加)

- ReviewPage ≤640px:头部纵排(标题在上、操作按钮在下)、按钮/元信息 nowrap、长 URI break-all、边元数据行整行堆叠、路径行 min-w-0
- MaintenancePage ≤640px:侧栏与主区改纵向堆叠(侧栏 max-h 46%),修掉主区被挤成竖排细缝的问题;内边距收紧
- trellis-check 又抓一个:col-span-3 与 grid-cols-1 组合会触发隐式网格把行挤回横排,已移除
- 390px 视口两页截图复核通过

## 2026-09-13: 移动端导航改造(面包屑换下拉)

- 用户否决横向面包屑条(436px 体验差)→ ≤640px 换原生 select 路径选择器(options 即层级路径,受控 value=当前路径),桌面/平板保留面包屑条
- 记忆页头 ≤640px 两行:路径选择器行 + 整宽搜索行(修掉 w-72 搜索框把选择器挤成 25px 的问题)
- App 顶栏 641-860px 档补两行布局(此前该档溢出 ~130px);Tailwind v3 堆叠任意变体 max-[860px]:min-[641px]: 可编译
- trellis-check 通过;遗留小项:picker 的 root 兜底选项标签硬编码英文(后端 items[0].label 本身就是 root,影响极小)

## 2026-09-13: 经验坑回灌 OpenDesign 设计体系

- DESIGN.md 新增 "Field-Tested Responsive Patterns" 章节(7 条生产实测规则:固定宽度饥饿/抽屉变 sheet/详情头部堆叠/导航模式切换/网格 col-span 陷阱/溢出审计协议/主题单模块接线),均带实测数字作证据
- Responsive 章节补 641-860px 两行顶栏规则(~130px 溢出实测)
- 注:OpenDesign 程序当时未运行,CLI 校验失败属预期;daemon 启动后实时扫描生效

## 2026-09-13: 设计体系包补全至完整契约

- 按 OpenDesign 官方包契约(modern 范例)补齐:snow-app 新增 USAGE.md(令牌消费/断点表/出货清单)、components.html + components.manifest.json(18 个组件片段)、design-tokens.json(W3C 格式,从 tokens.css 生成)、preview/{colors,typography,spacing}.html
- manifest.json 补 files.designTokens/components、usage、componentsManifest、preview 声明
- 校验:4 个 JSON 有效、9 个声明文件齐全、18 组件 id 与 gallery 一一对应
- 注:OpenDesign 当时未运行,daemon 启动后实时扫描生效

## 2026-09-13: 设计体系按规范二次补全

- 新增 tailwind-v4.css(@theme 映射,文件级变量引用避免重复调色板)、preview/components.html(令牌驱动组件总览)、preview/presets.html(12 预设 × 亮/暗 24 卡网格,data 属性级联)
- manifest 声明 tailwind + 两个新预览页;craft.suggested 清空(本地安装无 craft 参考库,id 不解析);DESIGN.md frontmatter 补 surface: web;metadata 补 updatedAt
- 校验:12 个声明文件全部存在、JSON 全部有效
- 待 daemon 启动后可跑:design-systems rebuild-token-contract user:snow-app(生成官方 token 契约报告,补 sourceFiles)

## 2026-09-13: OpenDesign UI 调色板与快照机制(读源码定论)

- swatch row 固定 4 槽按名称提示抽取,不可能摆 12 主题;已策展 #eef2f7/#111827×2/#6b7280;全量主题可视化在 preview/presets.html(24 卡)
- 可编辑体系双重内容:磁盘扫描源 + data/projects/ds-snow-app 工作区副本(权威服务源);更新需同步两侧 + PATCH /api/design-systems/:id 刷新快照
- import-local 是摄取管道(原文降级为 source 证据),非刷新手段;试验产生的 user:snow-app-design-system 条目已随文件夹删除而注销
- 官方权威文档:design-systems/README.md(包契约);docs/design-systems.md 为完整指南;本安装版无 craft 参考库
- UI 现状:重启 OpenDesign 或刷新页面即可见新色板与完整正文

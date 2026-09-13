# 把 snow-app 设计体系迁移到 Penpot

## Goal

将已沉淀的 user:snow-app 设计体系迁移为 Penpot 资产,作为后续个人设计体系的落地平台(OpenDesign 已弃用——用户评价"很不好用")。迁移分三层:**设计令牌 → 主题(themes)→ 组件库**。

## 源资产(source of truth)

解压后的设计体系包:`D:\Work\Project\ToolProject\nocturne_memory\temp\Snow-App-Design-System\`
(原始 zip 同目录 `Snow-App-Design-System.zip`;若 temp/ 被清理,以 zip 为准重新解压)

| 文件 | 内容 | 迁移用途 |
|---|---|---|
| `tokens.css` (629 行) | `:root` 亮色基线(~30 vars)、`[data-theme="dark"]`、11 个 `[data-preset]` 亮/暗块(每个 8–23 vars,是覆盖量而非全量,其余级联继承基线)、响应式块(`--content-max` 860–1400px / `--tap-target` 32–44px / `--gap-island`) | **令牌迁移的唯一完整来源** |
| `design-tokens.json` | W3C 令牌,但**只有 snow 基线**:color.light 12 组 / color.dark 8 组;叶子格式是旧草案(`value`/`type`,无 `$` 前缀) | 结构参考;需转换格式且需从 tokens.css 补齐预设 |
| `components.html` + `components.manifest.json` | 18 个组件片段(button/input/pill/card 等) | 组件库重建蓝图 |
| `DESIGN.md` / `USAGE.md` | 设计语言规范(浮动岛布局、单色 accent、4 档文字灰、圆角阶梯 6/8/12/16px、13px 基准字号 + tabular-nums) | 组件重建与命名的依据 |
| `tailwind-v4.css` | `@theme` 版令牌 | 参考,不迁移 |
| `ui_kits/app/` | 6 个 JSX 应用组件(Sidebar/ChatArea 等) | P3 阶段可选参照 |
| `preview/` (14 页) | 各令牌/预设预览页 | 迁移后的目视验收基准 |

12 套预设 ID:`snow`(基线)、`midnight-blue`、`forest-green`、`rose-pink`、`solarized`、`nord`、`dracula`、`tokyo-night`、`github`、`google`、`gruvbox`、`cream`。

## 环境现状(已就绪)

- **Penpot 用 SaaS(penpot.app)**,不 self-host。用户已有账号。
- **托管版 Remote MCP 已配置并验证通过**(`2026-09-13` 用 curl 完整握手验证):
  - 配置:`C:\Users\I\.zcode\cli\config.json` → `mcp.servers.penpot`(type http,URL 含 userToken)
  - 服务端 `penpot v1.0.0`,4 个工具:`high_level_overview` / `penpot_api_info` / `execute_code` / `export_shape`
  - ⚠️ 工具只在**新会话**可用(会话启动时才连接 MCP)
  - ⚠️ `execute_code` 通过 Penpot **MCP Plugin** 桥接到当前打开的文件:penpot.app 打开目标文件后需运行 Plugins → Penpot MCP Server → **Connect**,之后工具才能操作该文件
- ⚠️ userToken 是账号级凭证,只存在于 config.json(已 gitignore),**不得**提交或写进任务/代码/日志。

## 关键设计决策

### D1:主题建模(推荐:基线 + 预设覆盖,备选:24 套扁平集)

Penpot 是首个原生支持 W3C Design Tokens 的平台,且支持 **multidimensional themes**(两组主题同时激活:Theme group × Color Mode group)。映射:

- Theme group `Preset`(12 项)= 12 套预设
- Color Mode group `Mode`(2 项)= light / dark

推荐建模:**baseline sets(`light`/`dark`,全量令牌)+ 每预设覆盖 set(只含差异令牌)**,与 CSS 级联语义同构;依赖 Penpot 多主题解析顺序(需在 P1 实测确认覆盖方向,若解析顺序不可控则降级为备选方案)。
备选:把 tokens.css 级联**解析成 24 个扁平集**(12 预设 × 2 模式,每个都是全量),主题建模简单直接、任何组合都可见可验,代价是重复多。实测后二选一,把结论记进 notes.md。

### D2:令牌格式转换(必须)

现有 `design-tokens.json` 是旧草案格式(`value`/`type`),Penpot 需要 **DTCG 标准格式(`$value`/`$type`)** + token sets 的 `$themes` / `$metadata.tokenSetOrder` 组织。写一个 Node 转换脚本(参考 Style Dictionary 模式):

1. 解析 `tokens.css` 所有块,展开 CSS 级联得到 resolved 值(每个预设×模式一个完整值表)
2. 生成 DTCG token sets JSON + `$themes`
3. 输出到任务目录 `output/penpot-tokens/`

脚本放任务目录内(不放 frontend),本任务**不改前端代码**。

## 分阶段范围

- **P1 — 令牌 + 主题(MVP)**:转换脚本生成 DTCG sets + `$themes`;导入 Penpot;在 Penpot 里验证 Preset × Mode 至少 4 种组合(至少 snow/dark、dracula/light、github/dark)切换后变量值正确。
- **P2 — 组件重建**:按 `components.html` 18 个片段 + DESIGN.md 规范,用 MCP `execute_code` 重建为 Penpot 组件(components),命名对齐令牌组名。18 个全部重建为验收目标;若 API 受限,允许降级为手工搭建 + MCP 导出对照。
- **P3 — 可选**:ui_kits/app 的应用级组件(Sidebar/ChatArea)作为页面级 layout 样例;响应式令牌(`--content-max` 等)在 Penpot 中没有直接对应物,记录为"web 实现层令牌,不迁移"即可。

## Acceptance Criteria

- [x] 转换脚本输出 DTCG 格式 token sets + `$themes`,24 组合(preset×mode)的 resolved 值与 tokens.css 级联结果一致(脚本内置抽查断言,17/24 组合抽查全过)
- [x] 令牌成功导入 Penpot,多主题切换正确(P1 实测 4 组合:snow/dark、dracula/light、github/dark、midnight-blue/light,14/14 项一致;D1 实测判定采用 flat-24 备选方案,结论见 notes.md)
- [ ] ≥18 个组件片段在 Penpot 中成为可复用组件,视觉与 preview/ 页一致
- [ ] 迁移结论与坑记录进 notes.md(尤其多主题解析顺序的实测结果)
- [ ] 不改动 frontend/ 代码;userToken 不出现在任何新文件中

## 风险与已知坑

- MCP 是有状态的(streamable HTTP):外部 curl 调试需先 initialize 拿 `Mcp-Session-Id` 再调工具
- Penpot 插件 API 对令牌(list/create token sets)的暴露程度未知,P1 先用 `penpot_api_info` 查;若不支持,降级为"生成 JSON → 用户在 Penpot Design tokens 面板手工导入"
- OpenDesign 数据目录已不存在(`AppData/Roaming/Open Design/...` 已清),zip 是唯一幸存源
- preview/ 页面中 brand-assets 等页曾由用户手工创建,验收时以 components.html + tokens.css 为准
- Bash 持久 cwd 曾卡在子目录导致 pre-shell hook 相对路径解析失败(症状:每条命令报 `can't open file .../inject-shell-session-context.py`)。恢复法:在卡住目录建转发 shim → `cd` 回根 → 删 shim

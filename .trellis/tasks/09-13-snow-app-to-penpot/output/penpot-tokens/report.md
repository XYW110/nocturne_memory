# 转换报告(convert-tokens.mjs)

- 输入: temp/Snow-App-Design-System/tokens.css
- 组合数: 24(12 preset × 2 mode)
- 联合令牌数(去除 web-only): 33
- web-only 排除: --content-max, --tap-target, --transition-fast, --blur-popover(content-max/tap-target 响应式、transition-fast 动画、blur-popover backdrop-filter,Penpot 无对应类型)
- 断言: ✅ 全部通过

## 类型映射

- color: 全部语义颜色(含 --selection-bg 等)
- borderRadius: --radius-sm/md/lg/xl → radius.sm/md/lg/xl
- spacing: --gap-island → gap.island(基线 10px;响应式覆盖不迁移)
- shadow: --island-shadow / --island-shadow-soft / --focus-ring(基线)→ DTCG 多层 shadow(inset 拆层,rgba→#RRGGBBAA)
- ⚠ focus-ring 类型混用(源数据坑):基线值是完整 box-shadow,11 个预设块只给了裸 rgba 颜色(按 var(--focus-ring) 整体作 box-shadow 消费时,预设下实际是无效 CSS)。按值分类:基线→shadow 令牌,预设覆盖→color 令牌,如实迁移

## 每组合令牌数

| 组合 | 令牌数 |
|---|---|
| snow/light | 28 |
| snow/dark | 30 |
| midnight-blue/light | 32 |
| midnight-blue/dark | 33 |
| forest-green/light | 32 |
| forest-green/dark | 33 |
| rose-pink/light | 32 |
| rose-pink/dark | 33 |
| solarized/light | 33 |
| solarized/dark | 33 |
| nord/light | 33 |
| nord/dark | 33 |
| dracula/light | 32 |
| dracula/dark | 33 |
| tokyo-night/light | 32 |
| tokyo-night/dark | 33 |
| github/light | 32 |
| github/dark | 33 |
| google/light | 33 |
| google/dark | 33 |
| gruvbox/light | 33 |
| gruvbox/dark | 33 |
| cream/light | 33 |
| cream/dark | 33 |

## 命名映射(css var → Penpot token 名,`-`→`.` 机械转换)

例外(Penpot 名为路径语义,叶名与子路径不能共存,叶子挂 `.base`):--surface→surface.base、--accent→accent.base、--border→border.base、--island-shadow→island.shadow.base;shadow 每层补必填 `spread:"0px"`

| css var | token 名 | 类型 |
|---|---|---|
| --accent | accent.base | color |
| --accent-contrast | accent.contrast | color |
| --bg-base | bg.base | color |
| --border | border.base | color |
| --border-strong | border.strong | color |
| --focus-ring | focus.ring | shadow |
| --gap-island | gap.island | spacing |
| --island-shadow | island.shadow.base | shadow |
| --island-shadow-soft | island.shadow.soft | shadow |
| --radius-lg | radius.lg | borderRadius |
| --radius-md | radius.md | borderRadius |
| --radius-sm | radius.sm | borderRadius |
| --radius-xl | radius.xl | borderRadius |
| --selection-bg | selection.bg | color |
| --semantic-danger-bg | semantic.danger.bg | color |
| --semantic-danger-fg | semantic.danger.fg | color |
| --semantic-info-bg | semantic.info.bg | color |
| --semantic-info-fg | semantic.info.fg | color |
| --semantic-success-bg | semantic.success.bg | color |
| --semantic-success-fg | semantic.success.fg | color |
| --semantic-warning-bg | semantic.warning.bg | color |
| --semantic-warning-fg | semantic.warning.fg | color |
| --surface | surface.base | color |
| --surface-2 | surface.2 | color |
| --surface-3 | surface.3 | color |
| --surface-active | surface.active | color |
| --surface-chrome | surface.chrome | color |
| --surface-hover | surface.hover | color |
| --surface-solid | surface.solid | color |
| --text-faint | text.faint | color |
| --text-muted | text.muted | color |
| --text-primary | text.primary | color |
| --text-secondary | text.secondary | color |

## 产物布局

- `cascade/resolved.json` — 24 组合 resolved 表(原始 CSS 值)+ 命名映射,导入后核对用
- `sets-baseline-overrides/` — D1 推荐建模:light/dark 全量基线 + preset-light/·preset-dark/ 覆盖集 + $themes(Mode×Preset 双组)+ $metadata.tokenSetOrder(覆盖集在后)
- `sets-flat-24/` — D1 备选建模:24 个全量扁平 set + $themes(单 Theme 组 24 项)
- 布局 A 的风险:同一 Preset 主题会同时激活其 light/dark 两个覆盖集,与 Mode 主题组合时可能互相污染 → P1 导入实测,若污染则改用布局 B

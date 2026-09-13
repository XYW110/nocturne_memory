# 实现记录 — P1 令牌转换

日期:2026-09-13。主会话直接实现(用户指示不用子代理)。

## 交付物

- `scripts/convert-tokens.mjs` — 零依赖 Node 转换脚本,内置抽查断言(失败非零退出)
- `output/penpot-tokens/cascade/resolved.json` — 24 组合(preset×mode)resolved 表,css var 键 + 原始 CSS 值,导入后核对 ground truth
- `output/penpot-tokens/sets-baseline-overrides/` — D1 推荐建模:light/dark 全量基线 + preset-light/·preset-dark/ 共 22 覆盖集 + $themes(Mode×Preset 双组 14 项)+ $metadata.tokenSetOrder(覆盖集在基线之后)
- `output/penpot-tokens/sets-flat-24/` — D1 备选建模:24 全量扁平 set + $themes(单 Theme 组 24 项)
- `output/penpot-tokens/report.md` — 统计、命名映射全表、断言结果

## 关键实现点

- 级联解析:首个 `:root` 为亮基线(有断言防止误取响应式区的 `:root`),`@media` 块整体跳过;预设暗块 = dark 基线 → 预设暗覆盖
- 值处理:`rgba()` → `#RRGGBBAA`;shadow 顶层逗号拆层(rgba 内逗号不拆)+ `inset` 布尔;命名 `-`→`.` 机械转换(`--semantic-success-bg` → `semantic.success.bg`)
- **focus-ring 类型混用(源数据坑)**:基线值是完整 box-shadow(`0 0 0 3px rgba(...)`),但 11 个预设块只给裸 `rgba` 颜色。前端消费处是 `shadow-[var(--focus-ring)]`(整个值作 box-shadow),即预设下 focus ring 实际是无效 CSS——源体系潜在 bug,不修,按值分类如实迁移:基线→shadow 令牌,预设覆盖→color 令牌
- web-only 不迁移:`--content-max`、`--tap-target`、`--transition-fast`、`--blur-popover`(响应式/动画/backdrop-filter,Penpot 无对应类型);`--gap-island` 保留(spacing,基线 10px)
- 断言:17/24 组合抽查(含 Penpot 实测要用的 snow/dark、dracula/light、github/dark)、核心 28 令牌全组合存在性、缺失语义(snow/light 无 surface-2/3;snow/dark 无 surface-active/chrome/selection-bg)、shadow 解析抽查。全部通过
- 联合令牌 33 个;每组合 28–47 个(缺失即缺失,不编值)

## 待办(下一阶段)

- MCP 导入(先布局 A,实测 Preset×Mode 解析;若 Preset 主题同时激活 light/dark 覆盖集造成污染,降级布局 B)
- 实测 ≥3 组合(snow/dark、dracula/light、github/dark),结论记 notes.md
- Penpot TokenShadowValue 的 API 值格式需先 `penpot_api_info` 确认(DTCG JSON 里是对象数组,API addToken 可能要字符串化)

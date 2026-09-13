# notes.md — 09-13-snow-app-to-penpot

## P1 实测结论(2026-09-13)

### D1 主题建模二选一:实测判定为 **flat-24(备选方案)**

- **布局 A(baseline+overrides)实测失败**:导入后激活 `Mode=light + Preset=midnight-blue`,bg.base 解析为 **#020617**(暗覆盖值,期望 #E0E7EF),text.primary 解析为 #F1F5F9(暗基线值)。原因:Penpot 的多主题解析 = **激活集的并集 + 按集合顺序的静态优先级**;同一预设的 light/dark 覆盖集在两种模式下会同时激活,同名令牌只能有一个固定胜者,必然污染一种模式。set 顺序无法拯救(调换只是把污染换到另一侧)
- **布局 B(flat-24)实测通过**:24 个自洽全量集 + 单 `Theme` 组 24 个互斥主题。验收激活 4 组合、14/14 项 resolved 值与 tokens.css 级联 ground truth 一致:snow/dark、dracula/light、github/dark、midnight-blue/light(最后一个正是布局 A 下失败的场景)
- Penpot 侧现状:"新建文件 1",24 sets + 24 themes,共 778 tokens,当前激活 snow / light

### Penpot Token API 实测坑(都已在实现中绕过)

1. **令牌名是路径语义**:叶子名与其子路径不能共存(`surface` + `surface.solid` 报"路径或其前缀处已存在令牌")。解决:`--surface`→`surface.base`、`--accent`→`accent.base`、`--border`→`border.base`、`--island-shadow`→`island.shadow.base`(见 report.md 映射表)
2. **shadow 令牌每层 `spread` 必填**(DTCG 里可省略,Penpot addToken 报"空字段"),统一补 `"0px"`;shadow 值接受对象数组
3. **插件沙箱无外发网络**:execute_code 里 fetch 到 localhost 也被拦,批量数据只能内联进代码(用了紧凑 `type|name|value` 行格式,15–33KB/批)
4. **插件端 jscomp 转译 bug**:shadow 类型 token 的 `resolvedValue` getter 报 `$m$jscomp$…forEach is not a function`(颜色令牌正常);沙箱里避免 Set/`??=` 等语法
5. **resolvedValue 对颜色的显示丢 alpha 后缀**(#94A3B824 显示为 #94A3B8),value 存储是完整的,只是读取展示问题
6. **组内主题互斥是事实标准**:addTheme({group,name}) 后同组激活另一个,组内其他自动失效;跨组叠加(实测过 Mode+Preset 双组激活)

### 源设计体系的数据坑(如实迁移,待后续确认)

- **focus-ring 类型混用**:snow 基线是完整 box-shadow(`0 0 0 3px rgba(...)`),11 个预设块只给裸 rgba 颜色。前端消费处 `shadow-[var(--focus-ring)]` 把值整体作 box-shadow → 预设下 focus ring 实际是无效 CSS(潜在 bug,不影响迁移,按值分类:基线→shadow 令牌,预设→color 令牌)
- **部分令牌并非全组合存在**:`--surface-2/3` 不在亮色基线(snow/light 未定义),`--surface-active/chrome`、`--selection-bg` 只在预设块;flat-24 里 snow/light 相应缺这些令牌,是忠实映射不是遗漏
- 响应式令牌(`--content-max`、`--tap-target`)、`--transition-fast`、`--blur-popover` 无 Penpot 对应物,按 PRD P3 记录为 web 实现层令牌,不迁移

## 后续(P2)

- 18 个组件片段(components.html + manifest)用 execute_code 重建为 Penpot components,命名对齐令牌组(bg.base/text.primary/radius.sm…)
- 重建时可直接 `shape.applyToken(token, props)` 绑定令牌,主题切换即可换肤——这是 flat-24 方案的额外好处
- 验收基准:preview/ 页 + components.html;preview 中 brand-assets 等手工页以 components.html 为准

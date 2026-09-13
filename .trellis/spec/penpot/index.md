# Penpot MCP 自动化规范

> 来源:任务 09-13-snow-app-to-penpot(P1 令牌迁移 + P2 组件重建,2026-09-13)。
> 适用:任何通过 `mcp__penpot__*` 工具(execute_code / penpot_api_info / export_shape)操作 penpot.app 的自动化。
> 完整坑清单与实测记录:`.trellis/tasks/` 归档中该任务的 notes.md。

## 连接与会话契约

- MCP 工具只在**新会话启动时**连接;`execute_code` 桥接到用户在 penpot.app 打开的文件,需先运行 Plugins → Penpot MCP Server → Connect。
- 报错语义:`No Penpot instance connected` = 插件未连接;`plugin tab appears to be suspended (no heartbeat)` = 标签页被浏览器冻结。
- **插件标签页后台 ~30s 即被冻结**。长任务模式:先发探针(`return {alive:true}`)唤醒,紧跟操作调用;每次长间隔后重新探针。
- 插件沙箱**无外发网络**(fetch localhost 也失败):批量数据必须内联进 execute_code 代码(用 `type|name|value` 紧凑行格式,单批 ≤35KB 实测可行)。

## execute_code 沙箱语法限制(jscomp 转译器)

- 禁用:`Set`/`Map` 迭代展开、`??=`、对 shadow 类型 token 读 `resolvedValue`(触发 `$m$jscomp$…forEach is not a function`)。
- 用 `indexOf` 代替 `includes`、普通对象/数组代替 Set、`x ? a : b` 代替 `??`。
- `storage` 对象跨调用持久(存 helper 函数与中间态);`await new Promise(r => setTimeout(r, N))` 可用,applyToken 后等 300–600ms。

## Token 目录契约(Design Tokens)

### 命名 = 路径语义(最易踩)

- 点分名是路径:**叶名与其子路径不能共存**。`surface` + `surface.solid` → 报错"路径或其前缀处已存在令牌"。
- 映射 CSS 变量时的惯例:`--surface`→`surface.base`、`--accent`→`accent.base`、`--border`→`border.base`、`--island-shadow`→`island.shadow.base`;其余 `-`→`.` 机械转换。

### 值格式

- 颜色:`#RRGGBBAA` 8 位 hex,alpha 保留(应用后 fillOpacity 正确)。`resolvedValue` 的字符串显示会丢 alpha 后缀——用 `.value` 取完整值。
- shadow:对象数组,**每层 `spread` 必填**(DTCG 可省略,Penpot addToken 报"空字段"),inset 用 `inset: true`。
- 主题解析语义(实测):**激活集的并集 + 按 set 顺序的静态优先级,后建/靠后者胜**。跨组主题叠加不会按组智能消解——"基线+覆盖集"建模在同名字集跨模式激活时必然污染一侧;自洽全量集(flat N)+ 单组互斥主题是可靠建模。

### Wrong vs Correct:多主题建模

```js
// Wrong:同一预设的 light/dark 覆盖集挂在一个 Preset 主题上
// Mode=light + Preset=X 时两套覆盖集同时激活,静态顺序决定胜负 → 一种模式必然被污染
th.addSet(byName('preset-light/X')); th.addSet(byName('preset-dark/X'));

// Correct:每个 preset×mode 组合一个自洽全量 set + 单 Theme 组互斥主题
const th = cat.addTheme({ group: 'Theme', name: preset + ' / ' + mode });
th.addSet(byName(preset + '-' + mode));
```

## 组件构建契约(固定流程)

**顺序不可变:字面量建板 → createComponent → 再 applyToken 绑定。**
`createComponent` 会重置异步进行中的样式(applyToken 未落盘时注册,样式被冲掉)。

### 命名

- board 名给**叶子**;注册后 `component.name = '区段/id'`(Penpot 把 `/` 当组路径,主实例名自动带前缀)。board 预先带前缀会得到双前缀。

### 绑定规则

| 形状 | 绑什么 | 禁止 |
|---|---|---|
| 容器/面板 board | 背景/表面令牌(`bg.base`、`surface.*`、`semantic.*.bg`)、`radius.*` | 前景色令牌(会变成吞掉文字的色块) |
| 文本 shape | 前景令牌(`text.*`、`semantic.*.fg`、`accent.contrast`) | — |
| **shadow** | **用字面量,不绑定** | 绑定 `island.shadow.base` |

> **Warning**:绑定 shadow 令牌后 Penpot **服务端导出渲染全黑且 bbox 膨胀**(编辑器内数据正确)。已 A/B 验证;需要阴影主题联动时只能手动在 UI 里绑。

- 纯布局子板默认自带**不透明白 fill**,必须显式 `fills = []`,否则盖住半透明岛面。
- 同一 shape 两次 applyToken 同属性 = 后者覆盖前者(先 bg 后 fg 会只剩 fg)。

### 布局

- `board.addFlexLayout()` 建板后用;已含子板的容器用 `penpotUtils.addFlexLayout(container, dir)` 防乱序。
- 绝对定位子元素:先 `appendChild` 再 `penpotUtils.setParentXY(shape, x, y)`(x/y 是页面绝对坐标,parentX/Y 只读)。
- 一侧边框(如 accent 左条)用 3px 宽子板模拟;分隔线用 1px 子板 + `border.base`。

## 验收清单

- [ ] 每个组件 PNG 导出目视对照源规范(`export_shape`,shapeId 用 execute_code 查 `penpot.root.children` 拿 id;页级导出 `shapeId:'page'` 会 500)
- [ ] 终扫零"前景令牌绑在 board fill 上"(递归扫 `tokens.fill ∈ 前景集`)
- [ ] 切一个暗色主题再导出一次,验证令牌绑定组件真的换肤、无字面量漏网文字
- [ ] 验收后把主题切回默认(如 snow / light),不留脏状态

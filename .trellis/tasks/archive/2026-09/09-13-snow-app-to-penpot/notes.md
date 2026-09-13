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

## P2 组件重建结论(2026-09-13)

- **18/18 组件全部重建并注册为 Penpot components**,命名 `区段/id`(foundations/island、navigation/top-bar、actions/buttons、status/pills、status/chips、lists/list-row、lists/timeline、layouts/detail-panel、layouts/drawer-sheet、content/diff-lines、forms/toggle、select-input、text-input、settings-row),与 manifest 一一对应
- **令牌绑定是活的**:fills/radius 绑定 token(`applyToken`),实测切到 github/dark 后 detail-panel 变 #0A0E14、Primary 变 #58A6FF、文字自动变亮——组件即换肤。shadow 用字面量(见下)
- 全部 18 个经 PNG 导出目视验收(snow/light),关键组件另验 github/dark

### P2 踩坑(补充 P1 清单)

7. **组件注册命名**:board 名给叶子,`createComponent` 后 `c.name = '区段/id'`(Penpot 把 `/` 当组路径,主实例名会自动带前缀,别双写)
8. **createComponent 会重置异步进行中的样式**(applyToken 未落盘时注册 → 样式被冲掉)。流程固定:字面量建板 → 注册 → 再绑定
9. **绑定 shadow 令牌会触发 Penpot 服务端导出渲染 bug**(导出全黑、bbox 膨胀;编辑器内数据正确)。解法:shadow 用字面量,色彩/圆角保留绑定。已 A/B 验证(detail-panel 解绑后导出正常)
10. **前景色令牌误绑到板 fill** 会得到"色块吞文字"(板与文字同色)。扫绑修复:board 绑背景/表面令牌,text 绑前景令牌;终扫 0 残留
11. 默认新建 board 自带不透明白 fill,纯布局容器要显式 `fills = []`,否则盖住半透明岛面
12. 插件标签页后台 ~30s 被浏览器冻结(heartbeat 超时),长任务需先发探针唤醒紧跟操作调用

### P2 遗留(可接受/记录)

- `tabular-nums` 无 Penpot 对应,时间戳/计数未体现等宽数字
- 阴影令牌(light/dark 两套 island.shadow)以字面量(snow/light 值)内置,主题切换时阴影不变;如需联动可手动重新绑定 shadow(编辑器内正常,仅导出管线有 bug)
- 组件内 mono 字体未专门设置(diff 行用默认字体,字号/颜色/底色正确)

## P3 布局样例(2026-09-13 补做,任务归档后追加)

- **Layouts 页新建 `app-shell-desktop`(1280×800)应用壳样例**:bg.base 底板 + 顶部三岛(brand/nav/actions)+ 侧栏岛(Workspace 导航,active 行 accent 左条)+ 队列岛(内嵌 **lists/list-row 组件实例**,演示复用)+ 聊天主岛(general 频道头、3 条消息气泡、composer 输入条)。全部令牌绑定,随主题换肤
- **平板/移动壳(同日追加)**:`app-shell-tablet`(800×760,双行顶栏 + nav+main 双列 + **detail-panel 组件实例作滑出层**)、`app-shell-mobile`(390×760,紧凑单行顶栏 + **breadcrumb-select 组件实例作路径选择器** + 单列聊天 + 40px 触达 composer)。三个壳并排放在 Layouts 页,令牌绑定可整体换肤
- **文件组织决策**:设计体系(令牌+组件+布局)保持在**同一个 Penpot 文件**——令牌目录是文件级的,无跨文件同步/发布;将来做具体产品设计时新建产品文件,把本文件 Publish 成链接库复用组件(组件实例的令牌绑定如何跨库解析未实测,届时先拿一个组件验证)
- ui_kits/app 的 JSX 是通用脚手架(回退色不是 snow 调色板),布局权威以 DESIGN.md 浮动岛规范为准;样例按其三栏结构(侧栏 ~260 / 列表 ~340 / 主区 ~620,gap 10px)落地
- **响应式令牌最终结论**:`--content-max`、`--tap-target`、断点值均为 web 实现层令牌,Penpot 无对应物,不迁移(记入 report.md)
- 布局页踩坑补充:跨页移动 shape 无 API(Page 对象无 appendChild;remove/修改需目标页 active),页重建比搬移省事;`createPage` 忽略名称参数(自动命名),建后需手动 `page.name =`;组件库 `components[].name` 是叶子名,全路径在主实例名上;**execute_code 顶层 const 跨调用持久**(被取消的调用也会留下声明),长构建代码用 `storage.result = await (async () => {...})(); return storage.result;` 包裹防重名,并做幂等(开头移除同名旧板)

## 后续(P3,可选)

- ~~ui_kits/app 的应用级组件(Sidebar/ChatArea)作为页面级 layout 样例~~(已完成,见上)
- ~~平板/移动布局样例~~(已完成,见上)
- 响应式令牌(--content-max 等)保持"web 实现层令牌,不迁移"结论

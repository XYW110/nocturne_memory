# 合并 XYW110 分叉并将灵魂页/移动端落地 snow-app token

> 补建档:工作已于 2026-09-13 会话内完成(sess_f48f290a),本卡按实际完成内容回填。

## Goal

1. 修复 ToolProject 克隆的错误 remote(误指向他人的 Dataojitori/nocturne_memory),改回用户自己的 XYW110/nocturne_memory,打通推送链路。
2. 将两条独立演化的历史线合并为一:6 月线(TestProject 克隆,/m/* 移动端、灵魂模板、Docker/CI 等 49 提交)与 9 月线(ToolProject 克隆,snow-app 设计语言、Penpot 迁移等 19 提交),共同祖先 09b5e26。
3. 合并进来的灵魂页与移动端页面从 nocturne 旧调色板翻译到 snow-app token 层,并统一为全宽岛式布局。

## Requirements

- remote 修正 + git GitHub 代理(127.0.0.1:7897)配置,推送不再 connection reset / 403
- 冲突解决策略:样式类冲突一律取 9 月 snow-app token 版本;6 月线功能(SoulPage 路由、/m/* 设备分流、节点锁定、灵魂重置、safe-area CSS)全部保留并移植进 snow-app 样式底座;.trellis 取现役版本;i18n JSON 深度 union
- 灵魂页 5 组件 + 移动端 6 页面 + NamespaceSelector:nocturne-*/indigo/rose 等硬编码色全部替换为 `--surface/--text/--border/semantic-*` token;修复动态拼接 Tailwind 类名(移动端底栏)永不生效的 bug
- SoulPage 采用全站岛式骨架(标签栏浮岛 + 内容岛卡),诞生模板 1/2/3 列响应式栅格,情感页 2/3 维度面板 + 1/3 账单,关系页 1/3 当前关系 + 2/3 申请队列
- 情感账本 404 空数据显示空态而非空白卡片;初始化下拉框宽度固定

## Constraints

- 不改业务逻辑与 API;冲突解决只动样式壳与结构布局
- 保留 data-testid 与组件文件路径(测试依赖)
- 每步前端构建 + vitest 通过,后端 pytest 全量通过后方提交

## Acceptance Criteria

- [x] `git push origin main` 直推 XYW110/nocturne_memory 成功,本地与远程同步
- [x] 合并提交 fdbcf21:后端 112 测试通过,前端 build + vitest 通过
- [x] 灵魂页/移动端无任何 nocturne-*/indigo/rose 硬编码残留(grep 清零)
- [x] 1920px 宽屏下灵魂页三个标签均为全宽布局,截图验证通过
- [x] 亮/暗主题与 12 个主题预设对灵魂页生效

## Results

- 合并:fdbcf21;token 化:057f331;岛式骨架:e2fb324;宽屏布局:acad90c;journal:e087755
- 会话记录见 .trellis/workspace/xyw/journal-1.md "merge XYW110 fork; soul/mobile snow-app restyle"

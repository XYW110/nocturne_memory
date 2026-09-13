# 全站图标统一 lucide + favicon

## Goal

排查全站非 lucide 图标并统一:MobileSoul 齿轮 emoji 换 lucide Settings,移除 toast 消息冗余 ✓ 字符(Toast 组件自带 lucide 状态图标),index.html 补上 lucide layout-grid 风格 favicon

## Requirements

- 全站排查非 lucide 图标来源:内联 SVG、第三方图标库、CSS 背景图、emoji/字符图标、favicon
- 排查结果:仅三处——MobileSoul 设置入口用「⚙」字符当图标;4 条 toast 消息尾部带冗余「✓」字符(Toast 组件本就有 lucide CheckCircle 状态图标);index.html 无 favicon
- MobileSoul 的「⚙」替换为 lucide `<Settings>`;移除 toast 消息中的「✓」后缀;index.html 增加 lucide layout-grid 风格内联 SVG favicon(与顶栏品牌图标一致)

## Constraints

- 不新增依赖(lucide-react 已内置)
- 不动业务逻辑

## Acceptance Criteria

- [x] `grep -rn "<svg|react-icons|@heroicons|⚙|✓" frontend/src --include=*.jsx` 无 UI 层命中(仅代码注释)
- [x] 前端 build + vitest 通过
- [x] 浏览器验证:移动端灵魂页设置入口渲染 lucide 齿轮图标;favicon 生效

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.

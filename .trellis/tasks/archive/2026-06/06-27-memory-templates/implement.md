# 记忆模板系统 — 实现计划

## 执行顺序

按依赖关系分 7 个 Phase，Phase 间有依赖，Phase 内按序执行。

---

## Phase 1: 数据库 Schema 变更

**依赖**：无

- [ ] 1.1 创建 migration 文件
  - edges 表增加 7 个字段：`locked`, `emotion_trust`, `emotion_closeness`, `emotion_respect`, `emotion_dependency`, `emotion_security`, `emotion_resonance`
  - 创建 `emotion_ledger` 表
  - 创建 `relationship_requests` 表
  - 注册到 `migrations/runner.py`

- [ ] 1.2 更新 `backend/db/models.py`
  - `Edge` 模型：新增 locked + 6 个 emotion 字段
  - 新增 `EmotionLedger` ORM 模型
  - 新增 `RelationshipRequest` ORM 模型

**验证**：pytest 无回归；空 DB 和已有 DB 都能正常执行 migration

---

## Phase 2: 后端核心模块

**依赖**：Phase 1

- [ ] 2.1 创建 `backend/relations.py`
  - `Relationship` 枚举（7 种）
  - `VALID_TRANSITIONS` 有向图
  - `CONFLICT_PAIRS` 冲突规则
  - `RELATIONSHIP_CONTENT` — 每种关系的 `core://my_user` 内容模板
  - 辅助函数：`is_valid_transition()`, `find_conflicts()`

- [ ] 2.2 创建 `backend/template_loader.py`
  - `TemplateLoader(db, graph_service)` 类
  - `_load_json(path)` — 加载 JSON
  - `_replace_vars(content, persona)` — 替换 `{{name}}`, `{{gender}}`, `{{set_age}}`, `{{appearance}}`, `{{mbti}}`, `{{personality}}`, `{{communication_style}}`, `{{values}}`
  - `apply_template(template_id, namespace, persona, relationship)` — 核心：创建 5 个记忆节点 + my_user 节点
  - 返回 `ApplyResult(created, skipped, message)`

- [ ] 2.3 创建 `backend/emotion_service.py`
  - `EmotionService(db)` 类
  - `adjust(edge, adjustments, context)` — delta 校验 + 应用 + 写入 ledger
  - `get_current(edge)` — 返回 6 维当前值
  - `get_ledger(edge, limit)` — 返回变更历史
  - 常量：`EMOTION_DIMENSIONS`, `MAX_DELTA=5`, `MIN_DELTA=-5`

- [ ] 2.4 创建 `backend/relationship_service.py`
  - `RelationshipService(db)` 类
  - `get_current(edge)` — 读取当前关系
  - `request_change(edge, from_rel, to_rel, reason, snapshot)` — 创建申请
  - `approve(request_id)` — 批准 + 更新 edge 关系
  - `reject(request_id, reason)` — 驳回
  - `list_requests(namespace, status)` — 列出申请

**验证**：每个服务 mock DB session 进行单元测试

---

## Phase 3: API 路由

**依赖**：Phase 2

- [ ] 3.1 创建 `backend/api/templates.py`
  - `GET /api/templates` — 扫描 `backend/templates/` 目录
  - `GET /api/templates/{id}` — 返回模板详情（含 persona 字段 + 节点预览）
  - `POST /api/templates/{id}/apply` — 出生

- [ ] 3.2 创建 `backend/api/emotion.py`
  - `POST /api/emotion/adjust` — AI delta（或 Dashboard 手动调）
  - `GET /api/emotion?uri=...` — 当前数值
  - `GET /api/emotion/ledger?uri=...` — 变更账单（分页）

- [ ] 3.3 创建 `backend/api/relationship.py`
  - `POST /api/relationship/request`
  - `GET /api/relationship/requests?namespace=&status=`
  - `POST /api/relationship/requests/{id}/approve`
  - `POST /api/relationship/requests/{id}/reject`
  - `GET /api/relationship/current?uri=core://my_user`

- [ ] 3.4 修改 `backend/api/browse.py`
  - `PATCH /api/browse/node/locked` — 接收 `{path, domain, locked}`

- [ ] 3.5 更新路由注册
  - `backend/api/__init__.py`：导出新 router
  - `backend/web_app.py`：include 新 router

**验证**：pytest + httpx 测试所有新增端点

---

## Phase 4: MCP 工具变更

**依赖**：Phase 2

- [ ] 4.1 locked 拦截逻辑
  - 在 `mcp_server.py` 中新增 `_check_locked()` 辅助函数
  - `update_memory()` 开头调用
  - `delete_memory()` 开头调用
  - `add_alias()` 在目标节点上检查

- [ ] 4.2 新增 MCP 工具：`adjust_emotion`
  - 参数：`target_uri`, `adjustments[]`, `context`
  - 调用 `EmotionService.adjust()`
  - 返回格式化后的当前情感状态

- [ ] 4.3 新增 MCP 工具：`request_relationship_change`
  - 参数：`from_relationship`, `to_relationship`, `reason`
  - 调用 `RelationshipService.request_change()`
  - 返回申请结果

- [ ] 4.4 提示词更新
  - `create_memory` docstring：反知识污染（中文）+ 喜好归类引导
  - `update_memory` docstring：反知识污染（中文）
  - 所有写操作工具：locked 说明

**验证**：手动测试 locked 节点拦截；adjust_emotion 写 ledger

---

## Phase 5: 模板内容生成

**依赖**：Phase 2

- [ ] 5.1 从 demo.db 提取 3 个通用节点内容
  - `core://agent`（注入 persona 变量）
  - `core://operating_principles`
  - `core://philosophy`
  - `core://agent/showroom_quality`
  - 新写入 `backend/templates/default.json`

- [ ] 5.2 编写 7 种关系内容（`backend/templates/relationships.json`）
  - 每种关系一个 `core://my_user` 节点内容模板
  - 全部中文

- [ ] 5.3 编写 `scripts/extract_template.py`
  - 一次性脚本：连接 demo.db → 提取内容 → 生成 default.json

**验证**：JSON 格式合法；`{{变量}}` 占位符对应 persona 字段名

---

## Phase 6: 前端

**依赖**：Phase 3

- [ ] 6.1 `frontend/src/lib/api.js` — 新 API 函数
  - 模板：`listTemplates`, `getTemplate`, `applyTemplate`
  - 情感：`getEmotion`, `getEmotionLedger`
  - 关系：`getCurrentRelationship`, `listRelationshipRequests`, `approveRelationshipRequest`, `rejectRelationshipRequest`
  - locked：`toggleLocked`

- [ ] 6.2 `frontend/src/features/settings/TemplatesSection.jsx`
  - 模板卡片列表
  - 出生对话框：Step 1 人格表单 + Step 2 关系选择
  - gender 下拉框（男/女/其他）
  - appearance 为 textarea
  - Apply 结果 Toast

- [ ] 6.3 `frontend/src/features/settings/EmotionDashboard.jsx`
  - 6 维当前数值展示
  - 变更账单时间线（展开看 reason）
  - 使用雷达图或数值条

- [ ] 6.4 `frontend/src/features/settings/RelationshipPanel.jsx`
  - 当前关系显示
  - 待审批申请列表（approve/reject）
  - 历史申请记录

- [ ] 6.5 修改 `frontend/src/features/settings/SettingsDrawer.jsx`
  - 引入 3 个新面板（作为 Settings 的子区域）

- [ ] 6.6 修改 `frontend/src/features/memory/MemoryBrowser.jsx`
  - 节点旁显示 🔒 图标
  - 点击切换 locked 状态

- [ ] 6.7 i18n
  - `en.json` + `zh.json` 添加所有新翻译 key

**验证**：手动走完出生 → 情感面板有默认值 → 节点有锁

---

## Phase 7: 测试

**依赖**：Phase 1-6

- [ ] 7.1 后端测试
  - locked 拦截（update/delete 被拒）
  - 情感 delta 校验（超范围、无 reason）
  - 关系转变规则（合法/非法/冲突）
  - 模板 apply 幂等性

- [ ] 7.2 端到端
  - 出生 → 记忆可见 → locked 生效 → 情感 delta → 关系申请 → 审批

- [ ] 7.3 更新 demo.db
  - 用新模板重新生成 demo.db

---

## 回滚点

| Phase | 回滚方式 |
|-------|---------|
| Phase 1 | migration 可单独回滚 |
| Phase 2 | 新模块可选删，不影响现有功能 |
| Phase 3 | API 端点可移除 |
| Phase 4 | MCP 工具可 revert |
| Phase 5 | 模板文件可删，不影响运行 |
| Phase 6 | 前端组件纯新增，不影响现有页面 |

---

## 完整文件变更清单

| 文件 | 操作 | Phase |
|------|------|-------|
| `backend/db/models.py` | 修改 | 1 |
| `backend/db/migrations/xxx_emotion_locked.py` | 新增 | 1 |
| `backend/db/migrations/runner.py` | 修改 | 1 |
| `backend/relations.py` | 新增 | 2 |
| `backend/template_loader.py` | 新增 | 2 |
| `backend/emotion_service.py` | 新增 | 2 |
| `backend/relationship_service.py` | 新增 | 2 |
| `backend/api/templates.py` | 新增 | 3 |
| `backend/api/emotion.py` | 新增 | 3 |
| `backend/api/relationship.py` | 新增 | 3 |
| `backend/api/browse.py` | 修改 | 3 |
| `backend/api/__init__.py` | 修改 | 3 |
| `backend/web_app.py` | 修改 | 3 |
| `backend/mcp_server.py` | 修改 | 4 |
| `backend/templates/default.json` | 新增 | 5 |
| `backend/templates/relationships.json` | 新增 | 5 |
| `scripts/extract_template.py` | 新增 | 5 |
| `frontend/src/lib/api.js` | 修改 | 6 |
| `frontend/src/features/settings/TemplatesSection.jsx` | 新增 | 6 |
| `frontend/src/features/settings/EmotionDashboard.jsx` | 新增 | 6 |
| `frontend/src/features/settings/RelationshipPanel.jsx` | 新增 | 6 |
| `frontend/src/features/settings/SettingsDrawer.jsx` | 修改 | 6 |
| `frontend/src/features/memory/MemoryBrowser.jsx` | 修改 | 6 |
| `frontend/src/i18n/en.json` | 修改 | 6 |
| `frontend/src/i18n/zh.json` | 修改 | 6 |
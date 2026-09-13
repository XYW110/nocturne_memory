# Custom Template 自定义模板系统 PRD

## Goal

为用户提供创建、编辑和管理自定义灵魂模板的能力。自定义模板系统允许用户在已有内置模板的基础上，定义自己的 AI 灵魂配置方案，包括个性化的人格参数、记忆节点结构和初始关系类型。

与父任务 PRD1（记忆模板系统）中标记为 Out of Scope 的描述不同，该系统已在代码中完全实现，本 PRD 旨在补充完整的规范和文档。

## Requirements

### R1: 模板创建与存储

**用户自定义模板存储于数据库**：
- 内置模板：存储在 `backend/templates/*.json`（只读）
- 自定义模板：存储在 `soul_templates` 表中（可编辑/删除）
- 存储结构：
  - `id` (主键，模板唯一标识符)
  - `namespace` (命名空间，用于多租户隔离)
  - `name` / `name_en` (中英文模板名称)
  - `description` / `description_en` (中英文描述)
  - `persona` (人格参数定义，JSON 格式)
  - `memory_nodes` (记忆节点定义，JSON 格式)
  - `created_at` / `updated_at` (创建/更新时间戳)

**与内置模板统一处理**：
- TemplateLoader 在 `list_templates()` 和 `get_template()` 中自动合并内置和自定义模板
- 自定义模板通过 `is_custom: true` 字段标识
- 模板 ID 必须唯一，不允许与内置模板冲突

### R2: 模板 CRUD API

**后端 API 端点**：

| 端点 | 方法 | 请求体 | 响应 | 描述 |
|------|------|--------|------|------|
| `/templates/custom` | POST | `CreateTemplateRequest` | 完整模板 | 创建新自定义模板 |
| `/templates/custom/{template_id}` | PUT | 部分更新字段 | 更新后模板 | 更新自定义模板 |
| `/templates/custom/{template_id}` | DELETE | - (可传 `namespace`) | `{"success": true}` | 删除自定义模板 |

**请求体结构**：
```typescript
interface CreateTemplateRequest {
  id: string;                    // 必填，模板ID
  name: string;                  // 必填，中文名称
  name_en?: string;              // 可选，英文名称
  description?: string;          // 可选，中文描述
  description_en?: string;       // 可选，英文描述
  persona: Record<string, any>;  // 必填，人格参数定义
  memory_nodes: Record<string, any>[]; // 必填，记忆节点列表
  namespace?: string;            // 可选，命名空间
}
```

### R3: 模板应用（出生）流程

**支持三种应用方式**：

1. **标准应用** (`POST /templates/{template_id}/apply`)：
   - 使用选择的 persona 参数和 relationship 类型
   - 跳过已存在的节点（idempotent）
   - 创建记忆节点和 `core://my_user` 关系节点

2. **初始化已有灵魂** (`POST /templates/init-existing`)：
   - 为已有记忆数据但未应用模板的用户设计的恢复路径
   - 使用默认 persona 参数
   - 跳过已存在的节点，只创建缺失的节点
   - 更新 `core://my_user` 的关系内容和情感数值

3. **重置已有灵魂** (`POST /templates/reset-existing`)：
   - 强制重置，覆盖所有现有节点
   - 可提供自定义 persona 参数（可选）
   - 清理 `core://agent` 下模板未定义的子节点
   - 完全恢复到模板默认状态

### R4: 前端 UI 交互

**TemplatesSection 组件功能**：
- 模板列表：显示所有模板（内置 + 自定义），自定义模板带 `custom` 标签
- 创建模板：打开表单弹窗，输入 ID、名称、描述，JSON 编辑 persona 和 memory_nodes
- 删除模板：自定义模板显示删除按钮，内置模板不显示
- 出生流程：点击 "出生" 按钮打开 BirthDialog 两步流程
- 初始化/重置：提供关系选择和一键操作按钮

**BirthDialog 两步流程**：
1. Step 1：填写 persona 参数（根据模板定义）
2. Step 2：选择关系类型 + 强制覆盖选项（force overwrite）

**初始化已有灵魂区域**：
- 独立的 UI 区块，强调为已有数据的恢复功能
- 关系类型选择下拉框
- 执行按钮（带加载状态）

### R5: 数据验证与错误处理

**模板 ID 冲突**：
- 创建时检查 `soul_templates` 表是否存在相同 ID
- 冲突时返回 409 状态码

**人格参数验证**：
- 检查 `persona` 中标记为 `required: true` 的字段
- 缺失时拒绝应用

**关系类型验证**：
- 确保选择的 relationship 在 `relationships.json` 中定义
- 无效时返回 422 错误

**JSON 格式验证**：
- `persona` 和 `memory_nodes` 必须是有效 JSON
- 解析失败时返回 400 错误

## API Specification

### 模板管理 API

**`POST /api/templates/custom` - 创建自定义模板**

```typescript
Request Body:
{
  "id": "my_custom_template",
  "name": "我的自定义模板",
  "name_en": "My Custom Template",
  "description": "这是我定义的自定义灵魂模板",
  "description_en": "This is my custom soul template",
  "persona": {
    "name": {"type": "text", "label": "名字", "default": "Nocturne"},
    "mbti": {"type": "string", "label": "MBTI", "default": "INTJ"}
  },
  "memory_nodes": [
    {"domain": "core", "path": "agent", "locked": true, "content": "{{name}} 是一个 {{mbti}} 人格的 AI"},
    {"domain": "core", "path": "agent/philosophy", "content": "成长哲学：...", "locked": false}
  ],
  "namespace": "optional_namespace"
}

Response:
{
  "id": "my_custom_template",
  "name": "我的自定义模板",
  "name_en": "My Custom Template",
  "description": "这是我定义的自定义灵魂模板",
  "description_en": "This is my custom soul template",
  "persona": {...},  // 同请求
  "memory_nodes": [...],  // 同请求
  "node_count": 2,
  "domains": ["core"],
  "persona_fields": ["name", "mbti"],
  "is_custom": true,
  "created_at": "2026-06-30T11:00:00Z",
  "updated_at": "2026-06-30T11:00:00Z"
}
```

**`PUT /api/templates/custom/{template_id}` - 更新自定义模板**

```typescript
Request Body:
{
  "name": "更新后的模板名称",
  "persona": {...},  // 可选部分更新
  "memory_nodes": [...],  // 可选部分更新
  "namespace": "optional_namespace"
}
```

**`DELETE /api/templates/custom/{template_id}` - 删除自定义模板**

```typescript
Request Params:
?namespace=optional_namespace

Response:
{"success": true}
```

### 灵魂初始化 API

**`POST /api/templates/init-existing` - 初始化已有灵魂**

```typescript
Request Body:
{
  "relationship": "partner",  // 必填，关系类型
  "namespace": "optional_namespace"  // 可选
}

Response:
{
  "success": true,
  "uri": "core://my_user",
  "created": ["core://agent", "core://operating_principles"],  // 新创建的节点
  "skipped": ["core://agent/philosophy"],  // 已存在跳过的节点
  "locked": ["core://agent", "core://operating_principles"],  // 标记为 locked 的节点
  "emotion_updated": ["trust", "closeness"],  // 更新的情感维度
  "relationship_updated": true,  // 关系类型是否更新
  "content_updated": false,  // 关系内容是否更新
  "relationship": "partner"
}
```

**`POST /api/templates/reset-existing` - 重置已有灵魂**

```typescript
Request Body:
{
  "relationship": "partner",  // 必填，关系类型
  "persona": {"name": "Alice"},  // 可选，自定义 persona
  "namespace": "optional_namespace"  // 可选
}

Response:
{
  "success": true,
  "uri": "core://my_user",
  "created": [...],  // 重新创建的节点
  "skipped": [...],  // 内容未变化的节点
  "locked": [...],  // 标记为 locked 的节点
  "emotion_updated": [...],  // 更新的情感维度
  "relationship_updated": true/false,
  "content_updated": true/false,
  "deleted_extra": ["core://agent/custom_child"],  // 删除的额外子节点
  "relationship": "partner"
}
```

### 前端 API 函数

在 `frontend/src/lib/api.js` 中：

```javascript
// 自定义模板管理
export const createCustomTemplate = (data) =>
  api.post('/templates/custom', data).then(res => res.data);

export const updateCustomTemplate = (id, data) =>
  api.put(`/templates/custom/${encodeId(id)}`, data).then(res => res.data);

export const deleteCustomTemplate = (id, namespace) =>
  api.delete(`/templates/custom/${encodeId(id)}`, { params: { namespace } }).then(res => res.data);

// 初始化/重置
export const initExistingSoul = (relationship = 'partner', namespace) =>
  api.post('/templates/init-existing', { relationship, namespace }).then(res => res.data);

export const resetExistingSoul = (relationship = 'partner', persona, namespace) =>
  api.post('/templates/reset-existing', { relationship, persona, namespace }).then(res => res.data);
```

## UI Specification

### TemplatesSection 组件 (`frontend/src/features/soul/TemplatesSection.jsx`)

**布局结构**：
1. **初始化已有灵魂区域**（顶部）
   - 琥珀色背景区块，强调恢复功能
   - 关系类型选择下拉框（7种关系）
   - "初始化已有灵魂" 按钮

2. **模板列表区域**
   - 标题 + "添加模板" 按钮
   - 模板卡片网格：
     - 内置模板：名称、描述、节点数、领域、出生按钮
     - 自定义模板：额外显示 "自定义" 标签和删除按钮

3. **创建模板弹窗**
   - 多字段表单：ID、名称、描述（中英文）
   - JSON 编辑器：persona 和 memory_nodes
   - 保存/取消按钮

4. **出生对话框** (`BirthDialog` 组件)
   - Step 1: 填写 persona 参数（动态表单）
   - Step 2: 选择关系类型 + 强制覆盖选项
   - 步骤导航和确认出生按钮

**交互细节**：
- 自定义模板删除需要确认
- 创建模板时 ID 必填，用于 API 标识
- JSON 编辑器支持格式验证（try-catch）
- 出生流程支持跳过已存在节点或强制覆盖

### RelationshipPanel 组件关系

- **关系类型**：使用与 TemplatesSection 相同的 `RELATIONSHIP_TYPES` 常量
- **情感数值**：初始化/重置时会更新情感维度初始值（默认50）
- **当前关系**：通过 `getCurrentRelationship()` 显示当前关系状态

## Relationship with System Templates

### 与内置模板系统的关系

**继承与扩展**：
- 自定义模板继承内置模板的所有结构规范
- 支持相同的 `persona` 字段定义格式
- 支持相同的 `memory_nodes` 结构
- 支持 `{{variable}}` 占位符替换

**差异点**：
- 存储位置：数据库 vs 文件系统
- 可编辑性：自定义模板可编辑删除，内置模板只读
- 命名空间隔离：自定义模板支持 namespace 级别存储
- UI 标识：前端通过 `is_custom` 字段区分显示

**统一处理逻辑**：
```python
# TemplateLoader.list_templates()
templates = []
templates.extend(builtin_templates)  # 从 JSON 文件加载
templates.extend(custom_templates)   # 从数据库加载
return templates
```

**应用流程一致**：
- 使用相同的 `apply_template()` 方法
- 相同的 persona 验证逻辑
- 相同的关系类型处理
- 相同的 locked 节点标记

## Acceptance Criteria

### 模板管理功能
- [ ] 用户可在前端创建新的自定义模板
- [ ] 创建时需要指定唯一 ID、名称、persona、memory_nodes
- [ ] 自定义模板显示 "自定义" 标签
- [ ] 自定义模板可被删除（确认弹窗）
- [ ] 自定义模板列表与内置模板合并显示
- [ ] 模板 ID 冲突时显示错误提示

### 初始化/重置功能
- [ ] 初始化已有灵魂：跳过已有节点，只创建缺失的
- [ ] 重置已有灵魂：强制覆盖所有节点，清理额外子节点
- [ ] 支持自定义 persona 参数（可选）
- [ ] 更新 `core://my_user` 的关系内容和情感数值
- [ ] 返回详细的操作结果（创建、跳过、更新、删除的节点列表）

### 前端 UI
- [ ] TemplatesSection 正确显示所有模板
- [ ] 自定义模板有删除按钮，内置模板没有
- [ ] 创建模板表单包含所有必要字段
- [ ] JSON 编辑器有基本格式验证
- [ ] 出生对话框支持两步流程
- [ ] 初始化区域有明确的功能描述

### API 接口
- [ ] `/templates/custom` CRUD 接口工作正常
- [ ] `/templates/init-existing` 和 `/templates/reset-existing` 工作正常
- [ ] 错误处理：409 冲突、404 未找到、422 无效输入
- [ ] 请求/响应格式符合规范

### 数据持久化
- [ ] 自定义模板正确存储到 `soul_templates` 表
- [ ] 命名空间隔离生效
- [ ] 创建/更新时间戳自动记录
- [ ] JSON 字段正确序列化/反序列化

## Dependencies

### 数据库依赖
- `soul_templates` 表（migration 016 添加）
- `edges` 表（模板应用时创建节点）
- `memory` 表（存储节点内容）
- `paths` 表（存储节点路径）

### 服务依赖
- **TemplateLoader**：负责模板加载和应用
- **SoulTemplateService**：处理自定义模板 CRUD
- **GraphService**：处理节点创建和路径解析
- **PresetService**：配置启动 URI（可选）

### 前端依赖
- **TemplatesSection.jsx**：主界面组件
- **api.js**：API 函数
- **i18n**：多语言支持
- **Toast**：通知系统

### 后端依赖
- **templates.py**：API 路由
- **templates_service.py**：自定义模板服务
- **template_loader.py**：模板加载器
- **db.models.SoulTemplate**：ORM 模型

## Notes

### 为什么 PRD1 标记为 Out of Scope？

PRD1（记忆模板系统）在 `Out of Scope` 部分明确提到：
- "用户自定义模板导出"
- "模板编辑 UI"
- "多模板合并"

这些功能被标记为 Out of Scope 的原因是：
1. **优先级考量**：PRD1 聚焦于核心的模板系统、关系类型、情感数值等基础功能
2. **复杂性管理**：自定义模板涉及存储、UI、权限等额外复杂性
3. **迭代开发**：计划在后续版本中实现

### 实际实现与计划的差异

虽然 PRD1 标记为 Out of Scope，但代码中已经实现了完整的功能：

**已实现的功能**：
- ✅ 用户自定义模板创建（数据库存储）
- ✅ 模板编辑 UI（前端表单 + JSON 编辑器）
- ✅ 模板删除功能
- ✅ 命名空间级别存储

**超出 PRD1 范围但已实现**：
- `init-existing`：无需模板初始化已有数据的恢复功能
- `reset-existing`：强制重置已有灵魂到模板默认状态
- 模板 ID 冲突检测和错误处理

**尚未实现的功能**：
- 模板导出（JSON 文件下载）
- 多模板合并（多个模板组合应用）
- 模板版本管理

### 设计决策记录

**模板 ID 设计**：
- 使用简短的字符串 ID，而非 UUID
- 与内置模板使用相同的命名空间
- 便于记忆和在 URL 中引用

**JSON 存储设计**：
- `persona` 和 `memory_nodes` 存储为 JSON 文本
- 避免过度规范化，保持灵活性和扩展性
- 前端直接编辑 JSON，简化表单逻辑

**初始化/重置分离**：
- `init-existing`：恢复路径，最小侵入性
- `reset-existing`：重置路径，完全控制
- 满足不同场景的用户需求

**UI 用户体验**：
- 自定义模板明确标识，避免混淆
- JSON 编辑器提供示例和格式验证
- 初始化功能独立区块，强调恢复用途

### 风险与限制

**JSON 编辑复杂性**：
- 用户需要理解模板 JSON 结构
- 格式错误可能导致应用失败
- 建议：未来可添加可视化编辑器

**数据一致性风险**：
- 自定义模板可能创建无效的结构
- 应用失败时可能部分创建节点
- 建议：加强验证和事务回滚

**性能考虑**：
- 大量自定义模板可能影响列表加载性能
- 复杂模板结构可能影响应用速度
- 建议：添加分页和复杂度限制

### 建议的未来改进

1. **模板可视化编辑器**：图形化编辑 persona 和 memory_nodes
2. **模板导入/导出**：JSON 文件导入导出功能
3. **模板版本控制**：记录模板修改历史，支持回滚
4. **模板共享**：命名空间间共享自定义模板
5. **模板继承**：基于现有模板创建变体
6. **模板验证工具**：预览模板应用效果
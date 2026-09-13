# Review/Changeset 审查系统 PRD

## Goal

Review 系统是 nocturne_memory AI Agent 灵魂记忆管理系统的核心安全机制，用于人工审查 AI 通过 MCP 写入的记忆变更。

**核心价值**：
- **安全护栏**：防止 AI 意外破坏记忆结构或写入不恰当内容
- **变更透明**：提供可视化的差异对比，让用户清楚看到 AI 修改了什么
- **回滚控制**：允许用户拒绝不需要的变更，恢复到之前的状态
- **批量管理**：支持批量审查和审批，提高效率

## Requirements

### 功能需求

1. **变更组列表**
   - 按 node_uuid 分组显示所有待审查的变更
   - 显示每个变更组的 URI 显示名称、变更类型、影响行数
   - 支持命名空间过滤和显示
   - 实时加载和刷新变更列表

2. **差异对比查看**
   - 显示记忆内容的 before/after 文本差异
   - 对比元数据变更（优先级 priority、披露级别 disclosure）
   - 显示路径变更（新增/删除的路径）
   - 显示术语表变更（新增/删除的 glossary keywords）
   - 高亮显示具体修改的行和内容

3. **审查操作**
   - **回滚（拒绝）**：撤销 AI 的所有变更，恢复到之前状态
   - **批准（整合）**：接受 AI 变更，从待审查队列中移除
   - **全部批准**：一键批准所有待审查的变更组

4. **状态管理**
   - 加载状态显示
   - 错误处理（连接失败、差异获取失败等）
   - 异步操作确认（二次确认弹窗）
   - 操作结果反馈（toast 通知）

5. **数据持久化**
   - 变更集存储在 JSON 文件中（snapshots/changeset.json）
   - 支持文件锁定防止并发冲突
   - 自动清理无效变更（创建后立即删除的 no-op 变更）

## API Specification

### 基础端点
- **前缀**：`/api/review`
- **认证**：Bearer Token（自动附加）
- **命名空间**：review 相关 API 不附加 X-Namespace header

### 1. 获取变更组列表
```
GET /review/groups
→ 200 OK
[
  {
    "node_uuid": "uuid-string",
    "display_uri": "core://my_memory",
    "top_level_table": "nodes|memories|edges|paths|glossary_keywords",
    "action": "created|modified|deleted",
    "row_count": 5,
    "namespaces": ["namespace1", "namespace2"]
  },
  ...
]
```

**说明**：
- `node_uuid`：变更组的唯一标识符（数据库中的 node.uuid）
- `display_uri`：用于显示的友好 URI（如 "core://my_memory"）
- `top_level_table`：该组中最高的实体表（优先级：nodes > memories > edges > paths > glossary_keywords）
- `action`：主要变更类型（创建、修改、删除）
- `row_count`：该组中包含的变更行数
- `namespaces`：影响到的命名空间列表

### 2. 获取变更组差异详情
```
GET /review/groups/{node_uuid}/diff
→ 200 OK
{
  "uri": "node_uuid",
  "change_type": "nodes|memories|edges|paths|glossary_keywords",
  "action": "created|modified|deleted",
  "before_content": "旧记忆内容",
  "current_content": "新记忆内容",
  "before_meta": {
    "priority": 0,
    "disclosure": null
  },
  "current_meta": {
    "priority": 1,
    "disclosure": "public"
  },
  "path_changes": [
    {
      "action": "created|deleted",
      "uri": "core://path/to/memory",
      "namespace": ""
    }
  ],
  "glossary_changes": [
    {
      "action": "created|deleted",
      "keyword": "重要概念"
    }
  ],
  "active_paths": ["core://current/path"],
  "path_namespaces": {
    "core://current/path": ["default", "ns1"]
  },
  "has_changes": true
}
```

**说明**：
- `before_content`/`current_content`：记忆内容的 before/after 状态
- `before_meta`/`current_meta`：元数据变更（priority、disclosure）
- `path_changes`：路径变更列表（新增/删除）
- `glossary_changes`：术语表变更列表（新增/删除）
- `active_paths`：当前可访问的路径列表
- `path_namespaces`：各路径对应的命名空间列表
- `has_changes`：是否有实际变更（内容或元数据）

### 3. 回滚变更组
```
POST /review/groups/{node_uuid}/rollback
→ 200 OK
{
  "node_uuid": "uuid-string",
  "success": true,
  "message": "Deleted created node and its dependencies."
}
```

**回滚逻辑**：
1. **节点创建回滚**：如果节点是新创建的，级联删除整个节点及其依赖
2. **路径变更回滚**：
   - 删除新增的路径
   - 恢复被删除的路径
3. **边元数据回滚**：恢复 priority 和 disclosure 的原始值
4. **记忆内容回滚**：恢复之前的记忆版本（解除废弃状态）
5. **术语表回滚**：
   - 删除新增的 glossary keywords
   - 恢复被删除的 glossary keywords

### 4. 批准变更组
```
DELETE /review/groups/{node_uuid}
→ 200 OK
{
  "message": "Approved changes for node {node_uuid} ({count} rows removed from changeset)."
}
```

**说明**：不修改数据库，仅从变更集中移除跟踪的行，表示变更已被人工审查通过。

### 5. 全部批准
```
DELETE /review
→ 200 OK
{
  "message": "All {count} pending changes integrated."
}
```

**说明**：清空整个变更集文件，批准所有待审查的变更。

### 6. 其他端点
```
GET /review/deprecated
→ 获取所有已废弃的记忆列表（用于手动 GC）

DELETE /review/memories/{memory_id}
→ 永久删除已废弃的记忆（手动垃圾回收）

POST /review/diff
→ 通用文本差异对比工具（用于前端其他场景）
```

## UI Specification

### 页面布局

**ReviewPage.jsx** 采用左右分栏布局：

```
┌─────────────────────────────────────────────────────┐
│                   Review Page                       │
├─────────────┬───────────────────────────────────────┤
│   Sidebar   │            Main Stage                 │
│ (72px宽)    │                                       │
│             │                                       │
│ • 标题区     │ • Header区：显示选中变更信息          │
│ • 变更列表   │ • Diff区：差异对比展示               │
│ • 全批准按钮 │ • Metadata区：元数据变更             │
│             │ • Path区：路径变更                   │
│             │ • Glossary区：术语表变更             │
│             │ • 操作按钮：回滚/批准                │
└─────────────┴───────────────────────────────────────┘
```

### 侧边栏组件

**SnapshotList.jsx** 显示变更组列表：
- 每个变更项显示：
  - URI 显示名称（display_uri）
  - 变更类型标签（created/modified/deleted）
  - 影响行数（row_count）
  - 命名空间标签（如有）
- 颜色编码：
  - 创建：绿色（emerald）
  - 删除：红色（rose）
  - 修改：黄色（amber）
- 选中状态：高亮显示，左侧边框指示

### 差异查看器

**DiffViewer.jsx** 使用 `diff` 库进行行级差异对比：
- **删除内容**：红色背景 + 删除线
- **新增内容**：绿色背景
- **未变更内容**：正常显示
- 支持大文本内容的滚动查看

### 确认弹窗

**ConfirmModal.jsx** 提供操作确认：
- 危险操作（回滚）：红色警告图标
- 常规操作：默认蓝色样式
- ESC 键取消支持
- 响应式按钮布局

### 交互流程

1. **加载页面**：
   - 自动调用 `GET /review/groups` 获取变更列表
   - 加载第一个变更组的差异详情
   - 显示加载状态或错误状态

2. **选择变更组**：
   - 点击侧边栏列表项
   - 自动加载该组的差异详情（`GET /review/groups/{node_uuid}/diff`）
   - 更新主区域显示内容

3. **查看差异**：
   - 自动滚动到差异区域
   - 展开/折叠元数据、路径、术语表变更
   - 可点击重试按钮重新加载差异

4. **执行操作**：
   - **回滚**：
     - 点击回滚按钮 → 显示确认弹窗
     - 确认后调用 `POST /review/groups/{node_uuid}/rollback`
     - 成功后刷新变更列表，显示 toast 通知
   - **批准**：
     - 点击批准按钮 → 直接调用 `DELETE /review/groups/{node_uuid}`
     - 成功后从列表中移除该变更组，显示 toast 通知
   - **全部批准**：
     - 点击侧边栏底部按钮 → 显示确认弹窗
     - 确认后调用 `DELETE /review`
     - 成功后清空整个列表，显示 toast 通知

5. **错误处理**：
   - 连接失败：显示断开连接状态
   - 差异获取失败：显示错误信息 + 重试按钮
   - 操作失败：显示错误 toast 通知

## Data Flow

### Review Group 生命周期

```
AI通过MCP写入记忆变更
    ↓
变更被记录到 snapshot store（snapshots/changeset.json）
    ↓
用户访问 /review 页面
    ↓
前端调用 GET /review/groups
    ↓
后端分组算法处理：
  1. 读取变更集中所有行
  2. 按"因果锚点"分组（_get_causal_anchors）
  3. 折叠级联变更到根节点
  4. 返回分组结果
    ↓
用户选择某个变更组
    ↓
前端调用 GET /review/groups/{node_uuid}/diff
    ↓
后端计算差异：
  1. 提取该组的 before/after 状态
  2. 获取记忆内容（从变更集或实时数据库）
  3. 获取元数据（priority/disclosure）
  4. 收集路径和术语表变更
  5. 返回结构化差异数据
    ↓
用户决策：
  → 回滚：POST /review/groups/{node_uuid}/rollback
    ↓
    执行数据库回滚操作
    ↓
    从变更集中移除相关行
    ↓
    返回操作结果
  → 批准：DELETE /review/groups/{node_uuid}
    ↓
    从变更集中移除相关行
    ↓
    返回成功消息
```

### 分组算法详解

变更分组的关键在于**因果锚点（Causal Anchor）**算法：

1. **基础归属**：每行变更根据外键确定其字面归属的 `node_uuid`
   - `nodes` 表：直接使用 uuid
   - `memories` 表：使用 node_uuid
   - `edges` 表：使用 child_uuid
   - `paths` 表：通过 edge_id → child_uuid 查找
   - `glossary_keywords` 表：使用 node_uuid

2. **因果追踪**：识别级联关系，将低级变更"折叠"到高级原因
   - **路径级联**：子路径变更归因于父路径变更（除非是独立创建/删除）
   - **边级联**：边变更归因于路径变更或父节点删除
   - **记忆垃圾回收**：记忆废弃归因于节点失去所有入边
   - **节点级联**：节点删除归因于所有入边被删除

3. **寻根问祖**：通过 parent_map 找到最终的根因 node_uuid

这种设计确保：
- 高层 AI 操作（如删除节点）产生的级联变更被折叠到同一个审核组
- 用户看到的是逻辑完整的变更单元，而非碎片化的行级变更
- 回滚操作可以完整恢复整个逻辑变更，避免数据库外键断裂

### 变更集存储结构

**snapshots/changeset.json**：
```json
{
  "rows": {
    "nodes:uuid1": {
      "table": "nodes",
      "before": null,
      "after": {"uuid": "uuid1", "type": "memory", ...}
    },
    "memories:123": {
      "table": "memories",
      "before": {"id": 123, "node_uuid": "uuid1", "content": "old", ...},
      "after": {"id": 123, "node_uuid": "uuid1", "content": "new", ...}
    },
    "paths:default|core://my_memory": {
      "table": "paths",
      "before": null,
      "after": {"namespace": "", "domain": "core", "path": "my_memory", ...}
    }
  }
}
```

**存储语义**：
- `before`: null 表示创建操作
- `after`: null 表示删除操作
- `before` ≠ `after` 表示更新操作
- 第一次记录：保存 both `before` 和 `after`
- 后续更新：只覆盖 `after`，`before` 保持不变

## Acceptance Criteria

### 功能性测试

1. **变更列表显示**
   - [ ] 当有 AI 变更时，侧边栏显示变更组列表
   - [ ] 每个变更组显示正确的 URI、类型、行数
   - [ ] 创建/删除/修改操作使用正确的颜色编码
   - [ ] 命名空间标签正确显示
   - [ ] 点击变更组可选中并加载差异

2. **差异对比功能**
   - [ ] 记忆内容差异正确高亮显示
   - [ ] 元数据变更（priority/disclosure）正确显示
   - [ ] 路径变更列表正确显示
   - [ ] 术语表变更列表正确显示
   - [ ] 没有实际变更时显示"无变化"状态

3. **回滚操作**
   - [ ] 回滚创建操作：节点被完全删除
   - [ ] 回滚删除操作：路径和元数据被恢复
   - [ ] 回滚修改操作：记忆内容和元数据被恢复
   - [ ] 回滚后变更组从列表中移除
   - [ ] 回滚失败时显示错误消息

4. **批准操作**
   - [ ] 批准后变更组从列表中移除
   - [ ] 数据库状态保持不变
   - [ ] 全部批准清空整个变更列表
   - [ ] 没有待审查变更时显示空状态

5. **错误处理**
   - [ ] 网络断开时显示连接错误
   - [ ] 差异获取失败时显示重试按钮
   - [ ] 操作失败时显示 toast 通知
   - [ ] 确认弹窗可取消操作

### 性能测试

1. **加载性能**
   - [ ] 变更列表加载时间 < 1s（100个变更组以内）
   - [ ] 差异加载时间 < 2s（10KB记忆内容）
   - [ ] 页面切换流畅，无卡顿

2. **内存占用**
   - [ ] 差异查看器支持大文本（>100KB）而不崩溃
   - [ ] 变更列表支持100+条目而不影响性能
   - [ ] 长时间运行无内存泄漏

### 兼容性测试

1. **浏览器兼容**
   - [ ] Chrome、Firefox、Safari、Edge 最新版本支持
   - [ ] 响应式设计支持移动端查看
   - [ ] 深色/浅色主题适配

2. **API兼容**
   - [ ] 向后兼容现有 API 响应格式
   - [ ] 错误响应符合 FastAPI 标准
   - [ ] 认证机制与其他页面一致

## Dependencies

### 后端依赖

1. **数据库层**
   - `db.snapshot.ChangesetStore`：变更集存储
   - `db.graph.GraphService`：图形操作服务
   - `db.models`：SQLAlchemy 模型定义

2. **API层**
   - `api.review`：所有 review 相关端点
   - `api.utils.get_text_diff`：文本差异计算工具

3. **数据模型**
   - `models.schemas`：Pydantic 模式定义
     - `ChangeGroup`：变更组数据结构
     - `UriDiff`：差异详情数据结构
     - `GroupRollbackResponse`：回滚响应结构

### 前端依赖

1. **页面组件**
   - `features/review/ReviewPage.jsx`：主页面
   - `components/SnapshotList.jsx`：变更列表组件
   - `components/DiffViewer.jsx`：差异查看器
   - `components/ConfirmModal.jsx`：确认弹窗

2. **API层**
   - `lib/api.js`：所有 review API 函数
     - `getGroups()`
     - `getGroupDiff(nodeUuid)`
     - `rollbackGroup(nodeUuid)`
     - `approveGroup(nodeUuid)`
     - `clearAll()`

3. **工具库**
   - `react`：React 框架
   - `react-i18next`：国际化支持
   - `lucide-react`：图标库
   - `clsx`：类名工具
   - `diff`：文本差异库

### 系统依赖

1. **文件系统**
   - `snapshots/changeset.json`：变更集存储文件
   - 需要写权限（创建/修改文件）
   - 需要文件锁定支持（filelock 库）

2. **运行时**
   - FastAPI 服务器运行中
   - 数据库连接正常
   - MCP Server 已启动

## Notes

### 设计决策

1. **单文件存储 vs 数据库表存储**
   - 选择单文件存储（JSON）的原因：
     - 简化部署：无需额外数据库表
     - 易于调试：可直接查看文件内容
     - 独立于数据库：即使数据库损坏，变更集仍可恢复
     - 文件锁定确保并发安全

2. **因果锚点算法复杂度**
   - 支持复杂级联变更的正确分组
   - 避免用户看到碎片化的变更列表
   - 确保回滚操作能完整恢复逻辑单元
   - 算法复杂度 O(n²) 可接受，因为变更数量有限

3. **实时数据库查询**
   - 差异对比需要查询实时数据库状态
   - 原因：变更集只存储指针（memory_id），不存储完整内容
   - 优势：减少变更集文件大小
   - 劣势：增加了查询复杂度

### 限制与边界

1. **变更集大小限制**
   - 文件大小无硬性限制，但过大会影响性能
   - 建议定期清理已批准的变更
   - 变更集应视为临时存储，非长期审计日志

2. **并发操作限制**
   - 同一时间只允许一个用户执行回滚操作
   - 文件锁定确保数据一致性
   - 但多个用户同时浏览审查页面是安全的

3. **网络依赖性**
   - 差异查看需要数据库查询
   - 网络断开时无法显示最新差异
   - 但已加载的变更列表仍然可用

### 扩展性考虑

1. **未来优化**
   - 可添加变更筛选功能（按类型、命名空间、时间）
   - 可添加批量选择操作（同时回滚/批准多个组）
   - 可添加变更统计面板（显示变更趋势）

2. **集成可能性**
   - 可与通知系统集成（新变更时发送通知）
   - 可与审计日志集成（记录审查决策）
   - 可与权限系统集成（不同角色审查权限）

### 风险与缓解

1. **数据一致性风险**
   - **风险**：变更集与数据库状态不一致
   - **缓解**：回滚操作使用事务，确保原子性
   - **缓解**：定期校验变更集的有效性

2. **性能风险**
   - **风险**：大量变更时页面加载慢
   - **缓解**：分页加载变更列表
   - **缓解**：惰性加载差异详情

3. **安全风险**
   - **风险**：变更集文件可能被篡改
   - **缓解**：文件权限控制（只允许应用进程访问）
   - **缓解**：操作前校验变更有效性

---

**文档版本**：1.0  
**基于代码版本**：nocturne_memory 当前实现  
**最后更新**：2026-06-30  
**作者**：AI Agent（基于代码分析生成）
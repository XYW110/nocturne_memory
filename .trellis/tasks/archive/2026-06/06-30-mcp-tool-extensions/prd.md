# MCP 工具扩展 PRD

## Goal

为 AI Agent 提供基础记忆 CRUD 之外的扩展 MCP 工具，包括别名管理、触发关键词绑定和全文搜索，补齐 MCP Server 工具链的完整性。这些工具已在代码中实现，本文档正式记录其规范和行为契约。

## Requirements

### R1: add_alias — 记忆别名

AI 可为同一记忆节点创建多条访问路径（alias），每条 alias 有独立的 priority 和 disclosure。

- **语义**：alias 不是复制——alias 和原始路径指向同一个 Memory ID（同一份内容）
- **子节点继承**：target_uri 下的所有子节点自动在新路径下生成镜像 alias，AI 无需逐个创建
- **per-path 元数据**：每条 alias 的 priority 和 disclosure 独立存储（与 manage_triggers 不同，触发器是 per-node 的）
- **变更审查**：alias 创建进入 changeset 审查队列，需人工审批（与 REST API 的 `POST /browse/node/alias` 不同，REST 端点是人工直写，不走审查）
- **重复检测**：若同一节点在同一父目录下出现多次，返回警告提示

### R2: manage_triggers — 触发关键词管理

AI 可将触发关键词（glossary keywords）绑定到记忆节点，当该关键词出现在任意记忆内容中时，read_memory 自动在底部显示指向目标节点的链接。

- **语义**：触发器绑定到 Memory Node（Memory ID），而非具体路径——同一节点的所有 alias 共享同一组触发器
- **选词规则**：
  - 触发词必须已存在于某条旧记忆的内容中（借用已有文本中的词来挂钩新记忆）
  - 禁止凭空发明不存在于记忆库中的占位词
  - 使用具体词汇，避免宽泛/通用词（宽泛词产生噪音）
  - 一个节点可有多个触发器，同一触发词可指向多个节点
- **查看所有触发器**：通过 `read_memory("system://glossary")` 查看全部
- **变更审查**：触发器操作（添加/删除）进入 changeset 审查队列
- **幂等性**：重复添加已存在的关键词自动跳过，删除不存在关键词自动跳过

### R3: search_memory — 全文搜索

AI 可通过关键词在记忆库中进行全文搜索，返回匹配记忆的 URI 和内容片段。

- **语义**：词法全文搜索（基于 FTS 索引），非语义搜索
- **作用域**：默认跨所有 domain 搜索，可选 domain 过滤
- **只读**：无需变更审查，public_readonly_mcp 模式下也可用（未使用 @write_tool() 装饰器）
- **结果格式**：返回匹配数量、每个结果的 URI、priority、disclosure、内容片段

## Tool Specification

### 1. add_alias

**文件位置**：`backend/mcp_server.py:891-997`

**装饰器**：`@write_tool()` — 仅在非 public_readonly_mcp 模式下注册

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `new_uri` | `str` | ✅ | 新创建的 alias URI（如 `"core://timeline/2024/05/20"`） |
| `target_uri` | `str` | ✅ | 已存在的目标 URI（如 `"core://agent/my_user/first_meeting"`） |
| `priority` | `int` | ✅ | 此 alias 路径的相对检索优先级（≥0），取决于与父节点主题的相关性 |
| `disclosure` | `str` | ✅ | 此 alias 路径的触发条件描述，必须人工编写 |

#### 返回值

成功时返回包含以下信息的字符串：
- `new_uri` 和 `target_uri` 确认
- 自动继承的子节点 alias 列表（如有）
- 重复 sibling 警告（如同一节点在同一父目录下出现多次）
- 系统提醒：建议先读取父节点内容，检查冲突

#### 副作用
- 在 paths 表中新增一条 Path 记录（指向同一 node_uuid）
- 所有子节点自动创建镜像 path 记录（级联）
- 写入 changeset（进入审查队列）

#### 错误处理
- `priority < 0` → 返回错误
- `new_uri` 或 `target_uri` 格式无效（非法 domain/URI）→ 返回 `ValueError` 消息
- 数据库异常 → 返回通用错误消息

#### 使用场景
- **上下文路由**：记忆 B 在阅读节点 A 时也有价值 → 在 A 下建立 B 的 alias
- **重命名/移动**：`add_alias` 到新路径，再 `delete_memory` 旧路径（切不可 `delete` + `create`，那会丢失 Memory ID 和所有关联）
- **多视角访问**：同一记忆在不同主题路径下以不同 priority 出现

---

### 2. manage_triggers

**文件位置**：`backend/mcp_server.py:999-1119`

**装饰器**：`@write_tool()` — 仅在非 public_readonly_mcp 模式下注册

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uri` | `str` | ✅ | 指向目标记忆节点的任意 URI（任意 alias 等效） |
| `add` | `Optional[List[str]]` | — | 要绑定到此节点的触发词列表 |
| `remove` | `Optional[List[str]]` | — | 要从此节点解绑的触发词列表 |

- `add` 和 `remove` 至少提供一个
- 同一调用中 `add` 和 `remove` 不能包含相同的词（交集检查）

#### 返回值

成功时返回格式化字符串：
- 已添加的关键词列表
- 已跳过（已存在）的关键词列表
- 已移除的关键词列表
- 已跳过（未找到）的关键词列表
- 当前节点的触发词完整列表

#### 副作用
- 在 glossary_keywords 表中新增/删除关键词-节点绑定
- 写入 changeset（进入审查队列）
- 影响后续 `read_memory` 的 glossary 链接显示

#### 错误处理
- URI 不存在的记忆 → 返回 `"Error: Memory at '{uri}' not found."`
- `add` 和 `remove` 含交集 → 返回 `"Error: Cannot add and remove the same keywords simultaneously: ..."`
- `add_glossary_keyword` 抛出 `ValueError` → 该词被跳过（已存在）
- `remove_glossary_keyword` 返回 `success: false` → 该词被跳过（未找到）

#### 使用场景
- **跨记忆关联**：当记忆 A 的内容中包含某个关键词，该关键词又是记忆 B 的触发器 → 阅读 A 时自动看到 B 的链接
- **语义锚点建立**：为重要记忆节点添加多个触发词，使其在相关上下文中自动浮现
- **知识图谱构建**：通过共享触发词将分散的记忆编织成关联网络

---

### 3. search_memory

**文件位置**：`backend/mcp_server.py:1122-1176`

**装饰器**：`@mcp.tool()` — 所有模式下均注册（public_readonly_mcp 下也可用）

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `query` | `str` | ✅ | — | 搜索关键词（子串匹配） |
| `domain` | `Optional[str]` | — | `None` | 可选的 domain 过滤（如 `"core"`、`"writer"`），不指定则搜索全部 domain |
| `limit` | `int` | — | `10` | 最大返回结果数 |

#### 返回值

成功时返回格式化字符串：
- 匹配结果数量
- 每个结果的：
  - URI（格式 `domain://path`）
  - Priority 数值
  - Disclosure（如有）
  - 内容片段（snippet）

无匹配时返回 `"No matching memories found {scope}."`

#### 副作用
- 无（纯读取操作，不写入 changeset）

#### 错误处理
- 非法 domain → 返回 `"Error: Unknown domain '{domain}'. Valid domains: ..."`
- 搜索引擎异常 → 返回通用错误消息

#### 使用场景
- **URI 查找**：AI 不记得某条记忆的精确 URI 时，通过关键词搜索定位
- **内容发现**：探索记忆库中与某主题相关的所有记忆
- **去重检查**：在创建新记忆前，搜索是否已有相似内容（避免冗余）

## Integration

### 与已有 MCP 工具的关系

| 已有工具 | 扩展工具 | 关系 |
|----------|----------|------|
| `create_memory` | `add_alias` | create 后系统提示考虑是否需要 add_alias 建立多路径访问 |
| `create_memory` | `manage_triggers` | create 后系统提示考虑是否需要 manage_triggers 建立关键词关联 |
| `read_memory` | `manage_triggers` | read 返回内容底部展示 glossary links（由 manage_triggers 建立的触发词关联） |
| `read_memory("system://glossary")` | `manage_triggers` | system://glossary 展示所有 manage_triggers 创建的触发词绑定 |
| `read_memory` | `search_memory` | 当不知道 URI 时先用 search_memory，再 read_memory |
| `delete_memory` | `add_alias` | 移动记忆时先 add_alias 到新路径，再 delete_memory 旧路径 |

### 与 REST API 的重叠

| MCP 工具 | REST API | 差异 |
|----------|----------|------|
| `add_alias` | `POST /browse/node/alias` | MCP 端走 changeset 审查队列；REST 端人工直写，绕过审查 |
| `manage_triggers` | `POST /browse/glossary` + `DELETE /browse/glossary` | MCP 端走 changeset 审查；REST 端人工直写，绕过审查 |
| `search_memory` | `GET /browse/search` | 功能完全一致，共享同一搜索引擎；MCP 默认 limit=10，REST 默认 limit=20 |

**设计原则**：MCP 工具（AI 使用）的所有写入操作进入 changeset 审查队列，确保人工可审计和回滚。REST API（Dashboard 人工使用）直接写入数据库，不进入审查队列。

## Acceptance Criteria

### add_alias
- [ ] AI 可通过 `add_alias(new_uri, target_uri, priority, disclosure)` 创建别名
- [ ] 别名和原始路径指向同一 Memory ID，共享内容
- [ ] 每条 alias 有独立的 priority 和 disclosure
- [ ] 子节点自动镜像（不需逐个创建）
- [ ] 同父目录下重复 alias 触发警告
- [ ] 写入 changeset 审查队列
- [ ] public_readonly_mcp 模式下工具不可用

### manage_triggers
- [ ] AI 可通过 `manage_triggers(uri, add=[...], remove=[...])` 管理触发词
- [ ] 同一节点的所有 alias 共享触发器（per-node 绑定）
- [ ] 重复添加已存在词自动跳过
- [ ] 删除不存在词自动跳过
- [ ] add 和 remove 交集检测正常工作
- [ ] 写入 changeset 审查队列
- [ ] `read_memory("system://glossary")` 正确展示所有触发词绑定
- [ ] public_readonly_mcp 模式下工具不可用

### search_memory
- [ ] AI 可通过 `search_memory(query, domain, limit)` 搜索记忆
- [ ] 子串匹配正确工作（词法搜索，非语义）
- [ ] domain 过滤正确工作
- [ ] 无匹配时返回友好消息
- [ ] 非法 domain 返回错误提示
- [ ] public_readonly_mcp 模式下工具仍然可用（只读）

### 跨工具集成
- [ ] `create_memory` 返回消息中的 `add_alias` / `manage_triggers` 引导文字正确
- [ ] `read_memory` 底部 glossary links 与 `manage_triggers` 设置的触发词一致

## Dependencies

- **数据库**：`paths` 表（add_alias 写入）、`glossary_keywords` 表（manage_triggers 读写）、FTS 全文索引（search_memory 查询）
- **服务层**：`db.graph_service`（别名路径操作）、`db.glossary_service`（触发词管理）、`db.search_indexer`（全文搜索）
- **审查系统**：`db.snapshot.changeset_store`（变更记录）
- **namespace**：所有操作隔离到当前 namespace

## Constraints

- `add_alias` 和 `manage_triggers` 在 `public_readonly_mcp=true` 时不注册（使用 `@write_tool()` 装饰器控制）
- `search_memory` 始终注册（`@mcp.tool()`），不受 readonly 模式影响
- 所有 MCP 写入操作进入 changeset 审查队列，人工可回滚
- 不破坏现有 MCP 工具接口（read/create/update/delete_memory 保持兼容）

## 边界场景

| 场景 | 处理 |
|------|------|
| add_alias 到不存在的 target_uri | `graph.add_path` 抛出 ValueError，返回错误 |
| add_alias 的 new_uri 路径已存在 | `graph.add_path` 处理冲突（或抛出异常） |
| manage_triggers 未提供 add 也未提供 remove | 两个列表均为 None，返回当前触发词列表（无变更） |
| search_memory 跨大量记忆搜索 | FTS 索引保证性能，limit 参数控制返回量 |
| manage_triggers 对 locked 节点操作 | 当前实现未阻止对 locked 节点添加/删除触发词（与 update_memory/delete_memory 的 locked 检查行为不同） |

## Notes

- **Rest API 重叠**：`add_alias` 对应的 REST 端点是 `POST /browse/node/alias`（`backend/api/browse.py:385`），关键差异在于 REST 绕过 changeset 审查。`manage_triggers` 对应的 REST 端点是 `POST/DELETE /browse/glossary`（`backend/api/browse.py:541,554`），同样绕过审查。`search_memory` 对应的 REST 端点是 `GET /browse/search`（`backend/api/browse.py:604`），功能一致。
- **前端组件**：`KeywordManager.jsx` 通过 REST API 管理触发词（Dashboard 人工操作），`AliasManager.jsx` 通过 REST API 管理别名（Dashboard 人工操作）。
- **与 PRD1 的关系**：PRD1（记忆模板系统）记录了基础的 read/create/update/delete_memory 和 adjust_emotion、request_relationship_change 工具，本文档补充了剩余 3 个已实现但未记录的扩展工具。
- **locked 节点**：当前 `manage_triggers` 不检查节点 locked 状态（与 update_memory/delete_memory 行为不一致），这可能是一个有意设计（触发词是元数据绑定而非内容修改），也可能需要后续统一。

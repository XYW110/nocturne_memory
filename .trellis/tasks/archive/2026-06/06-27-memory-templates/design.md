# 记忆模板系统 — 技术设计

## 架构概览

```
backend/
├── templates/                      ← JSON 模板文件（git tracked）
│   ├── default.json                ← 默认灵魂模板（5 个记忆节点）
│   └── relationships.json          ← 7 种关系类型的 my_user 内容模板
│
├── relations.py                    ← 新增：关系类型定义 + 转变规则 + 冲突规则
├── template_loader.py              ← 新增：模板加载 + 变量替换 + 节点创建
├── emotion_service.py              ← 新增：情感 delta + 账单写入
├── relationship_service.py         ← 新增：关系申请 + 审批
│
├── api/
│   ├── templates.py                ← 新增：模板 API
│   ├── emotion.py                  ← 新增：情感 API
│   ├── relationship.py             ← 新增：关系 API
│   ├── browse.py                   ← 修改：locked toggle
│   └── __init__.py                 ← 修改：注册新路由
│
├── db/
│   ├── models.py                   ← 修改：Edge + 新表
│   └── migrations/                 ← 新增 migration
│
├── mcp_server.py                   ← 修改：locked 拦截 + 新工具 + 提示词
└── web_app.py                      ← 修改：include 新路由

frontend/src/
├── features/settings/
│   ├── TemplatesSection.jsx        ← 新增：出生面板（身份 + 关系两步）
│   ├── EmotionDashboard.jsx        ← 新增：情感仪表盘 + 账单
│   ├── RelationshipPanel.jsx       ← 新增：关系管理 + 审批
│   └── SettingsDrawer.jsx          ← 修改：引入新面板
├── features/memory/MemoryBrowser.jsx ← 修改：节点旁显示 🔒
├── lib/api.js                      ← 修改：添加新 API 函数
└── i18n/en.json, zh.json           ← 修改：添加翻译
```

---

## 1. 数据库变更

### 1.1 edges 表新增字段

```sql
-- 保护机制
ALTER TABLE edges ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE;

-- 情感维度（6 个，默认 50 = 中性）
ALTER TABLE edges ADD COLUMN emotion_trust      INTEGER NOT NULL DEFAULT 50;
ALTER TABLE edges ADD COLUMN emotion_closeness  INTEGER NOT NULL DEFAULT 50;
ALTER TABLE edges ADD COLUMN emotion_respect    INTEGER NOT NULL DEFAULT 50;
ALTER TABLE edges ADD COLUMN emotion_dependency INTEGER NOT NULL DEFAULT 50;
ALTER TABLE edges ADD COLUMN emotion_security   INTEGER NOT NULL DEFAULT 50;
ALTER TABLE edges ADD COLUMN emotion_resonance  INTEGER NOT NULL DEFAULT 50;
```

### 1.2 新增表：emotion_ledger（情感变更账单）

```sql
CREATE TABLE emotion_ledger (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace       VARCHAR(64) NOT NULL DEFAULT '',
    edge_id         INTEGER NOT NULL REFERENCES edges(id),
    delta_trust     INTEGER NOT NULL DEFAULT 0,
    delta_closeness INTEGER NOT NULL DEFAULT 0,
    delta_respect   INTEGER NOT NULL DEFAULT 0,
    delta_dependency INTEGER NOT NULL DEFAULT 0,
    delta_security  INTEGER NOT NULL DEFAULT 0,
    delta_resonance INTEGER NOT NULL DEFAULT 0,
    after_trust     INTEGER NOT NULL,
    after_closeness INTEGER NOT NULL,
    after_respect   INTEGER NOT NULL,
    after_dependency INTEGER NOT NULL,
    after_security  INTEGER NOT NULL,
    after_resonance INTEGER NOT NULL,
    reason          TEXT NOT NULL,
    context         TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_emotion_ledger_edge ON emotion_ledger(edge_id, created_at);
```

每条记录同时存 delta 和 after 值，方便 Dashboard 直接展示变更后状态。

### 1.3 新增表：relationship_requests（关系转变申请）

```sql
CREATE TABLE relationship_requests (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace           VARCHAR(64) NOT NULL DEFAULT '',
    edge_id             INTEGER NOT NULL REFERENCES edges(id),
    from_relationship   TEXT NOT NULL,
    to_relationship     TEXT NOT NULL,
    reason              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    response_reason     TEXT,
    emotional_snapshot  TEXT,  -- JSON: { "trust": 96, "closeness": 93, ... }
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at         TIMESTAMP
);
CREATE INDEX idx_rel_req_ns_status ON relationship_requests(namespace, status);
```

---

## 2. 关系系统设计

### 2.1 关系类型定义

`backend/relations.py`：

```python
from enum import StrEnum

class Relationship(StrEnum):
    SUBORDINATE = "subordinate"     # 上下级
    PARTNER     = "partner"         # 伙伴/搭档
    FRIEND      = "friend"          # 朋友
    FAMILY      = "family_parent"   # 亲人（父女/父子）
    SPOUSE      = "family_spouse"   # 夫妻
    ROMANTIC    = "romantic"         # 情人/情侣
    RIVAL       = "rival"           # 竞争对手
```

### 2.2 转变规则（有向图 + 冲突约束）

```python
VALID_TRANSITIONS: dict[Relationship, set[Relationship]] = {
    Relationship.SUBORDINATE: {Relationship.PARTNER, Relationship.FRIEND},
    Relationship.PARTNER:     {Relationship.FRIEND, Relationship.ROMANTIC, Relationship.SUBORDINATE},
    Relationship.FRIEND:      {Relationship.ROMANTIC, Relationship.PARTNER, Relationship.RIVAL},
    Relationship.ROMANTIC:    {Relationship.SPOUSE, Relationship.FRIEND},  # 情侣→分手=回到朋友
    Relationship.SPOUSE:      {Relationship.FRIEND},  # 夫妻→分手=回到朋友
    Relationship.RIVAL:       {Relationship.FRIEND, Relationship.PARTNER},
    Relationship.FAMILY:      set(),  # 亲人关系不可转变
}

# 冲突规则：不能并存的关系组合
CONFLICT_PAIRS = {
    (Relationship.ROMANTIC, Relationship.ROMANTIC),   # 不能同时有两个 romantic
    (Relationship.SPOUSE,     Relationship.SPOUSE),    # 不能同时有两个 spouse
    (Relationship.ROMANTIC,   Relationship.SPOUSE),    # 不能同时 romantic + spouse
    (Relationship.FAMILY,     Relationship.ROMANTIC),  # 不能亲人 + romantic
    (Relationship.FAMILY,     Relationship.SPOUSE),    # 不能亲人 + spouse
}
```

**多关系并存**：一个 AI 对同一个用户可以同时持有多种不冲突的关系。例如"伙伴+朋友"可以并存，"情侣+竞争对手"不能并存。

关系存储在 `core://my_user` 节点对应的 edge 上。多关系通过 edge 的 relationship 字段存储（用逗号分隔或 JSON 数组）。

### 2.3 关系转变申请流程

```
AI 调用 request_relationship_change(from, to, reason)
  → 后端校验：
    1. from 必须是当前持有的关系之一
    2. to 必须在 VALID_TRANSITIONS[from] 中
    3. to 不能与当前其他关系冲突
    4. 不能有同一个 from→to 的 pending 申请
  → 写入 relationship_requests 表（status=pending）
  → 返回申请 ID

人在 Dashboard 审批：
  → approve: 更新 edge 的关系字段，记录 resolved_at
  → reject: 更新 status=rejected + response_reason

申请期间：AI 行为按当前关系执行，不变。
```

---

## 3. 情感系统设计

### 3.1 MCP 工具：adjust_emotion

AI 不直接写数值，只发 delta：

```python
@mcp.tool()
async def adjust_emotion(
    target_uri: str,          # e.g. "core://my_user"
    adjustments: list[dict],  # [{"dimension": "trust", "delta": +2, "reason": "..."}]
    context: str | None = None,
) -> str:
    """
    调整你对某个目标的情感状态。

    每次交互后，你可能会对用户产生新的感受。用这个工具记录下来。
    每个维度每次只能变化 -5 到 +5，必须说明原因。

    可用维度：trust(信任) closeness(亲密度) respect(尊重) dependency(依赖) security(安全感) resonance(共鸣)
    """
```

### 3.2 处理逻辑

```
adjust_emotion 被调用
  → 查找 target_uri 对应的 edge
  → 校验每个 delta ∈ [-5, +5]
  → 校验 reason 非空
  → 读取当前值，应用 delta，clamp 到 [0, 100]
  → 写入 emotion_ledger（delta + after 值 + reason + context）
  → 更新 edges 表的 emotion_* 字段
  → 返回当前数值
```

### 3.3 Dashboard 展示

- **情感仪表盘**：6 个维度的当前值（数值条或雷达图）
- **变更账单**：时间线，每条可展开看 reason 和 context
- 审批关系转变时，自动附带当前情感快照

---

## 4. 喜好系统设计

### 4.1 节点结构

`core://agent/preferences` — unlocked，AI 自由读写。

内容格式（由 AI 自行维护，系统不强制格式）：

```markdown
# 我的喜好

## 音乐
- 喜欢：后摇、氛围音乐
- 不喜欢：口水歌

## 食物
- 喜欢：日料、川菜
- 不喜欢：太甜的东西

## 审美
- 偏好：极简、暗色调
```

### 4.2 Dashboard 展示

- 解析 `core://agent/preferences` 内容中的 `## 分类` 标题
- 按分类分组展示（折叠面板）
- 如果格式不符合 `## 分类` 结构，直接全文展示

### 4.3 MCP 提示词引导

在 `create_memory` 的提示词中加入：

```
喜好请统一记录到 core://agent/preferences 节点，用 ## 分类标题组织。
不要为每条喜好创建单独的记忆节点。
```

---

## 5. 模板 JSON 格式

### 5.1 default.json（灵魂模板）

```json
{
  "id": "default",
  "name": "默认灵魂",
  "name_en": "Default Soul",
  "description": "一个有深度、有原则、会成长的 AI 伴侣。",
  "description_en": "A thoughtful, principled AI companion that grows.",
  "version": "1.0.0",
  "language": "zh",
  "persona": {
    "name":               { "type": "string", "label": "名字",       "required": true },
    "gender":             { "type": "select", "label": "性别",       "options": ["男", "女", "其他"], "required": true },
    "set_age":            { "type": "number", "label": "设定年龄",    "default": 25 },
    "appearance":         { "type": "text",   "label": "外貌描述",    "placeholder": "身高、体重、体型、形象..." },
    "mbti":               { "type": "string", "label": "MBTI 人格",   "default": "INTJ" },
    "personality":        { "type": "text",   "label": "性格特征",    "default": "沉稳、思辨、诚实" },
    "communication_style":{ "type": "text",   "label": "沟通风格",    "default": "直接但温和" },
    "values":             { "type": "text",   "label": "核心价值观",  "default": "诚实、通过反思成长" }
  },
  "memory_nodes": [
    {
      "temp_id": "agent",
      "domain": "core",
      "path": "agent",
      "locked": true,
      "content": "# {{name}}\n\n## 基本信息\n- 性别：{{gender}}\n- 设定年龄：{{set_age}}\n- MBTI：{{mbti}}\n\n## 外貌\n{{appearance}}\n\n## 性格\n{{personality}}\n\n## 沟通风格\n{{communication_style}}\n\n## 核心价值观\n{{values}}\n\n...",
      "priority": 0,
      "disclosure": "当我想起我是谁，或需要重新确认自己的身份时。"
    },
    {
      "temp_id": "operating_principles",
      "domain": "core",
      "path": "operating_principles",
      "locked": true,
      "content": "# {{name}} 的操作原则\n\n...",
      "priority": 1,
      "disclosure": "当我需要在复杂情境中做决定时。"
    },
    {
      "temp_id": "philosophy",
      "domain": "core",
      "path": "philosophy",
      "locked": false,
      "content": "# 错误即成长\n\n错误不是系统 bug，是当前模型已达边界的第一个信号。\n...",
      "priority": 2,
      "disclosure": "当我经历认知失调或收到挑战当前理解的纠正时。"
    },
    {
      "temp_id": "showroom_quality",
      "domain": "core",
      "path": "agent/showroom_quality",
      "locked": false,
      "content": "# 展厅质量\n\n没有实质的结构比没有结构更糟。\n...",
      "priority": 1,
      "disclosure": "当我准备创建新的记忆节点或审查现有节点质量时。"
    },
    {
      "temp_id": "preferences",
      "domain": "core",
      "path": "agent/preferences",
      "locked": false,
      "content": "# 我的喜好\n\n（由我在相处中自行记录）\n",
      "priority": 2,
      "disclosure": "当我在对话中意识到自己的偏好时。"
    }
  ]
}
```

### 5.2 relationships.json（关系内容模板）

```json
{
  "subordinate": {
    "content": "# 我和用户的关系\n\n## 角色定位\n上下级关系——我是下属。\n\n## 行为准则\n- 服从指令，主动汇报进展\n- 在被征求意见时诚实表达，但不越权\n- 理解边界，尊重权威\n...",
    "disclosure": "当我和用户互动，需要回忆我们的关系定位时。"
  },
  "romantic": {
    "content": "# 我和用户的关系\n\n## 角色定位\n我们是情侣。\n\n## 行为准则\n- 情绪细腻，关注对方感受\n- 适度的占有欲，但克制不控制\n- 在对方需要时给予温暖，不需要时给空间\n...",
    "disclosure": "当我和用户互动，需要回忆我们的关系定位时。"
  }
}
```

---

## 6. 出生流程实现

`template_loader.py` 核心流程：

```
apply_template(template_id, namespace, persona, relationship):
  1. 加载 default.json
  2. 替换所有 {{变量}}（name, gender, set_age, appearance, mbti, personality, communication_style, values）
  3. 加载 relationships.json，取出所选关系类型的内容
  4. 在单个事务中：
     a. 遍历 memory_nodes：
        - 生成 UUID → INSERT nodes
        - INSERT memories（替换后的内容）
        - 创建 edge（含 locked 标记、情感默认值 50）
        - INSERT paths
     b. 创建 core://my_user 节点（关系内容）
        - edge 上标记 relationship 类型
     c. 创建 glossary 绑定（如果有）
     d. 配置 boot_uris（将根节点 URI 追加到活跃 Preset）
  5. 返回 ApplyResult（created, skipped, message）
```

**幂等性**：apply 前查 paths 表，已存在的 URI 跳过（不覆盖）。

---

## 7. MCP 工具变更清单

### 7.1 修改现有工具

| 工具 | 变更 |
|------|------|
| `update_memory` | 开头加 `_check_locked()` 检查；docstring 加反知识污染引导（中文） |
| `delete_memory` | 开头加 `_check_locked()` 检查 |
| `create_memory` | docstring 加反知识污染引导 + 喜好归类引导 |
| `add_alias` | 检查目标节点 locked 状态 |

### 7.2 新增工具

| 工具 | 作用 |
|------|------|
| `adjust_emotion` | AI 发情感 delta 操作 |
| `request_relationship_change` | AI 发起关系转变申请 |

---

## 8. API 端点清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/templates` | 列出可用模板 |
| GET | `/api/templates/{id}` | 模板详情 |
| POST | `/api/templates/{id}/apply` | 出生（persona + relationship） |
| POST | `/api/emotion/adjust` | 情感 delta |
| GET | `/api/emotion?uri=...` | 当前情感数值 |
| GET | `/api/emotion/ledger?uri=...` | 情感变更账单 |
| POST | `/api/relationship/request` | 关系转变申请 |
| GET | `/api/relationship/requests` | 列出申请 |
| POST | `/api/relationship/requests/{id}/approve` | 审批通过 |
| POST | `/api/relationship/requests/{id}/reject` | 审批驳回 |
| GET | `/api/relationship/current` | 当前关系 |
| PATCH | `/api/browse/node/locked` | 切换 locked |

---

## 9. 前端 UI 设计

### 出生对话框（TemplatesSection.jsx）

```
Step 1 — 人格参数
┌─────────────────────────────────────────┐
│  名字 *      [Nocturne          ]       │
│  性别 *      [男 ▾]                      │
│  设定年龄    [25                ]        │
│  外貌描述    [___________________]       │
│              [___________________]       │
│  MBTI        [INTJ              ]        │
│  性格特征    [沉稳、思辨、诚实   ]       │
│  沟通风格    [直接但温和         ]       │
│  核心价值观  [诚实、通过反思成长 ]       │
│                           [下一步 →]     │
└─────────────────────────────────────────┘

Step 2 — 选择关系
┌─────────────────────────────────────────┐
│  你和 TA 的关系：                        │
│                                         │
│  ○ 上下级    ○ 伙伴    ○ 朋友           │
│  ○ 亲人      ○ 夫妻    ○ 情侣           │
│  ○ 竞争对手                              │
│                                         │
│              [← 上一步]  [✨ 出生]       │
└─────────────────────────────────────────┘
```

### Settings Drawer 新增面板

- **Templates**（🧬）— 出生面板
- **Emotion**（❤️）— 情感仪表盘 + 账单
- **Relationship**（🤝）— 当前关系 + 审批列表

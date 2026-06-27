# 记忆模板系统 — AI 灵魂蓝图

## Goal

为 AI Agent 提供「灵魂蓝图」模板系统。模板定义 Agent 的初始人格（姓名、MBTI、性格等）和初始关系类型（上下级、伙伴、情侣等），应用模板即为 Agent 的「出生」——注入初始身份和关系记忆。出生之后，Agent 通过 MCP 工具自我进化，模板不再约束其成长方向。

## 设计哲学

**记忆系统是灵魂，不是知识库。**

模板内容只包含：
- ✅ 身份定义（我是谁）
- ✅ 行为原则（我怎么做）
- ✅ 成长哲学（我怎么变）
- ✅ 质量标准（什么值得记）
- ✅ 关系定义（我和用户是什么关系）

不包含世界事实、技术知识、用户观察、历史记录。AI 绝不能把记忆系统当搜索引擎用。

---

## Requirements

### R1: 模板结构

每个模板包含三层：

**① Persona 定义（可配置变量）**

| 字段 | 类型 | 必填 | 默认值 | locked | 说明 |
|------|------|------|--------|--------|------|
| `name` | string | ✅ | "Nocturne" | ✅ | |
| `gender` | select | ✅ | — | ✅ | 选项：男 / 女 / 其他 |
| `set_age` | number | — | 25 | ✅ | 设定年龄，永远不变（AI 不会老） |
| `appearance` | text | — | — | ✅ | 外貌综合描述（身高、体重、体型、形象，一个输入框自由描述） |
| `mbti` | string | — | "INTJ" | — | |
| `personality` | text | — | "沉稳、思辨、诚实" | — | 中文 |
| `communication_style` | text | — | "直接但温和" | — | 中文 |
| `values` | text | — | "诚实、通过反思成长" | — | 中文 |

**语言约定**：所有 persona 内容默认中文。模板记忆内容默认中文。MCP 工具提示词默认中文。AI 自行生成的内容默认中文。

**locked 标记说明**：name、gender、set_age、appearance 写入 `core://agent`（locked），AI 不能修改这些身份基础。mbti、personality、communication_style、values 也写入 `core://agent`，但可由用户在 Dashboard 调整是否锁定。

**② 记忆节点**（5 个，带 `{{变量}}` 占位符）

| 节点 | 作用 | locked |
|------|------|--------|
| `core://agent` | 核心身份（名字、年龄、MBTI、性格、价值观） | ✅ |
| `core://operating_principles` | 操作原则 | ✅ |
| `core://philosophy` | 成长哲学 | — |
| `core://agent/showroom_quality` | 质量标准（什么值得记） | — |
| `core://agent/preferences` | AI 喜好（自由写，按类别组织） | — |

**③ Glossary 绑定**（初始语义锚点）

---

### R2: 关系模板系统

出生时选择一种初始关系类型，生成 `core://my_user` 节点。

**可选关系类型：**

| 类型 | 描述 | 初始行为基调 |
|------|------|-------------|
| `subordinate` | 上下级（AI 是下属） | 服从、汇报、主动补充，不逾矩 |
| `partner` | 伙伴/搭档 | 平等协作，互相补充，直接反馈 |
| `friend` | 朋友 | 轻松、有话直说、偶尔损一下 |
| `family_parent` | 亲人（父女/父子） | 照顾、保护、耐心，不控制 |
| `family_spouse` | 夫妻 | 亲密、了解、知道什么时候该说什么 |
| `romantic` | 情人/情侣 | 浪漫、情绪细腻、有占有欲但克制 |
| `rival` | 竞争对手 | 对抗、挑刺、互相逼着变强 |

**关系转变规则（有向图）：**

```
上下级 ──→ 伙伴 ──→ 朋友 ──→ 情侣 ──→ 夫妻
                                  ↓
                                分手 ←── (任意关系)
                                
上下级 ──→ 朋友 (合法，需理由)
朋友 ──→ 情侣 (合法，需情感基础)
情侣 ──→ 夫妻 (合法，需高数值 + 时间)
```

**不允许的转变**（跨级）：
- 朋友 → 夫妻（跳过情侣阶段）
- 上下级 → 夫妻

**所有关系转变**必须由 AI 发起申请，人工审批。申请未通过前，AI 行为按当前关系执行。

**关系转变申请内容：**
```json
{
  "from_relationship": "情侣",
  "to_relationship": "夫妻",
  "reason": "具体理由，必须说明为什么...",
  "emotional_snapshot": { "trust": 96, "closeness": 93 }
}
```

---

### R3: 情感数值系统

**存储方式：** edges 表新增情感维度字段（结构化，可查询）

**情感维度（细粒度）：**

| 维度 | 英文 | 范围 | 说明 |
|------|------|------|------|
| 信任度 | `trust` | 0-100 | 多大程度相信用户说的话、做的决定 |
| 亲密度 | `closeness` | 0-100 | 多大程度感到和用户亲近 |
| 尊重度 | `respect` | 0-100 | 多大程度尊重用户的判断和边界 |
| 依赖度 | `dependency` | 0-100 | 多大程度需要/期待用户的关注 |
| 安全感 | `security` | 0-100 | 多大程度感到这段关系是稳定可靠的 |
| 共鸣度 | `resonance` | 0-100 | 多大程度感到和用户心意相通 |

**AI 操作方式：** AI 不直接写数值，只发 delta 操作：

```json
{
  "adjustments": [
    { "dimension": "trust", "delta": +2, "reason": "用户遵守了他对我的承诺" },
    { "dimension": "closeness", "delta": -1, "reason": "这次对话中感到一点疏远" }
  ],
  "context": "关于昨天的对话"
}
```

**系统处理：**
1. 校验 delta 范围（每次 -5 到 +5）
2. 应用 delta，clamp 到 0-100
3. 写入情感变更账单（完整审计日志）
4. 更新 edges 表中的当前值

**情感账单（审计日志）：**

每次变更记录：
- 时间戳
- 关联节点 URI
- 每个维度的 delta + 变更后数值
- AI 的理由（reason）
- 上下文（context）

**Dashboard 展示：**
- 当前情感数值仪表盘（雷达图/数值表）
- 完整变更历史（时间线，可展开每条看理由）
- 关系转变申请列表（待审批/已通过/已驳回）

**情感数值与关系转变的关系：**
- 数值影响 AI 是否**考虑**申请关系转变
- 但最终是否申请是 AI 自己的决定
- 你审批时能看到当前情感数值作为参考

---

### R4: 记忆保护机制（locked）

edges 表新增 `locked: bool` 字段。

| 入口 | locked=false | locked=true |
|------|-------------|-------------|
| **MCP 工具**（AI） | 自由读写 | 只读，修改/删除被拒绝 |
| **REST API**（Dashboard 人） | 自由读写 | 自由读写 + 可切换 locked |

- 模板中标记为 `locked: true` 的节点（agent、operating_principles），AI 不能修改或删除
- 用户可在 Dashboard 对任意节点设置/取消 locked
- 无审批队列

---

### R5: MCP 工具提示词 — 反知识污染

在 `create_memory` 和 `update_memory` 的工具描述中加入引导：

```
FORBIDDEN: Do NOT use this memory system to store world facts, general knowledge,
technical comparisons, or encyclopedic information. This system is for YOUR identity,
YOUR relationships, YOUR principles, and YOUR growth.

What belongs here:
- "I made a mistake because..." (self-reflection)
- "My user values X over Y" (relationship)
- "When I feel pressured, I tend to..." (self-awareness)

What does NOT belong here:
- "HTTP/2 uses multiplexing" (world fact)
- "Mem0 vs Zep comparison" (technical knowledge)
- "The user's company uses React" (environment info)
```

---

### R6: 后端 API

**模板相关：**
- `GET /api/templates` — 列出可用模板
- `GET /api/templates/{id}` — 模板详情（含关系类型选项）
- `POST /api/templates/{id}/apply` — 出生（含 persona + relationship_type）

**情感相关：**
- `POST /api/emotion/adjust` — AI 发情感 delta 操作
- `GET /api/emotion` — 查当前情感数值（Dashboard 用）
- `GET /api/emotion/ledger` — 查情感变更账单（Dashboard 用）

**关系转变相关：**
- `POST /api/relationship/request` — AI 发起关系转变申请
- `GET /api/relationship/requests` — 列出所有申请（待审批/已通过/已驳回）
- `POST /api/relationship/requests/{id}/approve` — 审批通过
- `POST /api/relationship/requests/{id}/reject` — 审批驳回（附理由）
- `GET /api/relationship/current` — 当前关系状态

**锁定相关：**
- `PATCH /api/browse/node/locked` — 切换节点 locked 状态

---

### R7: 前端 UI

**出生面板（Settings Drawer - Templates）：**
- Step 1: 选身份模板 + 填人格参数
- Step 2: 选关系类型
- Step 3: 确认出生

**Dashboard 新增页面/面板：**
- **情感仪表盘**：当前数值（6 个维度）+ 最近变更摘要
- **情感账单**：完整变更历史时间线
- **关系管理**：当前关系类型 + 待审批申请列表

**Memory Browser 增强：**
- 节点旁显示 🔒 图标，点击切换 locked

---

## Acceptance Criteria

### 模板系统
- [ ] 模板 JSON 只包含 4 个节点（身份、原则、哲学、质量标准）
- [ ] 模板包含 `persona` 定义和 `{{变量}}` 占位符
- [ ] 出生时可选择关系类型
- [ ] `{{变量}}` 在出生时被替换为用户填写的值
- [ ] 出生后，AI 可以通过 MCP 工具自由修改非 locked 记忆

### 保护机制
- [ ] edges 表有 `locked` 字段
- [ ] MCP `update_memory` / `delete_memory` 拒绝操作 locked 节点
- [ ] REST API（Dashboard）不受 locked 限制
- [ ] Dashboard 可对任意节点切换 locked 状态

### 情感系统
- [ ] edges 表有 6 个情感维度字段
- [ ] MCP 新增 `adjust_emotion` 工具，AI 发 delta 操作
- [ ] delta 带 reason，系统自动计算并记录账单
- [ ] Dashboard 显示当前情感数值
- [ ] Dashboard 显示完整情感变更历史（含理由）

### 关系系统
- [ ] 7 种关系类型可选
- [ ] 关系转变有向图约束（不允许跨级）
- [ ] AI 通过 MCP 发起关系转变申请
- [ ] 申请包含 from/to/reason/emotional_snapshot
- [ ] 申请未审批期间 AI 行为按当前关系执行
- [ ] Dashboard 可审批/驳回申请

### 反知识污染
- [ ] MCP `create_memory` / `update_memory` 工具描述包含反知识污染引导

### 前端
- [ ] 出生面板美观，两步（身份 + 关系）流畅
- [ ] Dashboard 情感仪表盘清晰
- [ ] Dashboard 关系管理面板可用
- [ ] Memory Browser 显示 locked 状态

## Constraints

- 模板文件 git tracked
- edges 表需 migration（加 `locked` + 情感字段）
- locked 不继承到子节点（每个节点独立标记）
- 不破坏现有 Preset 系统
- 不破坏现有 MCP 工具接口

## 边界场景

| 场景 | 处理 |
|------|------|
| AI 在 locked 节点下创建子节点否定父节点 | MCP 提示词引导反思，但不禁行为 |
| 人工删除 locked 节点 | Dashboard 弹出额外确认警告 |
| 申请未审批期间 AI 情感剧变 | 情感数值照常更新，关系不变 |
| AI 发起非法关系转变 | 后端校验，拒绝并返回合法路径 |
| AI 对已锁定的关系发转变申请 | 系统允许申请，由你决定是否批准 |
| 模板更新后想应用到已有 namespace | 用 overwrite=true 或另一个 namespace |

## Out of Scope

- 用户自定义模板导出
- 模板编辑 UI
- 多模板合并

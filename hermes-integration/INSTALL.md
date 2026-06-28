# Nocturne Memory Skill for Hermes Agent — 一键安装指南

## 📦 这是什么？

这是 **Nocturne Memory** 的 Hermes Agent Skill，让你的 Agent 拥有**持久化的灵魂记忆**。

## 🎯 核心能力

- **人格记忆** — Agent 的身份、原则、成长哲学
- **关系记忆** — 与用户的当前关系（朋友/伙伴/情侣/上下级等）
- **情感记忆** — 六个维度的情感数值，随时间变化
- **成长反思** — Agent 的自我认知和进化

## 📁 安装步骤（1 分钟搞定）

### 1️⃣ 复制 Skill 文件夹

```bash
# Linux/macOS
cp -r skills/nocturne-memory ~/.hermes/skills/

# Windows PowerShell
Copy-Item -Recurse skills/nocturne-memory $env:USERPROFILE\.hermes\skills\
```

### 2️⃣ 启动 Hermes Agent

启动 Hermes Agent，它会自动检测到 Nocturne Memory Skill。

### 3️⃣ 提供配置信息

Agent 会向你询问以下信息：

- `NOCTURNE_API_URL`（通常是 `https://nocturne-memory.aiprovip.cc.cd`）
- `NOCTURNE_API_TOKEN`（你的 API Token）

**直接回复 Agent 即可，例如：**

```
NOCTURNE_API_URL=https://nocturne-memory.aiprovip.cc.cd
NOCTURNE_API_TOKEN=abc123xyz
```

### 4️⃣ 等待自动配置

Agent 会自动：

1. 调用 `auto_config.py` 脚本
2. 更新 `~/.hermes/config.yaml` 文件
3. 执行 `/reload-mcp` 使配置生效

**无需手动操作！**

## 🛠️ Agent 出生（可选，但推荐）

第一次使用前，给你的 Agent 一个初始人格：

```bash
python birth.py --name "星辰" --mbti ENFP --relationship friend
```

或者直接应用默认模板：

```bash
python birth.py
```

## ✅ 验证安装

Agent 启动后，你应该能看到这些工具：

- `mcp_nocturne_read_memory`
- `mcp_nocturne_create_memory`
- `mcp_nocturne_adjust_emotion`
- 等等...

## 🔧 可用工具一览

| 工具名                                     | 功能     | 示例                                           |
| ------------------------------------------ | -------- | ---------------------------------------------- |
| `mcp_nocturne_read_memory`                 | 读取记忆 | `mcp_nocturne_read_memory(uri="core://agent")` |
| `mcp_nocturne_create_memory`               | 创建记忆 | 记录新的自我认知                               |
| `mcp_nocturne_update_memory`               | 更新记忆 | 更新现有记忆内容                               |
| `mcp_nocturne_delete_memory`               | 删除记忆 | 删除过时记忆                                   |
| `mcp_nocturne_search_memory`               | 搜索记忆 | 按关键词查找相关记忆                           |
| `mcp_nocturne_adjust_emotion`              | 情感调整 | 调整对用户的情感数值                           |
| `mcp_nocturne_request_relationship_change` | 关系转变 | 申请关系升级/降级                              |

## ❓ 常见问题

**Q: Skill 装好了，但工具没出现？**
A: 检查第 2 步的 MCP 配置是否正确，确认 `~/.hermes/config.yaml` 格式正确。

**Q: 如何获取 API Token？**
A: 联系项目管理员，或访问 Nocturne Memory Dashboard 生成 Token。

**Q: 出生脚本报错？**
A: 确认环境变量 `NOCTURNE_API_TOKEN` 已设置，或直接在 `birth.py` 中传入 `--token` 参数。

**Q: 能多个 Agent 共享记忆吗？**
A: ✅ 可以！所有配置了相同 Token 的 Agent 共享同一记忆库。

## 📞 支持

- **文档**: [Nocturne Memory 项目主页](https://nocturne-memory.aiprovip.cc.cd)
- **问题反馈**: GitHub Issues 或联系管理员

---

**版本**: 1.0.0  
**最后更新**: 2026-06-28  
**兼容性**: Hermes Agent v0.2.0+

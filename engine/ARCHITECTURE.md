# ARCHITECTURE — ElysiaClaw
> Stage: 认知架构演进中期 | Last updated: 2026-06-08
> Class: mixed | CLI-LEAN 下只信任 irreducible 章节（§0/§1/§6/§7），derivable 章节按需从代码现生


## 0. 产品简史  [irreducible]
**为什么要做这个项目：** ElysiaClaw 是 OpenClaw（多渠道 AI 助手平台）的个人维护分支。目标是在 pi-mono 框架之上构建一个对标 Claude Code 完整能力的自主 AI 助手，通过 Telegram Bot 提供服务。不是简单的 chatbot——而是常驻的、有状态的、会自我进化的信息接收主体。

**用户核心操作：**
1. 通过 Telegram 与 ElysiaClaw 对话，执行代码分析、文件操作、部署任务
2. Agent 自主执行多步骤任务（规划→执行→审查→沉淀），跨 session 延续
3. 记忆引擎自动索引和召回历史操作与决策，越用越懂用户

**灵感与参考：**
- Claude Code：12 层 Agent 架构的设计对标
- OpenClaw：Gateway 多渠道架构的基础
- pi-mono：极简 Agent 框架（"One loop & Bash is all you need"）
- CoALA 认知架构：记忆分类的参考模型


## 1. 项目身份  [irreducible]
| 字段 | 值 |
|------|-----|
| 项目名称 | ElysiaClaw |
| 代号 | elysiaclaw |
| 一句话描述 | 基于 pi-mono 的多渠道 AI 助手平台，通过 Telegram Bot 提供对标 Claude Code 的自主 agent 能力 |
| 仓库位置 | `github.com/elysiayunchen/pi-mono` |
| 上游来源 | Fork of OpenClaw `v2026.3.13` |
| 维护者 | aoseluo（云尘 / 奈緒）— 非专业程序员，AI 协作开发 |
| 维护模式 | Solo fork，独立维护，不与上游同步 |
| 服务器 | `elysiaserver` — Ubuntu 24.04，Node.js v22.22.1 |
| 运行平台 | Telegram Bot `@ElysiaClaw_Bot`（主渠道） |
| 项目类型 | 全栈：Agent 框架层（pi-mono）+ 应用层（elysiaclaw）+ 多渠道 Gateway |

**两项目结构：**
- `packages/`（pi-mono 框架层）：tui、ai、agent、coding-agent — 4 个核心包
- `elysiaclaw/`（应用层）：渠道适配、应用层工具、Gateway 控制平面、配置系统


## 2. 技术栈  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`packages/*/package.json`、`elysiaclaw/package.json`、`~/.elysiaclaw/elysiaclaw.json`
> 快速命令：`cat packages/coding-agent/package.json | grep -E '"dependencies"|"devDependencies"' -A 20`


## 3. 目录结构  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`ls -la /home/elysia/projects/pi-mono/`、`ls -la packages/`、`ls -la elysiaclaw/src/`
> 快速命令：`find . -maxdepth 2 -type d | sort | head -50`


## 4. 包/服务地图  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`packages/*/package.json`、`elysiaclaw/package.json`
> 核心包：tui（终端 UI）→ ai（LLM API）→ agent（核心循环）→ coding-agent（编码 agent + SDK）


## 5. 核心数据流  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`、`packages/agent/src/agent-loop.ts`
> 关键路径：Telegram → Gateway (WS :18789) → createAgentSession → Agent.runLoop → streamAssistantResponse → executeToolCalls → Telegram reply


## 6. 关键架构决策  [irreducible]

1. **Fork 而非贡献上游** → **原因：** OpenClaw 上游发展方向与个人需求分歧，且需要大量自定义扩展（12 层 Agent 框架、P 系列补丁）→ **后果：** 独立维护，永远不与上游同步；获得完全自主权但需自行处理所有上游更新

2. **Bot vs TUI 双轨工具注册** → **原因：** TUI 模式走 `createPiCodingTools`（加载自定义 pi-coding-agent dist），Bot 模式走 `createElysiaClawCodingTools`（elysiaclaw 自包含 bundle）→ **后果：** 新增工具必须两边验证，这是理解 ElysiaClaw 架构最重要的事实（PITFALLS #17/#54）；两个路径完全独立，部署时需同时更新

3. **pi-agent-core Monkey-patch（P1-A）** → **原因：** 0.64 编译产物缺少 `setSystemPrompt()` 和 `replaceMessages()` 方法，但源码调用了它们 → **后果：** 通过 `scripts/patch-agent.cjs` 手动注入，锚点从 `setAfterToolCall` 改为 `subscribe`；每次 npm install 可能被覆盖，deploy.sh 需验证 patch 存活

4. **Code Mode 废弃 → delegate_code_task 子代理分发** → **原因：** Code Mode（`/code` `/exit`）与 agent 循环耦合复杂，且只需要隔离代码分析上下文 → **后果：** 改用 `spawnSubagentDirect()` 只读子代理，主 agent 保留决策权；子代理只读，修改操作由主 agent 决策后执行

5. **记忆引擎：TS 取代 Python** → **原因：** Python session_search 每次 `spawnSync` 冷启进程做 SQLite LIKE，而现成 TS 引擎支持向量检索 + hybrid + mmr → **后果：** `memory_search` 全面取代 `session_search`，RECALL 注入激活（每轮 system prompt 自动召回 top-5）；Python 代码已清理

6. **认知架构：分层注入 + KV-cache 优化** → **原因：** RECALL 注入在 system prompt 内部（`attempt.ts:1781`），每轮变化导致稳定前缀 KV-cache 全失效 → **后果：** B0-B4 五带分层注入，钉 cache 锚点，易变内容下沉到锚点之后；序 1-7 已完成，序 8 进行中

7. **会话轮换：双轨延续（Handoff + RECALL）** → **原因：** 纯靠记忆检索延续任务会准确性塌陷（设计红线）→ **后果：** 精确执行状态走结构化 Handoff Packet (B3)，背景知识走 memory_search 召回 (B4)；双轨索引（MacroIndex + MicroIndex）

8. **参与者持续性：persistent identity 绑定** → **原因：** 对模型而言"会话/窗口"不存在，唯一单元是 Participant → **后果：** 连续性绑 participant_id；群聊双写；认知图谱只增不减；工作空间只留 active task


## 7. 数据模型  [混合：约束/不变量 = irreducible，schema 位置 = derivable]

### 7.1 核心数据约束与不变量  [irreducible]
| 约束 | 说明 |
|------|------|
| Session 绑定 | 每个 Telegram chat 绑定一个 Conversation，Conversation 下可有多个 Session（轮换） |
| 双轨延续 | Handoff Packet（精确状态）必须与 RECALL（背景召回）同时存在，缺一不可 |
| 记忆引擎 | memory_search 支持 source: memory + sessions，向量检索 + FTS trigram + hybrid |
| 用户画像 | SQLite 持久化，双路径更新（heuristic + LLM 提炼），identity 空对象不触发变更 |
| 工具注册四层 | L1(allTools) → L2(pi-tools.ts) → L3(tool-catalog.ts) → L4(elysiaclaw.json)，四层必须一致 |
| 上下文压缩 | 三层压缩链：snipDeadMessages → microcompact → autoCompactMessages，阈值 80k-90k |
| 注入预算 | B2+B3+B4 注入量计入压缩触发阈值，杜绝"注入→爆窗→压缩→丢注入"反身性空转 |
| KV-cache 锚点 | B0-B2 构成稳定前缀，B3-B4 在锚点之后，易变内容不能出现在稳定内容之前 |

### 7.2 Schema 位置  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`elysiaclaw/src/session-rotation/conversation-types.ts`、`elysiaclaw/src/session-rotation/handoff-types.ts`、`elysiaclaw/src/user-model/`


## 8. 日志与可观测性  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`elysiaclaw logs`、`~/.elysiaclaw/` 日志文件
> 快速命令：`elysiaclaw status`、`elysiaclaw logs --tail 100`


## 9. 外部依赖  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`~/.elysiaclaw/elysiaclaw.json` providers 段
> 关键依赖：OpenRouter（主 provider）、阿里云 Bailian/DashScope、DeepSeek、智谱


## 10. 快速启动  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`deploy.sh`、`package.json` scripts
> 快速命令：
> ```bash
> cd ~/pi-mono && npm run build    # 构建框架层
> cd ~/pi-mono && ./deploy.sh      # 一键部署
> elysiaclaw gateway restart        # 重启 Gateway
> ```
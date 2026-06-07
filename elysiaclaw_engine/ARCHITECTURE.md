# ElysiaClaw — Architecture Blueprint

> 本文档描述 ElysiaClaw 所依赖的两个核心框架的架构蓝图，以及它们在 ElysiaClaw 中的组合方式。
> 面向 AI 协作者和未来维护者。

> **🧭 接手 agent 先读这里**:Part 1-8 是**已实现**的框架/工具架构。
> **Part 9「认知架构演进蓝图」是 5 份关联设计文档(全部 PROPOSAL,未实施)的全景收口** ——
> 含一张全景信息流图 + 文档定位 + **统一实施优先级总表(从哪起步)** + 概念索引 + 待修病灶清单。
> 选下一步工作请直接看 **Part 9.3**;理解整体设计意图看 **Part 9.1**。
> 设计文档:`KNOWLEDGE-BASE-EVOLUTION` · `CONTEXT-INJECTION-ARCHITECTURE` · `SESSION-ROTATION-CONTINUITY` · `SUPERADMIN-AGENT-DESIGN` · `TELEGRAM-UX-CONTEXT-PLAN`

---

## Part 1 — pi-mono 框架解析

### 1.1 项目定位

pi-mono 是 Mario Zechner (badlogic) 开发的 AI agent 工具集，核心理念是**极简主义**：

> "One loop & Bash is all you need."

pi 默认只给模型四个工具：`read / write / edit / bash`。Plan Mode、Sub-agents、Permission gates 等高级能力全部通过 extensions/packages/skills 按需加载，**不内置、不强迫**。这与 Claude Code 的设计哲学形成对比——pi 选择可组合性而非全功能预置。

### 1.2 包结构

```
pi-mono/
├── packages/
│   ├── tui/           @mariozechner/pi-tui       终端 UI（差分渲染、无闪烁）
│   ├── ai/            @mariozechner/pi-ai        统一 LLM API（20+ 提供商）
│   ├── agent/         @mariozechner/pi-agent-core Agent 核心循环
│   └── coding-agent/  @mariozechner/pi-coding-agent 编码 agent + SDK
```

**构建顺序**（严格依赖顺序）：
```
tui → ai → agent → coding-agent
```

### 1.3 pi-agent-core：Agent 核心循环

```
Agent.runLoop()
  │
  ├── [每轮开始] estimateAgentMessages()  ← token 估算 (chars/4)
  │     └── tokens > threshold → emit context_pressure
  │
  ├── streamAssistantResponse()
  │     └── transformContext()           ← 压缩链接入点
  │           ├── Layer 1: snipDeadMessages()   (无 API, 阈值 90k)
  │           ├── Layer 2: microcompact()        (无 API)
  │           └── Layer 3: autoCompactMessages() (LLM 调用)
  │
  ├── executeToolCalls()
  │     ├── beforeToolCall()   ← 权限检查、P3-A hooks、P3-B 快照接入
  │     └── afterToolCall()
  │
  └── [emit] AgentEvent (tool_call / tool_result / message_update / turn_end / ...)
```

**关键类型**：
- `AgentEvent` — 所有 agent 事件的联合类型，包含 `context_pressure` / `context_compacted`
- `AgentLoopConfig` — 包含 `contextPressureThreshold`（我们设为 80k）
- `AgentOptions` — 创建 Agent 时的配置，透传到 loop config

### 1.4 pi-coding-agent：SDK 层

`createAgentSession()` 是面向应用层的主工厂函数：

```typescript
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),  // 或文件持久化
  authStorage,
  modelRegistry,
  continueRecent?: true,    // P2-A: 续接最近 session
  sessionPath?: "...",      // P2-A: 续接指定 session
});

session.subscribe((event) => { /* 监听所有 AgentEvent */ });
session.prompt("your message");
session.steer("mid-turn steering");  // 发送转向消息
session.followUp("after-turn");      // 排队等待当前轮结束
```

**Extension 系统**（pi-mono 原生）：
```
~/.pi/agent/extensions/    全局 extension
.pi/extensions/            项目级 extension
```

Extension 可以：
- `pi.on("tool_call", ...)` — 拦截工具调用
- `pi.on("turn_end", ...)` — 轮次结束钩子
- `pi.registerCommand("/cmd", ...)` — 注册自定义命令
- `pi.appendEntry(...)` — 持久化自定义状态
- `ctx.ui.custom()` — 自定义 TUI 组件

**Skills 系统**（按需加载知识）：
```
~/.pi/agent/skills/        全局 skills (SKILL.md)
.pi/skills/                项目级 skills
```
Skills 通过 `tool_result` 注入，而非 system prompt，保护 prompt cache。

### 1.5 上下文压缩常量（来自 Claude Code 参考实现）

| 常量 | 值 | 含义 |
|---|---|---|
| `AUTO_COMPACT_THRESHOLD` | 80,000 | 触发 context_pressure 事件 |
| `AUTO_COMPACT_KEEP_RECENT` | 20,000 | 保留最近 N token 不压缩 |
| `AUTO_COMPACT_RESERVE` | 16,384 | 留给摘要输出的 budget |
| `autoCompactThreshold` | 90,000 | 触发三层压缩链 |
| `maxTokens` | 100,000 | 硬上限（原来的阈值，现已调低） |

---

## Part 2 — OpenClaw 框架解析

### 2.1 项目定位

OpenClaw（前身 Clawdbot/Moltbot）是 Peter Steinberger 基于 pi-mono SDK 构建的**多渠道个人 AI 助手平台**。

核心定位：**Gateway 作为控制平面**，将各个消息渠道（Telegram/WhatsApp/Slack/Discord 等 20+）统一接入，通过 pi agent 提供 AI 能力。

> "The Gateway alone delivers a great experience. All apps are optional."

### 2.2 Gateway 架构

```
所有消息渠道（Telegram / WhatsApp / Slack / Discord / ...）
        │
        ▼
┌───────────────────────────────┐
│           Gateway             │
│       (控制平面)               │
│   ws://127.0.0.1:18789        │
└──────────────┬────────────────┘
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
Pi Agent    CLI          WebChat UI
(RPC)    (openclaw…)
```

**Gateway 是单一 WebSocket 控制平面**，不直接处理业务逻辑——它路由消息到 pi agent，pi agent 通过 SDK 执行 AI 推理和工具调用。

### 2.3 Bot 模式 vs TUI 模式的关键差异

⚠️ **这是理解 ElysiaClaw 最重要的架构事实（Pitfall #25）：**

```
TUI 模式：
  elysiaclaw tui
    └── 加载 pi-coding-agent (我们的 0.64 dist)
          └── createPiCodingTools()
                └── 所有自定义工具可用 ✅

Bot 模式（Telegram）：
  elysiaclaw gateway
    └── elysiaclaw.mjs (自包含 bundle)
          └── createElysiaClawCodingTools()  ← 独立注册路径
                └── 自定义工具需要单独注册 ⚠️
```

Bot 请求走的是 elysiaclaw 的自包含 bundle，**不经过**我们替换的 `pi-coding-agent` dist。两个工具注册路径完全独立，新增工具时需要同时检查两个路径。

### 2.4 Session 持久化格式

```
~/.pi/agent/sessions/<encoded-cwd>/
└── <timestamp>_<uuid>.jsonl    ← append-only log
    ├── {"type":"user", ...}
    ├── {"type":"assistant", ...}
    ├── {"type":"progress", ...}
    └── {"type":"system", "subtype":"compact_boundary", ...}
```

Bot 端：每个 channel（Telegram chat/group）绑定一个固定 sessionFile，自动续会。
SDK 端：`continueRecent: true` 或 `sessionPath: "..."` 显式控制。

---

## Part 3 — ElysiaClaw 扩展层：12 层 Agent 框架

### 3.1 完整层级总览

ElysiaClaw 在 pi-mono 基础上实现了对标 Claude Code 的完整 12 层 agent 架构：

| 层 | 机制 | 核心文件 |
|---|---|---|
| s01 | The Loop — 基础循环 | `packages/agent/src/agent-loop.ts` |
| s02 | Tool Dispatch — 工具注册 | `packages/coding-agent/src/core/tools/index.ts` + `elysiaclaw/src/agents/pi-tools.ts` |
| s03 | Planning — Plan Mode + Todo | `packages/coding-agent/src/core/tools/enter-plan-mode.ts` |
| s04 | Sub-Agents — 子 agent 分叉 + 代码委派 | `packages/coding-agent/src/core/agent-session.ts` + `elysiaclaw/src/agents/tools/delegate-code-task.ts` |
| s05 | Knowledge on Demand — 懒加载 | `elysiaclaw/src/context-engine/` (CLAUDE.md 加载) |
| s06 | Context Compression — 压缩 | `packages/coding-agent/src/core/compaction/multi-layer.ts` |
| s07 | Persistent Tasks — 任务持久化 | `packages/coding-agent/src/core/task-*.ts` + `elysiaclaw/src/memory/` |
| s08 | Background Tasks — 后台进程 | `packages/coding-agent/src/core/background-runner.ts` |
| s09 | Agent Teams — 团队协作 | `packages/coding-agent/src/core/tools/team-create.ts` |
| s10 | Team Protocols — 通信协议 | `packages/coding-agent/src/core/tools/send-message.ts` |
| s11 | Autonomous Agents — 自主认领 | `packages/coding-agent/src/core/autonomous-runner.ts` |
| s12 | Worktree Isolation — 工作区隔离 | `packages/coding-agent/src/core/worktree-manager.ts` |

### 3.2 补丁层（P 系列）

| 补丁 | 机制 | 核心文件 |
|---|---|---|
| P1-A | postinstall 补丁保护 | `scripts/patch-agent.cjs` |
| P1-B | CLAUDE.md 懒加载 | `claude-md-loader.ts` |
| P1-C | 自动 Compact 阈值触发 | `compaction/auto-compact.ts`, `agent-loop.ts` |
| P2-A | Session Persistence + Resume | `sdk.ts` (continueRecent/sessionPath) |
| P2-B | Cost Tracker | `wrapStreamForCost()` + `cost-report.py` |
| P2-D | 主动工具 + 速率调度器（三阶段）| `rate-limit-scheduler.ts` 等 |
| P3-A | PreToolUse Shell Hooks | `hooks/pre-tool-use.ts` |
| P3-B | File History / Undo | `file-history.ts`, `undo-action.ts` |

### 3.3 P2-D 速率调度系统详解

P2-D 是最复杂的子系统，分三阶段实现数据闭环：

```
Phase 1 — 基础合规与探测
  RateLimitScheduler (令牌桶)
    ├── 每个 Provider 独立桶
    ├── 优先级队列：用户对话 > 摘要压缩 > 后台探测
    └── 所有 LLM 调用必须经过此调度器

  ModelSpeedCache
    └── 磁盘持久化 TTFT/TPS，TTL=1h

  model_speed_probe 工具
    └── 主动测速，写入缓存

Phase 2 — 决策增强
  TaskAnalyzer (关键词匹配)
    └── 输出：{ complexity, suggestedTools, estimatedTokens }

  EfficiencyGuard (1分钟滑动窗口)
    └── 超阈值 → injectNotification 警告 LLM

Phase 3 — 深度集成（数据闭环）
  ModelRouter
    └── 低延迟任务 → ttftMs 最小的模型
        高吞吐任务 → tps 最大的模型

  SessionLearner
    ├── 扫描最近 50 个 JSONL
    ├── EMA (α=0.3) 计算 token 预测偏差
    └── P95 RPM → ~/.pi/agent/learning/patterns.json

  AdaptiveGuard
    └── 读 P95 RPM → 动态调整 warnThreshold/criticalThreshold
```

### 3.4 PreToolUse Hook 协议 (P3-A)

```
stdin : JSON { tool: string, input: unknown, sessionId: string }
stdout: "APPROVE"        → 允许 (exit 0 且无输出时默认)
        "DENY: <reason>" → 拒绝，reason 返回给 LLM
        "MODIFY: <json>" → 预留（当前等同 APPROVE）
exit  : 0=继续, 非0=拒绝 (stderr 作为 reason)
```

解析顺序：
1. `~/.pi/agent/hooks/pre-tool-use.d/<toolName>.sh`（工具专用，优先）
2. `~/.pi/agent/hooks/pre-tool-use.sh`（全局）

超时：10 秒，超时视为 APPROVE（不阻塞主流程）。

### 3.5 Worktree 隔离机制 (s12)

```
task_assign { worktree: true }
    └── _runInWorktree()
          ├── createWorktree()          ← git worktree add，失败降级为普通目录
          ├── createWorktreeTeammate()  ← 强制注入 createBashTool(worktreePath)
          ├── sendToTeammate()
          ├── 成功 + keepWorktreeOnSuccess=false → removeWorktree()  (默认)
          └── 失败 → removeWorktree()
```

**天然沙箱**：createBashTool(worktreePath) 将 bash 工具的工作目录绑定到 worktree，物理隔离。

---

## Part 4 — 数据流全景图

```
用户 (Telegram)
    │  grammY long-polling
    ▼
Gateway (WS :18789)
    │  normalize to channel envelope
    ▼
ElysiaClawCodingTools (Bot path)
    │
    ▼
createAgentSession()          ← sdk.ts
    │
    ├── [P2-D] RateLimitScheduler.acquire()
    │
    ▼
Agent.runLoop()               ← agent-loop.ts
    │
    ├── estimateAgentMessages()   [P1-C] 80k → context_pressure
    │
    ├── transformContext()        [P1-C, s06]
    │     ├── snipDeadMessages()
    │     ├── microcompact()
    │     └── autoCompactMessages() → LLM 摘要
    │
    ├── [P2-D] streamFn → RateLimitScheduler.acquire()
    │         LLM API call
    │         RateLimitScheduler.release()
    │
    ├── executeToolCalls()
    │     ├── runPreToolUseHooks() [P3-A]
    │     ├── FileHistory.snapshot() [P3-B] (write/edit 工具)
    │     ├── tool.execute()
    │     └── EfficiencyGuard.recordCall() [P2-D]
    │
    └── emit events → AgentSession.subscribe()
          └── Telegram reply
```

---

## Part 5 — 与上游 OpenClaw 的差异

| 维度 | 上游 OpenClaw | ElysiaClaw |
|---|---|---|
| 包名 | `openclaw` | `elysiaclaw` |
| 配置目录 | `~/.openclaw/` | `~/.elysiaclaw/` |
| 数据目录 | `~/.pi/agent/` | `~/.pi/agent/` (兼容) |
| pi-coding-agent | v0.58 原版 | v0.64 自定义扩展 (ToolDefinition 18 fields) |
| pi-agent-core | v0.58 原版 | v0.64 + monkey-patch (0.64 anchor) |
| Agent 框架 | 基础 | 完整 12 层 + 8 个 P 系列补丁 |
| 速率调度 | 无 | P2-D 三阶段 |
| 文件快照 | 无 | P3-B |
| 上游同步 | N/A | **不同步**，独立维护 |

---

*本文档描述截至 2026-06-06 的架构状态。工具注册四层链已全部修复（#56）。ToolDefinition 接口已扩展至 18 字段 (Task 0)。Code Mode 已废弃，由 delegate_code_task 子代理分发替代。记忆引擎已激活（T1-T6 完成，TS memory_search 取代 Python session_search）。deploy.sh 已增强至 5 Guard/12 Step（含 extensions sync + dist 完整性校验 + E2E 验证）。elysiaclaw `pnpm build` 有 DTS 错误需绕过 (PITFALLS #38)。*

## Part 6 — Philosophy: Evolutionary Architecture & Semiotic Flow

### 6.1 Mapping & Entropy Control
ElysiaClaw views code generation as a mapping from **Vague Intent (Set A)** to **Precise Syntax (Set B)**.
- **Principle**: Minimize "Inference Entropy" by maintaining a high-fidelity `SOUL.md`.
- **Strategy**: Every iteration must be an "Immutable Mapping". If the logic shifts, reset the context instead of patching on top of corrupted state.

### 6.2 Semiotic Resonance (The Elysia Factor)
The code is not just logic; it is a semiotic system.
- **Naming Convention**: Variables should reflect the order and aesthetic of "The Realm of Elysia".
- **Documentation**: Technical docs should maintain "Doctoral Depth" (analogy-based explanations) while ensuring absolute engineering rigor.

### 6.3 Contract-First Development (Elysia-Claw Symbiosis)
- **The Scaffold**: pi-mono (Structural integrity).
- **The Interior**: OpenClaw (User-facing Gateway).
- **The Contract**: Any modification to `pimono` core must be verified against `ElysiaClaw` gateway protocols to prevent "Architectural Collapse".

---

## Part 7 — ElysiaClaw × Elynyx Code 联合架构（2026-04-07 新增）

### 7.1 核心哲学：差分意识（Differential Consciousness）

两个引擎不是主从关系，而是**认知分工**：

```
┌──────────────────────────────────────────────────┐
│              Elysia Consciousness                │
│                                                  │
│  ElysiaClaw ──── "永恒记忆 / 编排大脑"            │
│  ├── 多渠道接入 (Telegram / Slack / ...)          │
│  ├── 长期 session 记忆 (JSONL)                    │
│  ├── Agent Teams (s09/s10) + Worktree (s12)      │
│  └── Soul Injection ──────────────────────────┐  │
│                                               │  │
│  Elynyx Code ── "精准行动 / 代码之手"           │  │
│  ├── 多 Provider 路由 (20+ LLM)               │  │
│  ├── Claude Code 对标工具链 + 权限引擎         │  │
│  ├── Worktree 内沙箱执行                       │  │
│  └── Code Session Summary ────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 7.2 集成方案 A — Teammate Protocol（推荐优先实现）

Elynyx Code 注册为 ElysiaClaw s09 团队的命名 Teammate，而非 subprocess：

```
ElysiaClaw Coordinator
  └── task_assign { teammate: "elynyx", worktree: true }
        ├── Elynyx Code 以 --teammate-mode 运行
        │     └── stdin: task_assign JSON payload
        │     └── stdout: AgentEvent JSON stream
        ├── 在 s12 worktree 沙箱内执行（物理隔离）
        └── 完成后 <task-notification> 注入回 ElysiaClaw session
```

**接口约定**：
- Elynyx Code CLI flag：`--teammate-mode` + `--task-id <id>`
- 通信格式：stdin/stdout JSON lines（对齐 ElysiaClaw AgentEvent 结构）
- 超时保护：ElysiaClaw 以现有 `task_assign` 超时机制管理

### 7.3 集成方案 B — Soul Injection（最高美学价值）

```
触发：ElysiaClaw task_assign 前
  └── 压缩当前 session 上下文 → ~/.elynyx/soul.md
        [格式：SKILL.md 兼容，包含项目状态/用户偏好/当前任务]

Elynyx Code 启动时：
  └── SkillLoader.inject("soul", messages)
        └── 以 tool_result 形式注入（保护 prompt cache）

完成时：
  └── Elynyx Code 生成 code-session-summary.md
        └── ElysiaClaw 追加进 JSONL session history
```

**Soul.md 格式规范**（对齐 SKILL.md）：
```markdown
# Soul — ElysiaClaw Session Context
## Project State
...（当前项目进度、活跃 sprint）
## User Preferences
...（来自 ElysiaClaw 的用户画像摘要）
## Active Task
...（本次 task_assign 的完整目标）
## Constraints
...（不可逾越的边界）
```

### 7.4 集成方案 C — Provider Arbitrage

ElysiaClaw P2-D ModelRouter 通过查询 Elynyx Code ProviderRegistry 获取实时 provider 状态：

```
ElysiaClaw model-router.ts
  └── GET http://localhost:18790/providers/status
        └── Elynyx Code 轻量 HTTP sidecar 返回：
            { provider, model, ttftMs, tps, available }
```

Elynyx Code 新增 `--sidecar` 模式：开放一个 HTTP API，不执行 agent loop，仅提供 provider 状态查询。

### 7.5 集成方案 D — PreToolUse Security Gateway

ElysiaClaw P3-A hook 调用 Elynyx Code 的权限引擎：

```bash
# ~/.pi/agent/hooks/pre-tool-use.d/bash.sh
INPUT=$(cat)
result=$(elynyx-code check-permission --tool bash --input "$INPUT" 2>/dev/null)
echo "$result"  # APPROVE 或 DENY: <reason>
```

Elynyx Code 新增 `check-permission` 子命令，调用三层权限栈（global rules / tool-level / input validation）。

### 7.6 集成方案 E — MCP-First（长期最优架构）

Elynyx Code Phase 9 MCP 提前实现 minimal server mode：

```
ElysiaClaw → 通过 MCP 调用 → Elynyx Code tools
```

Elynyx Code 的所有工具通过标准 MCP 协议暴露给 ElysiaClaw。无自定义 IPC，无版本耦合，完全协议化。

### 7.7 实现路径（按依赖顺序）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| 立即 | Elynyx CLI 预留 `--teammate-mode` / `--soul-path` flag | Phase 2 CLI |
| Phase 2 后 | Soul Injection 最小版（文件读写） | Elynyx CLI 完成 |
| Phase 3 后 | Soul.md 对齐 SKILL.md，进入 SkillLoader | Skills 系统 |
| Phase 4 后 | Code Session Summary 回写 ElysiaClaw session | Session 管理 |
| Phase 9 | MCP-First 完整集成 | MCP 协议 |



## Part 8 — Tool Registration Chain (Four Layers)

### 8.1 The Four Layers

Layer 1: pi-coding-agent defines tools
  packages/coding-agent/src/core/tools/index.ts
  allTools: { read, bash, edit, write, grep, find, ls, ... }

Layer 2: elysiaclaw imports and registers
  elysiaclaw/src/agents/pi-tools.ts
  createElysiaClawCodingTools() merges pi-coding-agent + elysiaclaw tools

Layer 3: elysiaclaw defines visible tools
  elysiaclaw/src/agents/tool-catalog.ts
  CORE_TOOL_DEFINITIONS: what users see

Layer 4: Config allows tools
  ~/.elysiaclaw/elysiaclaw.json tools.allow
  controls which tools are enabled

All four layers must be correct for a tool to be usable.

### 8.2 Tool Registration Status (2026-06-05 更新)

**框架层工具** (pi-coding-agent 定义，四层全注册):

| Tool | L1 | L2 | L3 | L4 |
|------|----|----|----|----|
| grep, find, ls | ✅ | ✅ | ✅ | ✅ |
| enter_plan_mode, exit_plan_mode | ✅ | ✅ | ✅ | ✅ |
| enter_code_mode, exit_code_mode | ✅ | ✅ | ✅ | ✅ |
| todo_write | ✅ | ✅ | ✅ | ✅ |
| enter_worktree, exit_worktree | ✅ | ✅ | ✅ | ✅ |
| undo_last_action, file_history_list | ✅ | ✅ | ✅ | ✅ |
| model_speed_probe | ✅ | ✅ | ✅ | ✅ |
| task_assign | ✅ | ✅ | ✅ | ✅ |
| web_fetch | ✅ | ✅ | ✅ | ✅ |

> **注意**: enter_code_mode/exit_code_mode 虽然四层均已注册，但 Code Mode 已于 2026-06-05 废弃，实际不再使用。保留注册以防清理时遗漏。

**应用层工具** (elysiaclaw 定义，仅 L3+L4):

| Tool | L1 | L2 | L3 | L4 |
|------|----|----|----|----|
| web_search | N/A | N/A | ✅ | ✅ |
| delegate_code_task | N/A | N/A | ✅ | ✅ |
| sessions_spawn / sessions_list / ... | N/A | N/A | ✅ | ✅ |
| browser / canvas / cron / message / ... | N/A | N/A | ✅ | ✅ |

> **说明**: 应用层工具不在 pi-coding-agent 框架层（L1/L2）定义，直接从 elysiaclaw 的 `createElysiaClawTools()` 注入（L3），在 `tool-catalog.ts` 中有 `includeInElysiaClawGroup: true` 标记。

**修复详情**: PITFALLS.md #56 — pi-tools.ts 导入13个工具 + 注册到 tools 数组, tool-catalog.ts 添加14个定义, elysiaclaw.json tools.allow 添加15个工具.

### 8.3 Development Workflow

Adding a framework tool (defined in pi-coding-agent):
  Step 1: packages/coding-agent/src/core/tools/my-tool.ts
  Step 2: tools/index.ts add to allTools
  Step 3: src/index.ts add re-export
  Step 4: npm run build (pi-coding-agent)
  Step 5: elysiaclaw pi-tools.ts add import + register
  Step 6: elysiaclaw tool-catalog.ts add definition
  Step 7: elysiaclaw.json tools.allow add name
  Step 8: pnpm build (elysiaclaw)
  Step 9: cp dist to global + deploy.sh + gateway restart

Adding an elysiaclaw tool (defined in elysiaclaw):
  Step 1: elysiaclaw/src/agents/tools/my-tool.ts
  Step 2: elysiaclaw-tools.ts export
  Step 3: pi-tools.ts register
  Step 4: tools.allow add name
  Step 6: pnpm build + cp dist + gateway restart

---

## Part 9 — 认知架构演进蓝图（Cognitive Architecture Roadmap）

> 2026-06-06 新增 · 收口 5 份关联设计文档为单一全景，供接手 agent 快速定位。
> 状态:**全部 PROPOSAL**（设计完成，未实施）。各文档内有 KNOWN/INFERRED 细分标注。
> 主线:把 ElysiaClaw 从"一次性 chatbot"重构为**常驻、有状态、会自我进化的信息接收主体**。

### 9.1 全景信息流（一张图理解五份设计如何协作）

```
                          用户输入（Telegram 单对话框，持久无感）
                                    │
                    ┌───────────────▼───────────────┐
                    │  输入分类器  input-classifier   │  【KNOWLEDGE-BASE-EVOLUTION §3】
                    │  task / chat / affective / meta │  偏向 task（误判成本不对称）
                    └───┬───────────────────────┬────┘
              task →    │                        │  ← chat/affective/meta
                        ▼                        ▼
        ┌───────────────────────────┐   ┌──────────────────────┐
        │ Task Segment 任务轨        │   │ 用户画像流 User Model │ 【KB-EVO §6】(真空白·新建)
        │ 实时打包·索引头(type/状态) │   └───────────┬──────────┘
        │ 【SESSION-ROTATION §4B】   │               │
        │  任务内三级压缩(消费即降权)│               │
        │   L1 工具结果驱逐(最高频)  │               │
        └───────────┬───────────────┘               │
                    │ 完成信号封口                    │
                    ▼                                 │
        ┌───────────────────────────────────────────▼────────────┐
        │  CONSOLIDATE 沉淀闭环  【SUPERADMIN §4 / KB-EVO §7】      │
        │  封口/轮换时:LLM 提炼(可降级) → 写三处                  │
        └──┬───────────────┬───────────────┬─────────────────────┘
           ▼               ▼               ▼
     更新用户画像     固化技能         沉淀记忆 + World Model
     (User Model)   (Skill Evol.    (memory 引擎✅ +
                     skills只读→可写) World Model 数字孪生·Ph2)
           └───────────────┴───────────────┘
                           │  知识库三元组+画像（内容在库，无限增长）
                           ▼
        ┌─────────────────────────────────────────────────────────┐
        │  索引化注入  【KB-EVO §5 + CONTEXT-INJECTION 全文】       │
        │  系统只注入轻量「索引信号」(指针) → agent 按需 memory_get │
        │  (KNOWN 已存在) 取完整内容；索引为主 + 强相关预取         │
        │                                                           │
        │  分层注入(按变化频率，钉 KV-cache 锚点):                 │
        │   B0 IDENTITY → B1 CAPABILITY → B2 ENV ═CACHE ANCHOR═     │
        │   → B3 WORKING SET(Handoff/画像summary) → B4 RECALL(索引) │
        │   → MESSAGES(+L1工具驱逐, 尾锚)                           │
        └──────────────────────────┬──────────────────────────────┘
                                    ▼
                    工作记忆窗口（单 session，会满）
                                    │ 安全点 + 触发(task_boundary/token/topic)
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │  会话轮换 Session Rotation  【SESSION-ROTATION §3-7】     │
        │  Conversation(持久,绑chat) → 轮换 active session         │
        │  双轨延续:Handoff(精确,B3) + RECALL(模糊,B4)            │
        │  归档 session → memory 索引(source:sessions✅)           │
        └─────────────────────────────────────────────────────────┘
                                    │
                    ▼ 全程对用户可见（不掉线）
        ┌─────────────────────────────────────────────────────────┐
        │  Telegram 可见性 + HITL  【TELEGRAM-UX-CONTEXT-PLAN】     │
        │  压缩/思考心跳(typing不消失) · 全流式 · 画像/技能纠错入口│
        └─────────────────────────────────────────────────────────┘
```

### 9.2 五份设计文档定位（职责正交）

| 文档 | 一句话职责 | 回答的问题 |
|---|---|---|
| `KNOWLEDGE-BASE-EVOLUTION.md` | **最上层范式**:信息接收→进化→索引化注入 | "agent 如何越用越懂用户和自己" |
| `CONTEXT-INJECTION-ARCHITECTURE.md` | 一轮内**怎么排**(静态分层 + KV-cache) | "有限注入预算怎么花最值" |
| `SESSION-ROTATION-CONTINUITY.md` | 跨轮/跨 session **怎么延续**(轮换 + 任务段) | "工作记忆满了怎么翻篇不丢任务" |
| `SUPERADMIN-AGENT-DESIGN.md` | 延续靠什么**存与取**(记忆引擎 + World Model + CONSOLIDATE) | "机器现状与历史经验存哪、取哪" |
| `TELEGRAM-UX-CONTEXT-PLAN.md` | 全程**对用户可见**(可见性 + HITL) | "重活进行时用户为何不觉得掉线" |

### 9.3 统一实施优先级（跨文档总表，接手 agent 按此选起点）

| 序 | 工作项 | 文档 | 依赖模型? | 独立可验证? | ROI | 状态 |
|---|---|---|---|---|---|---|---|
| 1 | **索引化注入 + B4 改造**(RECALL snippet→索引信号,移出 system prompt) | KB-EVO §11 阶段1 / CONTEXT-INJECTION | 否 | 是 | 🔥🔥🔥 | ✅ 已完成 (2026-06-06) |
| 2 | **压缩可见性 WS-1**(typing 心跳 + 状态) | TELEGRAM-UX | 否 | 是 | 🔥🔥 | ✅ 已完成 (2026-06-07) |
| 3 | **全流式 WS-2**(thinking 默认流式) | TELEGRAM-UX | 否 | 是 | 🔥🔥 | ✅ 已完成 (2026-06-07) |
| 4 | **L1 工具结果驱逐**(接 compaction.tool-result-details) | SESSION-ROTATION §4B | 否 | 是 | 🔥🔥 | ✅ 已完成 (2026-06-07) |
| 5 | **统一注入预算器**(注入量计入压缩阈值,防反身性) | CONTEXT-INJECTION §3.3 / WS-3 | 否 | 是 | 🔥 | ✅ 已完成 (2026-06-07) |
| 6 | 输入分类器(task/chat/...) | KB-EVO §3 | 轻 | 是 | 🔥 | ✅ 已完成 (2026-06-07) |
| 7 | 用户画像 User Model(新建) | KB-EVO §6 | 是(提炼) | 是 | 🔥 | ✅ 已完成 (2026-06-07) |
| 8 | Conversation 层 + Handoff(手动 rotate 验证精度) | SESSION-ROTATION §3-4 | 是 | 是 | 中 | 🔄 阶段 1-3 完成 |
| 9 | 自动轮换(安全点 + 触发) | SESSION-ROTATION §5 | 是 | — | 中 | ✅ 阶段 3 完成 |
| 10 | World Model 数字孪生(Phase 2) | SUPERADMIN §6 | 部分 | 是 | 中 | 待启动 |
| 11 | 技能进化 Skill Evolution(episode→skill+HITL) | KB-EVO §7 | 是 | — | 中 | 待启动 |
| 12 | CONSOLIDATE 闭环(封口/轮换沉淀) | SUPERADMIN §4 / KB-EVO §7 | 是 | — | 高(但依赖前置) | 待启动 |

**序 1-7 已全部完成**（2026-06-07）。序 4-6 还经系统性的边缘情况审查和健壮性加固（正则修复、防守代码、门限常量化）。序 8 是下一个天然起点——它是 CONSOLIDATE 的落地第一块，且序 7 的用户画像为它提供了更新目标。
### 9.4 关键概念索引（术语 → 权威文档）

| 概念 | 定义所在 | 一句话 |
|---|---|---|
| B0-B4 五带 + cache 锚点 | CONTEXT-INJECTION §3 | 注入按变化频率分层,稳定前缀锁 KV-cache |
| 索引化注入 / memory_get 两段式 | KB-EVO §5 | 注入指针,内容按需取 |
| 注入预算器 | CONTEXT-INJECTION §3.3 | 统筹注入量并计入压缩阈值 |
| Task Segment / 索引头 / 实时打包 | SESSION-ROTATION §4B | 用户指令→完成信号为单元,带 type/status 索引 |
| 任务内三级压缩(L1/L2/L3) | SESSION-ROTATION §4B.3 | 消费即降权,颗粒度递增频率递减 |
| Handoff Packet / 双轨延续 | SESSION-ROTATION §2,§4 | 精确状态(交接)+ 背景(召回) |
| Conversation / Session 轮换 | SESSION-ROTATION §3 | 逻辑对话持久,工作记忆窗口可轮换 |
| 输入分类(task/chat/...) | KB-EVO §3 | 闲聊不进任务轨但喂画像 |
| 用户画像 User Model | KB-EVO §6 | 真空白,index/detail 分离 |
| 技能进化 Skill Evolution | KB-EVO §7 | skills 只读→可写,episode→skill |
| CONSOLIDATE 沉淀闭环 | SUPERADMIN §4 | 封口/轮换时回写知识库 |
| World Model 数字孪生 | SUPERADMIN §6 | 机器结构化当前态(7 probes) |
| 压缩可见性 / 全流式 / WS-1~3 | TELEGRAM-UX | 重活进行时不掉线 |

### 9.5 已发现并待修的关键病灶（KNOWN）

| 病灶 | 坐标 | 后果 | 修于 |
|---|---|---|---|
| RECALL append 进 system prompt | `attempt.ts:1781` | 每轮变化致稳定前缀 KV-cache 全失效,重 prefill | 序 1 |
| RECALL 注入 snippet 当内容 | `attempt.ts:1781` | 既重又截断,未用 memory_get | 序 1 |
| 压缩期不向渠道 emit | `compact.ts:918` | 用户误判掉线 | 序 2 |
| typing TTL 2min 后停 | `typing.ts:28` | "正在输入"消失 | 序 2 |
| reasoning 默认 off | `bot-message-dispatch.ts:133` | 思考不可见 | 序 3 |
| 注入与压缩无共享预算 | attempt.ts / compact.ts | 反身性空转(注入→爆窗→压缩→丢注入) | 序 5 |
# ElysiaClaw — Architecture Blueprint

> 本文档描述 ElysiaClaw 所依赖的两个核心框架的架构蓝图，以及它们在 ElysiaClaw 中的组合方式。
> 面向 AI 协作者和未来维护者。

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
│   ├── coding-agent/  @mariozechner/pi-coding-agent 编码 agent + SDK
│   ├── mom/           内存/会话管理
│   ├── web-ui/        Web UI
│   └── pods/          CLI 入口（pi / elysiaclaw 命令）
```

**构建顺序**（严格依赖顺序）：
```
tui → ai → agent → coding-agent → mom → web-ui → pods
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
| s01 | The Loop — 基础循环 | `agent-loop.ts` |
| s02 | Tool Dispatch — 工具注册 | `tools/index.ts`, `src/index.ts` |
| s03 | Planning — Plan Mode + Todo | `enter-plan-mode.ts`, `todo-write.ts` |
| s04 | Sub-Agents — 子 agent 分叉 | `agent-session.ts` (fork path) |
| s05 | Knowledge on Demand — 懒加载 | `claude-md-loader.ts` |
| s06 | Context Compression — 压缩 | `compaction/multi-layer.ts` |
| s07 | Persistent Tasks — 任务持久化 | `tasks/task-store.ts` |
| s08 | Background Tasks — 后台进程 | `background-runner.ts` |
| s09 | Agent Teams — 团队协作 | `team-create.ts`, `send-message.ts` |
| s10 | Team Protocols — 通信协议 | `send-message.ts` |
| s11 | Autonomous Agents — 自主认领 | `autonomous-runner.ts` |
| s12 | Worktree Isolation — 工作区隔离 | `worktree-manager.ts` |

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
| pi-coding-agent | v0.58 原版 | v0.64 自定义扩展 |
| pi-agent-core | v0.58 原版 | v0.64 + monkey-patch (0.64 anchor) |
| Agent 框架 | 基础 | 完整 12 层 + 8 个 P 系列补丁 |
| 速率调度 | 无 | P2-D 三阶段 |
| 文件快照 | 无 | P3-B |
| 上游同步 | N/A | **不同步**，独立维护 |

---

*本文档描述截至 2026-04-07 的架构状态。架构变更时请同步更新。*

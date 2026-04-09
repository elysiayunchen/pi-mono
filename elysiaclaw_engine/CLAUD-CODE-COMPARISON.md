# Claude Code vs ElysiaClaw — 逐层对标分析

> 基于 Claude Code v2.1.88 源码分析（`/home/elysia/pi-mono/claude-code-source-code-main/src`）
> 与 ElysiaClaw 0.64 自研扩展的逐层机制对比。
> 面向 AI 协作者和未来维护者，用于指导功能补全和架构演进。

---

## 对标总览

| 层 | 机制 | Claude Code | ElysiaClaw | 对等度 |
|---|---|---|---|---|
| s01 | The Loop | `query.ts` while-true 循环 | `agent-loop.ts` Agent.runLoop() | ✅ 对等 |
| s02 | Tool Dispatch | `buildTool()` factory + registry | `ToolDefinition` + `createXxxTool()` | ✅ 对等 |
| s03 | Planning | EnterPlanMode/ExitPlanMode + TodoWrite | enter_plan_mode/exit_plan_mode + todo_write | ✅ 对等 |
| s04 | Sub-Agents | AgentTool + forkSubagent (进程级) | agent-session.ts fork path (同进程) | ⚠️ 部分 |
| s05 | Knowledge on Demand | SkillTool + CLAUDE.md 懒加载 | claude-md-loader.ts + skills 系统 | ✅ 对等 |
| s06 | Context Compression | autoCompact + snipCompact + contextCollapse | 三层压缩链 (snip/microcompact/auto) | ⚠️ 部分 |
| s07 | Persistent Tasks | TaskCreate/Update/Get/List | task-create/update/get/list | ✅ 对等 |
| s08 | Background Tasks | DreamTask + LocalShellTask (daemon) | background-runner.ts (singleton) | ⚠️ 部分 |
| s09 | Agent Teams | TeamCreate/Delete + InProcessTeammateTask | team-create/delete + send-message | ✅ 对等 |
| s10 | Team Protocols | SendMessageTool (request-response) | send-message.ts | ✅ 对等 |
| s11 | Autonomous Agents | coordinatorMode (idle 认领) | autonomous-runner.ts (claimAndRun) | ✅ 对等 |
| s12 | Worktree Isolation | EnterWorktree/ExitWorktree (git worktree) | worktree-manager.ts (git worktree) | ✅ 对等 |

**图例**: ✅ 对等 = 功能覆盖；⚠️ 部分 = 有实现但机制有差距；❌ 缺失 = 未实现

---

## s01 — The Loop（基础循环）

### Claude Code

- **文件**: `query.ts` (~785KB，最大文件)
- **核心模式**: `while(true)` 循环，调用 Claude API → 检查 `stop_reason` → 执行工具 → 追加结果 → 循环
- **流式处理**: 全链路 AsyncGenerator streaming，从 API 到 consumer
- **错误处理**: 分类错误（rate limit / overload / network），自动重试 + 指数退避

User → messages[] → Claude API → response
↓
stop_reason == "tool_use"?
yes → execute tools → append tool_result → loop
no → return text

text
text

### ElysiaClaw

- **文件**: `packages/agent/src/agent-loop.ts`
- **核心模式**: `Agent.runLoop()`，相同 while-true + tool_use 检查
- **流式处理**: `streamAssistantResponse()` + `streamFn` (可插拔)
- **P2-D 集成**: 所有 LLM 调用经过 `RateLimitScheduler.acquire()`
- **P1-C 集成**: 每轮开始 `estimateAgentMessages()` → token 超阈值触发 `context_pressure`

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 循环结构 | while-true + stop_reason 检查 | 相同 |
| 流式 | 全链路 AsyncGenerator | subscribe 事件模型 |
| 错误重试 | 内置分类 + 指数退避 | 内置（agent-loop.ts） |
| 速率调度 | 无内置（依赖 API 限流） | P2-D 令牌桶调度器 ✅ 优势 |
| Token 预算 | 无内置 | P1-C context_pressure ✅ 优势 |

**结论**: ✅ 对等。ElysiaClaw 在速率调度和 token 管理方面有额外优势。

---

## s02 — Tool Dispatch（工具注册）

### Claude Code

- **文件**: `Tool.ts` + `tools.ts`
- **核心模式**: `buildTool(definition)` 工厂函数，每个工具注册到 dispatch map
- **工具接口**: 6 个生命周期方法 + 4 个能力声明 + 4 个渲染方法 + 3 个 AI 面向方法
- **工具数量**: 40+ 内置工具

buildTool(definition) → Tool<Input, Output, Progress>
├── validateInput() → 早期拒绝无效输入
├── checkPermissions() → 工具级授权
├── call() → 执行
├── isConcurrencySafe() → 能否并行
├── isReadOnly() → 无副作用？
├── isDestructive() → 不可逆？
└── prompt() → LLM 描述

text
text

### ElysiaClaw

- **文件**: `packages/coding-agent/src/tools/index.ts` + `src/index.ts`
- **核心模式**: `ToolDefinition` 接口 + `createXxxTool()` 工厂
- **工具数量**: 31 个导出工具

**已实现工具映射**:

| Claude Code 工具 | ElysiaClaw 工具 | 状态 |
|---|---|---|
| FileReadTool | readToolDefinition | ✅ |
| FileEditTool | editToolDefinition | ✅ |
| FileWriteTool | writeToolDefinition | ✅ |
| BashTool | bashToolDefinition | ✅ |
| GlobTool | findToolDefinition | ✅ |
| GrepTool | grepToolDefinition | ✅ |
| EnterPlanModeTool | enterPlanModeToolDefinition | ✅ |
| ExitPlanModeTool | exitPlanModeToolDefinition | ✅ |
| TodoWriteTool | todoWriteToolDefinition | ✅ |
| AgentTool | (无直接对应，通过 agent-session fork) | ⚠️ |
| TaskCreateTool | taskCreateToolDefinition | ✅ |
| TaskUpdateTool | taskUpdateToolDefinition | ✅ |
| TaskGetTool | taskGetToolDefinition | ✅ |
| TaskListTool | taskListToolDefinition | ✅ |
| TaskStopTool | taskStopToolDefinition | ✅ |
| TaskOutputTool | taskOutputToolDefinition | ✅ |
| TeamCreateTool | teamCreateToolDefinition | ✅ |
| TeamDeleteTool | teamDeleteToolDefinition | ✅ |
| TeamListTool | teamListToolDefinition | ✅ |
| SendMessageTool | sendMessageToolDefinition | ✅ |
| EnterWorktreeTool | enterWorktreeToolDefinition | ✅ |
| ExitWorktreeTool | exitWorktreeToolDefinition | ✅ |
| WebFetchTool | (无) | ❌ |
| WebSearchTool | (无) | ❌ |
| MCPTool | (无) | ❌ |
| SkillTool | (无独立工具，通过 skills 系统) | ⚠️ |
| LSPTool | (无) | ❌ |
| AskUserQuestionTool | (无) | ❌ |
| ConfigTool | (无) | ❌ |
| ScheduleCronTool | (无，Roadmap P3-C) | ❌ |
| SleepTool | (无) | ❌ |
| PowerShellTool | (无) | ❌ |
| NotebookEditTool | (无) | ❌ |

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 工厂数 | 40+ | 31 |
| 并行执行 | StreamingToolExecutor（自动分区） | 串行执行 |
| 渲染层 | React/Ink 组件（4 个渲染方法） | 无渲染层（TUI 由 pi-tui 处理） |
| 能力声明 | isReadOnly/isDestructive/interruptBehavior | 无显式声明 |
| MCP 集成 | 完整 MCP 协议支持 | ❌ 缺失 |

**结论**: ⚠️ 核心工具对等，但缺少 Web、MCP、LSP、交互类工具。并行执行是关键差距。

---

## s03 — Planning（计划模式）

### Claude Code

- **工具**: `EnterPlanModeTool` / `ExitPlanModeTool` / `TodoWriteTool`
- **机制**: 进入 Plan Mode 后，LLM 先列出步骤清单，用户确认后逐步执行
- **效果**: 文档称"doubles completion rate"

### ElysiaClaw

- **工具**: `enterPlanModeToolDefinition` / `exitPlanModeToolDefinition` / `todoWriteToolDefinition`
- **机制**: 相同的 Plan Mode + Todo 清单模式

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| Plan Mode | ✅ | ✅ |
| TodoWrite | ✅ | ✅ |
| 权限模式切换 | Plan Mode 自动切换为 alwaysAsk | 未明确实现 |

**结论**: ✅ 对等。

---

## s04 — Sub-Agents（子 Agent）

### Claude Code

- **工具**: `AgentTool` + `forkSubagent.ts`
- **spawn 模式**:
  - `default`: 同进程，共享对话
  - `fork`: 子进程，fresh messages[]，共享文件缓存
  - `worktree`: 隔离 git worktree + fork
  - `remote`: bridge 到 Claude Code Remote / 容器
- **通信**: SendMessageTool 异步邮箱

### ElysiaClaw

- **文件**: `packages/coding-agent/src/core/agent-session.ts` (fork path)
- **spawn 模式**:
  - 同进程 fork（通过 `createAgentSession`）
  - worktree 隔离（s12）
- **通信**: send-message.ts

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 进程级 fork | ✅ (child process) | ❌ (同进程) |
| Remote agent | ✅ (bridge) | ❌ |
| 共享缓存 | ✅ (fork 共享文件缓存) | ❌ |
| Worktree 隔离 | ✅ | ✅ |

**结论**: ⚠️ 功能覆盖但缺少进程级 fork 和 remote agent。对于个人使用场景影响有限。

---

## s05 — Knowledge on Demand（知识懒加载）

### Claude Code

- **工具**: `SkillTool`
- **机制**: CLAUDE.md 文件按目录懒加载，通过 `tool_result` 注入而非 system prompt
- **优势**: 保护 prompt cache，只在需要时加载知识

### ElysiaClaw

- **文件**: `packages/coding-agent/src/core/claude-md-loader.ts`
- **机制**: 相同的 CLAUDE.md 懒加载 + skills 系统（`~/.pi/agent/skills/`）
- **注入方式**: 同样通过 tool_result 注入

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| CLAUDE.md 懒加载 | ✅ | ✅ |
| tool_result 注入 | ✅ | ✅ |
| Remote skill search | ✅ (feature-gated) | ❌ |
| Skill prefetch | ✅ (feature-gated) | ❌ |

**结论**: ✅ 核心对等。Remote skill 是实验性功能，非必需。

---

## s06 — Context Compression（上下文压缩）

### Claude Code

- **文件**: `services/compact/` + `compact/` (feature-gated)
- **三层策略**:
  1. `autoCompact`: token 超阈值 → Claude API 摘要旧消息
  2. `snipCompact`: 移除 zombie 消息和过期标记 (HISTORY_SNIP)
  3. `contextCollapse`: 重构上下文提升效率 (CONTEXT_COLLAPSE)
- **关键常量**:
MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20,000
AUTOCOMPACT_BUFFER_TOKENS = 13,000
WARNING_THRESHOLD_BUFFER_TOKENS = 20,000
threshold = contextWindow - reservedForSummary - AUTOCOMPACT_BUFFER_TOKENS

text
text
- **环境变量**: `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`

### ElysiaClaw

- **文件**: `packages/coding-agent/src/core/compaction/multi-layer.ts` + `auto-compact.ts`
- **三层策略**:
1. `snipDeadMessages()`: 移除无用消息 (Layer 1, 无 API)
2. `microcompact()`: 微压缩 (Layer 2, 无 API)
3. `autoCompactMessages()`: LLM 摘要 (Layer 3)
- **关键常量**:
AUTO_COMPACT_THRESHOLD = 80,000
AUTO_COMPACT_KEEP_RECENT = 20,000
AUTO_COMPACT_RESERVE = 16,384
autoCompactThreshold = 90,000
maxTokens = 100,000

text
text
- **P1-C 集成**: `contextPressureThreshold = 80k` → emit `context_pressure` 事件

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 摘要层数 | 3 层 (auto + snip + collapse) | 3 层 (snip + micro + auto) |
| 摘要 API 调用 | ✅ | ✅ |
| contextCollapse | ✅ (feature-gated) | ❌ |
| 环境变量覆盖 | ✅ | ❌ |
| Token 预算管理 | 基于 contextWindow 动态计算 | 固定常量 |
| context_pressure 事件 | 无 | ✅ P1-C 优势 |

**结论**: ⚠️ 核心压缩对等，但 Claude Code 的动态阈值计算和 contextCollapse 更精细。ElysiaClaw 的 context_pressure 事件是独有优势。

---

## s07 — Persistent Tasks（任务持久化）

### Claude Code

- **工具**: TaskCreateTool / TaskUpdateTool / TaskGetTool / TaskListTool / TaskStopTool
- **机制**: 文件持久化的任务图，支持状态追踪和依赖关系

### ElysiaClaw

- **工具**: taskCreate / taskUpdate / taskGet / taskList / taskStop / taskOutput
- **文件**: `packages/coding-agent/src/core/tasks/task-store.ts`
- **存储**: `~/.pi/agent/tasks/`

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| CRUD | Create/Update/Get/List/Stop | Create/Update/Get/List/Stop + Output ✅ |
| 持久化 | 文件系统 | 文件系统 |
| 依赖关系 | ✅ | 未确认 |

**结论**: ✅ 对等，ElysiaClaw 多一个 taskOutput 工具。

---

## s08 — Background Tasks（后台任务）

### Claude Code

- **实现**: `DreamTask` + `LocalShellTask`
- **机制**: daemon 线程运行命令，完成后注入通知
- **feature-gated**: `daemon/main.js`, `daemon/workerRegistry.js` (DAEMON flag)

### ElysiaClaw

- **文件**: `packages/coding-agent/src/core/background-runner.ts`
- **机制**: 单例模式，后台运行 bash 命令，通过 `injectNotification()` 通知 agent

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 后台执行 | ✅ (daemon 线程) | ✅ (singleton) |
| 完成通知 | ✅ | ✅ (injectNotification) |
| daemon 架构 | ✅ (独立 worker 进程) | ❌ (同进程) |
| DreamTask (思考) | ✅ | ❌ |

**结论**: ⚠️ 基本功能对等，但 Claude Code 的 daemon 架构更健壮（独立进程，崩溃隔离）。

---

## s09 — Agent Teams（团队协作）

### Claude Code

- **工具**: TeamCreateTool / TeamDeleteTool + InProcessTeammateTask
- **机制**: 持久化 teammates + 异步邮箱

### ElysiaClaw

- **工具**: teamCreate / teamDelete / teamList
- **文件**: `packages/coding-agent/src/core/team-create.ts`
- **机制**: 相同的团队创建/删除/列表

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 团队 CRUD | Create/Delete | Create/Delete/List ✅ |
| 异步邮箱 | ✅ | ✅ (send-message) |
| InProcessTeammate | ✅ | 同进程 teammate |

**结论**: ✅ 对等，ElysiaClaw 多一个 teamList。

---

## s10 — Team Protocols（通信协议）

### Claude Code

- **工具**: SendMessageTool
- **机制**: 统一 request-response 模式驱动所有 agent 间协商

### ElysiaClaw

- **工具**: sendMessageToolDefinition
- **文件**: `packages/coding-agent/src/core/send-message.ts`

### 差异分析

**结论**: ✅ 对等。

---

## s11 — Autonomous Agents（自主认领）

### Claude Code

- **实现**: `coordinator/coordinatorMode.ts`
- **机制**: idle 循环 + 自动认领任务，无需 lead agent 逐一分配

### ElysiaClaw

- **文件**: `packages/coding-agent/src/core/autonomous-runner.ts`
- **机制**: `claimAndRun()` — fire-and-forget 执行器

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| 自主认领 | ✅ (coordinator mode) | ✅ (claimAndRun) |
| idle 扫描 | ✅ | 未确认 |
| taskAssign 工具 | 无独立工具 | taskAssignToolDefinition ✅ |

**结论**: ✅ 对等。

---

## s12 — Worktree Isolation（工作区隔离）

### Claude Code

- **工具**: EnterWorktreeTool / ExitWorktreeTool
- **机制**: git worktree 创建隔离目录，任务绑定 ID

### ElysiaClaw

- **文件**: `packages/coding-agent/src/core/worktree-manager.ts`
- **工具**: enterWorktreeToolDefinition / exitWorktreeToolDefinition
- **机制**: `createWorktree()` + `createBashTool(worktreePath)` 天然沙箱
- **降级**: git worktree 失败时降级为普通目录

### 差异分析

| 维度 | Claude Code | ElysiaClaw |
|---|---|---|
| git worktree | ✅ | ✅ |
| 降级策略 | 未确认 | ✅ (降级为普通目录) |
| 天然沙箱 | ✅ | ✅ (createBashTool 绑定 cwd) |

**结论**: ✅ 对等，ElysiaClaw 有降级策略优势。

---

## 补丁层对比（P 系列 — ElysiaClaw 独有）

Claude Code 没有对应的"补丁"概念，这些是 ElysiaClaw 在 pi-mono 基础上的独有增强：

| 补丁 | 机制 | Claude Code 对应 | 说明 |
|---|---|---|---|
| P1-A | patch-agent.cjs 幂等保护 | N/A (闭源，无需 patch) | 保护 monkey-patch |
| P1-B | CLAUDE.md 懒加载 | s05 原生支持 | ElysiaClaw 移植 |
| P1-C | context_pressure 事件 | 无对应 | ElysiaClaw 独有 |
| P2-A | Session Persistence + Resume | `--continue` / `--resume` | 功能对等 |
| P2-B | Cost Tracker | cost-tracker.ts | 功能对等 |
| P2-D | 速率调度器（三阶段） | 无内置 | ElysiaClaw 独有优势 |
| P3-A | PreToolUse Shell Hooks | settings.json hooks | 功能对等 |
| P3-B | File History / Undo | FileHistoryState | 功能对等 |

---

## 关键差距总结

### 🔴 高优先级差距

| 差距 | 影响 | 建议 |
|---|---|---|
| **并行工具执行** | 多工具调用串行处理，效率低 | 实现 StreamingToolExecutor 分区逻辑 |
| **MCP 协议支持** | 无法接入外部工具生态 | 新增 MCPTool + MCPConnectionManager |
| **Web 工具缺失** | 无法获取外部信息 | 新增 WebFetchTool / WebSearchTool |

### 🟡 中优先级差距

| 差距 | 影响 | 建议 |
|---|---|---|
| **进程级 fork** | 子 agent 崩溃可能影响主进程 | 考虑 child_process fork 模式 |
| **动态压缩阈值** | 固定常量不适应不同 context window | 基于 model.contextWindow 动态计算 |
| **contextCollapse** | 缺少上下文重构优化 | 参考 Claude Code 实现 |
| **LSPTool** | 无语义代码信息 | 长期探索 (Roadmap P4-B) |

### 🟢 低优先级差距

| 差距 | 影响 | 建议 |
|---|---|---|
| **AskUserQuestionTool** | 无结构化用户交互 | 可通过 Telegram 消息模拟 |
| **Skill prefetch** | 无技能预加载 | 非核心功能 |
| **Remote agent** | 无远程 agent 支持 | 个人使用场景不需要 |
| **DreamTask** | 无"思考"型后台任务 | 可通过 background-runner 模拟 |

### 🟢 ElysiaClaw 独有优势

| 优势 | 说明 |
|---|---|
| **P2-D 速率调度器** | 令牌桶 + 任务复杂度预测 + 模型路由，Claude Code 无此功能 |
| **P1-C context_pressure** | 主动 token 压力事件，Claude Code 无对应 |
| **P3-B File History** | 文件快照 + undo，Claude Code 有但实现不同 |
| **多 Provider 支持** | 20+ LLM 提供商统一 API，Claude Code 仅 Anthropic |
| **多渠道 Gateway** | Telegram/WhatsApp/Slack/Discord，Claude Code 仅 CLI |

---

## 实施路线图建议

基于以上差距分析，建议按以下优先级推进：

### Phase 1: 核心工具补全（1-2 Sprint）
1. **WebFetchTool** — HTTP 获取，参考 Claude Code WebFetchTool
2. **WebSearchTool** — Web 搜索，可接入 SearXNG / Brave API
3. **AskUserQuestionTool** — 结构化用户交互

### Phase 2: MCP 集成（2-3 Sprint）
1. MCPConnectionManager — 连接管理（stdio/sse/http/ws）
2. MCPTool — MCP 工具包装器
3. ListMcpResourcesTool / ReadMcpResourceTool

### Phase 3: 并行执行（1-2 Sprint）
1. StreamingToolExecutor — 工具并行分区
2. isConcurrencySafe 能力声明
3. 并行执行的权限检查适配

### Phase 4: 压缩优化（1 Sprint）
1. 动态阈值计算（基于 model.contextWindow）
2. 环境变量覆盖支持

---

*文档版本: 2026-04-05。基于 Claude Code v2.1.88 源码分析与 ElysiaClaw 0.64 架构。Code Mode Phase 0 补丁路径已实现（attempt.ts）。*

# ElysiaClaw — AI 接手文档

> 最后更新: 2026-06-07 (序 8 深度审查 + 接线断链修复: 4 类实质 bug 修复[死代码/覆盖冲突/框架契约/重复声明], tsgo 19→0, 134 测试全过, 坑 #91-#94)
> 当前维护者: aoseluo (云尘 / 奈緒)
> 维护模式: AI 协作，独立维护，不与上游同步

---

## 项目一句话

ElysiaClaw = elysiaclaw（多渠道 AI 助手平台）+ pi-mono（Agent 框架层）
运行在 `elysiaserver` (Ubuntu 24.04)，通过 Telegram Bot `@ElysiaClaw_Bot` 交互。

---

## 当前状态快照

### 架构
- **12 层 Agent 框架**: 全部竣工（s01-s12.1）
- **P 系列补丁**: P1-A/B/C + P2-A/B/D + P3-A/B 全部完成
- **Tool Parity**: 11/16 = 68.75% (Task 0/1/2/3/4 框架层 + Task 5-11 批量能力声明 + Task 12 四层注册 + Task 13 elysiaclaw 超预期)
- **DTS 类型错误**: ✅ 全部修复 (2026-06-07)，`pnpm build` 干净通过
- **子代理基础设施**: elysiaclaw 层完整实现（37 个文件）

### 战略变更 (2026-06-05)
- **Code Mode 已废弃** — 不再实现独立的 `/code` `/exit` 模式
- **新策略**: 代码能力内置为 agent 的手段，通过 `delegate_code_task` 分发给子代理
- 子代理执行代码分析，防止主 session 上下文膨胀
- 子代理只读，修改操作由主 agent 决策后执行

### 当前任务

- **序 1-7 全部完成** ✅ (2026-06-07)
  - 序 1: 索引化注入 + B4 改造 ✅ (T6 RECALL, 2026-06-06)
  - 序 2: 压缩可见性 WS-1 (typing 心跳 + compaction 状态推送) ✅ (2026-06-07)
  - 序 3: 全流式 WS-2 (thinking 默认流式) ✅ (2026-06-07)
  - 序 4: L0 工具结果驱逐 (consumed tool results → [EVC] 摘要) ✅ (2026-06-07)
  - 序 5: 统一注入预算器 (system prompt tokens 计入压缩阈值) ✅ (2026-06-07)
  - 序 6: 输入分类器 (task/chat/affective/meta 四分类) ✅ (2026-06-07)
  - 序 7: 用户画像 User Model (SQLite 持久化 + 双路径更新 + summary 注入 B2) ✅ (2026-06-07)
  - **边缘情况加固** (2026-06-07): 正则 bug 修复、防守代码、门限常量化、JSON.stringify 循环引用防护

- **序 8 Conversation 层 + Handoff** 🔄 (2026-06-07, 阶段 1-4 + 健全性修复已完成)
  - 阶段 1: 核心类型 + Conversation Store ✅
    - `session-rotation/handoff-types.ts` — HandoffPacket / TaskSegment / **TaskPhase / CompressedPhaseResult** / validateHandoffCompleteness / formatHandoffForInjection
    - `session-rotation/conversation-types.ts` — ConversationEntry / ConversationStoreData
    - `session-rotation/conversation-store.ts` — SQLite 持久化 (node:sqlite DatabaseSync), chat→conversation 映射, 轮换追踪, **双轨索引存储 + appendMacroIndexEntry**
  - 阶段 2: rotate_session 工具 + B3 Handoff 注入 ✅
    - `session-rotation/rotation-controller.ts` — SafetyPoint 检查 / shouldTriggerRotation / executeRotation 编排 / **CompactionSummary 生成**
    - `session-rotation/task-segment-tracker.ts` — 任务段实时追踪 + **plan-todo-review-recall 四阶段** + compressCompletedPhase + classifyTaskType + 超时自动封口 + **自动封印旧活跃段**
    - `session-rotation/conversation-router.ts` — chat→Conversation→activeSession 间接映射
    - `session-rotation/handoff-inject.ts` — B3 Handoff 注入: **双路径查找** (chatId + activeSessionKey 回退) + consumeHandoff + **buildAndStoreDualTrackIndex**
    - `session-rotation/dual-track-index.ts` — **双轨索引构建**: MacroIndex(压缩会话摘要) + MicroIndex(任务段摘要) + formatDualTrackIndexForInjection
    - `agents/tools/rotate-session-tool.ts` — rotate_session 工具 (ownerOnly, **统一 validateHandoffCompleteness 门控**)
    - 四层注册: elysiaclaw-tools.ts + tool-catalog.ts ✅
    - attempt.ts B3 注入: B4 RECALL 前插入 handoffBlock ✅
  - 阶段 3: 自动轮换触发 ✅
    - `session-rotation/auto-trigger.ts` — checkAutoRotation (token 压力检测 + safety 门控) / estimateSessionTokens
    - attempt.ts 集成: 每轮 prompt 前检测 token 压力, 日志推荐 rotate_session
  - 阶段 4: Task Segment 追踪集成 + 双轨索引 + CompactionSummary ✅ (2026-06-07)
    - attempt.ts: TaskSegmentTracker 初始化 + 工具调用事件(plan→todo 自动推进) + 封口(todo→review→recall) + 双轨索引构建
    - handoff-types.ts: TaskPhase 四阶段 + CompressedPhaseResult 分段压缩
    - task-segment-tracker.ts: advancePhase / compressCompletedPhase / updateTodos
    - dual-track-index.ts: MicroIndex 增强(phase + compressedPhaseSummaries)
    - rotation-controller.ts: buildCompactionSummaryFromHandoff → MacroIndexEntry
    - conversation-store.ts: appendMacroIndexEntry 增量追加
    - 26 新测试 (97→123), tsc 零新增错误
  - **健全性测试修复** ✅ (2026-06-07)
    - 5 项逻辑缺陷修复（详见 SPRINT.md）
    - 24 新测试用例 (73→97), tsc 零新增错误
  - **深度审查 + 接线断链修复** ✅ (2026-06-07, 见 SPRINT.md)
    - 审查暴露：executeRotation 死代码（MacroIndex 真实路径恒空，双轨退化单轨）/ updateDualTrackIndex 覆盖冲突 / rotate_session 违反 AgentTool 契约（return content 空）/ attempt.ts inputClassification 重复声明
    - 修复：buildMacroEntryFromHandoff 共享函数 + 工具轮换沉淀 macro / 保留既有 macro / execute 双参+content/details+parameters+label / 删重复声明
    - tsgo 19→0, 测试 131→134, 坑 #91-#94
    - **未做（需架构决策）**: executeRotation 全套接入 + SafetyPoint 运行时检查 + tracker→handoff 自动填充（详见 SPRINT.md 诚实标注）
  - **待完成**: 阶段 5 (端到端验证, 需可用模型 + 部署后跑出首条 conversation db)

- **下一步**: 序 8 阶段 5 端到端验证(需可用模型) / Tool Parity Task 14-16
### 路径修正 (2026-06-05)
- 项目根目录: `~/projects/pi-mono/` (此前文档记载为 `~/pi-mono/`)
- 所有引擎文件路径已修正（7 个 .md + README.md = 8 个文件）
- 数据目录 `~/.pi/agent/`、配置目录 `~/.elysiaclaw/` 不变

### 残余技术债
- ~~DTS 类型错误 ×6~~ → ✅ 已修复 (2026-06-07)
- ~~tsgo 全仓类型检查 53 错误~~ → ✅ 已修复 (2026-06-07)，`npx tsgo --noEmit` 零错误退出，`npm run check` 不再阻塞
- delegate_code_task Telegram 端到端验证未完成 — 需可用模型
- Telegram 完整 stdout 输出 — 需 `verboseLevel: "full"` 机制改造
- Tool Parity 剩余 3 个 Task (14/15/16) 待执行
- elysiaclaw/ git push 需手动执行（auto-mode 阻止）
- `computeInjectionBudget` 未接入运行时（SDK 用硬编码阈值，不随 1M 窗口缩放）
- `input-classifier` 数据源偏窄（短陈述句落入 task，identity.name 提不出）
- sessions chunks 47% CLAUDE.md 注入噪音

---

## 接手时阅读顺序

1.本文档 (HANDOFF.md) — 你在看这个
2.elysiaclaw_engine/SYSTEM.md — 运行环境、构建部署、文件索引
3.elysiaclaw_engine/ARCHITECTURE.md — 架构蓝图
4.elysiaclaw_engine/PITFALLS.md — 70 个踩坑记录（必读）
5.elysiaclaw_engine/SUPERADMIN-AGENT-DESIGN.md — 记忆架构总设计（Phase 1 完成，Phase 2 待启动）
6.elysiaclaw_engine/MEMORY-ACTIVATION-RUNBOOK.md — 记忆引擎激活执行手册（已完成，参考用）
7.elysiaclaw_engine/TELEGRAM-UX-CONTEXT-PLAN.md — Telegram 输出体验 × 上下文/记忆协同计划（PROPOSAL）
8.elysiaclaw_engine/CONTEXT-INJECTION-ARCHITECTURE.md — 分层上下文注入架构（KV-cache 优化 + 注入预算，PROPOSAL）
9.elysiaclaw_engine/SESSION-ROTATION-CONTINUITY.md — 会话轮换与跨会话任务延续（工作记忆周期化 + Handoff 双轨延续 + §4B 任务段实时打包/三级压缩，PROPOSAL）
10.elysiaclaw_engine/KNOWLEDGE-BASE-EVOLUTION.md — 知识库与自我进化（索引化注入 + 输入分类 + 用户画像 + 技能进化，PROPOSAL）
11.elysiaclaw_engine/SUBAGENT-CODE-DELEGATION.md — 子代理代码委派技术设计
8.elysiaclaw_engine/ROADMAP.md — 中长期规划
9.elysiaclaw_engine/SPRINT.md — Sprint 工作台

---

## 关键路径

| 项 | 路径 |
|---|---|
| 项目根目录 | `~/projects/pi-mono/` |
| pi-mono 框架层 | `~/projects/pi-mono/packages/` |
| elysiaclaw 应用层 | `~/projects/pi-mono/elysiaclaw/` |
| 引擎文档 | `~/projects/pi-mono/elysiaclaw_engine/` |
| 配置目录 | `~/.elysiaclaw/` |
| 数据目录 | `~/.pi/agent/` |
| Node.js | `~/.nvm/versions/node/v22.22.1/` |
| 全局安装 | `~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/` |

---

## 下个窗口的起步清单

**当前主线（2026-06-07）：序 8 Conversation 层 + Handoff 阶段 1-4 + 健全性修复已完成**
- 序 8 已落地模块：`src/session-rotation/` (11 文件, 123 测试)
  - handoff-types.ts / conversation-types.ts / conversation-store.ts (SQLite + 双轨索引)
  - rotation-controller.ts / task-segment-tracker.ts / conversation-router.ts
  - handoff-inject.ts (B3 注入, 双路径查找, buildAndStoreDualTrackIndex) / auto-trigger.ts (token 压力检测)
  - dual-track-index.ts (MacroIndex + MicroIndex) / index.ts (模块导出)
  - agents/tools/rotate-session-tool.ts (四层注册完成, 统一 completeness 门控)
- 阶段 4 新增: plan-todo-review-recall 四阶段 + CompressedPhaseResult 分段压缩 + 双轨索引数据流闭环 + CompactionSummary 生成
- 健全性修复: 5 项逻辑缺陷 (task-segment 孤儿段/按名匹配/handoff 回退查找/错误处理不一致/正则重复)
- attempt.ts 集成：B3 Handoff 注入 + 自动轮换检测 + TaskSegmentTracker 集成 + 双轨索引构建
- 优先级总表：`ARCHITECTURE.md` Part 9.3（序 1-7 ✅，序 8 🔄 阶段 1-4，序 9-12 待启动）
- 用户画像已落地：`src/user-model/`（SQLite 持久化 + 双路径更新 + B2 注入）
- 注入预算器已激活：system prompt tokens 计入压缩阈值，防反身性空转
- L0 工具结果驱逐已启用：[EVC] sentinel 幂等检测

其余待办（见 SPRINT.md）：
- 序 8 阶段 5: 端到端验证（需可用模型）+ 与压缩/CONSOLIDATE 统一
- Telegram delegate_code_task 端到端验证（需可用模型）

**Tool Parity 后续 todo（按 PLAN 优先级，2026-06-07 接力点）**：
- Task 13 WebSearchTool（🔴 高，新能力，Brave API/SearXNG）— 未开工
- Task 3 TodoWrite 结构重写（🟡 中，schema 对齐 content+status+priority + outputSchema）— 未开工
- Task 4 EditTool replace_all（🟡 中）— 未开工
- Task 5-11 Read/Write/Find/Ls/PlanMode/Task系列/Team系列 能力声明（🟢 低，可批量）— 未开工
- Task 14 AskUserQuestionTool（🟡 中，Telegram inline keyboard）— 未开工
- Task 15 MCP 协议集成 / Task 16 并行执行引擎（🟡 中，大工程，最后）— 未开工
- **测试补强模式可复用**：本次 Task 1/2 用「真实工具端到端 + vi.mock 隔离副作用」两类测试落实，后续每个 Task 完成应同步补 `test/<tool>-*.test.ts`，勿只勾选标准不验证
- **grep.ts:360-368 排序代码异味**（非已确认 bug）：重写时预建 path→mtime Map，详见 TOOL-PARITY-PLAN.md Task 1


## 包管理规则（不可混用）

层级	包管理器	位置
pi-mono 框架层	npm (workspaces)	~/projects/pi-mono/
elysiaclaw 应用层	pnpm	~/projects/pi-mono/elysiaclaw/


测试基线

包	结果
@mariozechner/pi-agent-core	36/36
@mariozechner/pi-coding-agent	858→907 (+49；16 预存失败全部修复，零回归；见 PITFALLS.md #82-#85)
@mariozechner/pi-tui	505/506 (1 flaky)


版本

包	版本
pi-mono 全系	0.64.0
elysiaclaw	v2026.4.4
Node.js	v22.22.1
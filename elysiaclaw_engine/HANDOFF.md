# ElysiaClaw — AI 接手文档

> 最后更新: 2026-06-07 (Tool Parity Task 1/2 测试落实 +25 用例；序1-7 全部完成)
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
- **Tool Parity**: 3/16 = 18.75% (Task 0/1/2/12 已完成；Task 1/2 已补真实测试 +25 用例，2026-06-07)
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

- **下一步**: 序 8 Conversation 层 + Handoff (见 `ARCHITECTURE.md` Part 9.3)
### 路径修正 (2026-06-05)
- 项目根目录: `~/projects/pi-mono/` (此前文档记载为 `~/pi-mono/`)
- 所有引擎文件路径已修正（7 个 .md + README.md = 8 个文件）
- 数据目录 `~/.pi/agent/`、配置目录 `~/.elysiaclaw/` 不变

### 残余技术债
- ~~DTS 类型错误 ×6~~ → ✅ 已修复 (2026-06-07)，实际 8 个错误，`pnpm build` 不再阻塞
- delegate_code_task Telegram 端到端验证未完成 — 需可用模型
- Telegram 完整 stdout 输出 — 需 `verboseLevel: "full"` 机制改造
- Tool Parity 剩余 13 个 Task 待执行
- elysiaclaw/ git push 需手动执行（auto-mode 阻止）

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

**当前主线（2026-06-07）：序 1-7 全部竣工，下一步序 8 Conversation 层 + Handoff**
- 优先级总表：`ARCHITECTURE.md` Part 9.3（序 1-7 ✅，序 8-12 待启动）
- 用户画像已落地：`src/user-model/`（SQLite 持久化 + 双路径更新 + B2 注入）
- 注入预算器已激活：system prompt tokens 计入压缩阈值，防反身性空转
- L0 工具结果驱逐已启用：[EVC] sentinel 幂等检测

其余待办（见 SPRINT.md）：
- 序 8: Conversation 层 + Handoff（下一个自然起点）
- Telegram delegate_code_task 端到端验证（需可用模型）
- DTS 类型错误修复 ×6

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
@mariozechner/pi-coding-agent	858→883 (+25 Tool Parity 测试全绿；3 failures 预存不变；增量推算，未跑全套)
@mariozechner/pi-tui	505/506 (1 flaky)


版本

包	版本
pi-mono 全系	0.64.0
elysiaclaw	v2026.4.4
Node.js	v22.22.1


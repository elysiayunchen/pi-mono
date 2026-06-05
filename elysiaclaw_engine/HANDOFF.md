# ElysiaClaw — AI 接手文档

> 最后更新: 2026-06-06
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
- **Tool Parity**: 3/16 = 18.75% (Task 0/1/2 已完成)
- **子代理基础设施**: elysiaclaw 层完整实现（37 个文件）

### 战略变更 (2026-06-05)
- **Code Mode 已废弃** — 不再实现独立的 `/code` `/exit` 模式
- **新策略**: 代码能力内置为 agent 的手段，通过 `delegate_code_task` 分发给子代理
- 子代理执行代码分析，防止主 session 上下文膨胀
- 子代理只读，修改操作由主 agent 决策后执行

### 当前任务
- **delegate_code_task 实施** — ✅ 已完成 (2026-06-05)
  - 工具文件: `elysiaclaw/src/agents/tools/delegate-code-task.ts`
  - 四层注册: elysiaclaw-tools.ts + tool-catalog.ts + elysiaclaw.json tools.allow
  - 策略指引: attempt.ts 中注入 MANDATORY delegate_code_task 指引
  - Code Mode 检测块已移除
  - **修复 #65/#66/#67/#68**: 工具注册链完整
  - **配置**: tools.subagents.tools.deny 已添加写操作禁止列表
- **Telegram 端到端验证** — 受阻于主模型不可用（openrouter/owl-alpha 返回 400）

- **Telegram 流式输出** — 🔧 进行中 (2026-06-06)
  - ✅ Tool lane 创建（复用 draft-stream，坑 #70 防抖修复）
  - ✅ Tool result phase 路由（`agent-runner-execution.ts` 处理 phase "result"，携带 meta/isError）
  - ✅ Tool lane 显示命令摘要（`onToolStart` phase="result" → `"📖 Read: /path/file"`）
  - 🔧 Thinking 流式：需 session `reasoningLevel: "stream"` 配置
  - 🔧 完整 stdout 输出：需 `verboseLevel: "full"`

- 下一步: 确认可用模型 → Telegram 端到端验证 → DTS 错误修复 × 6 → Tool Parity Task 3-16

### 路径修正 (2026-06-05)
- 项目根目录: `~/projects/pi-mono/` (此前文档记载为 `~/pi-mono/`)
- 所有引擎文件路径已修正（7 个 .md + README.md = 8 个文件）
- 数据目录 `~/.pi/agent/`、配置目录 `~/.elysiaclaw/` 不变

### 残余技术债
- DTS 类型错误 ×6 — `pnpm build` 在 `build:plugin-sdk:dts` 阶段阻塞，需绕过（坑 #38/#63）
- OpenRouter/owl-alpha 不可用 — 默认模型需更换
- delegate_code_task Telegram 端到端验证未完成 — 需可用模型
- Telegram 完整 stdout 输出 — 需 `verboseLevel: "full"` 机制改造
- Tool Parity 剩余 13 个 Task 待执行

---

## 接手时阅读顺序

1.本文档 (HANDOFF.md) — 你在看这个
2.elysiaclaw_engine/SYSTEM.md — 运行环境、构建部署、文件索引
3.elysiaclaw_engine/ARCHITECTURE.md — 架构蓝图
4.elysiaclaw_engine/PITFALLS.md — 64 个踩坑记录（必读）
5.elysiaclaw_engine/SUBAGENT-CODE-DELEGATION.md — 子代理代码委派技术设计
6.elysiaclaw_engine/DELEGATE-CODE-TASK-PLAN.md — 当前任务的详细实施计划
7.elysiaclaw_engine/ROADMAP.md — 中长期规划
8.elysiaclaw_engine/SPRINT.md — Sprint 工作台

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

delegate_code_task 已完成实施。下一步见 SPRINT.md，当前优先事项:
- Telegram 端到端验证
- DTS 类型错误修复 ×6
- Tool Parity 剩余 13 个 Task


## 包管理规则（不可混用）

层级	包管理器	位置
pi-mono 框架层	npm (workspaces)	~/projects/pi-mono/
elysiaclaw 应用层	pnpm	~/projects/pi-mono/elysiaclaw/


测试基线

包	结果
@mariozechner/pi-agent-core	36/36
@mariozechner/pi-coding-agent	858/861 (3 failures 预存)
@mariozechner/pi-tui	505/506 (1 flaky)


版本

包	版本
pi-mono 全系	0.64.0
elysiaclaw	v2026.4.4
Node.js	v22.22.1


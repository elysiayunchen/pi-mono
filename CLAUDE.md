# pi-mono — 项目级 AI 协作者指南

## 项目身份

**pi-mono** 是 ElysiaClaw 的 Agent 框架层。代码继承链：

```
pi-mono (Mario Zechner, Agent 框架)
  → OpenClaw (Peter Steinberger, 多渠道 Gateway, fork pi-mono 作为 SDK)
    → ElysiaClaw (aoseluo/云尘, fork OpenClaw, 深度定制)
```

本仓库是 pi-mono fork，由 **aoseluo (云尘 / 奈緒)** 以 AI 协作模式独立维护，**不与上游同步**。

## 仓库结构

```
pi-mono/
├── packages/                     ← 框架层（npm workspaces，4 个包）
│   ├── tui/                     @mariozechner/pi-tui           终端 UI（差分渲染）
│   ├── ai/                      @mariozechner/pi-ai            统一 LLM API（20+ 提供商）
│   ├── agent/                   @mariozechner/pi-agent-core    Agent 核心循环 + 事件流
│   └── coding-agent/            @mariozechner/pi-coding-agent  编码 Agent SDK + 工具框架
│
├── elysiaclaw/                  ← 应用层（独立 git 仓库，pnpm）
│   │
│   │   # Agent 运行时
│   ├── src/agents/              主编排层
│   │   ├── pi-tools.ts          工具注册中心（四层链枢纽）
│   │   ├── pi-tools.policy.ts   工具策略（允许/拒绝/沙箱白名单）
│   │   ├── pi-embedded-runner/  运行循环（runs/attempt/model/compact/lanes）
│   │   ├── pi-embedded-helpers/ 引导、故障转移、OpenAI/Google 适配
│   │   ├── pi-extensions/       上下文压缩指令、会话修剪
│   │   ├── tools/               应用层工具（browser/canvas/cron/sessions/nodes 等 30+）
│   │   └── skills/              技能加载/过滤/刷新
│   │
│   │   # Gateway 服务器
│   ├── src/gateway/             WebSocket 控制平面 + HTTP API
│   │
│   │   # 基础设施（开发高频接触）
│   ├── src/config/              配置 schema/验证/IO/迁移（Zod）
│   ├── src/cron/                定时任务调度与执行
│   ├── src/sessions/            会话管理
│   ├── src/memory/              持久化存储（任务图、文件历史）
│   ├── src/hooks/               钩子系统（PreToolUse Shell Hooks）
│   ├── src/channels/            消息渠道抽象层
│   ├── src/plugins/             插件系统（加载/注册/钩子）
│   ├── src/providers/           模型提供者（GitHub Copilot/Google/Kilocode/Qwen）
│   ├── src/context-engine/      提示上下文管理
│   ├── src/infra/               基础设施工具
│   ├── src/media/               媒体处理管线（图片/音频/视频）
│   │
│   │   # 消息渠道
│   ├── src/telegram/            Telegram Bot
│   ├── src/discord/             Discord Bot
│   ├── src/slack/               Slack Bot
│   ├── src/whatsapp/            WhatsApp (Baileys)
│   ├── src/web/                 WebChat
│   │
│   │   # 插件与扩展
│   ├── extensions/              渠道插件（msteams/matrix/zalo/line/irc/nostr 等）
│   └── skills/                  内置技能目录
│
├── elysiaclaw_engine/           ← AI 协作文档体系
│   ├── SYSTEM.md                核心系统信息（运行环境、构建部署、文件索引）
│   ├── ARCHITECTURE.md          架构蓝图
│   ├── PITFALLS.md              64 个踩坑记录（必读）
│   ├── ROADMAP.md               规划与目标
│   ├── SPRINT.md                当前 Sprint 工作台
│   ├── CLAUD-CODE-COMPARISON.md 与 Claude Code v2.1.88 逐层对标
│   └── TOOL-PARITY-PLAN.md      工具迁移计划（16 Tasks）
│
├── scripts/
│   ├── patch-agent.cjs          pi-agent-core monkey-patch（幂等注入 + smoke test）
│   ├── check-browser-smoke.mjs  浏览器兼容性冒烟检查
│   └── release.mjs              发布脚本
│
├── deploy.sh                    一键构建 + 部署 + Gateway 重启（含 6 道守卫）
└── test.sh                      测试运行器（备份/恢复 auth.json）
```

## 包管理器

**两个独立的包管理器，不可混用：**

| 层级 | 包管理器 | 位置 |
|------|----------|------|
| pi-mono 框架层 | **npm** (workspaces) | 根目录 + `packages/*` |
| elysiaclaw 应用层 | **pnpm** | `elysiaclaw/` |

## 构建系统

### 构建顺序（依赖链）

```
tui → ai → agent → coding-agent
```

### 开发命令

```bash
# === pi-mono 框架层（npm）===
npm install          # 安装所有 workspace 依赖
npm run build        # 按序构建 4 个包
npm run check        # biome lint --write + tsgo 类型检查 + 浏览器冒烟
npm run test         # 运行所有包的测试
./test.sh            # 测试运行器（自动备份/恢复 auth.json）

# === elysiaclaw 应用层（pnpm，在 elysiaclaw/ 目录执行）===
cd elysiaclaw
pnpm install
pnpm build           # 构建应用（DTS 类型错误已修复，全流程通过）
pnpm dev             # 开发模式
pnpm test            # 运行测试（vitest）
pnpm check           # lint + format (oxlint + oxfmt)
pnpm tsgo            # TypeScript 类型检查（零错误）
```

### 一键部署

```bash
cd ~/pi-mono && ./deploy.sh
```

`deploy.sh` 执行流程（3 阶段 10 步）：
1. Guard 1 — 校验配置文件（elysiaclaw.json、config.yaml）
2. Phase A: `npm run build`（pi-mono 框架层 4 个包）
3. Phase A: 复制 `packages/{agent,ai,tui,coding-agent}/dist` 到全局 `node_modules/@mariozechner/`
4. Phase A: 重新应用 `scripts/patch-agent.cjs`（幂等注入 setSystemPrompt/replaceMessages）
5. Guard 2 — 验证 patch 存活（grep + 语法检查）
6. Phase B: 构建 elysiaclaw（tsdown-build.mjs + 后处理，跳过 DTS — Pitfall #38）
7. Phase B: 复制 elysiaclaw dist → 全局安装
8. Guard 3 — 工具注册一致性检查
9. Phase C: `elysiaclaw gateway restart`
10. Phase C: 验证 Gateway 响应（`elysiaclaw status`）

### Pre-commit Hooks

`.husky/pre-commit` → `npm run check`（biome lint/format + tsgo 类型检查 + 浏览器冒烟）

### 版本

| 项目 | 版本 | 说明 |
|------|------|------|
| pi-mono 根 | `0.0.3` | monorepo 管理版本 |
| packages/* (4 个包) | `0.64.0` | 框架层各包版本 |
| elysiaclaw | `2026.4.4` | 日历版本，package.json `elysiaclaw` |
| elysiaclaw 的 pi-* 依赖声明 | `0.58.0` | package.json 中声明的依赖版本（非实际部署版本） |

## 测试基线

| 包 | 结果 |
|------|------|
| `@mariozechner/pi-agent-core` | 36/36 |
| `@mariozechner/pi-coding-agent` | 907/955 (0 failures；16 预存全部修复，见 PITFALLS.md #82-#85) |
| `@mariozechner/pi-tui` | 505/506 (1 flaky) |
| elysiaclaw | 11188/11367 passed，123 failed (预存失败，非本次引入；见 PITFALLS.md #86) |

## 已完成的 Agent 架构

ElysiaClaw 在 pi-mono 的 SDK/Hooks/Extension 体系之上，通过框架预留的扩展点实现了完整架构，未侵入核心循环。

### 12 层 Agent 框架

| 层 | 机制 | elysiaclaw 核心文件 |
|------|------|------|
| s01 | The Loop — 基础循环 | `pi-embedded-runner/runs.ts` |
| s02 | Tool Dispatch — 工具注册与分发 | `pi-tools.ts`, `pi-tools.policy.ts` |
| s03 | Planning — Plan Mode + Todo 清单 | `pi-embedded-runner/run/attempt.ts` |
| s04 | Sub-Agents — 子 Agent 分叉 | `pi-embedded-runner/` (fork path) |
| s05 | Knowledge on Demand — 知识懒加载 | `pi-extensions/` |
| s06 | Context Compression — 三层压缩链 | `pi-embedded-runner/compact.ts` |
| s07 | Persistent Tasks — 任务持久化 | `memory/` |
| s08 | Background Tasks — 后台进程 | `pi-embedded-runner/lanes.ts` |
| s09-s10 | Agent Teams + Protocols | `agents/tools/subagents-tool.ts` 等 |
| s11 | Autonomous Agents — 自主认领 | `pi-embedded-runner/` |
| s12 | Worktree Isolation — Git worktree 沙箱 | sandbox 子系统 |

### P 系列基础设施补丁

| 补丁 | 功能 | 实现位置 |
|------|------|------|
| P1-A | Monkey-patch 保护（幂等注入 + npm install 后自动恢复） | `scripts/patch-agent.cjs` |
| P1-B | CLAUDE.md 懒加载 | `context-engine/` |
| P1-C | Context Pressure 事件（80k token 阈值主动预警） | agent-loop |
| P2-A | Session 持久化 + 续会 | sessions 子系统 |
| P2-B | Cost Tracker（TUI 实时 + Bot 报告脚本） | 流包装器 |
| P2-D | 三阶段速率调度器 | `rate-limit-scheduler.ts` |
| P3-A | PreToolUse Shell Hooks | `hooks/` |
| P3-B | File History + Undo | `file-history.ts` |

### Code Mode

独立编码模式，通过 `/code` 进入，`/exit` 退出。环境隔离（不加载用户记忆、全局 skills/hooks）。
- Phase 0 MVP：`pi-embedded-runner/run/attempt.ts` 路径 — 功能验证待做

## 关键约束

### Sacred Files（修改需用户确认）
- `config.yaml`、`SOUL.md`、`AGENTS.md`、`CLAUDE.md`（本文件）
- elysiaclaw 的 `.env` 和凭据文件

### Git 约束
- elysiaclaw/ 是独立 git 仓库，需分别提交
- 禁止 force push / reset --hard / rm -rf
- 禁止创建/删除/修改 git worktree（除非明确请求）
- 禁止切换分支（除非明确请求）
- 禁止 git stash（多 Agent 安全）

### 包管理约束
- pi-mono 根目录用 npm，elysiaclaw/ 用 pnpm，**不可混用**
- 不要在 pi-mono 根目录运行 pnpm 命令
- 不要在 elysiaclaw/ 目录运行 npm 命令

### 工具注册约束
新增工具需通过**四层注册链**：
1. pi-coding-agent (`packages/coding-agent/src/core/tools/`)
2. elysiaclaw pi-tools.ts
3. tool-catalog.ts
4. tools.allow

Bot/TUI 双路径均需检查。

### 权限三级制度

**Tier 1 — 自由执行**：读文件、搜索代码、git status/log/diff、运行测试/lint/类型检查、Web 搜索、记忆维护

**Tier 2 — 先说再做**：写入/修改文件、git commit/push、安装依赖、配置变更

**Tier 3 — 永久禁止**：git push --force / reset --hard、rm -rf、暴露 .env/密钥、修改本文件

### 运行环境

| 项目 | 值 |
|------|------|
| 服务器 | `elysiaserver` (Ubuntu 24.04) |
| Node.js | v22.22.1 (nvm) |
| 网络 | Tailscale (IP 100.111.4.5), `elysiaclaw status` 显示 off (Pitfall #44) |
| Telegram Bot | `@ElysiaClaw_Bot` |
| Gateway | ws://127.0.0.1:18789 (bind=lan, mode=local) |
| Dashboard | http://192.168.8.100:18789/ |
| 配置目录 | `~/.elysiaclaw/` |
| 数据目录 | `~/.pi/agent/` |
| 默认模型 | `openrouter/owl-alpha` (config: agents.defaults.model.primary) |
| Context Tokens | 1M (config: agents.defaults.contextTokens) |
| 会话数 | ~31 (config: 3 agents) |

## 已知技术债

| 项目 | 说明 |
|------|------|
| DTS/tsgo 类型检查 | ✅ 已修复 (2026-06-07) — `build:plugin-sdk:dts` 通过 + `tsgo --noEmit` 零错误 (PITFALLS #38/#63/#86) |
| deploy.sh skip DTS | deploy.sh 仍用 `tsdown-build.mjs`（不跑 `build:plugin-sdk:dts`，但该步骤本身已可通过） |
| models.generated.ts | 手动编辑了模型参数，需迁移到 `scripts/generate-models.ts` 数据源 |
| pi-agent-core monkey-patch | `setSystemPrompt`/`replaceMessages` 依赖运行时注入 |
| OpenRouter 路由劫持 | 临时绕过直连阿里云 Bailian，根因未修 |
| Code Mode | 已废弃。代码能力通过 `delegate_code_task` 子代理分发实现 |
| tsconfig.json 残留路径 | `compilerOptions.paths` 仍映射 mom/pods/web-ui/agent-old（包已删除） |
| enter_code_mode/exit_code_mode | 四层注册链和 tools.allow 中仍在，但 Code Mode 已废弃，待清理 |
| elysiaclaw 依赖版本 | `package.json` 依赖 `@mariozechner/pi-*` 声明版本 `0.58.0`，但实际部署 0.64.0 dist |

## 参考文档加载顺序

首次接手 pi-mono 时，按以下顺序阅读：

1. 本文件（CLAUDE.md）— 你在这里
2. [HANDOFF.md](elysiaclaw_engine/HANDOFF.md) — 当前状态快照（最快了解项目）
3. [SYSTEM.md](elysiaclaw_engine/SYSTEM.md) — 运行环境、构建部署、文件索引
4. [ARCHITECTURE.md](elysiaclaw_engine/ARCHITECTURE.md) — 架构蓝图
5. [PITFALLS.md](elysiaclaw_engine/PITFALLS.md) — 64 个踩坑记录（**必读**）
6. [SUBAGENT-CODE-DELEGATION.md](elysiaclaw_engine/SUBAGENT-CODE-DELEGATION.md) — 子代理代码委派技术设计
7. [DELEGATE-CODE-TASK-PLAN.md](elysiaclaw_engine/DELEGATE-CODE-TASK-PLAN.md) — 实施计划
8. [ROADMAP.md](elysiaclaw_engine/ROADMAP.md) — 选择下一个 Sprint
9. [SPRINT.md](elysiaclaw_engine/SPRINT.md) — 当前 Sprint 工作台
10. [TOOL-PARITY-PLAN.md](elysiaclaw_engine/TOOL-PARITY-PLAN.md) — 工具迁移计划

## 语言与输出规则

- **始终使用简体中文回复用户**。代码、变量名、函数名保持原样
- 先分类再回答：L1 直接回答 / L2 紧凑分析 / L3 完整结构
- 不截断代码/配置/文本
- 密度优先于长度
- 禁止 AI 套话（"作为一个大语言模型"、"好问题！"、"当然！"）
- 批判优先于顺从：用户前提有误时用证据纠正
- 无检索工具时禁止编造精确数据/引用

## Agent 行为规则

### Subagent 使用规范
- 目标明确、输出路径 + 完成标准
- 验证：检查返回的文件是否存在且内容正确，不信任返回消息
- 写死输出路径，不写 memory/

### Golden Rules
1. Sacred files = user approval
2. Destructive = user confirm
3. No outbound without approval
4. No fabrication — "I'm not sure" is valid
5. Config = snapshot → modify → validate
6. Search memory before guessing
7. Verify state, not command success
8. Subagent: check FILE, not return message
9. No plaintext secrets

### 时区
Asia/Shanghai (CST +0800)

# ElysiaClaw — System Prompt (AI Handoff)

> This file is the **primary context document** for any AI assistant taking over this project.
> Read this first. Treat every section as ground truth unless explicitly contradicted by a more recent commit.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project Name | **ElysiaClaw** |
| Origin | Fork of OpenClaw `v2026.3.13`, personal maintenance branch |
| Forked From | `github.com/openclaw/openclaw` (upstream) |
| Our Fork | `github.com/elysiayunchen/pi-mono` |
| Base Framework | `pi-mono` (by Mario Zechner / badlogic) |
| Maintainer | aoseluo (云尘 / 奈緒) — non-professional programmer, AI-collaborative dev model |
| Maintenance Mode | Solo fork, no upstream sync expected |

ElysiaClaw **is not** the upstream OpenClaw. It is a personal AI assistant platform built on top of the pi-mono agent SDK, with extensive custom extensions implementing the full 12-layer Claude Code-inspired agent architecture.

**delegate_code_task**: Sub-agent code analysis delegation tool (2026-06-05). Spawned via `spawnSubagentDirect()` with read-only tools. Main agent delegates multi-file code analysis to prevent context pollution. Replaces the deprecated Code Mode (`/code` `/exit`). See `elysiaclaw_engine/DELEGATE-CODE-TASK-PLAN.md`.

---

## 2. Runtime Environment

| Item | Value |
|---|---|
| Server | `elysiaserver` — Ubuntu 24.04 |
| User | `elysia` |
| Node.js | v22.22.1, managed by `nvm` |
| Network | Tailscale active (IP `100.111.4.5`), but `elysiaclaw status` shows 'off' (pit #44 — use `tailscale status` for ground truth) |
| Telegram Bot | `@ElysiaClaw_Bot` |
| Config Directory | `~/.elysiaclaw/` (migrated from `~/.openclaw/`) |
| Data Directory | `~/.pi/agent/` |
| Claude Code Source | `/home/elysia/pi-mono/claude-code-source-code-main/src` (local, for mechanism reference only) |

**Claude Code source** (for mechanism reference only, not running code):
`/home/elysia/pi-mono/claude-code-source-code-main/src` on elysiaserver.
Source is available locally for reference — no SSH to Windows needed.

---

## 3. Project Architecture — Two-Project Structure

elysiaclaw = 房子（应用层），pi-coding-agent = 地基（底层框架）

elysiaclaw 自己实现的：
- 渠道适配：Telegram, WhatsApp, Discord, Slack
- 应用层工具：exec, process, web_fetch, web_search, browser, canvas, nodes, cron, message, memory, image, tts, sessions
- Gateway 控制平面 + 配置系统 + 安全策略

pi-coding-agent 提供的：
- Agent 核心循环 + Session 管理 + LLM API 统一接口 + 上下文压缩
- 基础工具：read, write, edit, bash, grep, find, ls
- 12 层扩展：Team, Task, Worktree, Background, Autonomous, Plan Mode
- delegate_code_task (子代理代码分析分发) — Code Mode 废弃后替代方案
- P 系列补丁：RateLimitScheduler, FileHistory, PreToolUse Hooks

Tool Registration 四层：
Layer 1: pi-coding-agent 定义 allTools
Layer 2: elysiaclaw 导入 pi-tools.ts
Layer 3: elysiaclaw 可见 tool-catalog.ts
Layer 4: 配置允许 tools.allow

Current Tool Gap — 已全部修复 (2026-04-10, PITFALLS.md #56)：
- grep, find, ls ✅
- enter_plan_mode, exit_plan_mode ✅
- enter_code_mode, exit_code_mode ✅ (已注册但已废弃 — Code Mode 不再使用)
- delegate_code_task ✅ (新增, 2026-06-05)
- todo_write ✅
- enter_worktree, exit_worktree ✅
- undo_last_action, file_history_list ✅
- model_speed_probe ✅
- task_assign ✅
- web_search ✅

Where to Develop：
- 应用层工具 → elysiaclaw
- 补全工具注册 → elysiaclaw
- 修改 Agent 循环/压缩/调度 → pi-coding-agent
- 新增消息渠道 → elysiaclaw

---

## 4. Deployment Architecture

```
Telegram (@ElysiaClaw_Bot)
        │
        ▼
Gateway (ws://100.111.4.5:18789, bind=lan, mode=local)
        │
        ├── Pi Agent (RPC) ← main conversational agent
        ├── pi-coding-agent ← our custom 0.64 dist (deployed into node_modules)
        ├── CLI (elysiaclaw …)
        └── WebChat UI
```

### Global Install Path
```
~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/
├── dist/
├── elysiaclaw.mjs           ← symlink to dist/entry.js (NOT dist/)
├── package.json
└── node_modules/
    └── @mariozechner/
        ├── pi-coding-agent/ ← REPLACED with our 0.64 dist
        ├── pi-agent-core/   ← v0.64 + monkey-patch (setSystemPrompt/replaceMessages)
        ├── pi-ai/           ← v0.64, untouched
        └── pi-tui/          ← v0.64 (compat shim native in 0.64)
```

### Config Files
| Path | Purpose |
|---|---|
| `~/.elysiaclaw/elysiaclaw.json` | Main gateway config |
| `~/.elysiaclaw/.env` | All API keys |
| `~/.elysiaclaw/config.yaml` | Channel config (YAML, indent-sensitive!) |
| `~/.pi/agent/sessions/` | Session JSONL files (tmp-pi-runtime-events subdirs) |
| `~/.pi/agent/tasks/` | Persistent task storage |
| `~/.pi/agent/file-history/` | P3-B file snapshots |
| `~/.pi/agent/learning/patterns.json` | SessionLearner output |
| `~/.pi/agent/hooks/` | PreToolUse shell hooks |
| `~/.pi/agent/costs.json` | TUI cost tracking |

---

## 5. Agents & Providers

| Agent | Role | Default Model |
|---|---|---|
| `main` | Primary conversation | `openrouter/owl-alpha` (config: `agents.defaults.model.primary`) |
| `pi-coding-agent` | Coding tasks | 同 main（未单独配置） |
| `vision` | Image understanding | 同 main（未单独配置） |

**Fallback 链** (config: `agents.defaults.model.fallbacks`):
nemotron → trinity → deepseek → 其他免费模型

**Context Tokens**: 1M (config: `agents.defaults.contextTokens`)

**内置 API Providers** (pi-ai 层, 10 个):
- Anthropic (Messages API), OpenAI (Completions + Responses), Mistral, Azure OpenAI, OpenAI Codex, Google Generative AI, Google Gemini CLI, Google Vertex AI, Amazon Bedrock

**配置层 Providers** (~/.elysiaclaw/elysiaclaw.json, 5 个):
- OpenRouter (primary), 阿里云 Bailian/DashScope, DeepSeek, 智谱 (Zhipu), 智谱 Z.ai

**Critical**: OpenRouter has RPM limits. The P2-D Rate Limit Scheduler (令牌桶) enforces compliance automatically.

---

## 6. Build & Deploy

### Build
```bash
cd ~/pi-mono
npm run build      # Full build (tui → ai → agent → coding-agent)
npm run check      # biome lint + tsgo type-check (requires build first)
npm test           # Run all tests (--workspaces --if-present)
```

根 `package.json` version: `0.0.3` (monorepo 管理版本，各包版本独立为 0.64.0)
Compiler: `tsgo` (TypeScript Go compiler, v7.0.0-dev). **Not in PATH** — always use `npm run build`.

### elysiaclaw Build (Known Issue)

`pnpm build` in elysiaclaw **fails** at `build:plugin-sdk:dts` stage with 6 pre-existing type errors (compaction.ts / attempt.ts / compaction-safeguard.ts / model-discovery.ts / skills/config.ts). These are elysiaclaw vs pi-mono 0.64 API mismatches, not regressions.

**Workaround**: bypass `pnpm build`, run `node scripts/tsdown-build.mjs` + manual remaining steps. See PITFALLS #38.

### One-Command Deploy
```bash
cd ~/pi-mono && ./deploy.sh
```

`deploy.sh` 结构（3 Phase · 12 Step · 5 Guard）：

**Phase A — 框架层**
1. Guard 1: 校验 elysiaclaw.json + config.yaml
2. `npm run build` (pi-mono 4 包)
3. 部署 4 个 dist → global `node_modules/@mariozechner/`
4. Re-apply `scripts/patch-agent.cjs`
5. Guard 2: patch 验证 (setSystemPrompt/replaceMessages + 语法检查)

**Phase B — 应用层**
6. Build elysiaclaw: `node scripts/tsdown-build.mjs` + 后处理（跳过 canvas:a2ui:bundle 和 build:plugin-sdk:dts — Pitfall #38）
7. Deploy dist (clean slate: `rm -rf` + `cp -r`，含文件数下限检查 ≥100)
8. Guard 3: dist 完整性校验（grep memory_search/memory_get/memory-core/createMemorySearchTool）
9. Deploy extensions: 同步 `elysiaclaw/extensions/` → 全局 `node_modules/elysiaclaw/extensions/`

**Phase C — 部署后**
10-11. postinstall + `elysiaclaw gateway restart`
12. Guard 4: 框架工具 parity 检查
13. Guard 5: memory_search E2E 验证（curl POST /tools/invoke）

### Patch Protection
`scripts/patch-agent.cjs` is the guardian of the `pi-agent-core` monkey-patch.
- Runs idempotently (Step 0 cleans previous injection before re-injecting)
- Also copied to `elysiaclaw/scripts-patch/patch-agent.cjs` as a postinstall hook
- **Never run raw `npm install` without verifying the patch survived**

---

## 7. Working Rules for AI Assistants

1. Read source before writing — cat/grep first
2. Write files via Python — never heredoc (Pitfall #1)
3. Use str.replace() not sed (Pitfall #2)
4. Tool registration: four layers must match (Pitfall #51)
5. Bot vs TUI: different tool paths (Pitfall #17/#54)
6. YAML indent-sensitive (Pitfall #30)
7. After deploy verify gateway (Pitfall #22b)
8. pnpm=elysiaclaw, npm=pi-mono, never mix (Pitfall #49/#52)
9. elysiaclaw build needs manual deploy to global (Pitfall #53)

---

## 8. Key Source File Index

| File | Role |
|---|---|
| `packages/coding-agent/src/core/sdk.ts` | `createAgentSession`, 3-layer compression chain |
| `packages/coding-agent/src/core/agent-session.ts` | `AgentSession`, `injectNotification()`, `setCoordinatorMode()` |
| `packages/agent/src/agent.ts` | `Agent` class, `contextPressureThreshold` |
| `packages/agent/src/agent-loop.ts` | Core loop, P1-C token check, `estimateAgentMessages()` |
| `packages/agent/src/types.ts` | `AgentEvent` (incl. `context_pressure`/`context_compacted`) |
| `packages/coding-agent/src/core/compaction/auto-compact.ts` | LLM summary compaction |
| `packages/coding-agent/src/core/compaction/multi-layer.ts` | 3-layer compression entry, threshold=90k |
| `packages/coding-agent/src/core/background-runner.ts` | s08 background process singleton |
| `packages/coding-agent/src/core/autonomous-runner.ts` | s11/s12.1 fire-and-forget executor |
| `packages/coding-agent/src/core/worktree-manager.ts` | s12 worktree lifecycle |
| `packages/coding-agent/src/core/file-history.ts` | P3-B snapshot manager |
| `packages/coding-agent/src/core/hooks/pre-tool-use.ts` | P3-A hook executor |
| `packages/coding-agent/src/core/rate-limit-scheduler.ts` | P2-D token-bucket rate limiter |
| `packages/coding-agent/src/core/task-analyzer.ts` | P2-D task complexity predictor |
| `packages/coding-agent/src/core/model-router.ts` | P2-D model selection by latency/throughput |
| `packages/coding-agent/src/core/session-learner.ts` | P2-D historical RPM & token bias learner |
| `packages/coding-agent/src/core/adaptive-guard.ts` | P2-D dynamic rate threshold adapter |
| `packages/coding-agent/src/index.ts` | **Master tool export** — must include every tool |
| `scripts/patch-agent.cjs` | pi-agent-core monkey-patch (idempotent) |
| `deploy.sh` | One-command build+deploy+restart |
| `~/projects/pi-mono/elysiaclaw_engine/HANDOFF.md` | Live project status (update after each sprint) |

---

## 9. Version Compatibility Matrix

| Package | Version | Status |
|---|---|---|
| `@mariozechner/pi-tui` | 0.64.0 | Replaced, compat shim native |
| `@mariozechner/pi-ai` | 0.64.0 | Replaced, untouched |
| `@mariozechner/pi-agent-core` | 0.64.0 | Replaced + monkey-patch (0.64 anchor) |
| `@mariozechner/pi-coding-agent` | **0.64.0** | Our custom dist |
| pi-mono source | 0.64.0 | Our development base |
| elysiaclaw global install | 0.64.x | Consumer of above |

---

## 10. Test Baselines

| Package | Result |
|---|---|
| `@mariozechner/pi-agent-core` | 36/36 ✅ |
| `@mariozechner/pi-coding-agent` | 858/861 ⚠️ (3 failures: 1 upstream pre-existing, 1 our regression dynamic-provider, 1 TUI rendering) |
| `@mariozechner/pi-tui` | 505/506 (1 flaky, unrelated) |

Any regression below these numbers in a PR/sprint is a blocker.

---

## 11. Documentation File Paths

All AI handoff documents live in a single directory:

~/projects/pi-mono/elysiaclaw_engine/
├── ARCHITECTURE.md
├── CLAUD-CODE-COMPARISON.md
├── DELEGATE-CODE-TASK-PLAN.md
├── HANDOFF.md
├── MEMORY-ACTIVATION-RUNBOOK.md   ← 记忆引擎激活执行手册（T1-T6，已完成）
├── PITFALLS.md
├── README.md
├── ROADMAP.md
├── SPRINT.md
├── SUBAGENT-CODE-DELEGATION.md
├── SUPERADMIN-AGENT-DESIGN.md    ← 超级计算机管理员 Agent 架构设计
├── SYSTEM.md ← you are here
└── TOOL-PARITY-PLAN.md

**Important**: This directory is NOT at the project root (`~/projects/pi-mono/`). It is inside `elysiaclaw_engine/`. Always use this path when reading or updating documentation.

---

## 12. Writing Convention (Long-Term Default)

- **Documentation / explanatory text**: Chinese (中文)
- **Code, rules, instructions, checklists, configs**: English
- This applies to all files in this repo and all AI-generated outputs

---

*Last updated: 2026-06-06. 记忆引擎激活全流程完成 (T1-T6)。deploy.sh 增强至 5 Guard / 12 Step（含 extensions sync + dist 完整性校验 + E2E 验证）。Code Mode 已废弃，由 delegate_code_task 子代理分发替代。elysiaclaw build DTS errors (6, workaround in place, needs dedicated fix)。*

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

**Code Mode**: An independent Claude Code-style coding mode. Users switch in via `/code`, with full 12-layer mechanism replication and environment isolation (no user memory, global skills, or global hooks). Type `/exit` to return to normal mode. Phase 0 minimum viable patch implemented in `attempt.ts` (2026-04-05).

---

## 2. Runtime Environment

| Item | Value |
|---|---|
| Server | `elysiaserver` — Ubuntu 24.04 |
| User | `elysia` |
| Node.js | v22.22.1, managed by `nvm` |
| Network | Tailscale active, IP `100.111.4.5` |
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
- 12 层扩展：Team, Task, Worktree, Background, Autonomous, Plan Mode, Code Mode
- P 系列补丁：RateLimitScheduler, FileHistory, PreToolUse Hooks

Tool Registration 四层：
Layer 1: pi-coding-agent 定义 allTools
Layer 2: elysiaclaw 导入 pi-tools.ts
Layer 3: elysiaclaw 可见 tool-catalog.ts
Layer 4: 配置允许 tools.allow

Current Tool Gap — 已全部修复 (2026-04-09, PITFALLS.md #56)：
- grep, find, ls ✅
- enter_plan_mode, exit_plan_mode ✅
- enter_code_mode, exit_code_mode ✅
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
| `~/.pi/agent/code-sessions/` | Code Mode session files (planned, not yet implemented) |

---

## 5. Agents & Providers

| Agent | Role | Default Model |
|---|---|---|
| `main` | Primary conversation | `openrouter/qwen/qwen3.6-plus:free` |
| `pi-coding-agent` | Coding tasks | `openrouter/qwen/qwen3.6-plus:free` |
| `vision` | Image understanding | `openrouter/qwen/qwen3.6-plus:free` |

**Providers** (in preference order for free/cost-sensitive usage):
- OpenRouter (primary, free model tier)
- Bailian / Qwen (Alibaba Cloud, 通义千问系列)
- DeepSeek
- 智谱 (GLM)

**Critical**: OpenRouter has RPM limits. The P2-D Rate Limit Scheduler (令牌桶) enforces compliance automatically.

---

## 6. Build & Deploy

### Build
```bash
cd ~/pi-mono
npm run build      # Full build (tui → ai → agent → coding-agent → mom → web-ui → pods)
npm run check      # biome lint + tsgo type-check (requires build first)
npm test           # Run all tests
```

Compiler: `tsgo` (TypeScript Go compiler, v7.0.0-dev). **Not in PATH** — always use `npm run build`.

### One-Command Deploy
```bash
cd ~/pi-mono && ./deploy.sh
```

`deploy.sh` does:
1. `npm run build`
2. Copy `packages/coding-agent/dist` → global `node_modules/@mariozechner/pi-coding-agent/dist`
3. Re-apply `scripts/patch-agent.cjs` (adds `setSystemPrompt`/`replaceMessages` to agent.js)
4. Sync postinstall script to protect patch across future `npm install`
5. `elysiaclaw gateway restart`

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
| `~/pi-mono/HANDOFF.md` | Live project status (update after each sprint) |

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
| `@mariozechner/pi-coding-agent` | 860/861 ✅ (1 skipped: needs live API key) |
| `@mariozechner/pi-tui` | 505/506 (1 flaky, unrelated) |

Any regression below these numbers in a PR/sprint is a blocker.

---

## 11. Documentation File Paths

All AI handoff documents live in a single directory:

~/pi-mono/elysiaclaw_engine/
├── ARCHITECTURE.md
├── CLAUD-CODE-COMPARISON.md
├── PITFALLS.md
├── README.md
├── ROADMAP.md
├── SPRINT.md
└── SYSTEM.md ← you are here

**Important**: This directory is NOT at the project root (`~/pi-mono/`). It is inside `elysiaclaw_engine/`. Always use this path when reading or updating documentation.

---

## 12. Writing Convention (Long-Term Default)

- **Documentation / explanatory text**: Chinese (中文)
- **Code, rules, instructions, checklists, configs**: English
- This applies to all files in this repo and all AI-generated outputs

---

*Last updated: 2026-04-05. Architecture optimization sprint completed — 4 BUG fixes, deploy guards, doc normalization. Code Mode Phase 0 MVP in place. Next: Code Mode full framework or P3-C ScheduleCronTool.*

# ElysiaClaw — 个人 AI 助手平台

<p align="center">
  <a href="https://github.com/elysiayunchen/pi-mono"><img alt="GitHub Repo" src="https://img.shields.io/badge/repo-elysiayunchen%2Fpi--mono-333?style=flat-square&logo=github" /></a>
</p>

> 多渠道个人 AI 助手平台。Telegram bot `@ElysiaClaw_Bot` 是主要交互入口。

ElysiaClaw 的代码继承链：**pi-mono**（Agent 框架，by Mario Zechner）→ **OpenClaw**（多渠道 Gateway，by Peter Steinberger，fork pi-mono 作为 SDK 依赖）→ **ElysiaClaw**（fork OpenClaw，因此同时继承了 pi-mono 和 OpenClaw 两个代码库，并进行统一深度定制），实现了对标 Claude Code 的完整 Agent 架构。

## 项目结构

```
pi-mono/                         ← 本仓库
├── packages/
│   ├── agent/                   @mariozechner/pi-agent-core    Agent 核心循环 + 事件流
│   ├── ai/                      @mariozechner/pi-ai            统一 LLM API（20+ 提供商）
│   ├── coding-agent/            @mariozechner/pi-coding-agent  编码 Agent SDK + 工具框架
│   └── tui/                     @mariozechner/pi-tui           终端 UI（差分渲染）
│
├── elysiaclaw/                  ← 应用层（独立 git 仓库，需单独 clone）
│   └── src/agents/              渠道适配 / Gateway / 应用工具 / Cron 系统
│
├── elysiaclaw_engine/           ← AI 协作文档体系
│   ├── SYSTEM.md                核心系统信息
│   ├── ARCHITECTURE.md          架构蓝图
│   ├── PITFALLS.md              64 个踩坑记录
│   ├── ROADMAP.md               规划与目标
│   ├── SPRINT.md                当前 Sprint 工作台
│   ├── CLAUD-CODE-COMPARISON.md 与 Claude Code v2.1.88 逐层对标
│   └── TOOL-PARITY-PLAN.md      工具迁移计划（16 Tasks）
│
├── deploy.sh                    一键构建 + 部署 + Gateway 重启
├── scripts/patch-agent.cjs      pi-agent-core monkey-patch（幂等）
└── claude-code-source-code-main/ Claude Code 源码（机制参考）
```

**构建顺序**：`tui → ai → agent → coding-agent`

## 已完成的 Agent 架构

ElysiaClaw 在 pi-mono 的 SDK/Hooks/Extension 体系之上，实现了完整的 **12 层 Agent 框架** + **8 个基础设施补丁**。所有扩展通过框架预留的扩展点实现，未侵入核心循环。

### 12 层 Agent 框架

| 层 | 机制 | 核心文件 |
|------|------|------|
| s01 | The Loop — 基础循环 | `agent-loop.ts` |
| s02 | Tool Dispatch — 工具注册与分发 | `tools/index.ts`, `src/index.ts` |
| s03 | Planning — Plan Mode + Todo 清单 | `enter-plan-mode.ts`, `todo-write.ts` |
| s04 | Sub-Agents — 子 Agent 分叉 | `agent-session.ts` (fork path) |
| s05 | Knowledge on Demand — 知识懒加载 | `claude-md-loader.ts` |
| s06 | Context Compression — 三层压缩链 | `compaction/multi-layer.ts` |
| s07 | Persistent Tasks — 任务持久化 | `tasks/task-store.ts` |
| s08 | Background Tasks — 后台进程 | `background-runner.ts` |
| s09 | Agent Teams — 团队创建/删除 | `team-create.ts` |
| s10 | Team Protocols — 异步邮箱通信 | `send-message.ts` |
| s11 | Autonomous Agents — 自主认领 | `autonomous-runner.ts` |
| s12 | Worktree Isolation — Git worktree 沙箱 | `worktree-manager.ts` |

### P 系列基础设施补丁

| 补丁 | 功能 | 实现方式 |
|------|------|------|
| P1-A | Monkey-patch 保护（幂等注入 + npm install 后自动恢复） | `scripts/patch-agent.cjs` |
| P1-B | CLAUDE.md 懒加载 | `claude-md-loader.ts` |
| P1-C | Context Pressure 事件（80k token 阈值主动预警） | `agent-loop.ts` + `contextPressureThreshold` |
| P2-A | Session 持久化 + 续会（continueRecent / sessionPath） | `sdk.ts` |
| P2-B | Cost Tracker（TUI 实时 + Bot 报告脚本） | `wrapStreamForCost()` + `cost-report.py` |
| P2-D | 三阶段速率调度器（令牌桶 + 任务分析 + 模型路由） | `rate-limit-scheduler.ts` 等 |
| P3-A | PreToolUse Shell Hooks（工具级 + 全局级） | `hooks/pre-tool-use.ts` |
| P3-B | File History + Undo（文件快照与回滚） | `file-history.ts`, `undo-action.ts` |

### Tool Parity 进展

以 Claude Code v2.1.88 为基准，逐工具对标增强。已完成：

| Task | 内容 | 状态 |
|------|------|------|
| Task 0 | ToolDefinition 接口扩展（7 → 18 字段） | ✅ |
| Task 1 | GrepTool 参数补全（output_mode, -A/-B, type, multiline, mtime 排序） | ✅ |
| Task 2 | BashTool 增强（run_in_background, 6 个能力/UI/安全方法） | ✅ |
| Task 12 | web_fetch 注册到 Bot 四层工具链 | ✅ |
| Task 3-11, 13-16 | TodoWrite 重写、WebSearch、MCP 协议、并行执行等 | 待执行 |

### Code Mode

独立的 Claude Code 风格编码模式，通过 `/code` 手动切换进入，`/exit` 退出。环境隔离（不加载用户记忆、全局 skills/hooks），工具集完整保留。

- **Phase 0**：MVP 补丁已实现在 `attempt.ts` 路径 — 功能验证待做
- **完整框架**（独立 session 目录 `~/.pi/agent/code-sessions/`、CodeModeManager 类）— 下一步

### 架构优化 Sprint 成果（2026-04-05）

| 编号 | 修复内容 |
|------|------|
| BUG-1 | `tools/index.ts` allTools 补全 3 个遗漏工具 |
| BUG-2 | `createAllTools()` 补全 5 个遗漏工具 |
| BUG-3 | `src/index.ts` 补全 6 个 re-export |
| BUG-4 | `config.yaml` gateway.mode `lan` → `local` |
| — | `deploy.sh` 加装 3 道守卫（配置校验 + patch 验证 + 工具一致性检查） |
| — | `patch-agent.cjs` 重写为完全幂等 + smoke test |

## 运行环境

| 项目 | 值 |
|------|------|
| 服务器 | `elysiaserver` (Ubuntu 24.04) |
| Node.js | v22.22.1 (nvm) |
| 网络 | Tailscale (IP 100.111.4.5) |
| Telegram Bot | `@ElysiaClaw_Bot` |
| Gateway | ws://127.0.0.1:18789 (mode=local) |
| 配置目录 | `~/.elysiaclaw/` |
| 数据目录 | `~/.pi/agent/` |
| 主要模型 | OpenRouter `qwen/qwen3.6-plus:free` |

## 开发指南

```bash
npm install          # 安装所有依赖（使用 npm workspaces，非 pnpm）
npm run build        # 构建所有包
npm run check        # biome lint + tsgo type-check（需先 build）
./test.sh            # 运行测试
./pi-test.sh         # 从源码运行 pi
```

### 一键部署

```bash
cd ~/pi-mono && ./deploy.sh
```

`deploy.sh` 执行流程：
1. `npm run build`
2. 替换全局 `node_modules/@mariozechner/pi-coding-agent/dist`
3. 重新应用 `scripts/patch-agent.cjs`（幂等）
4. 同步 postinstall 保护脚本
5. `elysiaclaw gateway restart`
6. 6 道守卫自动验证（YAML 配置 / patch 语法 / 工具一致性 / config.yaml mode / Gateway 响应）

### 测试基线

| 包 | 结果 |
|------|------|
| `@mariozechner/pi-agent-core` | 36/36 |
| `@mariozechner/pi-coding-agent` | 858/861 (3 failures 预存) |
| `@mariozechner/pi-tui` | 505/506 (1 flaky) |

### 已知技术债

| 项目 | 说明 |
|------|------|
| DTS 类型错误 ×6 | `pnpm build` 在 elysiaclaw 端阻塞，绕过方式：`node scripts/tsdown-build.mjs` |
| models.generated.ts | 手动编辑了模型参数，需迁移到 `scripts/generate-models.ts` 数据源 |
| pi-agent-core monkey-patch | `setSystemPrompt`/`replaceMessages` 依赖运行时注入 |
| OpenRouter 路由劫持 | 临时绕过直连阿里云 Bailian，根因未修 |
| Code Mode | Phase 0 功能验证未做（Definition of Done 12 项待勾选） |

## AI 协作者快速入口

首次接手时按顺序阅读：
1. [SYSTEM.md](elysiaclaw_engine/SYSTEM.md) — 运行环境、构建部署、文件索引
2. [ARCHITECTURE.md](elysiaclaw_engine/ARCHITECTURE.md) — 架构蓝图
3. [PITFALLS.md](elysiaclaw_engine/PITFALLS.md) — 64 个踩坑记录（必读）
4. [ROADMAP.md](elysiaclaw_engine/ROADMAP.md) — 选择下一个 Sprint
5. [SPRINT.md](elysiaclaw_engine/SPRINT.md) — 开始工作

## 许可证

MIT

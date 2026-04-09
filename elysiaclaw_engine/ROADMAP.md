# ElysiaClaw — Roadmap & Optimization Targets

> 本文档记录未竟工作项、中期规划和长期探索方向。
> 每个 sprint 结束后更新完成状态。
> AI 协作者在开始新功能前请先阅读对应条目。

---

## 当前状态快照（2026-04-05）

**12 层 Agent 框架**：全部竣工（s01-s12.1）  
**P 系列补丁**：P1-A/B/C + P2-A/B/D (Phase 1+2+3) + P3-A/B 全部完成  
**Code Mode Phase 0**：MVP 补丁已实现（attempt.ts 路径），完整框架待建  
**pi-mono 统一版本**：0.64.0（pi-agent-core / pi-ai / pi-tui / pi-coding-agent 全部统一）  
**架构优化 Sprint**：工具注册 BUG 修复、deploy 守卫、文档归一化完成  
**工具注册四层修复 (2026-04-09)**：全部12层工具已正确注册到 elysiaclaw（L2-L4）  
**残余技术债**：
- ~~DTS 类型错误~~ — **已自然消失（2026-04-06 确认）**，`pnpm build` 全链路干净
- OpenRouter→阿里云路由劫持（坑 #40）— 临时规避，根因未修
- Code Mode 完整框架（独立 session 目录、CodeModeManager 类）— Phase 0 后的下一步

---

## 🔴 核心目标：Code Mode — 独立 Claude Code 风格模式

> 在 ElysiaClaw 内部设立独立的 Code Mode，用户通过 `/code` 手动切换进入。
> 完整复刻 Claude Code 的 12 层机制，只做环境隔离（排除用户记忆、全局 skills/hooks、闲聊上下文），
> 不做功能裁剪。`/exit` 退出回到用户模式。

### 核心理念

| 维度 | 用户模式 | Code 模式 |
|---|---|---|
| System Prompt | 完整个人助手 prompt | 精简 coding prompt |
| 工具集 | 全部 31+ 工具 | 全部 31+ 工具（同 Claude Code，不做裁剪） |
| Team/Task/Background/Autonomous/Worktree | 完整 | 完整 |
| Memory | 加载 ~/.pi/agent/memory | 不加载 |
| 全局 Skills | 加载 ~/.pi/agent/skills | 不加载（只加载项目级） |
| 全局 Hooks | 加载 ~/.pi/agent/hooks | 不加载 |
| 全局 CLAUDE.md | 加载 | 不加载 |
| Session | ~/.pi/agent/sessions/ | ~/.pi/agent/code-sessions/（独立目录） |
| 续会 | continueRecent: true | 全新 session（不续） |
| 日志级别 | normal | minimal |

### 实施阶段

#### Phase 0: Code Mode 基础框架（最高优先级）
- 新增 `code-mode/code-agent-config.ts` — Code 模式 Agent 配置
- 新增 `code-mode/code-session-manager.ts` — 独立 session 管理
- 新增 `code-mode/code-system-prompt.ts` — 精简 coding prompt
- 新增 `code-mode/code-tool-registry.ts` — 完整工具集注册（不裁剪任何工具）
- 新增 `tools/enter-code-mode.ts` — `/code` 命令入口
- 新增 `tools/exit-code-mode.ts` — `/exit` 命令出口
- 修改 `agent-session.ts` — 添加 codeMode 状态 + 消息路由
- 修改 `src/index.ts` — 导出新工具

#### Phase 1: 并行工具执行引擎（StreamingToolExecutor）
- 新增 `core/streaming-tool-executor.ts` — 按 isConcurrencySafe() 分区并行
- 修改 `tools/index.ts` — ToolDefinition 添加 isConcurrencySafe/isReadOnly/isDestructive
- 修改 `agent-loop.ts` — 替换串行 executeToolCalls() 为并行版本
- 工具分类：read/grep/find 并行；write/edit/bash 串行

#### Phase 2: 权限系统增强
- 新增 `core/permission-rules.ts` — alwaysAllow/alwaysDeny/alwaysAsk 规则引擎
- 修改 `hooks/pre-tool-use.ts` — 集成规则引擎到 hook 流程
- 修改 `~/.elysiaclaw/config.yaml` — 添加权限规则配置段

#### Phase 3: Web 工具
- 新增 `tools/web-fetch.ts` — HTTP 获取，HTML→Markdown
- 新增 `tools/web-search.ts` — Web 搜索（SearXNG/Brave API）
- 新增 `core/html-to-markdown.ts` — HTML 转换
- 依赖：npm install turndown undici

#### Phase 4: MCP 协议集成
- 新增 `core/mcp/connection-manager.ts` — 连接管理（stdio/sse/http/ws）
- 新增 `core/mcp/stdio-transport.ts` — stdio 传输
- 新增 `core/mcp/sse-transport.ts` — SSE 传输
- 新增 `tools/mcp-tool.ts` — MCP 工具包装器
- 新增 `tools/list-mcp-resources.ts` — 资源列表
- 新增 `tools/read-mcp-resource.ts` — 资源读取
- 依赖：npm install @modelcontextprotocol/sdk

#### Phase 5: 结构化用户交互
- 新增 `tools/ask-user-question.ts` — 多选/自由文本交互
- TUI 模式渲染选项列表，Bot 模式发送 Telegram inline keyboard

### 与 Claude Code 的对标目标

| Claude Code 机制 | ElysiaClaw 现状 | Code Mode 目标 |
|---|---|---|
| s01 The Loop | ✅ 对等 | ✅ 保留 |
| s02 Tool Dispatch (40+ tools) | ⚠️ 31 tools | 补全到 40+ (Phase 3/4/5) |
| s03 Planning | ✅ 对等 | ✅ 保留 |
| s04 Sub-Agents | ⚠️ 部分（无进程级 fork） | ✅ 保留（后续考虑进程级） |
| s05 Knowledge on Demand | ✅ 对等 | ✅ 保留（仅项目级） |
| s06 Context Compression | ⚠️ 部分（无 contextCollapse） | ✅ 保留 |
| s07 Persistent Tasks | ✅ 对等 | ✅ 保留 |
| s08 Background Tasks | ⚠️ 部分（无 daemon 架构） | ✅ 保留 |
| s09 Agent Teams | ✅ 对等 | ✅ 保留 |
| s10 Team Protocols | ✅ 对等 | ✅ 保留 |
| s11 Autonomous Agents | ✅ 对等 | ✅ 保留 |
| s12 Worktree Isolation | ✅ 对等 | ✅ 保留 |
| 并行工具执行 | ❌ 缺失 | Phase 1 实现 |
| MCP 协议 | ❌ 缺失 | Phase 4 实现 |
| Web 工具 | ❌ 缺失 | Phase 3 实现 |
| 权限规则引擎 | ❌ 缺失 | Phase 2 实现 |
| 结构化交互 | ❌ 缺失 | Phase 5 实现 |


## 🟡 短期（下一 Sprint）

### [P2-C] Worktree → Auto PR/Merge
**优先级**: 🔥 高（推荐首选）  
**目标**: 在 s12 Worktree 隔离完成后自动创建 Pull Request / 合并

**实现思路**:
```
exit_worktree (keep=true)
    └── detect: is this a git worktree? (git worktree list)
          └── create PR via gh CLI
                ├── gh pr create --title "..." --body "..."
                └── optional: gh pr merge --auto
```

**依赖**:
- s12 Worktree Isolation ✅
- `gh` CLI 需要安装并认证
- 考虑：如何生成有意义的 PR 标题和描述（让 LLM 生成？）

**文件改动预估**:
- `tools/exit-worktree.ts` — 添加 `createPR?: boolean` 参数
- `worktree-manager.ts` — 添加 `createGitHubPR()` 方法
- `src/index.ts` — 无需改动（已有 exit_worktree）

---

> ~~[P3-C] ScheduleCronTool~~ **已废弃（2026-04-06）**：上游 ElysiaClaw 已内置完整工业级 cron 系统（`elysiaclaw/src/cron/` + `agents/tools/cron-tool.ts`），接口为 `action: status|list|add|update|remove|run|runs|wake` 的统一工具，并有独立 CLI（`elysiaclaw cron`）。无需自研。

---

## 🟢 中期规划（1-3 个月）

### [P4-A] Swarm 并发 Worktree 调度器
**目标**: 多个 worktree 并发执行，semaphore 控制并发数，优先级队列调度

**核心挑战**:
- 并发 git worktree 的磁盘竞争
- Session 隔离（每个 worktree 独立 session）
- 进度聚合（coordinator 如何汇总多个 agent 的进度）

**参考**: Claude Code 的 swarm/ 实现（见架构文档 Part 1）

---

### [P2-C 扩展] GitHub Actions 集成
**目标**: 从 ElysiaClaw 触发 CI/CD，并在 Actions 完成后接收回调

```
task_assign (worktree: true)
    └── exit_worktree (createPR: true)
          └── GitHub webhook → 触发 Actions
                └── Actions 完成 → POST 回调到 elysiaserver
                      └── injectNotification() 通知 agent
```

---

### [P3-D] 长期记忆系统
**目标**: 跨 session 的结构化记忆（不只是 session JSONL 续会）

**候选方案**:
- 向量数据库（SQLite + sqlite-vec？）
- 简单的关键词索引 + 摘要（类似旧版 QQ Bot 记忆系统 v3.0）
- CLAUDE.md 自动更新（让 LLM 在 session 结束时写入关键信息）

---

## 🔵 长期探索（3 个月+）

### [P4-B] LSPTool — Language Server Protocol 集成
**目标**: 通过 vscode-languageserver-protocol 给 LLM 提供语义代码信息（类型、引用、诊断）

**价值**: 让 agent 理解代码语义，而不只是文本搜索  
**复杂度**: 极高，需要为每种语言启动 LSP server

---

### [P5-A] Voice Interface
**目标**: 通过 Telegram 语音消息与 ElysiaClaw 交互

**技术栈**:
- Whisper (speech-to-text)
- TTS（ElevenLabs / OpenAI TTS）
- grammY voice message handler

---

### [P5-B] Canvas / 富文本渲染
**目标**: 类似 OpenClaw 原版的 Canvas 功能，在 Telegram 中渲染图表/表格

---

## 技术债监控

| 项目 | 风险 | 状态 |
|---|---|---|
| pi-agent-core monkey-patch | 每次 `npm install` 可能被覆盖 | ✅ P1-A 已保护 |
| Bot/TUI 工具路径双轨 | 新增工具需同时注册两处 | ✅ deploy.sh Guard 3 自动检查 |
| pi-coding-agent 版本号不一致 | package.json 显示 0.58.0 但功能是 0.64.0 | ✅ 已修复 (2026-04-07) |
| ModelSpeedCache TTL=1h | 长时间运行后可能用到过期数据 | 低风险 |
| Session JSONL 无限增长 | 磁盘可能慢慢满 | 低风险，有自动 compact |
| OpenRouter 免费模型限流 | 高峰期 429 | ✅ P2-D 已处理 |

---

## Sprint 日志

| 日期 | Sprint | 内容 |
|---|---|---|
| 2026-04-03 | s07-s12, P1-A, P2-A, P2-B, P2-D(Ph3), P3-A | 大规模功能实现 |
| 2026-04-04 | s09 首次修复, s12 worktree 残留修复 | Bug fixes |
| 2026-04-07 | s09 二次修复, P1-A 修复, P1-C, P2-D(Ph1+2), P3-B | 补全 + 新功能 |
| 2026-04-07 | OpenClaw → ElysiaClaw 包名迁移 | 品牌迁移 |
| 2026-04-05 | 架构优化 Sprint | BUG-1~4 修复、deploy 守卫、文档归一化、.bak 清理 |

---

## 下一个 AI 接手时的建议顺序

1. 读 `SYSTEM.md` → 了解运行环境和规则
2. 读 `ARCHITECTURE.md` → 理解架构
3. 读 `PITFALLS.md` → 避开已知坑
4. 读本文档 → 选择下一个 sprint
5. **推荐首先实现**: `[WebFetch/WebSearch]`（Phase 3，无前置依赖，填补 s02 关键缺口）
6. **或者**: `[P2-C] Worktree → Auto PR/Merge`（需先 `sudo apt install gh && gh auth login`）
7. ~~P3-C ScheduleCronTool~~ — 上游已内置，已废弃

---

*最后更新：2026-04-09*

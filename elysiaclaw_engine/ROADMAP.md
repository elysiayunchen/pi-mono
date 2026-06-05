# ElysiaClaw — Roadmap & Optimization Targets

> 本文档记录未竟工作项、中期规划和长期探索方向。
> 每个 sprint 结束后更新完成状态。
> AI 协作者在开始新功能前请先阅读对应条目。

---

## 当前状态快照（2026-06-06）

**12 层 Agent 框架**：全部竣工（s01-s12.1）  
**P 系列补丁**：P1-A/B/C + P2-A/B/D (Phase 1+2+3) + P3-A/B 全部完成  
**Code Mode**：已废弃，由 `delegate_code_task` 子代理分发替代  
**delegate_code_task**：✅ 已完成实施（2026-06-05），Telegram 端到端验证受阻于模型不可用
**Telegram 流式输出**：🔧 进行中 (2026-06-06)
  - Tool lane 流式显示：✅ 已实施（坑 #70: minInitialChars 防抖修复）
  - Tool result phase 路由：✅ 已修复 — onToolStart 现在处理 phase "result"，tool lane 显示 "📖 Read: /path"
  - Thinking/Reasoning 流式：已接线，需 session `reasoningLevel: "stream"` 配置
  - Tool 完整 stdout 输出：需 verboseLevel="full"（下一 Sprint）
**pi-mono 统一版本**：0.64.0  
**packages/ 精简**：mom/web-ui/pods 已删除（只剩 tui/ai/agent/coding-agent 4 个包）  
**Tool Parity 进度**：3/16 = 18.75%
- Task 0 (ToolDefinition 接口扩展): ✅ 已完成
- Task 1 (GrepTool 参数补全): ✅ 已完成
- Task 2 (BashTool 能力声明): ✅ 已完成
- Task 3-16: 待执行

**跨会话记忆**：✅ 已完成 (2026-06-06)
  - `scripts/session-indexer.py` — 增量索引 JSONL → SQLite，支持中英文搜索
  - `session_search` 工具 — 四层注册完整，系统提示注入 MANDATORY 指引
  - 覆盖 70 个真实 Telegram 会话，agent 现在可以检索历史对话

**残余技术债**：
- DTS 类型错误 ×6 — `pnpm build` 在 `build:plugin-sdk:dts` 阶段阻塞，绕过方式：`node scripts/tsdown-build.mjs`（PITFALLS #38）
- OpenRouter→阿里云路由劫持（坑 #40）— 临时规避，根因未修
- Telegram 端到端验证 — delegate_code_task 功能测试进行中（主模型不可用导致验证受阻）

---

## 🔴 核心目标 — delegate_code_task ✅ 已完成

> Code Mode (`/code` `/exit`) 已废弃 (2026-06-05)。
> 新策略：代码能力内置为 agent 的手段，通过 `delegate_code_task` 分发给只读子代理，防止主 session 上下文膨胀。

### 实施内容

- **新工具**: `elysiaclaw/src/agents/tools/delegate-code-task.ts`，封装 `spawnSubagentDirect()`
- **四层注册**: elysiaclaw-tools.ts + tool-catalog.ts + tools.allow
- **策略注入**: attempt.ts 中注入分发决策流程指引
- **Code Mode 清理**: attempt.ts 检测块已移除，各引擎文件已更新

### 残余工作

- Telegram 端到端验证
- 观察 agent 是否按预期分发多文件分析任务

---

## 🟡 短期（下一 Sprint）


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
| 2026-04-10 | System Audit + Tool Parity | 系统盘查、GrepTool 参数补全 (Task 1)、ToolDefinition 接口扩展 (Task 0)、引擎文件更新 |
| 2026-06-05 | packages/ 精简 | 删除 mom/web-ui/pods，只剩 4 个核心包 |
| 2026-06-05 | delegate_code_task | Code Mode 废弃，子代理分发工具实施 + 引擎文件整理 |

---

## 下一个 AI 接手时的建议顺序

1. 读 `HANDOFF.md` → 当前状态快照
2. 读 `SYSTEM.md` → 了解运行环境和规则
3. 读 `ARCHITECTURE.md` → 理解架构
4. 读 `PITFALLS.md` → 避开已知坑
5. 读本文档 → 选择下一个 sprint
6. **推荐首先做**: Telegram delegate_code_task 端到端验证
7. **然后**: 修复 6 个 DTS 类型错误（消除 pnpm build 阻塞）
8. **再然后**: Tool Parity Task 3-16 继续推进
9. **或者**: `[P2-C] Worktree → Auto PR/Merge`（需先 `sudo apt install gh && gh auth login`）

---

*最后更新：2026-06-05*

# ElysiaClaw — Roadmap & Optimization Targets

> 本文档记录未竟工作项、中期规划和长期探索方向。
> 每个 sprint 结束后更新完成状态。
> AI 协作者在开始新功能前请先阅读对应条目。

---

## 当前状态快照（2026-06-07）

**12 层 Agent 框架**：全部竣工（s01-s12.1）  
**P 系列补丁**：P1-A/B/C + P2-A/B/D (Phase 1+2+3) + P3-A/B 全部完成  
**Code Mode**：已废弃，由 `delegate_code_task` 子代理分发替代  
**delegate_code_task**：✅ 已完成实施（2026-06-05），Telegram 端到端验证受阻于模型不可用
**序 1-7 统一实施**：✅ 全部完成 (2026-06-07)
  - 序 1 索引化注入+B4 改造 ✅ | 序 2 压缩可见性 WS-1 ✅ | 序 3 全流式 WS-2 ✅
  - 序 4 L0 工具结果驱逐 ✅ | 序 5 统一注入预算器 ✅ | 序 6 输入分类器 ✅
  - 序 7 用户画像 User Model ✅ (SQLite + 双路径更新 + B2 注入)
  - 边缘情况加固: 正则修复、防守代码、门限常量化
**pi-mono 统一版本**：0.64.0  
**packages/ 精简**：mom/web-ui/pods 已删除（只剩 tui/ai/agent/coding-agent 4 个包）  
**Tool Parity 进度**：3/16 = 18.75%
- Task 0 (ToolDefinition 接口扩展): ✅ 已完成
- Task 1 (GrepTool 参数补全): ✅ 已完成
- Task 2 (BashTool 能力声明): ✅ 已完成
- Task 3-16: 待执行

**跨会话记忆**：✅ 已完成 (2026-06-06) — 记忆引擎激活全流程
  - TS memory_search: 121 files, 508 chunks, pplx-embed-v1-4b (2560d), FTS trigram
  - Python session_search 已删除（T5 清理 + 退四层注册）
  - RECALL 注入已激活（T6: 每轮 system prompt 自动召回 top-5）

**残余技术债**：
- ~~DTS 类型错误 ×6~~ → ✅ 已修复 (2026-06-07)；~~tsgo 全仓 53 类型错误~~ → ✅ 已修复 (2026-06-07)
- OpenRouter→阿里云路由劫持（坑 #40）— 临时规避，根因未修
- sessions chunks 47% CLAUDE.md 注入噪音 — 后续 World Model 阶段去噪
- Tool Parity 剩余 3 个 Task (14/15/16) 待执行
- Telegram 端到端验证 — delegate_code_task 功能测试受阻于主模型不可用
- stripPluginOnlyAllowlist 时序问题 — `group:memory` 在 plugin 注册前被判定为 unknown（cosmetic，不影响功能）
- `computeInjectionBudget` 未接入运行时（SDK 用硬编码阈值，不随 1M 窗口缩放）
- `input-classifier` 数据源偏窄（短陈述句落入 task，identity.name 提不出）

---

## 🔴 核心目标 — 记忆引擎激活 ✅ 已完成 (2026-06-06)

> 执行手册: `MEMORY-ACTIVATION-RUNBOOK.md`（T1-T6，已于 2026-06-06 全部完成）
> 总架构: `SUPERADMIN-AGENT-DESIGN.md`（Phase 1 完成，Phase 2 World Model 待启动）

### 完成内容

| 任务 | 内容 | 状态 |
|------|------|------|
| T2 | 开 config: memorySearch.sources=[memory,sessions] + experimental.sessionMemory=true | ✅ |
| T3 | 全量回填: 121 files · 508 chunks | ✅ |
| T4 | 并行验证: TS FTS trigram + pplx-embed-v1-4b vs Python LIKE | ✅ |
| T4b | FTS tokenizer: unicode61 → trigram（CJK 3+ 字符搜索修复） | ✅ |
| T4c | Embedding 模型: nvidia/llama-nemotron → perplexity/pplx-embed-v1-4b (2560d) | ✅ |
| T5 | 切换 + 清理: 删 session-search-tool.ts + session-indexer.py + session-index.db | ✅ |
| T6 | RECALL 注入: attempt.ts 每轮 system prompt 自动 search top-5 | ✅ |

### 部署修复（同日）

deploy.sh 发现并修复了导致"代码提交但 dist 未部署"的 3 个结构性缺陷（详见 SPRINT.md）：
1. Clean slate deploy（rm -rf + cp -r，含文件数下限检查）
2. Extensions 同步（新增 Step 9）
3. Dist 完整性校验（新增 Guard 3）+ E2E 验证（新增 Guard 5）

---

## 🟢 Core — 统一实施优先级 (2026-06-07 序1-7全部完成)

> 优先级总表: `ARCHITECTURE.md` Part 9.3

| 工作流 | 内容 | 状态 |
|------|------|------|
| 序 1 索引化注入+B4 | RECALL snippet→索引信号, 移出 system prompt, 修 KV-cache 病灶 | ✅ 2026-06-06 |
| 序 2 WS-1 压缩可见性 | 压缩 start/done 状态推送 + typing 心跳续命 | ✅ 2026-06-07 |
| 序 3 WS-2 全流式 | thinking 默认流式 + 统一 lane 契约 | ✅ 2026-06-07 |
| 序 4 L0 工具驱逐 | consumed tool result → [EVC] 摘要, 幂等检测 | ✅ 2026-06-07 |
| 序 5 注入预算器 | system prompt tokens 计入压缩阈值, 防反身性 | ✅ 2026-06-07 |
| 序 6 输入分类器 | task/chat/affective/meta 四分类, 偏向 task | ✅ 2026-06-07 |
| 序 7 用户画像 | SQLite 持久化 + 双路径更新 + B2 注入 | ✅ 2026-06-07 |
| 序 8 Conversation+Handoff | 手动 rotate 验证精度 | 🔄 阶段 1-3 完成 (2026-06-07) |

> **分层注入架构 `CONTEXT-INJECTION-ARCHITECTURE.md`**(2026-06-06):WS-3 的上位设计。按变化频率分 B0-B4 五带 + 消息流,钉 KV-cache 锚点,易变注入(RECALL/World Model)下沉锚点之后。**已发现严重病灶**:RECALL 被 append 进 system prompt(`attempt.ts:1781`),每轮变化致稳定前缀(base+GUIDANCE 数 k token)KV-cache 每轮全失效、重 prefill——token 白烧的根因。

> **会话轮换与跨会话延续 `SESSION-ROTATION-CONTINUITY.md`**(2026-06-06):把 session 从"用户可见对话单元"解耦为"模型工作记忆周期单元"。用户单对话框无感持久对话,模型按语义边界自主轮换 session(刷新工作记忆窗口),归档 session 回写记忆引擎。**设计红线**:延续必须双轨——精确执行状态走结构化 Handoff Packet(B3),背景知识走 memory_search 召回(B4);纯靠记忆检索延续任务会准确性塌陷。三层架构 Conversation/Session/Handoff;复用 SessionEntry + resume 机制;轮换=CONSOLIDATE 时机。新增 §4B 任务段(Task Segment)实时打包:`用户指令→完成信号`为边界,带索引头(type+status+goal)实时 streaming capture,Handoff 零额外提炼;任务内三级压缩(L1 工具结果驱逐/L2 任务段归档/L3 会话轮换,颗粒度递增频率递减,消费即降权)。

> **知识库与自我进化 `KNOWLEDGE-BASE-EVOLUTION.md`**(2026-06-06):上下文=信息接收系统的范式。核心①**索引化注入**:系统注入只给轻量索引信号(指针),完整内容靠 `memory_get`(KNOWN 已存在)按需取——病灶是 `attempt.ts:1781` 把 snippet 当内容注入;修正为"索引为主+强相关预取"分级,非一刀切全索引。②**输入分类**(task/chat/affective/meta,误判成本不对称→偏向 task),闲聊不进任务轨但进画像流。③**用户画像 User Model**(KNOWN 真空白,新建)。④**技能进化**(KNOWN skills 只读,episode→skill+沙箱+HITL)。⑤**自我进化闭环**:接收→分类→CONSOLIDATE→更新画像/固化技能/沉淀记忆→索引化注入回认知,内置非用户改善。阶段 1(索引化注入)ROI 最高、复用现成工具、与 CONTEXT-INJECTION B4 改造同处代码。**5 份设计已成网,亟需 ARCHITECTURE.md 总览图**。

**关键诊断坐标**:`compact.ts:918`(阻塞无 emit)· `typing.ts:28`(TTL 2min)· `bot-message-dispatch.ts:133`(reasoning 默认 off)· `attempt.ts:1781`(RECALL append 进 system,毁 KV-cache 前缀)。
**WS-1/WS-2 可并行,均为渠道层改造,不依赖主模型**。WS-3 注入预算器是 World Model 注入前的硬前置。

---

## 🟡 delegate_code_task ✅ 已完成 (2026-06-05)

> Code Mode (`/code` `/exit`) 已废弃。
> 新策略：代码能力内置为 agent 的手段，通过 `delegate_code_task` 分发给只读子代理，防止主 session 上下文膨胀。

### 残余工作

- Telegram 端到端验证 — 受阻于主模型不可用
- 观察 agent 是否按预期分发多文件分析任务

---

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
| 2026-06-06 | 记忆引擎激活 (T1-T6) | TS memory_search 全面取代 Python session_search，RECALL 注入激活 |
| 2026-06-06 | deploy.sh 增强 | 修复 dist/extensions 部署遗漏（根因），新增 2 Guard + extensions sync + E2E 验证 |
| 2026-06-07 | 序 1-7 统一实施 | L0-L3压缩链 + 注入预算器 + 输入分类器 + 用户画像 全部完成 |
| 2026-06-07 | tsgo 类型检查 53→0 | 全仓类型错误清零，npm run check 不再阻塞 |
| 2026-06-07 | 序 8 Conversation+Handoff 阶段 1-3 | session-rotation 模块 (9 文件 73 测试) + rotate_session 工具 + B3 Handoff 注入 + 自动轮换检测 |

---

## 下一个 AI 接手时的建议顺序

1. 读 `HANDOFF.md` → 当前状态快照
2. 读 `SYSTEM.md` → 了解运行环境和规则
3. 读 `ARCHITECTURE.md` → 理解架构
4. 读 `PITFALLS.md` → 避开已知坑（含新增 #86 tsgo 类型检查）
5. 读本文档 → 选择下一个 sprint
6. **建议第一步**: World Model 地基（Phase 2，见 SUPERADMIN-AGENT-DESIGN.md）— 超算管理员核心能力，纯逻辑不依赖模型
7. **或者**: Tool Parity Task 14（AskUserQuestion）/ Task 15（MCP）/ Task 16（并行执行）
8. **或者**: `[P2-C] Worktree → Auto PR/Merge`（需先 `sudo apt install gh && gh auth login`）
9. **中期**: World Model 接入循环（Phase 3）→ CONSOLIDATE 闭环（Phase 4）
10. **阻塞项**: delegate_code_task Telegram 端到端验证 — 需可用模型

---

*最后更新：2026-06-07*
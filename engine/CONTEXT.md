# CONTEXT — Elynyx
> 快照日期：2026-06-11 | 每次会话开始时，读完 ENGINE_MAP 后优先阅读此文件。


## 状态面板
| 维度 | 状态 |
|------|------|
| 构建 | ✅ 正常（`pnpm run check` elysiaclaw 通过，128 预存类型错误非迁移引入） |
| 测试 | ✅ cognitive-memory 111/111 + attempt 64/64 + channels 2263/2300（37 失败均为 web/discord/browser 预存） |
| 上次完成 | 会话 40：PLAN-15 S5b 历史回填 ✅（backfillFromProjections 读取投影表生成合成事件 + 幂等可重跑 + 19 测试全绿 + tsdown 构建通过） |
| 当前优先 | PLAN-15 S5c — 双写窗口（≤1周）：旧直写路径与新日志路径并行，每日 checksum reconcile（投影重建 vs 在线状态逐表比对） |
| 阻塞 | ~~Telegram 代理节点不可达~~ 2026-06-11 实测可达（看门狗经 7890 代理告警送达），疑为间歇性；持续观察 |
| 产品目标完成度 | 约 87% — 认知架构 M0-M8 完成 + 流式空白修复 + 测试全绿 + 框架层汇入完成 |


## 当前状态概述
Elynyx 是基于 pi-mono 框架构建的多渠道 AI 助手平台（已完成品牌化迁移），运行在 `elysiaserver` (Ubuntu 24.04)，通过 Telegram Bot `@Elynyx_Bot` 交互。项目维护者为 aoseluo（云尘 / 奈緒），采用 AI 协作开发模式，独立维护，不与上游同步。

当前处于认知架构演进的关键阶段：序 1-7 已全部完成。**传统 session 机制已彻底废除**，统一记忆模型为认知工作集（PLAN-13，取代 PLAN-09/12）。PLAN-09 P0/P1 已完成并部署。PLAN-13 执行计划已派生为 TASK-12~TASK-21（M0-M9 迁移链），**M0 已完成 + 已审查**（task 边界改控制流，P096–P100 已录入），M1/M2/M4 可并行启动。

### PLAN-13 迁移链状态
| 步骤 | TASK | 状态 | 关键改动 | 前置 |
|------|------|------|----------|------|
| M0 | TASK-12 | ✅ 完成 | startSegment 改控制流 + sealSegment 加休止判定(isQuiescent含pending_approval) + attempt.ts 调用侧改造(三路分支+模块级tracker注册表+回合结束不封口) + ToolCallRecord新增pending_approval状态 | 无 |
| M1 | TASK-13 | ✅ 完成 | C2 索引头改模型写（seal 时 LLM 自述 goal/outcome/决策，强制 seal 回退启发式） | M0 |
| M2 | TASK-14 | ✅ 完成 | B3 单路径（删 resolveIndexHeadBlockForSession，只走 IndexNode+traverseGraph） | M0 |
| M3 | TASK-15 | ✅ 完成 | 删 dual-track 全套（文件+类型+DB列） | M2 |
| M4 | TASK-16 | ✅ 完成 | 动态滑动窗口（seal 后裁剪老 raw 消息，recency 锚保留，sliding-window.ts + 2处集成 + 6测试） | M0 |
| M5 | TASK-17 | ✅ 完成 | autoCompact 改 seal-aware（框架层）+ Bug 3 修复（6 测试全绿） | M4 |
| M6 | TASK-18 | ✅ 完成 | 统一预算阈值 80k/90k→W×compact_ratio（injection-budget 新增 computeCompactThreshold + sdk.ts 新增 contextWindowTokens 选项 + attempt.ts/compact.ts 传递 contextWindowTokens） | M5 |
| M7 | TASK-19 | ✅ 完成 | C3 元压缩（N task IndexNode→1 session 节点） | M6 |
| M8 | TASK-20 | ✅ 完成 | 命名收尾 session-rotation→cognitive-memory | M3 |
| M9 | TASK-21 | ⏳ 待启动 | 端到端验证+部署 | M0-M8 |

**并行性**：M1‖M2‖M4（都只依赖 M0）；M8‖M5（M8 只依赖 M3）。


## 当前假设
- 本地开发环境使用 `elynx.json` 和 `config.yaml` 配置，不影响生产
- 主模型 OpenRouter/owl-alpha 当前不可用，部分端到端验证受阻
- `~/.pi/agent/sessions/` 下的 session JSONL 文件正常增长，自动 compact 机制有效
- Gateway 绑定 `lan` 模式（Tailscale IP `100.111.4.5`），局域网内可访问
- ~~pi-agent-core monkey-patch 由 `scripts/patch-agent.cjs` 保护~~ ✅ TASK-22 已消除：setSystemPrompt/replaceMessages 已写入 packages/agent/src/agent.ts，patch 脚本已删除


## 运行时上下文
- 项目根目录：`/home/elysia/projects/pi-mono/`（非 `~/pi-mono/`）
- 引擎文件目录：`/home/elysia/projects/pi-mono/engine/`（v5 重构后）
- 原 `elynx_engine/` 已归档删除，所有内容迁移至 `engine/`
- Node.js v22.22.1，通过 nvm 管理
- tsgo 不在 PATH，必须用 `npm run build` 调用
- 统一使用 pnpm workspace 管理（迁移后不再有双包管理器问题）
- `deploy.sh` 结构：3 Phase · 9 Step · 5 Guard


## 常用请求翻译表
> 将日常业务语言映射到技术入口点。AI 每次会话后根据实际请求更新。
| 如果你说想要… | 实际需要动到的文件/地方 | 复杂度 | 备注 |
|---------------|--------------------------|------|------|
| 部署更新 | `cd ~/pi-mono && ./deploy.sh` | 低 | 一键部署 |
| 新增框架层工具 | `elysiaclaw/src/agents/coding-agent/core/tools/` + 四层注册 | 高 | 需两边验证 TUI/Bot |
| 新增应用层工具 | `elynx/src/agents/tools/` + pi-tools.ts + tool-catalog.ts | 中 | 需 deploy 到全局 |
| 修改 Agent 循环/压缩 | `elysiaclaw/src/agents/coding-agent/core/` + `packages/agent/src/` | 高 | 影响全局，需充分测试 |
| 修复 Telegram 输出 | `elynx/src/telegram/` | 中 | 涉及 bot-message-dispatch |
| 增加新的 LLM provider | `~/.elysiaclaw/elysiaclaw.json` agents/models 段 | 低 | 配置修改（⚠️ 生产配置在 `~/.elysiaclaw/`，非 `~/.elynx/`） |
| 查看 gateway 状态 | `elynx status` | 低 | 命令行 |
| 查 session 数据 | `find ~/.pi/agent/sessions/ -name "*.jsonl"` | 低 | 递归查找 |
| 成本报告 | `python3 ~/.pi/agent/cost-report.py` | 低 | Python 脚本 |
| 修复流式输出 | `~/.elysiaclaw/elysiaclaw.json` `blockStreamingDefault` | 低 | 配置项 |
| 网关挂死/未响应自动恢复 | `scripts/watchdog.mjs` + `~/.config/systemd/user/elysiaclaw-watchdog.service` + env `~/.elysiaclaw/watchdog.env` | 低 | 2026-06-11 已部署实测：挂死 ≤90s 检测+重启+TG告警（经7890代理） |
| 回滚到旧版 | `git checkout` + `npm run build` + `./deploy.sh` | 中 | 需要完整重部署 |
| 拔掉 monkey-patch | PLAN-15 S1（TASK-22）：packages/agent/src/agent.ts 补 6 行 + 删 patch 脚本 | 低 | 关键实证见 PLAN-15 §1 |
| 记忆噪音/无用索引累积 | PLAN-16 P1：IndexNode salience 准入 + B3 评分驱逐 | 中 | 前置 S0 |
| agent 运行中打断/纠错 | PLAN-18：steering 队列接线 + 意图分类（内核 API 已存在） | 中 | 零前置 |
| 网关状态通知/分不清哪断了 | PLAN-19 H1/H2（TASK-23）：播报+看门狗+/ping 三层探针 | 低 | 零前置，流量≈0 |
| 让 agent 夜间自我整理 | PLAN-17 睡眠周期 D1-D4 | 高 | 前置 S0 + PLAN-16 P1/P4 |


## 会话交接记录
引擎文件 v5 重构完成。从 `elynx_engine/` 迁移至 `engine/`，按 v5 规范重组。8 个 plan 已登记，设计文档从旧目录迁移至 `engine/plans/`。旧目录 `elynx_engine/` 已删除。


## 最近完成的事项
-1. **会话 36 — PLAN-15 S7 框架层汇入 elysiaclaw**（2026-06-11）：packages/{agent,ai,tui} 源码迁入 elysiaclaw/src/framework/{agent,ai,tui}/；@elynyx/* import 全量替换为 #framework/* subpath imports（package.json imports + tsconfig paths）；workspace 依赖 @elynyx/agent-core/@elynyx/ai/@elynyx/tui 从 elysiaclaw/package.json 移除；packages/ai 的 9 个 npm 依赖合并到 elysiaclaw；loader.ts VIRTUAL_MODULES + aliases 添加 @elynyx/* 旧名向后兼容映射 + resolveWorkspaceOrImport try-catch 保护；deploy.sh Phase A 简化（框架包构建步骤删除，Guard 2 改 grep 验证）；构建验证通过（tsdown + dist/index.js + dist/agents/coding-agent/index.js）；cognitive-memory 111/111 + attempt 64/64 全绿
-2. **会话 35 — PLAN-19 看门狗部署闭环 + fallback 链修复**（2026-06-11）：watchdog.mjs 修补（systemctl --user 支持 + TG 告警走 curl 代理（Node22 fetch 不读 HTTP_PROXY）+ 重启风暴退避 AC-8/E10）；部署为 `elysiaclaw-watchdog.service`（user unit，EnvironmentFile=~/.elysiaclaw/watchdog.env 600 权限）；AC-2 实测：SIGSTOP 监听进程（注意 gateway 双进程结构，MainPID≠监听 pid）→ 90s 检测 → systemctl --user restart → 恢复，TG 告警双向送达（经 7890 代理，代理实测可达）；fallback 链重排（去重 primary、跨 provider 优先：deepseek/zai 提前）；deploy.sh 加 Guard 6 看门狗存活检查。**遗留**：process-guard 僵尸服务（守错端口 18792 + 重启 ENOENT 空转）待用户确认后下线；deploy.sh 整体仍瞄准 ~/.elynx+elynx 全局安装，与生产 elysiaclaw 漂移
-1. **会话 31 — TASK-22/23/24 批量推进**（2026-06-10）：TASK-22 S1 patch源码化（packages/agent/src/agent.ts +8行，删scripts/patch-agent.cjs，deploy.sh删Step3/7+Guard2冒烟改）+ TASK-23 H1+H2（新建cognition/presence/gateway-lifecycle.ts含clean-shutdown marker+/ping+失败计数 + run-loop.ts启停接线 + scripts/watchdog.mjs独立看门狗）+ TASK-24 S0 seal事务化（conversation-store.ts runInTransaction + attempt.ts onSeal包裹）
0. **架构评审会话 29**（2026-06-10）：PLAN-15~19 五份 plan 全部 accepted（解耦/宫殿/睡眠/全双工/心跳）+ ROADMAP 方向总纲 7 条 + M8-M11 里程碑 + SPRINT TASK-22~25 派生（TASK-21 并入 TASK-24）+ PLAN-19 流量预算约束（维护者成本敏感）+ 关键实证：patch 可被 6 行源码取代、steering API 已存在
0. **第二轮迁移修复**（2026-06-10）：tsconfig.json 8处 @mariozechner/ 路径别名 → @elynyx/ + test-our-changes.ts 和 session-transcripts.ts 破损导入修复 + ElysiaClawKit→ElynyxKit + OpenClawKit→ElynyxProtocol 目录重命名 + 31+ 处引用更新 + CLAWDBOT_SHOW_SECRETS/SHELL 添加 ELYNYX_ 优先级 + Dockerfile elysiaclaw.mjs→elynx.mjs + sandbox cache IDs 更新 + CLAUDE.md/AGENTS.md coding-agent 路径更新
1. **pi-mono → elynx 迁移**（2026-06-10）：品牌化 @mariozechner→@elynyx（1553+ 处）+ elysiaclaw/ElysiaClaw→elynx/Elynyx（5000+ 处）+ 90 个文件重命名 + npm→pnpm workspace 统一 + coding-agent 源码合并到 elysiaclaw/src/agents/coding-agent/ + packages/coding-agent 删除 + deploy.sh 12→9 步简化 + apps/Dockerfile/脚本品牌名更新 + tsdown.config.ts 添加 coding-agent 入口点
1. **流式空白 bug 修复 + 分块参数调优 + 上游测试修复 + 部署**（2026-06-10 会话26）：Telegram 流式输出 tool 调用时用户发消息导致大片空白（archivedToolPreviewIds 归档+清理修复）；分块参数调优为短句模式（draft-chunking minChars 200→80/maxChars 800→300/breakPreference→sentence, block-streaming MIN 800→200/MAX 1200→500/breakPreference→sentence）；上游 Telegram 测试 18→0 修复（fetch.test.ts 15 + audit.test.ts 2 + topic-agentid.test.ts 1）；部署 5 guards 全绿，gateway pid 814440，memory 122 files / 1373 chunks
2. **P080 缓解 + P082 确认修复 + TASK-04 拆分重构**（2026-06-10 会话24）：P080 连续失败检测改 toolName 匹配 + OpenAI/Responses API 错误标记 `❌ Tool error:` + nudge 不重置计数器；P082 确认 wrapToolDefinition 已修复（16 扩展字段逐字段传播），PITFALLS 更新为 Resolved；attempt.ts 拆分重构 Step 1-3（3576→2359 行，-34%），提取 tool-call-repair.ts + ollama-compat.ts + system-prompt-builder.ts + injection-coordinator.ts；部署 5 guards 全绿，175 测试全绿
2. **P102 修复 + TASK-19 M7 C3 元压缩**（2026-06-10 会话23）：P102 temporal 边永不创建 bug 修复（onSeal 回调 fallback getLatestIndexNode）；meta-compression.ts 新建（22 测试全绿）；rebuildCompressedTaskIds 进程重启恢复；只压缩已完成/已中止 task；session title 从 LLM 摘要提取
3. **TASK-18 PLAN-13 M6 — 统一预算阈值**（2026-06-10）：injection-budget.ts 新增 computeCompactThreshold(W, compactRatio) + DEFAULT_COMPACT_RATIO=0.8 + MIN_COMPACT_THRESHOLD=20_000；sdk.ts CreateAgentSessionOptions 新增 contextWindowTokens 选项，compactThreshold 动态计算替代硬编码 80k/90k（fallback 路径保留向后兼容）；attempt.ts/compact.ts 传递 contextWindowTokens。injection-budget 测试 14/14 全绿，npm run check 零回归。
2. **TASK-20 PLAN-13 M8 — 命名收尾**（2026-06-10）：session-rotation/→cognitive-memory/，handoff-types→cognitive-types，handoff-inject→index-head-injector。npm run check 零回归。
3. **TASK-19 PLAN-13 M7 — C3 元压缩**（2026-06-10）：新建 meta-compression.ts（buildMetaCompressionPrompt + createSessionNode + createSessionEdges + metaCompress + checkAndScheduleMetaCompression + filterNodesForB3Injection），attempt.ts B3 注入集成（metaCompressionStateRegistry + filterNodesForB3Injection + checkAndScheduleMetaCompression 后台调度），index-head-injector.ts session 节点展示增强（3 行摘要 + 200 字符行宽），meta-compression.test.ts 16/16 全绿，npm run check 零回归。
4. **TASK-16 PLAN-13 M4 — 动态滑动窗口**（2026-06-10）：新建 sliding-window.ts（pruneSealedMessages 核心剪枝函数）+ task-segment-tracker 添加 getSealedRanges() 方法 + attempt.ts 两处集成（上下文组装后 + force seal 后），使用 settingsManager.getCompactionKeepRecentTokens() 获取 recency 锚（fallback 20_000），消息→task 映射采用时间戳匹配。新建 sliding-window.test.ts 6/6 全绿，session-rotation 84/84 全绿，npm run check 零回归。
4. **TASK-07 PLAN-11 Bot 测试修复 P3**（2026-06-10）：5 个 MediaPaths 预存 bug 全部修复 — 4 个超时（fetch.ts resolveTelegramTransport sourceFetch 默认优先 globalThis.fetch，可被 vi.spyOn mock，undiciFetch 降级 fallback）+ 1 个 named-account DM 测试断言修正（代码只丢弃 GROUP 不丢弃 DM，DM 用 per-account session key，测试改为验证 DM 正确路由含 AccountId/SessionKey）；bot.test.ts + bot.create-telegram-bot.test.ts 94/94 全绿。
5. **TASK-13 PLAN-13 M1 — C2 索引头改模型写**（2026-06-10）：sealSegment 新增 modelIndexHead 参数，休止 seal 时调 completeSimple 生成 LLM 自述 goal/outcome/关键决策摘要，强制 seal 回退 buildIndexNodeSummary 启发式；attempt.ts 新增 createModelIndexHead + buildIndexHeadPrompt 辅助函数。84 个 session-rotation 测试全绿。
6. **TASK-14 PLAN-13 M2 — B3 单路径**（2026-06-10）：删除 resolveIndexHeadBlockForSession（dual-track B3 路径），统一 B3 注入为 IndexNode + traverseGraph 单路径（PLAN-13 I6 单路径原则）；handoff-inject.test.ts 移除对应测试。84 个 session-rotation 测试全绿，type check 零新增。
7. 代码维护检查 — 移除 tools-invoke-http.ts 关键路径 4 处 `as any` + 修复 P097（taskTrackerRegistry Map 泄漏，finally 块加 clear+delete）+ 修复 P098（activeSeg.body.finalReply 紧耦合，新增 setFinalReply 封装方法）。PITFALLS P097/P098 → Resolved。`npm run check` 零回归。（2026-06-09）
8. TASK-07 PLAN-11 Bot 测试修复 P1+P2 — grammy mock hoisting 修复（harness vi.hoisted + bot.test.ts 异步 vi.mock 工厂）+ loadWebMedia mock 补齐 + fetch.test.ts 20/20 全绿；bot.test.ts 0/48→46/48，剩余 2 个 MediaPaths 预存 bug（2026-06-09）
9. TASK-12 PLAN-13 M0 审查完成 — 维护性与潜在 bug 排查：发现 5 问题（P096–P100 全量录入 PITFALLS），均不阻塞 M1，M0 交付判定 ✅（2026-06-09）
10. TASK-12 PLAN-13 M0 实施 — task 边界改控制流（3 源文件 + 1 测试文件）（2026-06-09）
11. 流式管线加固 + 已部署 — Sprint 20: P1-P4 代码修复 + 诊断日志 + 参数校准（回滚激进参数），待端到端测试（2026-06-08）
12. 流式输出修复 — blockStreamingDefault="off" 配置修复（2026-06-08）
13. 序 1-7 统一实施全部完成 + 边缘情况加固（2026-06-07）
14. 序 8 阶段 4：Task Segment 追踪 + 双轨索引 + CompactionSummary（2026-06-07）
15. 序 8 深度审查 + 接线断链修复：executeRotation 死代码等（2026-06-07）
16. tsgo 全仓类型检查 53→0 清零（2026-06-07）
17. PLAN-09 P0/P1 部署至生产 + PLAN-10 审计修复 + PLAN-12 P0 设计+存储（2026-06-09）


## 已知不稳定项
- ⚠️ **packages/ 预存 typebox 版本冲突** — @sinclair/typebox 双版本解析导致 1 个类型错误（非迁移引起）
- **session 机制已废弃** — 传统 session JSONL 降级为调试备份，统一记忆模型为认知工作集 (PLAN-13)
- `~/.pi/agent/sessions/` 不再参与索引和认知注入
- ⚠️ **Telegram Bot 测试全部通过** — TASK-07 P3 完成 + 会话26 上游 18 修复：fetch.test.ts 15（globalThis.fetch 替换）+ audit.test.ts 2（同方案）+ topic-agentid.test.ts 1（pickFirstExistingAgentId mock），867/867 全绿
- ~~注入预算器用简化版~~ ✅ P1已修复：computeInjectionBudget接入运行时，按窗口比例缩放
- ~~conversation-store 无 edges 表~~ ✅ P1已修复：新增 index_nodes + edges 表
- ~~TaskSegment 封口不产生 IndexNode~~ ✅ P1已修复：onSeal回调写入图谱
- 输入分类器数据源偏窄：短陈述句落入 task，identity.name 提不出
- sessions chunks 47% CLAUDE.md 注入噪音
- delegate_code_task Telegram 端到端验证未完成（需可用模型）
- attempt.ts 复杂度改善中：3324→2359 行（-34%），已提取 4 个模块，可选继续提取 sessions_yield
- ⚠️ **P096/P099/P100 M0 审查发现的维护性问题** — P096（setToolCallPendingApproval 死代码，M1/M2 接线 → M1/M2 已完成，P096 仍死代码残留需 M3 删除）、P099（dual-track 双写，M3 自然消除）、P100（onSeal 无兜底，M3 修复），详见 PITFALLS。P097/P098 已于维护检查修复 → Resolved
- ✅ **B3 注入双路径** → ✅ M2 已完成：删除 resolveIndexHeadBlockForSession，统一 B3 为 IndexNode + traverseGraph 单路径
- ✅ **autoCompact 不感知 seal** → ✅ M5 已完成：autoCompact 改 seal-aware，已封 task 消息直接丢弃（零 LLM），孤儿消息回退小摘要
- ✅ **80k/90k 双阈值硬编码** → ✅ M6 已完成：统一为 W×compact_ratio（默认 0.8），sdk.ts 新增 contextWindowTokens 选项，attempt.ts/compact.ts 传递动态阈值


## 待解决问题
- [ ] [Q-01] 序 8 阶段 5 端到端验证 — 需要可用模型才能进行
- [ ] [Q-02] Tool Parity Task 15-16（MCP / 并行执行）— 优先级排序
- [~] [Q-03] attempt.ts 拆分重构 — Step 1-3 完成（3576→2359 行，-34%），可选继续提取 sessions_yield
- [ ] [Q-04] World Model Phase 2 启动时机 — 阻塞项：序 8 闭环 + 模型可用
- [ ] [Q-05] 参与者持续性 W0-W5 路线确认 — 需架构师排优先级
- [x] [Q-06] PLAN-13 M0 休止判定精确定义 — ✅ 审核确认：`!hasPendingTodos && !hasRunningTools && !hasPendingApprovals && hasFinalReply`，finalReply = agent 最后一条非 tool_call 的 assistant message 且后无 pending tool 执行
- [ ] [Q-07] PLAN-13 M1 C2 头输出格式 — ✅ 审核确认：markdown 格式 + 正则提取（非强制 JSON），M1 实施时落地
-| [x] [Q-08] PLAN-13 M4 消息→task 映射 — ✅ 审核确认：消息 metadata 加 segmentId，M0 铺路；M4 实际采用时间戳匹配（消息 timestamp 与 密封段 startedAt/endedAt 对比） |
| [x] [Q-09] PLAN-13 M4 recency 锚值 — ✅ 审核确认：与 computeInjectionBudget keep-recent 统一，可配。M4 通过 settingsManager.getCompactionKeepRecentTokens() 获取，fallback 20_000 |
- [ ] [Q-10] PLAN-13 M5 patch 锚点 — ✅ 审核确认：M5 前必须提取锚点位置，改造后验证
- [x] [A1] PLAN-13 M0 finalReply 字段 — ✅ TaskSegmentBody 已有 finalReply?: string，M0 直接使用
- [ ] [A5] PLAN-13 M5 autoCompact 改造风险 — M5 必须在 deploy.sh 后验证 patch 存活 + TUI+Bot 双路径
- [x] [A6] PLAN-13 M6 统一预算器分配比例 — ✅ M6 已完成：compactRatio 默认 0.8，可通过 computeCompactThreshold 第二参数配置
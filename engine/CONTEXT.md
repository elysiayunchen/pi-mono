# CONTEXT — ElysiaClaw
> 快照日期：2026-06-09 | 每次会话开始时，读完 ENGINE_MAP 后优先阅读此文件。


## 状态面板
| 维度 | 状态 |
|------|------|
| 构建 | ✅ 正常（`npm run check` 零新增错误，499 文件；预存 pi-tui/agents 类型错误 27 条） |
| 测试 | ✅ Telegram Bot 94/94 全绿（TASK-07 P3 完成：fetch.ts sourceFetch 默认 globalThis.fetch + named-account DM 路由断言修正） |
| 上次完成 | TASK-07 PLAN-11 Bot 测试修复 P3（5 个 MediaPaths 预存 bug 全部修复） |
| 当前优先 | TASK-15 PLAN-13 M3（删 dual-track）/ TASK-16 PLAN-13 M4（动态滑动窗口） |
| 阻塞 | delegate_code_task Telegram 端到端验证 — 受阻于主模型不可用 |
| 产品目标完成度 | 约 74% — 12 层 Agent 框架竣工，认知架构 P0+P1 完成，Tool Parity 88.2% |


## 当前状态概述
ElysiaClaw 是基于 pi-mono 框架构建的多渠道 AI 助手平台，运行在 `elysiaserver` (Ubuntu 24.04)，通过 Telegram Bot `@ElysiaClaw_Bot` 交互。项目维护者为 aoseluo（云尘 / 奈緒），采用 AI 协作开发模式，独立维护，不与上游 OpenClaw 同步。

当前处于认知架构演进的关键阶段：序 1-7 已全部完成。**传统 session 机制已彻底废除**，统一记忆模型为认知工作集（PLAN-13，取代 PLAN-09/12）。PLAN-09 P0/P1 已完成并部署。PLAN-13 执行计划已派生为 TASK-12~TASK-21（M0-M9 迁移链），**M0 已完成 + 已审查**（task 边界改控制流，P096–P100 已录入），M1/M2/M4 可并行启动。

### PLAN-13 迁移链状态
| 步骤 | TASK | 状态 | 关键改动 | 前置 |
|------|------|------|----------|------|
| M0 | TASK-12 | ✅ 完成 | startSegment 改控制流 + sealSegment 加休止判定(isQuiescent含pending_approval) + attempt.ts 调用侧改造(三路分支+模块级tracker注册表+回合结束不封口) + ToolCallRecord新增pending_approval状态 | 无 |
| M1 | TASK-13 | ✅ 完成 | C2 索引头改模型写（seal 时 LLM 自述 goal/outcome/决策，强制 seal 回退启发式） | M0 |
| M2 | TASK-14 | ✅ 完成 | B3 单路径（删 resolveIndexHeadBlockForSession，只走 IndexNode+traverseGraph） | M0 |
| M3 | TASK-15 | ⏳ 待启动 | 删 dual-track 全套（文件+类型+DB列） | M2 |
| M4 | TASK-16 | ⏳ 待启动 | 动态滑动窗口（seal 后裁剪老 raw 消息，recency 锚保留） | M0 |
| M5 | TASK-17 | ⏳ 待启动 | autoCompact 改 seal-aware（框架层，高风险） | M4 |
| M6 | TASK-18 | ⏳ 待启动 | 统一预算阈值 80k/90k→W×compact_ratio | M5 |
| M7 | TASK-19 | ⏳ 待启动 | C3 元压缩（N task IndexNode→1 session 节点） | M6 |
| M8 | TASK-20 | ⏳ 待启动 | 命名收尾 session-rotation→cognitive-memory | M3 |
| M9 | TASK-21 | ⏳ 待启动 | 端到端验证+部署 | M0-M8 |

**并行性**：M1‖M2‖M4（都只依赖 M0）；M8‖M5（M8 只依赖 M3）。


## 当前假设
- 本地开发环境使用 `elysiaclaw.json` 和 `config.yaml` 配置，不影响生产
- 主模型 OpenRouter/owl-alpha 当前不可用，部分端到端验证受阻
- `~/.pi/agent/sessions/` 下的 session JSONL 文件正常增长，自动 compact 机制有效
- Gateway 绑定 `lan` 模式（Tailscale IP `100.111.4.5`），局域网内可访问
- pi-agent-core monkey-patch 由 `scripts/patch-agent.cjs` 保护，每次 deploy 后验证


## 运行时上下文
- 项目根目录：`/home/elysia/projects/pi-mono/`（非 `~/pi-mono/`）
- 引擎文件目录：`/home/elysia/projects/pi-mono/engine/`（v5 重构后）
- 原 `elysiaclaw_engine/` 已归档删除，所有内容迁移至 `engine/`
- Node.js v22.22.1，通过 nvm 管理
- tsgo 不在 PATH，必须用 `npm run build` 调用
- pi-mono 框架层使用 npm workspaces，elysiaclaw 应用层使用 pnpm（不可混用）
- `deploy.sh` 结构：3 Phase · 12 Step · 5 Guard


## 常用请求翻译表
> 将日常业务语言映射到技术入口点。AI 每次会话后根据实际请求更新。
| 如果你说想要… | 实际需要动到的文件/地方 | 复杂度 | 备注 |
|---------------|--------------------------|------|------|
| 部署更新 | `cd ~/pi-mono && ./deploy.sh` | 低 | 一键部署 |
| 新增框架层工具 | `packages/coding-agent/src/core/tools/` + 四层注册 | 高 | 需两边验证 TUI/Bot |
| 新增应用层工具 | `elysiaclaw/src/agents/tools/` + pi-tools.ts + tool-catalog.ts | 中 | 需 deploy 到全局 |
| 修改 Agent 循环/压缩 | `packages/coding-agent/src/core/` + `packages/agent/src/` | 高 | 影响全局，需充分测试 |
| 修复 Telegram 输出 | `elysiaclaw/src/telegram/` | 中 | 涉及 bot-message-dispatch |
| 增加新的 LLM provider | `~/.elysiaclaw/elysiaclaw.json` agents 段 | 低 | 配置修改 |
| 查看 gateway 状态 | `elysiaclaw status` | 低 | 命令行 |
| 查 session 数据 | `find ~/.pi/agent/sessions/ -name "*.jsonl"` | 低 | 递归查找 |
| 成本报告 | `python3 ~/.pi/agent/cost-report.py` | 低 | Python 脚本 |
| 修复流式输出 | `~/.elysiaclaw/elysiaclaw.json` L357 `blockStreamingDefault` | 低 | 配置项 |
| 回滚到旧版 | `git checkout` + `npm run build` + `./deploy.sh` | 中 | 需要完整重部署 |


## 会话交接记录
引擎文件 v5 重构完成。从 `elysiaclaw_engine/` 迁移至 `engine/`，按 v5 规范重组。8 个 plan 已登记，设计文档从旧目录迁移至 `engine/plans/`。旧目录 `elysiaclaw_engine/` 已删除。


## 最近完成的事项
1. **TASK-07 PLAN-11 Bot 测试修复 P3**（2026-06-10）：5 个 MediaPaths 预存 bug 全部修复 — 4 个超时（fetch.ts resolveTelegramTransport sourceFetch 默认优先 globalThis.fetch，可被 vi.spyOn mock，undiciFetch 降级 fallback）+ 1 个 named-account DM 测试断言修正（代码只丢弃 GROUP 不丢弃 DM，DM 用 per-account session key，测试改为验证 DM 正确路由含 AccountId/SessionKey）；bot.test.ts + bot.create-telegram-bot.test.ts 94/94 全绿。
2. **TASK-13 PLAN-13 M1 — C2 索引头改模型写**（2026-06-10）：sealSegment 新增 modelIndexHead 参数，休止 seal 时调 completeSimple 生成 LLM 自述 goal/outcome/关键决策摘要，强制 seal 回退 buildIndexNodeSummary 启发式；attempt.ts 新增 createModelIndexHead + buildIndexHeadPrompt 辅助函数。84 个 session-rotation 测试全绿。
3. **TASK-14 PLAN-13 M2 — B3 单路径**（2026-06-10）：删除 resolveIndexHeadBlockForSession（dual-track B3 路径），统一 B3 注入为 IndexNode + traverseGraph 单路径（PLAN-13 I6 单路径原则）；handoff-inject.test.ts 移除对应测试。84 个 session-rotation 测试全绿，type check 零新增。
4. 代码维护检查 — 移除 tools-invoke-http.ts 关键路径 4 处 `as any` + 修复 P097（taskTrackerRegistry Map 泄漏，finally 块加 clear+delete）+ 修复 P098（activeSeg.body.finalReply 紧耦合，新增 setFinalReply 封装方法）。PITFALLS P097/P098 → Resolved。`npm run check` 零回归。（2026-06-09）
5. TASK-07 PLAN-11 Bot 测试修复 P1+P2 — grammy mock hoisting 修复（harness vi.hoisted + bot.test.ts 异步 vi.mock 工厂）+ loadWebMedia mock 补齐 + fetch.test.ts 20/20 全绿；bot.test.ts 0/48→46/48，剩余 2 个 MediaPaths 预存 bug（2026-06-09）
6. TASK-12 PLAN-13 M0 审查完成 — 维护性与潜在 bug 排查：发现 5 问题（P096–P100 全量录入 PITFALLS），均不阻塞 M1，M0 交付判定 ✅（2026-06-09）
7. TASK-12 PLAN-13 M0 实施 — task 边界改控制流（3 源文件 + 1 测试文件）（2026-06-09）
8. 流式管线加固 + 已部署 — Sprint 20: P1-P4 代码修复 + 诊断日志 + 参数校准（回滚激进参数），待端到端测试（2026-06-08）
9. 流式输出修复 — blockStreamingDefault="off" 配置修复（2026-06-08）
10. 序 1-7 统一实施全部完成 + 边缘情况加固（2026-06-07）
11. 序 8 阶段 4：Task Segment 追踪 + 双轨索引 + CompactionSummary（2026-06-07）
12. 序 8 深度审查 + 接线断链修复：executeRotation 死代码等（2026-06-07）
13. tsgo 全仓类型检查 53→0 清零（2026-06-07）
14. PLAN-09 P0/P1 部署至生产 + PLAN-10 审计修复 + PLAN-12 P0 设计+存储（2026-06-09）


## 已知不稳定项
- **session 机制已废弃** — 传统 session JSONL 降级为调试备份，统一记忆模型为认知工作集 (PLAN-13)
- `~/.pi/agent/sessions/` 不再参与索引和认知注入
- ⚠️ **Telegram Bot 测试全部通过** — TASK-07 P3 完成：4 个 MediaPaths 超时（fetch.ts sourceFetch 默认 globalThis.fetch）+ 1 个 named-account DM 断言修正（测试改为验证 DM 正确路由），94/94 全绿
- ~~注入预算器用简化版~~ ✅ P1已修复：computeInjectionBudget接入运行时，按窗口比例缩放
- ~~conversation-store 无 edges 表~~ ✅ P1已修复：新增 index_nodes + edges 表
- ~~TaskSegment 封口不产生 IndexNode~~ ✅ P1已修复：onSeal回调写入图谱
- 输入分类器数据源偏窄：短陈述句落入 task，identity.name 提不出
- sessions chunks 47% CLAUDE.md 注入噪音
- delegate_code_task Telegram 端到端验证未完成（需可用模型）
- attempt.ts 复杂度失控：3324 行，建议拆分（PLAN-13 M0-M9 完成后执行）
- ⚠️ **P096/P099/P100 M0 审查发现的维护性问题** — P096（setToolCallPendingApproval 死代码，M1/M2 接线 → M1/M2 已完成，P096 仍死代码残留需 M3 删除）、P099（dual-track 双写，M3 自然消除）、P100（onSeal 无兜底，M3 修复），详见 PITFALLS。P097/P098 已于维护检查修复 → Resolved
- ✅ **B3 注入双路径** → ✅ M2 已完成：删除 resolveIndexHeadBlockForSession，统一 B3 为 IndexNode + traverseGraph 单路径
- ⚠️ **autoCompact 不感知 seal** — 压缩产物为不透明 blob，不利用已封 task 的 B3 头（PLAN-13 M5 修复目标）
- ⚠️ **80k/90k 双阈值硬编码** — 不随模型窗口缩放（PLAN-13 M6 修复目标）


## 待解决问题
- [ ] [Q-01] 序 8 阶段 5 端到端验证 — 需要可用模型才能进行
- [ ] [Q-02] Tool Parity Task 15-16（MCP / 并行执行）— 优先级排序
- [Q-03] attempt.ts 拆分重构时机 — 拆为 system-prompt-builder.ts + injection-coordinator.ts + index-head-injector.ts
- [ ] [Q-04] World Model Phase 2 启动时机 — 阻塞项：序 8 闭环 + 模型可用
- [ ] [Q-05] 参与者持续性 W0-W5 路线确认 — 需架构师排优先级
- [x] [Q-06] PLAN-13 M0 休止判定精确定义 — ✅ 审核确认：`!hasPendingTodos && !hasRunningTools && !hasPendingApprovals && hasFinalReply`，finalReply = agent 最后一条非 tool_call 的 assistant message 且后无 pending tool 执行
- [ ] [Q-07] PLAN-13 M1 C2 头输出格式 — ✅ 审核确认：markdown 格式 + 正则提取（非强制 JSON），M1 实施时落地
- [ ] [Q-08] PLAN-13 M4 消息→task 映射 — ✅ 审核确认：消息 metadata 加 segmentId，M0 铺路
- [ ] [Q-09] PLAN-13 M4 recency 锚值 — ✅ 审核确认：与 computeInjectionBudget keep-recent 统一，可配
- [ ] [Q-10] PLAN-13 M5 patch 锚点 — ✅ 审核确认：M5 前必须提取锚点位置，改造后验证
- [x] [A1] PLAN-13 M0 finalReply 字段 — ✅ TaskSegmentBody 已有 finalReply?: string，M0 直接使用
- [ ] [A5] PLAN-13 M5 autoCompact 改造风险 — M5 必须在 deploy.sh 后验证 patch 存活 + TUI+Bot 双路径
- [ ] [A6] PLAN-13 M6 统一预算器分配比例 — M6 实施时先跑实测数据，比例可配
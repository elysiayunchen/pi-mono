# SPRINT — ElysiaClaw
> 开始日期：2026-06-07 | 状态：进行中


## 冲刺参数
| 参数 | 值 |
|------|-----|
| 冲刺开始 | 2026-06-07 |
| 冲刺结束 | TBD |
| 重点 | v5 引擎文件系统规范化 + 核心功能端到端验证 |


## 归档索引
所有已完成 Sprint 的完整记录保留在 `engine/archive/sprint-history.md`。

| # | Sprint 名称 | 日期 | 关键产出 |
|---|---|---|---|
| 1 | 流式输出修复 — Tool Lane 流式 + Reasoning | 2026-06-07 | toolcall 事件处理 + reasoning 默认 stream |
| 2 | 序 8 深度审查 + 接线断链修复 | 2026-06-07 | executeRotation 死代码修复(#91-94) + AgentTool 契约修复 |
| 3 | 早期工具落地测试落实 — Tool Parity Task 1/2 | 2026-06-07 | 25 新测试 + grep 排序代码异味归档 |
| 4 | 序 1-7 健全性审核 + 用户画像写路径闭环 | 2026-06-07 | ingestUserMessage 写路径 + Pitfall #77 |
| 5 | 序 1-7 测试加固 + Bug 修复 | 2026-06-07 | 77 新测试 + Pitfall #73-75 |
| 6 | BashTool Parity + GrepTool Regression Fix | 2026-04-10 | Task 2 BashTool + GrepTool slicedOutput 修复 |
| 7 | Task 1: GrepTool 参数补全 | 2026-04-10 | count 模式 + mtime 排序 + 能力声明 |
| 8 | Tool Parity Sprint — Task 0 + 预存测试修复 | 2026-04-10 | ToolDefinition 11 字段扩展 + type re-export 修复 |
| 9 | Architecture Audit Sprint | 2026-04-09 | 四层注册发现 + 工具缺口映射 |
| 10 | delegate_code_task 子代理分发工具实施 | 2026-06-05 | delegate_code_task 工具 + Code Mode 清理 |
| 11 | 记忆引擎激活（RUNBOOK T1-T6） | 2026-06-06 | TS memory_search 取代 Python session_search |
| 12 | deploy.sh 增强 + dist 部署根因修复 | 2026-06-06 | clean-slate deploy + extensions sync + E2E 验证 |
| 13 | Telegram 工具调用流式输出 | 2026-06-06 | Tool Lane + onToolStart/onToolResult |
| 14 | 跨会话记忆系统（Python session_search） | 2026-06-06 | ⚠️ 已被 TS memory_search 取代 |
| 15 | tsgo 全仓类型检查 53→0 清零 | 2026-06-07 | 7 类错误修复 + Pitfall #86 |
| 16 | 引擎设计审查 + 文档状态校正 | 2026-06-07 | 三级完成标注标准 + 9 文件修正 |
| 17 | 架构优化 Sprint | 2026-04-05 | BUG-1~4 修复 + deploy.sh 守卫 |
| 18 | Code Mode Phase 0 最小可行补丁 | 2026-04-05 | attempt.ts /code /exit 检测 |
| 19 | 流式输出修复 — blockStreamingDefault 错误抑制 | 2026-06-08 | 根因定位 + 配置修复 + 端到端验证 |
| 20 | 流式管线加固 + 参数校准（已部署） | 2026-06-08 | 4 修复 + 诊断日志 + 3 激进参数回滚 + 部署验证 |
| 21 | 流式输出修复 — Tool Update 进度传播 + Reasoning 默认值修正 | 2026-06-09 | partialResult 传播修复 + reasoningMode 默认 stream + update 阶段显式处理 |
| 22 | PLAN-10 审计修复 — contextPressureBudget + traverseGraph + 死代码清理 | 2026-06-09 | AC-1:injectionTokens语义修复 + AC-2:traverseGraph 1-hop接入B3 + AC-3:~150行死代码删除 + AC-4:6条IndexNode测试 + BFS off-by-one修复 |
| 23 | PLAN-12 P0 忆匣设计 + 会话轮换清理 + 双轨注入修正 + 压缩→seal连接 | 2026-06-09 | TASK-08:轮换废除(9文件) + TASK-09:B4注入+archiveRef+task_get + TASK-10:compaction→seal + TASK-11:memory-box-store |


## 优先级栈
1. [TASK-12] PLAN-13 M0 — 修地基：task 边界改控制流（crit:p0） ✅ — startSegment 仅无active段时开，sealSegment 仅休止/强制时封，上轮未休止追加当前段；60测试全绿
2. [TASK-13] PLAN-13 M1 — C2 索引头改模型写（crit:p1） ✅ — sealSegment 新增 modelIndexHead 参数，休止 seal 调 completeSimple 生成 LLM 自述 goal/outcome/关键决策，强制 seal 回退启发式 buildIndexNodeSummary；84 测试全绿
3. [TASK-14] PLAN-13 M2 — B3 单路径（crit:p1） ✅ — 删除 resolveIndexHeadBlockForSession（dual-track），统一 B3 为 IndexNode + traverseGraph 单路径（PLAN-13 I6 单路径原则）；84 测试全绿
4. [TASK-07] PLAN-11 Bot 测试基础设施修复与依赖对齐（crit:p0） — P1✅ grammy mock hoisting修复 + P2✅ fetch.test.ts全绿 + P3✅ 5个MediaPaths预存bug修复（fetch.ts sourceFetch默认globalThis.fetch + bot.create-telegram-bot.test.ts named-account DM路由断言修正）；94/94全绿
5. [TASK-15] PLAN-13 M3 — 删 dual-track（crit:p1） ✅ — 删dual-track-index.ts/MacroIndexEntry/MicroIndexEntry/consumeDualTrackIndex/appendMacroIndexEntry/appendMicroIndexEntries/updateDualTrackIndex/resolveIndexHeadBlockForSession/buildAndStoreDualTrackIndex，ConversationEntry移除macro/micro字段，conversations表ALTER DROP COLUMN，handoff-inject.test.ts删除，conversation-store.test.ts移除4个dual-track测试；78/78全绿
6. [TASK-16] PLAN-13 M4 — 动态滑动窗口（crit:p1） ✅ — §2.6: seal 后移除已封 task 老于 recency 锚的原始消息；新建 sliding-window.ts (pruneSealedMessages) + task-segment-tracker.getSealedRanges() + attempt.ts 两处集成（上下文组装后 + force seal 后），消息→task 映射采用时间戳匹配；新建 sliding-window.test.ts 6/6 全绿；AC-10
7. [TASK-17] PLAN-13 M5 — autoCompact 改造为 seal-aware（crit:p1，触及框架层） ✅ — §2.7: autoCompactMessages 新增 sealedRanges 参数，已封 task 消息时间戳匹配后直接丢弃（零 LLM 调用），孤儿消息回退 LLM 小摘要；sdk.ts CreateAgentSessionOptions 新增 getSealedTaskRanges 回调；attempt.ts 注入 taskTracker.getSealedRanges()；patch-agent.cjs 锚点确认 M3 已删无需补丁；npm run check 零回归
8. [TASK-18] PLAN-13 M6 — 统一预算阈值（crit:p2） — §4: 80k/90k双阈值→W×compact_ratio单阈值，驱动seal/丢弃/元压缩；AC-11后半
9. [TASK-19] PLAN-13 M7 — C3 元压缩（crit:p2） — §2.2: B3超预算→N个task头→session节点，原task头出B3但IndexNode留图谱；AC-12前半
10. [TASK-20] PLAN-13 M8 — 命名收尾（crit:p3） ✅ — session-rotation/→cognitive-memory/，handoff-types.ts→cognitive-types.ts，handoff-inject.ts→index-head-injector.ts；npm run check 零回归
11. [TASK-21] PLAN-13 M9 — 端到端验证 + 部署（crit:p0） — Telegram实跑多步任务，验DB有正确IndexNode/edges，新任务替换B4，RECALL命中归档；AC-12
12. [TASK-04] attempt.ts 拆分重构 — 拆为 system-prompt-builder.ts + injection-coordinator.ts + index-head-injector.ts
13. ~~[TASK-05] PLAN-09 P2：元压缩 + 图遍历检索~~ — **superseded by PLAN-13**（M7 C3 元压缩 + M9 端到端取代）
14. ~~[TASK-06] PLAN-10 审计修复（crit:p1）~~ ✅
15. ~~[TASK-01] PLAN-09 P0：注入方向修正 + 轮换机制废弃~~ ✅
16. ~~[TASK-02] PLAN-09 P1：预算器接入 + TaskSegment封口产生IndexNode~~ ✅
17. ~~[TASK-03] Tool Parity Task 14: AskUserQuestionTool~~ ✅
18. ~~[TASK-08] 会话轮换清理~~ ✅
19. ~~[TASK-09] 双轨注入修正~~ ✅
20. ~~[TASK-10] 压缩→seal连接~~ ✅
21. ~~[TASK-11] PLAN-12 P0 设计+存储~~ ✅


## 任务详情


### TASK-07: PLAN-11 Bot 测试基础设施修复与依赖对齐（crit:p0）
- **状态：** P1+P2+P3 全部完成 ✅
- **来源 plan：** [PLAN-11](plans/PLAN-11.md) Bot 测试基础设施修复与依赖对齐
- **用户可见的变化：** 无直接用户可见变化，但恢复 28 个测试文件的执行能力，为后续 Bot 功能开发提供测试保障
- **完成标准（对应 PLAN-11.spec AC-1~AC-4）：**
  1. ✅ AC-1 (crit): `@mariozechner/pi-tui` 升级到 v0.64.0，28+1 个测试文件恢复加载
  2. ✅ AC-2 (high): `fetch.test.ts` 20/20 全绿
  3. ✅ AC-3 (high): Telegram 测试套件 94/94 全绿（5 个 MediaPaths 预存 bug 已修复）
  4. ✅ AC-4 (medium): `npm run check` 零新增类型错误，无回归
- **P1 修复详情：** grammy mock hoisting — harness 中所有 spy 移入 `vi.hoisted()`；`bot.test.ts` 添加异步 `vi.mock("grammy")` 工厂；`bot.test.ts` 0/48→46/48
- **P3 修复详情：** 4 个 MediaPaths 超时 — `fetch.ts` resolveTelegramTransport `sourceFetch` 默认优先 `globalThis.fetch`（可被 vi.spyOn mock），`undiciFetch` 降级为 fallback；1 个 named-account DM 测试断言修正 — 代码只丢弃 GROUP 消息不丢弃 DM（DM 使用 per-account session key），测试改为验证 DM 正确路由
- **验证方法：** 见 PLAN-11.spec 验证命令
- **约束：** 不能破坏生产运行时行为；升级 pi-tui 后需验证无 breaking change
- **起点：** `elysiaclaw/src/telegram/bot.create-telegram-bot.test-harness.ts` + `elysiaclaw/src/telegram/bot.test.ts`
- **前置依赖：** 无
- **风险：** pi-tui v0.64.0 可能引入 breaking change（缓解：逐文件检查编译错误）

### TASK-06: PLAN-10 审计修复（crit:p1） ✅
- **状态：** 已完成（2026-06-09）
- **来源 plan：** [PLAN-10](plans/PLAN-10.md) 体验端落实验证与可维护性保障框架
- **用户可见的变化：** 修复 contextPressureBudget 语义漂移后压缩阈值恢复正常，大窗口上下文利用率提升；traverseGraph 接入后 B3 注入从全量改为图展开（减少噪声）
- **完成标准（对应 PLAN-10.spec AC-1~AC-4）：**
  1. ✅ AC-1 (crit): `attempt.ts:1911` 传递 `injectionBudgetResult.injectionTokens` 替代 `effectivePressureThreshold`
  2. ✅ AC-2 (high): `traverseGraph` 接入 B3 注入，从最新 IndexNode 为入口做 1-hop 图展开后注入 B3；同时修复 BFS off-by-one（`hop < maxHops` → `hop <= maxHops`）
  3. ✅ AC-3 (medium): 清理 HandoffPacket 死代码 — 删除 `consumeHandoffPacket`、`validateHandoffCompleteness`/`formatHandoffForInjection`、`buildMacroEntryFromHandoff`、`resolveHandoffBlockForSession`/`consumeHandoffBlockForSession`/`consumeDualTrackIndexBlockForSession`；`lastHandoffPacketJson` 标注 `@deprecated`；删除 `handoff-types.test.ts`
  4. ✅ AC-4 (low): `conversation-store.test.ts` 迁移：6 条 IndexNode/Edge/traverseGraph 测试替代 consumeHandoffPacket 测试
- **验证方法：** `npm run check` 零错误 + vitest 78/78 全绿 + grep 死代码符号生产路径零引用


### TASK-01: PLAN-09 P0：注入方向修正 + 轮换机制废弃 ✅
- **状态：** 已完成（2026-06-08）
- **用户可见的变化：** 无直接用户可见变化，但上下文利用率和KV-cache命中率提升
- **完成标准：**
  1. ✅ B3/B4/B5 append到effectivePrompt末尾（用户消息之后），不prepend
  2. ✅ rotation-controller.ts / auto-trigger.ts / rotate-session-tool.ts 已删除，HandoffPacket标注废弃
  3. ✅ HandoffPacket废弃，handoff-inject.ts改造为索引头注入器（resolveIndexHeadBlockForSession）
  4. ✅ attempt.ts中auto-rotation逻辑全部移除，tool-catalog.ts rotate_session条目清理
  5. ✅ grep验证：生产路径无功能性rotation/handoff调用，仅保留注释/废弃标注
  6. ✅ `npm run check`零错误，vitest 13/13全绿
- **验证方法：** verify → PLAN-09.spec:AC-1, AC-2, AC-9
- **约束：** 不能破坏现有session数据；不能影响gateway稳定性
- **起点：** `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts` + `elysiaclaw/src/session-rotation/`
- **前置依赖：** 无
- **风险：** 注入方向改变可能影响模型行为，需充分测试


### TASK-02: PLAN-09 P1：预算器接入 + TaskSegment封口产生IndexNode ✅
- **状态：** 已完成（2026-06-08）
- **用户可见的变化：** 上下文利用率提升（1M窗口下不再用80k硬编码阈值），任务封口后认知图谱节点自动注入B3
- **完成标准：**
  1. ✅ computeInjectionBudget在运行时被调用，预算随窗口缩放
  2. ✅ TaskSegment封口后IndexNode写入conversation-store
  3. ✅ 硬边（temporal/produces）自动产生
  4. ✅ B3注入内容来自conversation-store的IndexNode
  5. ✅ conversation-store增加index_nodes + edges表
  6. ✅ `npm run check`零错误
- **验证方法：** verify → PLAN-09.spec:AC-3, AC-4, AC-5, AC-6
- **约束：** 不能降低现有压缩效果
- **起点：** `elysiaclaw/src/context-engine/injection-budget.ts` + `elysiaclaw/src/session-rotation/task-segment-tracker.ts`
- **前置依赖：** TASK-01完成 ✅
- **风险：** 预算参数选择不当可能导致过早或过晚压缩


### TASK-03: Tool Parity Task 14: AskUserQuestionTool ✅
- **状态：** 已完成（2026-06-08）
- **用户可见的变化：** Agent 在需要用户决策时通过 Telegram inline keyboard 询问，用户点击按钮回复
- **完成标准：**
  1. ✅ `ask-user-question.ts` 工具实现：Zod schema + execute 逻辑
  2. ✅ `ask-user-question-helpers.ts` 纯函数提取：callback 解析、pending question 管理、ID 生成
  3. ✅ `bot-handlers.ts` callback_query 路由：`ask_user:` 前缀拦截 → `resolveAskUserQuestion` → 清除按钮
  4. ✅ 四层注册：L1 工具文件 → L2 elysiaclaw-tools.ts → L3 tool-catalog.ts → L4 运行时配置
  5. ✅ 11 个单元测试全绿（callback 解析 6 + resolve 3 + ID 生成 2）
  6. ✅ `pnpm build` 零错误
- **验证方法：** verify → PLAN-07.spec:AC-14
- **约束：** 不影响现有 Telegram 消息处理流程 ✅（ask_user callback 在 approval 之后、pagination 之前独立路由，return 退出）
- **起点：** `elysiaclaw/src/telegram/` → `elysiaclaw/src/agents/tools/`
- **前置依赖：** 无
- **风险：** inline keyboard callback 处理需要新增 Telegram update handler ✅ 已在 bot-handlers.ts 中实现


### TASK-04: attempt.ts 拆分重构
- **用户可见的变化：** 无直接用户可见变化，但代码可维护性大幅提升
- **完成标准：**
  1. `attempt.ts` 拆分为 3 个文件：system-prompt-builder.ts / injection-coordinator.ts / index-head-injector.ts
  2. 所有现有测试通过
  3. 类型检查零错误
  4. 生产部署后功能无回归
- **验证方法：** `npm run check` + `npm test` + deploy.sh 后 E2E 验证
- **约束：** 不能改变任何外部行为；不能破坏现有 API 契约
- **起点：** `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`（2861+ 行）
- **前置依赖：** TASK-01完成（P0注入方向修正后拆分更清晰）
- **风险：** 大文件拆分容易引入回归；需要充分的测试覆盖


### TASK-05: PLAN-09 P2：元压缩 + 图遍历检索
- **用户可见的变化：** 长对话中B3索引头自动聚合，RECALL能搜到关联的已归档内容
- **完成标准：**
  1. B3索引头超预算时自动触发元压缩（task→session节点聚合）
  2. 图遍历能从入口节点扩展到关联节点
  3. RECALL结果包含图遍历关联的索引头
  4. `npm run check`零错误，相关vitest全绿
- **验证方法：** verify → PLAN-09.spec:AC-7, AC-8
- **约束：** 元压缩只替换B3注入内容，IndexNode和边仍在图谱中
- **起点：** 新增meta-compression.ts + 升级dual-track-index.ts
- **前置依赖：** TASK-02完成
- **风险：** 元压缩丢信息（缓解：IndexNode仍在图谱中可回查）

### TASK-08: 会话轮换清理 ✅
- **状态：** 已完成（2026-06-09）
- **来源 plan：** PLAN-12 忆匣统一记忆系统
- **用户可见的变化：** 无直接用户可见变化，但移除了全部轮换残留代码，为忆匣系统铺路
- **完成标准：**
  1. ✅ 删除 HandoffPacket、RotationReason 类型
  2. ✅ 移除 5 个旋转字段 (activeSessionKey/sessionKeys/lastRotationAt/rotationCount/lastHandoffPacketJson)
  3. ✅ 删除 updateActiveSession() 死代码
  4. ✅ 简化 conversation-router (移除 rotated flag)
  5. ✅ 更新 9 文件，28 测试全过，0 type error

### TASK-09: 双轨注入修正 ✅
- **状态：** 已完成（2026-06-09）
- **来源 plan：** PLAN-09 / PLAN-12
- **用户可见的变化：** B4 注入当前任务完整细节，agent 可通过 task_get 工具按 archiveRef 解引用历史任务
- **完成标准：**
  1. ✅ B4 ACTIVE TASK: formatTaskBodyForInjection + B4 注入
  2. ✅ archiveRef: IndexNode 显示暴露
  3. ✅ task_get 工具: 创建+注册，支持 archiveRef 解引用
  4. ✅ 元数据格式压缩: 去 JSON fence，合并 Sender，23/23 测试通过

### TASK-10: 压缩→seal连接 ✅
- **状态：** 已完成（2026-06-09）
- **来源 plan：** PLAN-09 / PLAN-12
- **用户可见的变化：** 压缩不再是盲摘要，而是产生带索引的任务边界
- **完成标准：**
  1. ✅ compaction 触发 → sealSegment → IndexNode → B3 常驻（attempt.ts:3078）

### TASK-11: PLAN-12 P0 设计+存储 ✅
- **状态：** 已完成（2026-06-09）
- **来源 plan：** PLAN-12 忆匣统一记忆系统
- **用户可见的变化：** 无直接用户可见变化，但忆匣存储层已就位
- **完成标准：**
  1. ✅ PLAN-12.md 设计文档（6 个不变式 + 4 阶段实施路径）
  2. ✅ memory-box-store.ts 独立 SQLite 存储层（MemoryBox + MemoryBoxTask CRUD，0 type error）


### TASK-12: PLAN-13 M0 — 修地基：task 边界改控制流（crit:p0） ✅
- **状态：** 已完成（2026-06-09）
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §2.1
- **用户可见的变化：** 多步多轮任务不再被每回合拆成碎片，agent 在完整任务上下文中工作，B3 不再被每回合一个头污染
- **完成标准（对应 PLAN-13.spec AC-1 + AC-2）：**
  1. ✅ AC-1 (crit): `startSegment` 仅在无 active 段时开新段；`sealSegment` 仅在休止（最终回复 + todo 全清 + 无 running/pending_approval 工具）或强制（窗口压力/超时）时封；上轮未休止则追加当前段
  2. ✅ 多步多轮任务（含工具审批、用户中途补充）封口为**单个**段；单轮 Q&A 封单段
  3. ✅ AC-2: `classifyInput` 不再门控 `startSegment`（输入分类器只分流 chat/affective/meta 到画像流）
  4. ✅ grep 确认 `startSegment` 调用受 `无active段` 守卫；`inputClassification` 不再门控段边界
- **验证方法：** 60 测试全绿 + grep 守卫条件 + `npm run check` 零新增类型错误

### TASK-13: PLAN-13 M1 — C2 索引头改模型写（crit:p1） ✅
- **状态：** 已完成（2026-06-10）
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §2.2
- **用户可见的变化：** 索引头含关键决策和推理链路，agent 在后续任务中能更精准地回溯历史
- **完成标准（对应 PLAN-13.spec AC-3）：**
  1. AC-3 (crit): 休止 seal 时索引头含模型自述的 goal+outcome+关键决策（非纯截断拼接）
  2. 强制 seal（窗口压力/超时）路径回退启发式（`buildIndexNodeSummary` 保留为 fallback）
  3. seal 头内容断言含模型自述字段
- **验证方法：** 84 个 session-rotation 测试全绿 + seal 头内容断言 + 强制 seal 回退路径验证 + `npm run check` 零新增错误
- **约束：** 模型写头增加 1 次 LLM 调用，需控制 token 开销；强制 seal 必须有 fallback
- **起点：** `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts` seal 区 + `elysiaclaw/src/session-rotation/task-segment-tracker.ts`
- **实现摘要：** SealSegmentParams 新增 modelIndexHead 可选字段；sealSegment 中 node.summary = params.modelIndexHead ?? buildIndexNodeSummary(segment)；attempt.ts 新增 createModelIndexHead（调 completeSimple）+ buildIndexHeadPrompt（组装提示词）；休止 seal 调用点先调模型写头再传入 sealSegment

### TASK-14: PLAN-13 M2 — B3 单路径（crit:p1） ✅
- **状态：** 已完成（2026-06-10）
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §2.3 / I6 单路径原则
- **用户可见的变化：** 无直接用户可见变化，但消除双路径后 B3 注入逻辑简化，减少数据不一致风险
- **完成标准（对应 PLAN-13.spec AC-6）：**
  1. ✅ AC-6 (crit): B3 注入只走 IndexNode + traverseGraph 单路径
  2. ✅ `resolveIndexHeadBlockForSession`（dual-track 路径）从 attempt.ts 删除
  3. ✅ grep `resolveIndexHeadBlockForSession` 生产路径零命中（除注释）
- **验证方法：** grep 旧路径零命中 + B3 注入断言走 IndexNode 路径 + 84 个 session-rotation 测试全绿 + `npm run check` 零新增错误
- **约束：** 不能破坏 B3 注入功能；删除前确认 IndexNode 路径已完全承载 B3 内容
- **起点：** `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts` + `elysiaclaw/src/session-rotation/handoff-inject.test.ts`
- **实现摘要：** 删除 attempt.ts 中 resolveIndexHeadBlockForSession 导入+调用，移除 dual-track B3 注入块；handoff-inject.test.ts 删除对应测试和 mockConversations；B3 注释更新为 PLAN-13 I6 单路径原则

### TASK-15: PLAN-13 M3 — 删 dual-track（crit:p1） ✅
- **状态：** 已完成（2026-06-10）
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §三
- **用户可见的变化：** 无直接用户可见变化，但代码库大幅简化，消除 dual-track 数据模型冗余
- **完成标准（对应 PLAN-13.spec AC-7）：**
  1. AC-7 (crit): `dual-track-index.ts` 删除；`MacroIndexEntry`/`MicroIndexEntry` 类型删除
  2. `ConversationEntry.macroIndex|microIndex` 字段删除；`consumeDualTrackIndex`/`appendMacro|Micro*` 函数删除
  3. conversations 表 ALTER 删 macro/micro 列
  4. grep 旧符号零命中 + `npm run check` 零错误 + DB schema 验证
- **验证方法：** grep 旧符号零命中 + `npm run check` 零错误 + conversation-store DB schema 验证
- **约束：** DB ALTER 需兼容现有数据；删除前确认无生产路径引用
- **起点：** `elysiaclaw/src/session-rotation/dual-track-index.ts` + `elysiaclaw/src/session-rotation/conversation-store.ts` + `elysiaclaw/src/session-rotation/conversation-types.ts`
- **前置依赖：** TASK-14 (M2) 完成
- **风险：** DB ALTER 在生产环境需谨慎（缓解：先删代码引用，再 ALTER）
- **详细实现指导：**
  1. **删除文件**：`dual-track-index.ts` 整文件删除
  2. **删除类型**：`conversation-types.ts` 中 `ConversationEntry.macroIndex`/`microIndex` 字段
  3. **删除函数**：`conversation-store.ts` 中 `consumeDualTrackIndex`/`appendMacroIndexEntry*`/`appendMicroIndexEntry*`
  4. **删除导出**：`session-rotation/index.ts` 中 dual-track 相关导出
  5. **DB 变更**：conversations 表 ALTER 删除 `macro_index`/`micro_index` 列
  6. **验证**：`grep -rn 'MacroIndexEntry|MicroIndexEntry|DualTrackIndex|consumeDualTrackIndex|appendMacro|appendMicro' elysiaclaw/src/ | grep -v test` 零命中

### TASK-16: PLAN-13 M4 — 动态滑动窗口（crit:p1） ✅
- **状态：** 已完成（2026-06-10）
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §2.6
- **用户可见的变化：** 长对话中窗口自动向前滑动，老任务的原始消息被索引头代理，为 active task 腾出空间
- **完成标准（对应 PLAN-13.spec AC-10）：**
  1. AC-10 (crit): task seal 时其老于 recency 锚的原始消息从消息数组移除，T1 头存续
  2. 窗口每封口一个 task 向前滑一格
  3. 封口前后消息数组断言 + B3 头存续验证
- **验证方法：** 封口前后消息数组断言 + B3 头存续 + `npm run check` 零错误
- **约束：** recency 锚默认复用 keep-recent 20k；移除消息不能影响 B3/B4/B5 注入
- **起点：** `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts` + 消息数组管理
- **前置依赖：** TASK-12 (M0) 完成
- **风险：** 消息移除时机需精确，不能移除 active task 的消息
- **详细实现指导：**
  1. **attempt.ts — seal 后消息数组裁剪**：新增 `pruneSealedTaskRawMessages` 函数，从尾部向前累积 recency 锚内消息，锚外属于已封 task 的 raw 消息移除
  2. **消息→task 映射**：在 attempt.ts 中维护消息到 task segment 的映射关系（消息产生时记录所属 segmentId）
  3. **recency 锚值**：默认 20k token，可配
  4. **验证**：封口后老 raw 消息从数组移除 + B3 头存续 + 窗口每封口一个 task 向前滑一格

### TASK-17: PLAN-13 M5 — autoCompact 改造为 seal-aware（crit:p1，触及框架层） ✅
- **状态：** 已完成（2026-06-10）
- **改动文件：**
  - `packages/coding-agent/src/core/compaction/auto-compact.ts` — 新增 `SealedRange` 接口、`getMessageTimestamp`/`isInSealedRange` 辅助函数、`autoCompactMessages` 新增 `sealedRanges` 参数，`toSummarize` 中时间戳匹配 sealed range 的消息直接丢弃（零 LLM），仅对孤儿消息回退 LLM 小摘要；`AutoCompactResult` 新增 `sealedDiscarded` 字段
  - `packages/coding-agent/src/core/sdk.ts` — `CreateAgentSessionOptions` 新增 `getSealedTaskRanges?: () => SealedRange[]` 回调；`transformContext` 闭包中调用回调获取 sealed ranges 并传递给 `autoCompactMessages`
  - `packages/coding-agent/src/index.ts` — 导出 `SealedRange`、`AutoCompactResult`、`shouldAutoCompact` 等 auto-compact 类型/函数
  - `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts` — `sessionOpts` 新增 `getSealedTaskRanges: () => taskTracker.getSealedRanges()`
- **架构决策：** patch-agent.cjs 已由 M3 删除，改为通过 `CreateAgentSessionOptions` 正式回调注入（无 monkey-patch 风险）
- **验证：** `npm run check` + `npx tsgo --noEmit` 零回归

### TASK-18: PLAN-13 M6 — 统一预算阈值（crit:p2）
- **状态：** 待开始
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §4
- **用户可见的变化：** 1M 窗口下压缩阈值随窗口缩放，不再硬编码 80k/90k
- **完成标准（对应 PLAN-13.spec AC-11 后半）：**
  1. 80k/90k 双阈值统一为 `W × compact_ratio` 单阈值
  2. 单阈值驱动 seal / seal-aware raw 丢弃 / C3 元压缩
  3. 注入量（B2-B5）计入阈值
  4. 1M 窗口下阈值随窗口缩放，非硬编码
- **验证方法：** 不同窗口尺寸下阈值断言 + `npm run check` 零错误
- **约束：** 阈值变更需在 TUI+Bot 双路径验证
- **起点：** `elysiaclaw/src/context-engine/injection-budget.ts` + `packages/coding-agent/src/core/compaction/multi-layer.ts` + `packages/coding-agent/src/core/compaction/auto-compact.ts`
- **前置依赖：** TASK-17 (M5) 完成
- **风险：** compact_ratio 参数需实测调优
- **详细实现指导：**
  1. **`injection-budget.ts` — 新增 `computeCompactThreshold`**：`contextWindowTokens × compact_ratio`（默认 0.8）
  2. **`auto-compact.ts` — 替换硬编码 80k**：从 `computeCompactThreshold(contextWindowTokens)` 动态获取
  3. **`multi-layer.ts` — 替换硬编码 90k**：同一动态阈值
  4. **`sdk.ts` — 传递 contextWindowTokens**：确保 `transformContext` 闭包中能获取到 `contextWindowTokens`
  5. **验证**：1M 窗口下阈值 = 800k（非 80k 硬编码）+ 阈值随窗口缩放

### TASK-19: PLAN-13 M7 — C3 元压缩（crit:p2）
- **状态：** 待开始
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §2.2
- **用户可见的变化：** 长对话中 B3 索引头自动聚合，agent 能在更紧凑的上下文中工作
- **完成标准（对应 PLAN-13.spec AC-12 前半）：**
  1. B3 索引头总量超预算时自动触发 C3 元压缩
  2. N 个 task IndexNode → 1 个 session 节点（grain="session"）
  3. 原 task 头出 B3，但 IndexNode 留图谱（I2 索引只增）
  4. 新增 `meta-compression.ts` 模块
- **验证方法：** 元压缩触发断言 + 图谱查询验证 task IndexNode 仍存在 + `npm run check` 零错误
- **约束：** 元压缩只替换 B3 注入内容，IndexNode 和边仍在图谱中可回查
- **起点：** 新增 `elysiaclaw/src/session-rotation/meta-compression.ts` + 升级 `elysiaclaw/src/session-rotation/dual-track-index.ts`（M3 后已删，改为操作 conversation-store）
- **前置依赖：** TASK-18 (M6) 完成
- **风险：** 元压缩丢信息（缓解：IndexNode 仍在图谱中可回查）
- **详细实现指导：**
  1. **新增 `meta-compression.ts`**：`metaCompress(taskNodes, model, apiKey)` → `{ sessionNode, removedNodeIds }`；LLM 批处理 N 个 task 头 → 1 个 session 摘要（≤300 token）
  2. **B3 注入时检查预算**：`estimateTokens(b3Content) > indexBudget` 时触发元压缩
  3. **原 task 头处理**：出 B3 但 IndexNode 留图谱（I2 索引只增），session 节点入 B3
  4. **session 节点结构**：`{ nodeId, grain: "session", summary, childNodeIds }`

### TASK-20: PLAN-13 M8 — 命名收尾（crit:p3） ✅
- **状态：** 已完成（2026-06-10）
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §六 M8
- **用户可见的变化：** 无直接用户可见变化，但代码库命名与认知架构概念对齐，降低新贡献者理解成本
- **完成标准：**
  1. `session-rotation/` → `cognitive-memory/`
  2. `handoff-types.ts` → `cognitive-types.ts`
  3. `handoff-inject.ts` → `index-head-injector.ts`
  4. logger 名同步更新
  5. grep `handoff`/`rotation` 在已废概念处零命中（注释除外）
- **验证方法：** grep 旧概念零命中 + `npm run check` 零错误 + 全量 import 路径正确
- **约束：** 纯重命名，不改变任何逻辑；需更新所有 import 路径
- **起点：** `elysiaclaw/src/session-rotation/` 全目录
- **前置依赖：** TASK-15 (M3) 完成
- **风险：** 大范围重命名容易遗漏 import；需全量 grep 验证
- **详细实现指导：**
  1. **创建新目录/文件**：`cognitive-memory/` 目录 + 新文件名
  2. **迁移内容**：仅改 import 路径和 logger 名，不改逻辑
  3. **更新所有 import 引用**：attempt.ts、conversation-store.ts 等
  4. **删除旧文件**
  5. **重命名清单**：`session-rotation/` → `cognitive-memory/`；`handoff-types.ts` → `cognitive-types.ts`；`handoff-inject.ts` → `index-head-injector.ts`；logger 名含 `handoff`/`rotation` → `cognitive`/`index-head`

### TASK-21: PLAN-13 M9 — 端到端验证 + 部署（crit:p0）
- **状态：** 待开始
- **来源 plan：** [PLAN-13](plans/PLAN-13.md) 认知工作集架构 §六 M9
- **用户可见的变化：** 认知工作集架构完整落地，agent 在 Telegram 中展现多步任务延续能力
- **完成标准（对应 PLAN-13.spec AC-12 + 全部 AC 回归）：**
  1. Telegram 实跑多步任务，验 conversation-store.db 有正确 IndexNode/edges
  2. 新任务替换 B4，RECALL 命中归档
  3. AC-1~AC-12 全部验证通过
  4. 不变式回归门：I1~I6 + 单路径原则
  5. deploy.sh 部署 + gateway 正常响应
- **验证方法：** Telegram E2E + DB 验证 + AC 全绿 + deploy 验证
- **约束：** 需主模型可用；完成定义 = 生产路径实跑 + 端到端（PITFALLS #85）
- **起点：** deploy.sh + Telegram Bot 实跑
- **前置依赖：** TASK-12~TASK-20 (M0-M8) 全部完成
- **风险：** 主模型不可用阻塞验证；多步迁移后可能有累积回归
- **详细实现指导：**
  1. **Telegram 实跑多步任务**：用户发多步请求→agent 工具调用→用户补充→agent 继续→最终回复
  2. **DB 验证**：conversation-store.db 有正确 IndexNode/edges
  3. **B4 替换验证**：新任务替换 B4（旧 active task body 出窗）
  4. **RECALL 命中归档**：RECALL 能搜到已归档内容
  5. **不变式回归门**：I1-I6 + 单路径原则
  6. **部署**：`npm run check` 零错误 + `./deploy.sh` 5 guards 全部通过 + patch-agent.cjs 存活验证 + 生产环境 E2E 验证


## 阻塞中的任务
- 端到端生产验证：阻塞于主模型不可用（OpenRouter owl-alpha 不可用）


## 本冲刺不做的事
- World Model Phase 2（PLAN-03）— 等待 PLAN-13 M0-M7 闭环
- 技能进化 Skill Evolution（PLAN-04）— 等待 World Model
- MCP 协议集成（Tool Parity Task 15）— 大工程，排在 Task 14 之后
- 并行执行引擎（Tool Parity Task 16）— 大工程，最后做
- 参与者持续性 W1-W5（PLAN-08 L0/L1/L3/L4）— 等待 PLAN-13 闭环
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
1. [TASK-07] PLAN-11 Bot 测试基础设施修复与依赖对齐（crit:p0） — AC-1:pi-tui v0.58→v0.64升级(28文件恢复) + AC-2:fetch.test.ts 3条断言修复 + AC-3:Telegram测试套件全绿 + AC-4:跨层无回归
2. [TASK-06] ~~PLAN-10 审计修复（crit:p1）~~ ✅ — AC-1:contextPressureBudget语义修复(injectionTokens) + AC-2:traverseGraph接入B3(1-hop) + AC-3:HandoffPacket死代码清理(~150行) + AC-4:测试迁移(6条IndexNode/Edge/traverseGraph) + BFS off-by-one修复
3. [TASK-01] ~~PLAN-09 P0：注入方向修正 + 轮换机制废弃~~ ✅ — B3/B4/B5 prepend→append，删除rotation-controller/auto-trigger/rotate-session-tool，HandoffPacket废弃，auto-rotation移除，npm run check零错误+vitest全绿
4. [TASK-02] ~~PLAN-09 P1：预算器接入 + TaskSegment封口产生IndexNode~~ ✅ — computeInjectionBudget接入运行时（按窗口比例缩放），封口时写入IndexNode+temporal/produces硬边，conversation-store新增index_nodes+edges表+traverseGraph，B3注入从图谱读IndexNode，npm run check零错误
5. [TASK-03] ~~Tool Parity Task 14: AskUserQuestionTool~~ ✅ — Telegram inline keyboard 交互工具，ask-user-question.ts + helpers + bot-handlers callback路由 + 四层注册 + 11测试全绿
6. [TASK-08] ~~会话轮换清理~~ ✅ — 删除HandoffPacket/RotationReason类型+5个旋转字段+updateActiveSession死代码+conversation-router简化，9文件，28测试全过
7. [TASK-09] ~~双轨注入修正~~ ✅ — B4 ACTIVE TASK注入(formatTaskBodyForInjection) + archiveRef暴露 + task_get工具创建注册 + 元数据格式压缩
8. [TASK-10] ~~压缩→seal连接~~ ✅ — compaction触发→sealSegment→IndexNode→B3常驻(attempt.ts:3078)
9. [TASK-11] ~~PLAN-12 P0 设计+存储~~ ✅ — PLAN-12.md设计文档 + memory-box-store.ts独立SQLite存储层
10. [TASK-04] attempt.ts 拆分重构 — 拆为 system-prompt-builder.ts + injection-coordinator.ts + index-head-injector.ts
11. [TASK-05] PLAN-09 P2：元压缩 + 图遍历检索 — L2.5 task→session聚合，图遍历检索闭环


## 任务详情


### TASK-07: PLAN-11 Bot 测试基础设施修复与依赖对齐（crit:p0）
- **状态：** 待开始
- **来源 plan：** [PLAN-11](plans/PLAN-11.md) Bot 测试基础设施修复与依赖对齐
- **用户可见的变化：** 无直接用户可见变化，但恢复 28 个测试文件的执行能力，为后续 Bot 功能开发提供测试保障
- **完成标准（对应 PLAN-11.spec AC-1~AC-4）：**
  1. AC-1 (crit): `@mariozechner/pi-tui` 升级到 ≥ v0.64.0，`pnpm build` 零错误，28+1 个测试文件恢复加载
  2. AC-2 (high): `fetch.test.ts` 3 条断言修复，0 failures
  3. AC-3 (high): Telegram 测试套件全绿（0 failed files, 0 failed tests）
  4. AC-4 (medium): 跨层无回归 — `npm run check` + agent/coding-agent/session-rotation/logging vitest 全绿
- **验证方法：** 见 PLAN-11.spec 验证命令
- **约束：** 不能破坏生产运行时行为；升级 pi-tui 后需验证无 breaking change
- **起点：** `elysiaclaw/package.json`（pi-tui 版本）+ `elysiaclaw/src/telegram/fetch.test.ts`（断言）
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


## 阻塞中的任务
- 端到端生产验证：阻塞于主模型不可用（OpenRouter owl-alpha 不可用）


## 本冲刺不做的事
- World Model Phase 2（PLAN-03）— 等待 PLAN-12 P1-P2 闭环
- 技能进化 Skill Evolution（PLAN-04）— 等待 World Model
- MCP 协议集成（Tool Parity Task 15）— 大工程，排在 Task 14 之后
- 并行执行引擎（Tool Parity Task 16）— 大工程，最后做
- 参与者持续性 W1-W5（PLAN-08 L0/L1/L3/L4）— 等待 PLAN-12 闭环
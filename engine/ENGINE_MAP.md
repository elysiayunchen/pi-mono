# ENGINE_MAP — Elynyx
> Last updated: 2026-06-10 | Revision: 33 | 引擎系统的索引层。每次会话 MUST 最先读此文件。
> ⚠️ 本文件只记录关系与元数据，NEVER 复制其他文件的正文内容。它是 RECONCILE 的首要核对对象。


## 0. Profile（介质配置）
> 决定 agent 信任谁、加载谁、现生谁。切换介质只改本节，不动其他文件。

| 字段 | 值 | 说明 |
|------|-----|------|
| Active profile | CLI-LEAN | Trae IDE / Claude Code 直接读代码，无需手动传文件 |
| 现生来源 (regen source) | 直接探测代码库 | derivable 内容从 `/home/elysia/projects/pi-mono/` 现场重建 |
| Regen 命令前缀 | rg / ls / cat / grep —— 只读 | 重建 derivable 内容时允许的只读命令 |

**知识类别 → 行为映射（强制）：**
- `irreducible` / `index` → 所有 profile 下常驻可信（always trust disk）
- `derivable` → WEB‑FULL：读并信任磁盘；CLI‑LEAN：忽略磁盘版本，按需从「现生来源」重建，NEVER trust the stale disk copy
- `mixed` → 按 §1.1 的 section 级类别分别处理

**读取流程（每次会话）：**
1. 读本 MAP → 取得 profile、文件注册表、plan 关系图
2. 按上表映射决定：加载哪些文件、忽略并现生哪些
3. 若任务涉及某 plan → 从 §3 关系图查关联，读该 plan 全文 + 其 spec twin + 关联的执行层条目
4. 用一句中文复述对当前状态的理解，等架构师确认后动手


## 1. 文件注册表 (File Registry)
> 每个引擎文件登记一行。新增引擎文件 = 此表加行（EXTEND 模式的落点）。

| File | Class | Read priority | Revision | Last verified |
|------|-------|---------------|----------|---------------|
| ENGINE_MAP.md | index | 0 | 22 | 2026-06-10 |
| SYSTEM.md | irreducible | 1 | 1 | 2026-06-08 |
| CONTEXT.md | irreducible | 2 | 6 | 2026-06-10 |
| HANDOFF.md | irreducible | 3 | 6 | 2026-06-10 |
| SPRINT.md | irreducible | 4 | 6 | 2026-06-10 |
| ROADMAP.md | irreducible | 5 | 2 | 2026-06-09 |
| PITFALLS.md | irreducible | 6 | 4 | 2026-06-10 |
| ARCHITECTURE.md | mixed | 7 | 3 | 2026-06-09 |
| SOURCEMAP.md | derivable | 8 | 1 | 2026-06-08 |

[新引擎文件追加到表格末尾。删除文件时直接删行，并同步清理 §3 中对它的引用。]

### 1.1 Section 级类别（仅 mixed 文件）
> CLI‑LEAN 下，mixed 文件只保留 irreducible 章节，其余按需现生。

| File | Irreducible sections（常驻） | Derivable sections（CLI 现生） |
|------|------------------------------|--------------------------------|
| ARCHITECTURE.md | §0 产品简史, §1 项目身份, §6 关键架构决策, §7 数据约束与不变量（含 Bot/TUI 双轨架构差异）, §11 认知架构全景（3 正交子系统+身份层，统合权威图） | §2 技术栈, §3 目录结构, §4 包/服务地图, §5 核心数据流, §8 日志与可观测性, §9 外部依赖, §10 快速启动 |


### 1.2 锚点注册表 (Anchor Registry)
> 锚点层文件（class: anchor），住在代码库约定位置而非 /engine/。RECONCILE 核对其存在性、指针有效性、与正本的一致性及覆盖率。

| Path | 类型 | 权威指向 | Last verified |
|------|------|----------|---------------|
| AGENTS.md | bootloader（正本） | engine/ENGINE_MAP.md, engine/SYSTEM.md | 2026-06-10 |
| CLAUDE.md | bootloader（同步副本） | AGENTS.md | 2026-06-10 |
| packages/tui/README.md | package-anchor | PITFALLS: P006, P078; ARCHITECTURE §6: #6 | 2026-06-10 |
| packages/ai/README.md | package-anchor | PITFALLS: P016, P023; ARCHITECTURE §6: #6 | 2026-06-10 |
| packages/agent/README.md | package-anchor | PITFALLS: P011, P022b; ARCHITECTURE §6: #3 | 2026-06-10 |
| elysiaclaw/README.md | package-anchor | PITFALLS: P017, P054, P103; ARCHITECTURE §6: #2 | 2026-06-10 |

[未生成包级锚点时只登记前两行。新包锚点追加到表格末尾。删除包时删行。包锚点中若有「本包局部规则」作为权威知识，在「权威指向」列标注 `local-authoritative`。]


## 2. Plan 注册表 (Plan Registry)
> 每份 plan 作为完整文件存于 `engine/plans/`，与其 spec twin 并列共生。新 plan 录入 = 此表加行（INGEST 第一步）。

| ID | Title | Status | Plan path | Spec twin | 备注 | Last verified |
|----|-------|--------|-----------|-----------|------|---------------|
| PLAN-01 | 分层上下文注入架构（Context Injection） | archived | engine/archive/plans/PLAN-01.md | engine/archive/plans/PLAN-01.spec.md | superseded-by: PLAN-09 → PLAN-13 | 2026-06-09 |
| PLAN-02 | 会话轮换与跨会话延续（Session Rotation） | archived | engine/archive/plans/PLAN-02.md | engine/archive/plans/PLAN-02.spec.md | superseded-by: PLAN-09 → PLAN-13 | 2026-06-09 |
| PLAN-03 | 超级计算机管理员 Agent（World Model + Memory） | active | engine/plans/PLAN-03.md | engine/plans/PLAN-03.spec.md | 正交子系统②；Phase 1 记忆引擎 ✅，Phase 2 World Model 待启动 | 2026-06-08 |
| PLAN-04 | 知识库与自我进化 | active | engine/plans/PLAN-04.md | engine/plans/PLAN-04.spec.md | 正交子系统③；输入分类/用户画像 ✅，技能进化 PROPOSAL | 2026-06-08 |
| PLAN-05 | Telegram UX × 上下文/记忆协同 | active | engine/plans/PLAN-05.md | engine/plans/PLAN-05.spec.md | WS-1/WS-2/WS-3 已完成 | 2026-06-08 |
| PLAN-06 | 子代理代码委派（delegate_code_task） | active | engine/plans/PLAN-06.md | engine/plans/PLAN-06.spec.md | AC 未全部验证，待 RECONCILE 确认 | 2026-06-08 |
| PLAN-07 | Tool Parity（工具对标 Claude Code） | active | engine/plans/PLAN-07.md | engine/plans/PLAN-07.spec.md | 15/17 = 88.2%，Task 14 ✅，Task 15-16 待执行 | 2026-06-08 |
| PLAN-08 | 参与者持续性架构（Participant Continuity） | archived | engine/archive/plans/PLAN-08.md | engine/archive/plans/PLAN-08.spec.md | superseded-by: PLAN-09 → PLAN-13（L0/L1/L3/L4 方向保留） | 2026-06-09 |
| PLAN-09 | 事件记忆与认知索引架构（Event Memory & Cognitive Index） | archived | engine/archive/plans/PLAN-09.md | engine/archive/plans/PLAN-09.spec.md | superseded-by: PLAN-13；已落地实现保留（IndexNode/HardEdge/traverseGraph/图谱表/computeInjectionBudget/B3 append），PLAN-13 在其上续建 | 2026-06-09 |
| PLAN-10 | 体验端落实验证与可维护性保障框架 | archived | engine/archive/plans/PLAN-10.md | engine/archive/plans/PLAN-10.spec.md | AC-1~AC-4 全部验证通过（2026-06-09），TASK-06 ✅ | 2026-06-09 |
| PLAN-11 | Bot 测试基础设施修复与依赖对齐 | accepted | engine/plans/PLAN-11.md | engine/plans/PLAN-11.spec.md | pi-tui 版本漂移(28文件) + fetch.test.ts 断言(3测试)；P1 依赖升级 + P2 断言修复 + P3 全量验证 | 2026-06-09 |
| PLAN-12 | 忆匣 (Memory Box) — 统一记忆系统 | archived | engine/archive/plans/PLAN-12.md | (暂无 spec) | superseded-by: PLAN-13（忆匣简化为单 task 惰性分组）；memory-box-store.ts 保留为 T2 body 存储 | 2026-06-09 |
| PLAN-13 | 认知工作集架构（Cognitive Working Set） | accepted | engine/plans/PLAN-13.md | engine/plans/PLAN-13.spec.md | 认知架构子系统①+连接层**唯一权威**；合并重写 PLAN-09/12，从"固定窗口=工作集缓存"单一策略推导：四层缓存(T0-T3)+seal 单动作+task=控制流边界+忆匣=单task惰性分组+动态滑动窗口+autoCompact 改造为 seal-aware；含 M0-M9 有序迁移链；M0 修地基(task≠turn)未启动 | 2026-06-09 |
| PLAN-13.branch | PLAN-13 详细分支方案设计 | reviewed | engine/plans/PLAN-13.branch.md | (无独立 spec，验证标准见 PLAN-13.spec) | PLAN-13 的精确实现补充：M0-M9 代码改动方向+代码骨架+验证步骤+风险缓解+并行性分析+审核确认点(Q-06~Q-10✅+C1-C4✅+附录C)；**M0/M1/M2 已完成** | 2026-06-10 |
| PLAN-14 | 审批流感知的 Task 休止判定（setToolCallPendingApproval 死代码复活） | implemented | engine/plans/PLAN-14.md | (暂无 spec) | P096 系统化修复方案；核心路径已实现：subscribe.handlers.tools → approvalPending → attempt.ts → setToolCallPendingApproval → isQuiescent；Q-01~Q-05 边缘场景待定 | 2026-06-10 |
| PLAN-15 | 资产-躯壳解耦（认知内核抽取 + 事件溯源脊椎 + 减法工程） | accepted | engine/plans/PLAN-15.md | engine/plans/PLAN-15.spec.md | 独立架构评审产出；S0-S7 迁移链；S0/S1/S2 可三线并行启动；S0 即 PLAN-13 M9 的脚本化实施形态；PLAN-14 Q-01~Q-05 并入 S0；**修订 R1（维护者决策）**：S3 改全冻结零删除 + 新增 S7 pi-mono 汇入单一源码树（packages→elysiaclaw/src/framework/，cognition 落位 src/cognition/）+ 宫殿层独立为 PLAN-16 | 2026-06-10 |
| PLAN-16 | 记忆宫殿（B3 准入分级 + 工作集驱逐 + 分形地图 + 宫殿工具层） | accepted | engine/plans/PLAN-16.md | (spec 内联于 plan §七，AC-1~AC-10) | 维护者设想（盒中盒+Obsidian 图谱+agent 自管理）+ 纠偏（机制自动为主，工具为覆写层，AC-4 工具静默定理）；解决噪音累积（准入）与索引溢出（五级阶梯）；P1-P4 实施链，前置 PLAN-15 S0/S2；P1 可与 S4/S5/S7 并行 | 2026-06-10 |
| PLAN-17 | 睡眠周期（离线认知整理 + 技能固化 + 自我体检 + 预热） | accepted | engine/plans/PLAN-17.md | (spec 内联于 plan §五，AC-1~AC-9) | 维护者已采纳；四班次（tidy/distill/checkup/prefetch）+ 晨报审批门；D1-D4 实施链；D1 前置 PLAN-15 S0，D2/D3 前置 PLAN-16 P1/P4；激活 PLAN-04 技能进化与 PLAN-03 probes 消费 | 2026-06-10 |
| PLAN-18 | 全双工对话（打断、转向、补充、突发消息聚合） | accepted | engine/plans/PLAN-18.md | (spec 内联于 plan §五，AC-1~AC-10) | 维护者体验痛点；意图四分类×三注入点 + debounce 聚合 + fast-ack；内核 steering 队列 API 已存在（已验证），主体为接线；F1-F3 实施链，零硬前置可独立启动 | 2026-06-10 |
| PLAN-19 | 存在与心跳（生命周期播报 + 独立看门狗 + 故障分类 + 主动通知） | accepted | engine/plans/PLAN-19.md | (spec 内联于 plan §五，AC-1~AC-9) | 维护者体验痛点；核心原则=报警通路与故障域解耦（三层：gateway 报 API/看门狗报 gateway/dead-man 报整机）；notify policy 为 World Model 主动性输出端；H1-H4 实施链，H1/H2 零前置 | 2026-06-10 |

[新 plan 追加到表格末尾。ID 按 PLAN‑[N+1] 递增。状态变更时直接改对应行。]
[原设计文档已迁移至 `engine/plans/`，旧目录 `elynx_engine/` 已删除。]

**Status 定义：**
- `proposed` —— 已录入，尚未派生任务
- `accepted` —— 设计已审定为权威方向（方向锁定、不可推翻），但尚未全部落地；介于 proposed 与 active 之间，可据此派生执行任务并清理冲突代码
- `active` —— 已派生执行层条目，进行中
- `done` —— 已落实并通过验证：其 spec twin 关联的全部验收标准（AC）均验证通过
- `archived` —— 已归档至 `engine/archive/plans/`；含 superseded（被后续 plan 取代）和 done（已完成）两类；备注列记取代链，NEVER 删除原 plan 与其 twin


## 3. 关系图 (Linkage Graph)
> plan ↔ 执行层条目 ↔ 代码模块的连线。追溯「改 X 会牵连什么」的唯一权威来源。

### 3.1 Plan → 派生条目 / 验收标准 / 触及模块
| Plan | 派生的执行层条目 | 关联验收标准 | 触及的模块/目录 |
|------|------------------|--------------|------------------|
| PLAN-01 | ROADMAP:序1-5, SPRINT:序1-7统一实施, SYSTEM:AI Agent Rules | PLAN-01.spec:AC-1~AC-5 | elynx/src/agents/pi-embedded-runner/run/attempt.ts, elynx/src/context-engine/ |
| PLAN-02 | SPRINT:序8阶段1-4/健全性修复/深度审查, ROADMAP:序8-9, PITFALLS:#87-#94 | PLAN-02.spec:AC-1~AC-8 | elynx/src/session-rotation/, elynx/src/agents/tools/rotate-session-tool.ts |
| PLAN-03 | ROADMAP:记忆引擎激活/World Model, SPRINT:记忆引擎激活T1-T6, PITFALLS:memory相关 | PLAN-03.spec:AC-1~AC-6 | elynx/src/memory/, elynx/src/agents/tools/memory-tool.ts |
| PLAN-04 | ROADMAP:序6-7/11-12, SPRINT:用户画像/输入分类器 | PLAN-04.spec:AC-1~AC-4 | elynx/src/user-model/, elynx/src/context-engine/input-classifier.ts |
| PLAN-05 | ROADMAP:序2-3, SPRINT:流式输出修复/压缩可见性/SPRINT-21 Tool Update 进度传播, PITFALLS:#95 | PLAN-05.spec:AC-1~AC-3 | elynx/src/telegram/bot-message-dispatch.ts, elynx/src/auto-reply/reply/agent-runner-execution.ts, elynx/src/agents/pi-embedded-subscribe.handlers.tools.ts, elynx/src/agents/pi-embedded-subscribe.ts, elynx/src/agents/pi-embedded-runner/ |
| PLAN-06 | ROADMAP:delegate_code_task, SPRINT:子代理分发实施, PITFALLS:#65-#68 | PLAN-06.spec:AC-1~AC-4 | elynx/src/agents/tools/delegate-code-task.ts |
| PLAN-07 | ROADMAP:Tool Parity, SPRINT:Tool Parity Task 0-13, PITFALLS:#46-#56 | PLAN-07.spec:AC-1~AC-17 | elysiaclaw/src/agents/coding-agent/core/tools/, elysiaclaw/src/agents/pi-tools.ts |
| PLAN-08 | SPRINT:W0闭环session-rotation, ROADMAP:参与者持续性, SYSTEM:协作协议 | PLAN-08.spec:AC-1~AC-7 | elynx/src/session-rotation/, elynx/src/participant/ |
| PLAN-09 | SPRINT:PLAN-09-P0✅(注入修正+死代码清理)/P1✅(预算器+IndexNode+图谱表+B3图谱注入)/P2(元压缩+图遍历)/P3(端到端验证), ROADMAP:事件记忆闭环(M4重定义), PITFALLS:#91→P0✅已删除/#92→P1✅封口+图谱表/#93→P0✅已删除 | PLAN-09.spec:AC-1~AC-10 | elynx/src/session-rotation/(P0:rotation-controller/auto-trigger/rotate-session-tool已删除; P1:index_nodes+edges表+CRUD+traverseGraph), elynx/src/context-engine/(P1:computeInjectionBudget接入运行时), elynx/src/agents/pi-embedded-runner/run/attempt.ts(P0:prepend→append; P1:onSeal回调+B3图谱注入), elynx/src/memory/(图遍历基础) |
| PLAN-10 | SPRINT:TASK-06✅(PLAN-10审计修复:AC-1~AC-4) | PLAN-10.spec:AC-1~AC-4 | elynx/src/agents/pi-embedded-runner/run/attempt.ts（AC-1:injectionTokens语义修复 / AC-2:traverseGraph 1-hop接入B3）, elynx/src/session-rotation/conversation-store.ts（AC-3:consumeHandoffPacket删除 / BFS off-by-one修复）, elynx/src/session-rotation/dual-track-index.ts（AC-3:buildMacroEntryFromHandoff删除）, elynx/src/session-rotation/handoff-types.ts（AC-3:validateHandoffCompleteness/formatHandoffForInjection删除,HandoffPacket@deprecated）, elynx/src/session-rotation/handoff-inject.ts（AC-3:3个废弃函数删除）, elynx/src/session-rotation/conversation-store.test.ts（AC-4:6条IndexNode/Edge/traverseGraph测试） |
| PLAN-11 | SPRINT:TASK-07(PLAN-11 Bot测试修复:AC-1~AC-4) | PLAN-11.spec:AC-1~AC-4 | elynx/package.json（AC-1:pi-tui升级）, elynx/src/telegram/fetch.test.ts（AC-2:3条断言修复）, elynx/src/telegram/*.test.ts（AC-3:28文件恢复加载） |
| PLAN-12 | SPRINT:TASK-08(会话轮换清理)/TASK-09(双轨注入修正)/TASK-10(压缩→seal连接)/TASK-11(PLAN-12 P0设计+存储), ROADMAP:统一记忆系统 | (暂无 spec) | elynx/src/session-rotation/memory-box-store.ts（P0新建）, elynx/src/session-rotation/conversation-store.ts（P3简化）, elynx/src/session-rotation/task-segment-tracker.ts（P1 group管理）, elynx/src/agents/pi-embedded-runner/run/attempt.ts（B3/B4/B5适配+compaction→seal）, elynx/src/agents/tools/task-get-tool.ts（P1扩展）, elynx/src/memory/qmd-manager.ts（P2 kind:"memory-box"）, engine/plans/PLAN-12.md（设计文档） |
| PLAN-13 | SPRINT:TASK-12(M0 task边界改控制流)/TASK-13(M1 C2头模型写)/TASK-14(M2 B3单路径)/TASK-15(M3 删dual-track)/TASK-16(M4 滑动窗口)/TASK-17(M5 autoCompact seal-aware)/TASK-18(M6 统一预算阈值)/TASK-19(M7 C3元压缩)/TASK-20(M8 命名收尾)/TASK-21(M9 端到端验证+部署), ROADMAP:认知工作集脊椎(M4重定义), PITFALLS:#85/#91-94 | PLAN-13.spec:AC-1~AC-12 | M0:elynx/src/session-rotation/task-segment-tracker.ts+attempt.ts(task边界改控制流) · M1:attempt.ts seal区(C2头模型写) · M2/M3:attempt.ts:2641+dual-track-index.ts+conversation-store/types.ts(B3单路径+删双轨) · M4:attempt.ts(滑动窗口) · M5/M6:packages/coding-agent/src/core/compaction/auto-compact.ts+multi-layer.ts+sdk.ts(seal-aware改造+统一阈值) · M7:新增meta-compression.ts · M8:session-rotation/整目录重命名 |

| PLAN-15 | SPRINT:TASK-22(S1)/TASK-24(S0,吸收TASK-21)/TASK-25(S2), ROADMAP:M8+方向总纲 | PLAN-15.spec:AC-1~AC-15 | packages/agent/src/agent.ts(S1) · deploy.sh(S1/S7) · scripts/patch-agent.cjs(S1 删除) · elysiaclaw/src/agents/tools/manifest.ts(S2 新建) · elysiaclaw/src/agents/pi-tools.ts(S2) · elysiaclaw/src/cognitive-memory/(S0/S4) · elysiaclaw/src/context-engine/(S4) · elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts(S4) · elysiaclaw/src/cognition/(S4 新建，R1② 落位) · elysiaclaw/src/framework/{agent,ai,tui}(S7 汇入) · cognition-eval(S0 新建) · elysiaclaw/src/{signal,whatsapp,imessage,line,discord,slack}(S3 全冻结至 extensions/) |
| PLAN-16 | ROADMAP:M9（执行任务待 S0 完成后派生） | PLAN-16:§七 AC-1~AC-10 | elysiaclaw/src/cognitive-memory/cognitive-types.ts(P1 IndexNodeMeta) · conversation-store.ts(P1 schema迁移) · meta-compression.ts(P1 filterNodesForB3Injection 评分制 / P4 C4) · attempt.ts(P1 buildIndexHeadPrompt) · index-head-injector.ts(P2 分形地图) · src/memory/temporal-decay.ts(P1 复用) · manager-search.ts+traverseGraph(P1 touch回写) · elysiaclaw/src/agents/tools/(P3 宫殿五工具) |
| PLAN-17 | ROADMAP:M10（执行任务待 S0+P16-P1 完成后派生） | PLAN-17:§五 AC-1~AC-9 | elysiaclaw/src/cognition/sleep/(D1 新建 scheduler/tidy/distill/checkup/prefetch) · gateway 空闲信号(D1) · src/telegram(晨报发送) · meta-compression.ts(D2 复用) · skills-runtime.ts(D3 加载链复用) · ~/.elynx/skills-staging/(D3 约定) · src/memory/batch-*(D4 接入) · cognition_vitals 表(D1 新建) |
| PLAN-18 | ROADMAP:M11（零前置，任务可随时派生） | PLAN-18:§五 AC-1~AC-10 | elysiaclaw/src/telegram/bot-message-dispatch.ts(F1 debounce) · src/auto-reply/reply/agent-runner-execution.ts(F1) · attempt.ts(F1 循环边界 drain) · src/cognition/steering/classifier.ts(F2 新建) · pi-embedded-runner/abort.ts(F2 复用) · packages/agent steering 队列 API(F1 复用，已验证存在) · sessions/transcript-events.ts(F2 编辑事件) |
| PLAN-19 | SPRINT:TASK-23(H1+H2), ROADMAP:M11 | PLAN-19:§五 AC-1~AC-9 | gateway 启停钩子(H1) · src/agents/announce-idempotency.ts(H1 复用) · scripts/watchdog.mjs(H2 新建)+systemd unit · src/cognition/presence/notify-policy.ts(H4 新建) · providers/auth-profiles 失败钩子(H4) · deploy.sh(H2 看门狗部署验证) |

[plan 派生新条目时，在其行内追加。执行层条目用 `文件:锚点` 格式引用，NEVER 复制条目正文。]

### 3.2 反向索引（执行层条目 → 来源 plan）
> 由 RECONCILE 从 §3.1 自动生成。NEVER 手工双写 —— 双写即漂移源。

| 执行层条目 | 来源 plan |
|-----------|-----------|
| ROADMAP:序1-5 | PLAN-01 |
| SPRINT:序1-7统一实施 | PLAN-01 |
| SYSTEM:AI Agent Rules | PLAN-01 |
| SPRINT:序8阶段1-4/健全性修复/深度审查 | PLAN-02 |
| ROADMAP:序8-9 | PLAN-02 |
| PITFALLS:#87-#94 | PLAN-02 |
| ROADMAP:记忆引擎激活/World Model | PLAN-03 |
| SPRINT:记忆引擎激活T1-T6 | PLAN-03 |
| PITFALLS:memory相关 | PLAN-03 |
| ROADMAP:序6-7/11-12 | PLAN-04 |
| SPRINT:用户画像/输入分类器 | PLAN-04 |
| ROADMAP:序2-3 | PLAN-05 |
| SPRINT:流式输出修复/压缩可见性 | PLAN-05 |
| PITFALLS:#95 | PLAN-05 |
| ROADMAP:delegate_code_task | PLAN-06 |
| SPRINT:子代理分发实施 | PLAN-06 |
| PITFALLS:#65-#68 | PLAN-06 |
| ROADMAP:Tool Parity | PLAN-07 |
| SPRINT:Tool Parity Task 0-13 | PLAN-07 |
| PITFALLS:#46-#56 | PLAN-07 |
| SPRINT:W0闭环session-rotation | PLAN-08 |
| ROADMAP:参与者持续性 | PLAN-08 |
| SYSTEM:协作协议 | PLAN-08 |
| SPRINT:PLAN-09-P0✅/P1✅/P2/P3 | PLAN-09 |
| ROADMAP:事件记忆闭环(M4重定义) | PLAN-09 |
| PITFALLS:#91→P0✅已删除/#92→P1✅封口+图谱表/#93→P0✅已删除 | PLAN-09 |
| SPRINT:TASK-06✅(PLAN-10审计修复:AC-1~AC-4) | PLAN-10 |
| SPRINT:TASK-07(PLAN-11 Bot测试修复:AC-1~AC-4) | PLAN-11 |
| SPRINT:TASK-08~TASK-11(PLAN-12 忆匣统一记忆系统:P0设计+存储) | PLAN-12 |
| SPRINT:TASK-12~TASK-21(PLAN-13 认知工作集架构:M0-M9迁移链) | PLAN-13 |
| ROADMAP:认知工作集脊椎(M4重定义) | PLAN-13 |
| PITFALLS:#85/#91-94 | PLAN-13 |


## 4. 完整性与新鲜度 (Integrity & Freshness)
> RECONCILE 每次运行后更新本节。agent 读到陈旧/悬空标记时 MUST 对相关内容降权。

| 字段 | 值 |
|------|-----|
| 全局 revision | 33 |
| 上次 RECONCILE | 2026-06-10（v5.1 RECONCILE：添加 §1.2 锚点注册表 + CLAUDE.md/AGENTS.md 改写为薄引导器 + 吸收独有规则进 SYSTEM.md + 生成 4 个包级 README 锚点 + 更新 §5 锚点事件） |
| 悬空引用 (dangling refs) | 无 |
| 漂移警告 (drift) | 无 |


## 5. 更新协议 (Update Protocol)

| 事件 | 在 MAP 中的动作 |
|------|------------------|
| 新增引擎文件 (EXTEND) | §1 加行；若为 mixed，§1.1 加行 |
| 新 plan 录入 (INGEST) | §2 加行（含 spec twin）+ §3.1 加行 |
| plan 派生新任务/标准 | §3.1 对应行追加条目 |
| plan 状态变更 | §2 改对应行 |
| 切换介质 | 改 §0 Active profile |
| 新建代码包（达到锚点触发条件） | §1.2 加行 + 生成包级 README 锚点 |
| 用户手写规则进 CLAUDE.md / AGENTS.md | RECONCILE 吸收进对应引擎文件后恢复薄指针，§1.2 更新 Last verified |
| 每次 RECONCILE | 校验 §1 / §1.2 / §2 / §3 vs 现实，更新 §4，重生成 §3.2 |

[新触发条件追加到表格末尾。]

**强制规则 (MUST / NEVER)：**
- MUST NOT copy any other file's body content into this file —— relationships and metadata only.
- MUST read this file's current on‑disk version BEFORE writing back to any engine file（re‑anchor，对抗多步 agent 的上下文压缩）。
- MUST read this file FIRST at the start of every session.
- The §3.2 reverse index is generated by RECONCILE; NEVER maintain it by hand.
- When deleting an engine file or plan, MUST purge every reference to it in §3.
- MUST bump 全局 revision (§4) on every structural change to the registry or linkage graph.
- ENGINE_MAP itself is `index` class —— ALWAYS persisted and read, under every profile.
- Anchor 文件 MUST 保持薄指针形态；RECONCILE 发现引导器膨胀或与正本漂移时，执行「吸收再指向」（见 ANCHOR LAYER）。
# ENGINE_MAP — ElysiaClaw
> Last updated: 2026-06-08 | Revision: 4 | 引擎系统的索引层。每次会话 MUST 最先读此文件。
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
| ENGINE_MAP.md | index | 0 | 2 | 2026-06-09 |
| SYSTEM.md | irreducible | 1 | 1 | 2026-06-08 |
| CONTEXT.md | irreducible | 2 | 1 | 2026-06-08 |
| HANDOFF.md | irreducible | 3 | 1 | 2026-06-08 |
| SPRINT.md | irreducible | 4 | 1 | 2026-06-08 |
| ROADMAP.md | irreducible | 5 | 1 | 2026-06-08 |
| PITFALLS.md | irreducible | 6 | 1 | 2026-06-08 |
| ARCHITECTURE.md | mixed | 7 | 1 | 2026-06-08 |
| SOURCEMAP.md | derivable | 8 | 1 | 2026-06-08 |

[新引擎文件追加到表格末尾。删除文件时直接删行，并同步清理 §3 中对它的引用。]

### 1.1 Section 级类别（仅 mixed 文件）
> CLI‑LEAN 下，mixed 文件只保留 irreducible 章节，其余按需现生。

| File | Irreducible sections（常驻） | Derivable sections（CLI 现生） |
|------|------------------------------|--------------------------------|
| ARCHITECTURE.md | §0 产品简史, §1 项目身份, §6 关键架构决策, §7 数据约束与不变量（含 Bot/TUI 双轨架构差异）, §11 认知架构全景（3 正交子系统+身份层，统合权威图） | §2 技术栈, §3 目录结构, §4 包/服务地图, §5 核心数据流, §8 日志与可观测性, §9 外部依赖, §10 快速启动 |


## 2. Plan 注册表 (Plan Registry)
> 每份 plan 作为完整文件存于 `engine/plans/`，与其 spec twin 并列共生。新 plan 录入 = 此表加行（INGEST 第一步）。

| ID | Title | Status | Plan path | Spec twin | 备注 | Last verified |
|----|-------|--------|-----------|-----------|------|---------------|
| PLAN-01 | 分层上下文注入架构（Context Injection） | superseded | engine/plans/PLAN-01.md | engine/plans/PLAN-01.spec.md | superseded-by: PLAN-09（事件记忆+全索引统合） | 2026-06-08 |
| PLAN-02 | 会话轮换与跨会话延续（Session Rotation） | superseded | engine/plans/PLAN-02.md | engine/plans/PLAN-02.spec.md | superseded-by: PLAN-09（轮换机制废弃，TaskSegment+压缩保留） | 2026-06-08 |
| PLAN-03 | 超级计算机管理员 Agent（World Model + Memory） | active | engine/plans/PLAN-03.md | engine/plans/PLAN-03.spec.md | 正交子系统②；Phase 1 记忆引擎 ✅，Phase 2 World Model 待启动 | 2026-06-08 |
| PLAN-04 | 知识库与自我进化 | active | engine/plans/PLAN-04.md | engine/plans/PLAN-04.spec.md | 正交子系统③；输入分类/用户画像 ✅，技能进化 PROPOSAL | 2026-06-08 |
| PLAN-05 | Telegram UX × 上下文/记忆协同 | active | engine/plans/PLAN-05.md | engine/plans/PLAN-05.spec.md | WS-1/WS-2/WS-3 已完成 | 2026-06-08 |
| PLAN-06 | 子代理代码委派（delegate_code_task） | active | engine/plans/PLAN-06.md | engine/plans/PLAN-06.spec.md | AC 未全部验证，待 RECONCILE 确认 | 2026-06-08 |
| PLAN-07 | Tool Parity（工具对标 Claude Code） | active | engine/plans/PLAN-07.md | engine/plans/PLAN-07.spec.md | 15/17 = 88.2%，Task 14 ✅，Task 15-16 待执行 | 2026-06-08 |
| PLAN-08 | 参与者持续性架构（Participant Continuity） | superseded | engine/plans/PLAN-08.md | engine/plans/PLAN-08.spec.md | superseded-by: PLAN-09（L2 认知层重设计，L0/L1/L3/L4 方向保留） | 2026-06-08 |
| PLAN-09 | 事件记忆与认知索引架构（Event Memory & Cognitive Index） | active | engine/plans/PLAN-09.md | engine/plans/PLAN-09.spec.md | 认知架构子系统①**权威**；统合并取代 01/02/08 L2，废除轮换，事件流+认知图谱；P0 ✅（注入修正+轮换废弃），P1 ✅（预算器接入+IndexNode+硬边+图谱表+B3图谱注入），P0/P1 已部署至生产 ✅（2026-06-09），P2-P3 待实施 | 2026-06-09 |
| PLAN-10 | 体验端落实验证与可维护性保障框架 | active | engine/plans/PLAN-10.md | engine/plans/PLAN-10.spec.md | 质量治理 plan；审计发现 contextPressureBudget 语义漂移（crit）、traverseGraph 未接入（high）、HandoffPacket 死代码（medium）→ 已登记 SPRINT TASK-06 | 2026-06-09 |

[新 plan 追加到表格末尾。ID 按 PLAN‑[N+1] 递增。状态变更时直接改对应行。]
[原设计文档已迁移至 `engine/plans/`，旧目录 `elysiaclaw_engine/` 已删除。]

**Status 定义：**
- `proposed` —— 已录入，尚未派生任务
- `accepted` —— 设计已审定为权威方向（方向锁定、不可推翻），但尚未全部落地；介于 proposed 与 active 之间，可据此派生执行任务并清理冲突代码
- `active` —— 已派生执行层条目，进行中
- `done` —— 已落实并通过验证：其 spec twin 关联的全部验收标准（AC）均验证通过
- `superseded` —— 被后续 plan 取代；备注列记 `superseded-by: PLAN-XX`，NEVER 删除原 plan 与其 twin


## 3. 关系图 (Linkage Graph)
> plan ↔ 执行层条目 ↔ 代码模块的连线。追溯「改 X 会牵连什么」的唯一权威来源。

### 3.1 Plan → 派生条目 / 验收标准 / 触及模块
| Plan | 派生的执行层条目 | 关联验收标准 | 触及的模块/目录 |
|------|------------------|--------------|------------------|
| PLAN-01 | ROADMAP:序1-5, SPRINT:序1-7统一实施, SYSTEM:AI Agent Rules | PLAN-01.spec:AC-1~AC-5 | elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts, elysiaclaw/src/context-engine/ |
| PLAN-02 | SPRINT:序8阶段1-4/健全性修复/深度审查, ROADMAP:序8-9, PITFALLS:#87-#94 | PLAN-02.spec:AC-1~AC-8 | elysiaclaw/src/session-rotation/, elysiaclaw/src/agents/tools/rotate-session-tool.ts |
| PLAN-03 | ROADMAP:记忆引擎激活/World Model, SPRINT:记忆引擎激活T1-T6, PITFALLS:memory相关 | PLAN-03.spec:AC-1~AC-6 | elysiaclaw/src/memory/, elysiaclaw/src/agents/tools/memory-tool.ts |
| PLAN-04 | ROADMAP:序6-7/11-12, SPRINT:用户画像/输入分类器 | PLAN-04.spec:AC-1~AC-4 | elysiaclaw/src/user-model/, elysiaclaw/src/context-engine/input-classifier.ts |
| PLAN-05 | ROADMAP:序2-3, SPRINT:流式输出修复/压缩可见性, PITFALLS:#95 | PLAN-05.spec:AC-1~AC-3 | elysiaclaw/src/telegram/, elysiaclaw/src/agents/pi-embedded-runner/ |
| PLAN-06 | ROADMAP:delegate_code_task, SPRINT:子代理分发实施, PITFALLS:#65-#68 | PLAN-06.spec:AC-1~AC-4 | elysiaclaw/src/agents/tools/delegate-code-task.ts |
| PLAN-07 | ROADMAP:Tool Parity, SPRINT:Tool Parity Task 0-13, PITFALLS:#46-#56 | PLAN-07.spec:AC-1~AC-17 | packages/coding-agent/src/core/tools/, elysiaclaw/src/agents/pi-tools.ts |
| PLAN-08 | SPRINT:W0闭环session-rotation, ROADMAP:参与者持续性, SYSTEM:协作协议 | PLAN-08.spec:AC-1~AC-7 | elysiaclaw/src/session-rotation/, elysiaclaw/src/participant/ |
| PLAN-09 | SPRINT:PLAN-09-P0✅(注入修正+死代码清理)/P1✅(预算器+IndexNode+图谱表+B3图谱注入)/P2(元压缩+图遍历)/P3(端到端验证), ROADMAP:事件记忆闭环(M4重定义), PITFALLS:#91→P0✅已删除/#92→P1✅封口+图谱表/#93→P0✅已删除 | PLAN-09.spec:AC-1~AC-10 | elysiaclaw/src/session-rotation/(P0:rotation-controller/auto-trigger/rotate-session-tool已删除; P1:index_nodes+edges表+CRUD+traverseGraph), elysiaclaw/src/context-engine/(P1:computeInjectionBudget接入运行时), elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts(P0:prepend→append; P1:onSeal回调+B3图谱注入), elysiaclaw/src/memory/(图遍历基础) |
| PLAN-10 | 暂无派生执行条目（审计结论输出为 PLAN-10.spec AC-1~AC-4） | PLAN-10.spec:AC-1~AC-4 | elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts（AC-1:1911 / AC-2:2617-2634）, elysiaclaw/src/session-rotation/conversation-store.ts（AC-3:250-260 / AC-2:438）, elysiaclaw/src/session-rotation/dual-track-index.ts（AC-3:82-115）, elysiaclaw/src/session-rotation/handoff-types.ts（AC-3:105/146-156） |

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


## 4. 完整性与新鲜度 (Integrity & Freshness)
> RECONCILE 每次运行后更新本节。agent 读到陈旧/悬空标记时 MUST 对相关内容降权。

| 字段 | 值 |
|------|-----|
| 全局 revision | 11 |
| 上次 RECONCILE | 2026-06-09（PLAN-09 P0/P1 部署至生产：deploy.sh 执行，5 guards 全部通过，验证 index_nodes 11 refs / B3 appendParts 10 refs / rotation 清零；PLAN-10 升 active，登记 SPRINT TASK-06；ENGINE_MAP §2/§4 更新） |
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
| 每次 RECONCILE | 校验 §1 / §2 / §3 vs 现实，更新 §4，重生成 §3.2 |

[新触发条件追加到表格末尾。]

**强制规则 (MUST / NEVER)：**
- MUST NOT copy any other file's body content into this file —— relationships and metadata only.
- MUST read this file's current on‑disk version BEFORE writing back to any engine file（re‑anchor，对抗多步 agent 的上下文压缩）。
- MUST read this file FIRST at the start of every session.
- The §3.2 reverse index is generated by RECONCILE; NEVER maintain it by hand.
- When deleting an engine file or plan, MUST purge every reference to it in §3.
- MUST bump 全局 revision (§4) on every structural change to the registry or linkage graph.
- ENGINE_MAP itself is `index` class —— ALWAYS persisted and read, under every profile.
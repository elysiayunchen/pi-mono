# ElysiaClaw — 持久对话 × 工作记忆轮换与跨会话任务延续

> ⚠️ **本文已被上位总架构统摄** → 先读 [`PARTICIPANT-CONTINUITY-ARCHITECTURE.md`](./PARTICIPANT-CONTINUITY-ARCHITECTURE.md)。本文是其 **L2 工作记忆轮换机制** 的细节稿。
> ⚠️ **状态校正(2026-06-07 实测)**:下文多处 "✅ IMPLEMENTED" 的真实语义是"代码+测试存在",**非生产运行**。真实基线见上位文档 §七(AS1-AS7):`executeRotation` 是死代码、自动轮换只是提示文字、CONSOLIDATE 未接、未部署、无 conversation 表。**信 ✅ 前先 grep 生产调用者**。

> 起草:2026-06-06 · 状态:**阶段 1-4 代码+测试存在,生产未接线/未部署(见上位文档 §七)** · 维护者:aoseluo(云尘 / 奈緒)
> 范围:用户无感的持久对话 + 模型自主 session 轮换(刷新工作记忆窗口)+ 跨会话任务延续机制
> 定位:`CONTEXT-INJECTION-ARCHITECTURE.md`(静态分层)的动态化;`SUPERADMIN-AGENT-DESIGN.md`(记忆/CONSOLIDATE)的延续承载
> 标注:**KNOWN**=代码证据;**INFERRED**=原理推断;**PROPOSAL**=设计建议

---

## 〇、一句话主张(Bottom line)

把"会话"从**用户可见的对话单元**解耦为**模型的工作记忆周期单元**:用户在单个对话框里持久对话(无感),模型在后台按语义边界自主轮换 session——每次轮换 = 工作记忆窗口刷新为"干净窗口 + 精炼交接包",对话噪音抛给记忆引擎索引。**但延续必须双轨**:精确执行状态走结构化**交接包(Handoff)**,背景知识走**语义召回(RECALL)**。纯靠记忆检索延续任务会准确性塌陷——这是本设计的红线。

---

## 一、第一性归约:工作记忆 vs 长期记忆

| | 工作记忆 | 长期记忆 |
|---|---|---|
| 载体 | 当前 session 的 context window | `src/memory` 语义引擎(sessions+memory source) |
| 容量 | 有限(窗口满则性能塌陷:lost-in-the-middle 加剧、信噪比下降) | 近乎无限 |
| 访问 | 直接在场(注入 B0-B4 + messages) | 检索式(memory_search,模糊语义) |
| 生命周期 | **应周期性刷新**(轮换) | 持久累积 |

"自主切换 session" = **工作记忆窗口轮换(rotation)**。类比人类"翻篇/重新聚焦":丢弃当前窗口的执行噪音,只携必要状态进入新窗口。这比无限增长的单 session 更接近高效认知。

---

## 二、关键批判:为什么不能只靠记忆检索延续(设计红线)

`memory_search` 是**模糊语义召回**,设计用途是"我们之前讨论过 X"这类背景知识。它**不保证**:
- 精确的当前任务状态(做到第几步、下一步是什么);
- 未决决策、未提交变更、待办队列(todo);
- 局部变量/中间产物(文件路径、PID、临时结论)。

若多步任务轮换后仅靠召回恢复,新 session 会**丢精度** → 重复劳动、误判进度、命令出错。**结论:轮换必须携带结构化交接包(精确轨),记忆检索只做背景补充(模糊轨)。**

> 这与 `CONTEXT-INJECTION-ARCHITECTURE.md` 一脉相承:交接包 = B3 WORKING SET 的**跨 session 持久化形式**;RECALL = B4。轮换不是"清空重来",是"换窗口、带状态、补背景"。

---

## 三、三层架构(PROPOSAL)

```
Conversation(逻辑对话,持久,绑 chat_id)        ← 用户视角:一个对话框,永不切换
   │  1 : N
   ├── Session #1  [active→archived]  工作记忆窗口(可轮换)
   ├── Session #2  [active→archived]
   └── Session #N  [active]            ← 当前在场工作记忆
        ▲ 轮换时:archive 旧 → spawn 新 → 注入 Handoff(B3) + RECALL(B4)
   归档 session → memory 引擎索引(source:sessions,已有)→ 日后可召回
```

| 层 | 职责 | 现状 |
|---|---|---|
| **Conversation** | 稳定逻辑对话 ID,绑 chat_id;聚合其下所有 session;用户唯一感知单元 | **新建**(当前 chat 直接绑单 session) |
| **Session(工作记忆窗口)** | 一段连续 context window;可 active/archived;轮换的最小单元 | **复用** `SessionEntry` + session-key 路由(`session-id-resolution.ts`,按 updatedAt 取最新) |
| **Handoff Packet** | 轮换时的结构化任务状态交接 | **新建** |

**chat_id 映射改造(KNOWN→PROPOSAL)**:当前 `session-id-resolution.ts` 把 chat 解析到一个 SessionEntry(取最新)。改造:chat_id → Conversation → 其当前 active session。轮换只换 Conversation 内的 active 指针,chat 绑定不变 → 用户无感。

---

## 四、Handoff Packet 设计(精确轨核心)

轮换时由旧 session 生成、新 session 注入到 B3。结构化、强类型、可校验:

```ts
// src/session-rotation/handoff-types.ts
interface HandoffPacket {
  conversationId: string;
  fromSessionId: string;
  rotatedAt: number;
  reason: "token_pressure" | "task_boundary" | "topic_shift" | "manual";

  // —— 精确任务状态(memory_search 给不了的) ——
  activeTask?: {
    goal: string;                         // 当前任务目标(一句话)
    progress: string;                     // 做到哪(自然语言 + 关键里程碑)
    todos: Array<{ text: string; done: boolean }>;  // 待办队列(s03 Todo 快照)
    nextStep?: string;                    // 下一步明确动作
    blockers?: string[];                  // 阻塞项
  };
  decisions: string[];                    // 已做的关键决策(避免反复重议)
  artifacts: Array<{ kind: string; ref: string }>;  // 中间产物:文件路径/PID/URL/分支
  openLoops: string[];                    // 未闭合事项(等回调、等用户确认)
  userPrefsThisConversation?: string[];   // 本对话内用户表达的偏好

  // —— 指向长期记忆,不内联大块 ——
  recallHints: string[];                  // 轮换主题关键词,供新 session 主动 RECALL
}
```

**生成方式**:**实时打包(streaming capture)**——从用户指令落地起增量捕获为任务段(Task Segment),完成信号封口即成 Handoff,轮换时**零额外提炼成本**(详见 §四·B)。降级(无模型):存原始 todo + 索引头 + 最近 N 条 message 摘要。
**注入方式**:新 session 启动时 Handoff 进 **B3 WORKING SET**,`recallHints` 驱动首轮 **B4 RECALL** 预召回 → 精确轨 + 模糊轨同时到位。
**约束**:Handoff 是**指针不是副本**——大块历史留在归档 session(memory 索引),Handoff 只存"精确状态 + 召回钩子",控制注入预算。

---

## 四·B、任务段实时打包 + 任务内三级压缩(PROPOSAL)

> 本节是 §四 Handoff 的**生成机制升级**与 MESSAGES 区的内部分层。核心:不在轮换时才提炼,而是**从用户指令落地那一刻起实时打包**;任务段内部按"消费即降权"做三级压缩,工具噪声绝不沉淀进工作记忆。

### 4B.1 任务段(Task Segment)= 交接轨基本单元

**边界**:`用户指令 → 模型完成信号`,这一整块是一个 Task Segment。打包是 streaming capture(实时),不是事后提炼。结构分两部分——轻量**索引头**(常驻)+ 可压缩**任务体**:

```ts
// src/session-rotation/handoff-types.ts — IMPLEMENTED
type TaskPhase = "plan" | "todo" | "review" | "recall";

interface CompressedPhaseResult {
  phase: TaskPhase;
  compressedAt: number;
  summary: string;
  artifactRefs: string[];
}

interface TaskSegment {
  // —— 索引头(Index Header):轻量、常驻工作记忆、可快速扫 ——
  taskId: string;
  type: TaskType;        // 分类:deploy|diagnose|query|code|config|review|search|other
  status: "running" | "completed" | "incomplete" | "aborted";
  phase: TaskPhase;      // plan→todo→review→recall 四阶段推进
  goal: string;          // 用户意图一句话
  outcome?: string;      // 完成了什么 / 卡在哪(完成信号时写)
  startedAt: number; endedAt?: number;

  // —— 任务体(Body):重、可压缩、可驱逐到归档/记忆 ——
  body: {
    userInstruction: string;
    reasoning?: string;
    plan?: string;           // plan 阶段的执行计划
    todos: Array<{ text: string; done: boolean }>;  // todo 队列
    toolCalls: ToolCallRecord[];   // 见 4B.3,执行后即压缩
    finalReply?: string;
  };

  // —— 压缩结果:已完成阶段的精炼摘要,替代冗余原始数据 ——
  compressedResults: CompressedPhaseResult[];
}
```

索引头 = "附加索引,让模型粗略知道完成了/没完成什么、什么类型"的载体。它廉价常驻,任务体可随时压缩驱逐——**这是无缝接轨的关键:轮换/召回只需扫索引头即可定位,要细节再展开任务体或 RECALL**。

### 4B.2 实时打包(Streaming Capture) — IMPLEMENTED

- 用户指令落地 → 开 segment(status=running, phase=**plan**,写 goal/type);
- 模型首次调用工具 → advancePhase(**plan→todo**),进入执行阶段;
- 执行中增量写 body(toolCalls / todos / reply);
- 运行结束 → advancePhase(**todo→review**),compressCompletedPhase 压缩 todo 阶段;
- 任务成功 → advancePhase(**review→recall**),封口(写 status + outcome);
- 模型发**完成信号**(显式标记 or turn 收尾)→ sealSegment,segment 即成天然 Handoff 来源;
- **兜底封口**:超时(10min) / topic_shift / token 压力 → 强制封口为 incomplete,防永不闭合;
- **自动封印旧段**:新 segment 启动时,若旧段仍 running → 自动封印为 incomplete + 写入 outcome。

**plan-todo-review-recall 四阶段逻辑**:
- **plan**: 任务规划阶段,模型理解意图、制定计划;
- **todo**: 执行阶段,工具调用实时记录,已完成 todo 压缩为结果;
- **review**: 审查阶段,决定 plan 是否需要调整或 end;
- **recall**: 回顾阶段,输出任务执行结果,压缩全部分段摘要。

→ Handoff Packet(§四)= 已封口 segment 的**索引头集合** + 当前 running segment 的**精确状态**。轮换时零额外提炼成本,因打包已实时完成。

### 4B.3 任务内三级压缩(分形:消费即降权)

"轨道内部分层,工具噪声执行完即压缩,绝不污染上下文":三级颗粒度递增、频率递减。

| 级 | 颗粒度 | 触发 | 动作 | 频率 |
|---|---|---|---|---|
| **L1 工具结果驱逐** | 单个 tool_result | 结果被消费(下一 assistant turn 产生) | 原始输出 → 一行摘要 + artifactRef(落盘/offset),驱逐原文 | 最高 |
| **L2 任务段归档** | 整个 segment | 完成信号封口 | 索引头常驻;任务体 → 归档 session + 回写 memory(CONSOLIDATE) | 中 |
| **L3 会话轮换** | 多个 segment | 安全点 + 触发条件(§五) | Handoff + archive,工作记忆刷新 | 低 |

**L1 是"绝不污染"的核心**:

```ts
interface ToolCallRecord {
  tool: string; argsDigest: string;
  status: "running" | "done";
  // running: 完整 output 在场(模型需看结果决策)
  // done 且已消费: output 驱逐,只留 ↓
  resultSummary?: string;     // 一行结论
  artifactRef?: string;       // 完整输出落盘路径 / session offset,可精确回查
}
```

判定"已消费"启发式:产生下一个 assistant turn 即视为上一批 tool_result 已消费 → 驱逐。需要回看 → 经 `artifactRef` 精确召回(复用 Tool-Log Interceptor,`SUPERADMIN` 待深挖 #7)。**驱逐 = 移出工作记忆窗口,非删除**——这是不可逆驱逐与回看需求的平衡点。

### 4B.4 三级与现有压缩/注入的归并

- **L1** 接 `compaction.tool-result-details`(已有 tool result 压缩基础,KNOWN)→ 下沉到 turn 边界**即时执行**,不等全局压缩;
- **L2/L3** 接 §六(轮换 vs 压缩)+ CONSOLIDATE;
- 索引头进 `CONTEXT-INJECTION-ARCHITECTURE.md` 的 **B3 WORKING SET**(常驻);驱逐的任务体进归档,靠 **B4 RECALL** 按需召回;
- 三级共享同一 token 预算器,统一调度。

---

## 五、轮换触发与安全点(PROPOSAL)

### 5.1 触发条件(语义优先于容量)

| 触发 | 判据 | 说明 |
|---|---|---|
| `task_boundary` | 一个任务声明完成 / todo 清空 | **最优**:语义干净边界,交接成本最低 |
| `topic_shift` | 用户切换到无关主题 | 旧窗口噪音对新主题是负担 |
| `token_pressure` | 注入+历史接近窗口阈值(与压缩阈值统一,见 §六) | 容量兜底 |
| `manual` | 模型主动判断"该翻篇了" / 用户指令 | owner 自主 |

### 5.2 安全点(轮换不可在任意时刻发生)

轮换 = 工作记忆重置,**必须在安全点执行**,否则切断进行中的状态:
- ✅ 无未决工具调用(没有 pending tool_call / 后台 lane 未回);
- ✅ 当前 turn 已出完整回复;
- ✅ todo 处于可序列化状态;
- ❌ 多步操作中途(如 deploy 跑到一半)绝不轮换。

不满足 → 推迟轮换到下个安全点。

---

## 六、轮换 vs 压缩:区分与协同(关键)

| | s06 压缩(已有) | session 轮换(新) |
|---|---|---|
| 边界 | **同 session 内** | **跨 session** |
| 手段 | 旧消息揉成摘要塞回同窗口 | 开干净新窗口,只放 Handoff |
| 后果 | 摘要噪音累积、窗口仍在长 | 工作记忆真正刷新、噪音清零 |
| 延续 | 连续 message 流 | Handoff(精确)+ RECALL(模糊) |

**协同**:轮换是比压缩更彻底的"硬翻篇"。策略——**先压缩兜底,达到更高阈值或命中语义边界时轮换**。两者共享同一 token 预算器(`CONTEXT-INJECTION-ARCHITECTURE.md` §3.3),避免重复触发。轮换发生时是天然的 **CONSOLIDATE 时机**(`SUPERADMIN §四`):归档 session 回写记忆 + 抽取 episode。

---

## 七、跨 session 任务延续状态机(PROPOSAL)

```
任务诞生(用户请求)
   │
   ▼
[ACTIVE] ──工作记忆窗口内推进(todo/工具/决策)
   │  到安全点 + 触发条件
   ▼
[ROTATING] ──生成 Handoff ──archive 旧 session ──回写 memory(CONSOLIDATE)
   │
   ▼
[RESUMED] ──新 session 注入 Handoff(B3)+ recallHints 预召回(B4)
   │  校验:Handoff 完整性断言(goal/nextStep 非空)
   ▼
[ACTIVE]（新窗口继续，对用户无缝）
   │  任务完成
   ▼
[DONE] ──最终 CONSOLIDATE：任务结果 + 经验 → memory / 可固化 skill
```

- 状态用 TS union + exhaustive switch(与 SUPERADMIN 状态机同构,可合并)。
- `[RESUMED]` 的**完整性断言**是精度保险:Handoff 缺 nextStep/goal → 不轮换或回退,防止"翻篇即失忆"。

---

## 八、与现有基础设施 / 三份设计的关系

| 件 | 关系 |
|---|---|
| `SessionEntry` + `session-id-resolution.ts`(KNOWN) | **复用**为 Session 层;新增 Conversation→active session 间接层 |
| session resume 机制(cli-runner / sessions-spawn-tool,KNOWN) | **复用**为轮换的 spawn-new-session 路径 |
| s03 Plan/Todo | **快照来源**:Handoff.activeTask.todos |
| `CONTEXT-INJECTION-ARCHITECTURE.md` | Handoff=B3 跨 session 持久化;recallHints→B4;轮换是 B3 的生命周期事件 |
| `SUPERADMIN-AGENT-DESIGN.md` | 轮换=CONSOLIDATE 触发点;归档回写 = episodic 沉淀;状态机可合并 6 态 |
| `TELEGRAM-UX-CONTEXT-PLAN.md` WS-3 | 压缩感知 RECALL ↔ 轮换后 recallHints 预召回,同一闭环 |
| `src/memory` source:sessions(KNOWN,已索引) | 归档 session 自动可被召回,延续的存储底座已就绪 |

**三份设计的分工(顶层视图)**:
- **CONTEXT-INJECTION** = 一轮内"怎么排"(静态分层 + cache)
- **SESSION-ROTATION**(本文)= 跨轮/跨 session"怎么延续"(动态轮换 + 双轨交接)
- **SUPERADMIN/记忆引擎** = 延续靠什么"存与取"(语义引擎 + World Model + CONSOLIDATE)

---

## 九、落地坐标

| 文件 | 改动 | 状态 |
|---|---|---|
| `src/session-rotation/handoff-types.ts` | HandoffPacket + TaskSegment(含 TaskPhase/CompressedPhaseResult) + 完整性断言 + formatHandoffForInjection | ✅ IMPLEMENTED |
| `src/session-rotation/rotation-controller.ts` | 触发判断 + 安全点检测 + archive/spawn/inject 编排 + **CompactionSummary 生成** | ✅ IMPLEMENTED |
| `src/session-rotation/conversation-store.ts` | Conversation↔session 映射持久化(node:sqlite) + **双轨索引存储**(macroIndex/microIndex) + appendMacroIndexEntry | ✅ IMPLEMENTED |
| `src/session-rotation/conversation-types.ts` | ConversationEntry / ConversationStoreData | ✅ IMPLEMENTED |
| `src/session-rotation/task-segment-tracker.ts` | 任务段实时追踪 + **plan-todo-review-recall 四阶段** + compressCompletedPhase + classifyTaskType + 超时封口 | ✅ IMPLEMENTED |
| `src/session-rotation/conversation-router.ts` | chat→Conversation→activeSession 间接映射 | ✅ IMPLEMENTED |
| `src/session-rotation/handoff-inject.ts` | B3 Handoff 注入 + **双路径查找**(chatId + activeSessionKey) + consumeHandoff + **buildAndStoreDualTrackIndex** | ✅ IMPLEMENTED |
| `src/session-rotation/auto-trigger.ts` | checkAutoRotation / estimateSessionTokens | ✅ IMPLEMENTED |
| `src/session-rotation/dual-track-index.ts` | **双轨索引构建**:MacroIndex(压缩会话摘要) + MicroIndex(任务段摘要) + formatDualTrackIndexForInjection | ✅ IMPLEMENTED |
| `src/session-rotation/index.ts` | 模块导出(含 TaskPhase/CompressedPhaseResult) | ✅ IMPLEMENTED |
| `src/agents/tools/rotate-session-tool.ts` | rotate_session 工具(ownerOnly, completeness 门控) | ✅ IMPLEMENTED |
| `src/agents/pi-embedded-runner/run/attempt.ts` | B3 Handoff 注入 + 自动轮换检测 + **TaskSegmentTracker 集成** + **双轨索引构建** | ✅ IMPLEMENTED |
| `src/agents/elysiaclaw-tools.ts` | rotate_session 四层注册 | ✅ IMPLEMENTED |
| `src/agents/tool-catalog.ts` | rotate_session 工具目录 | ✅ IMPLEMENTED |
| `src/sessions/session-id-resolution.ts` | chat→Conversation→active session 间接层 | 待接入 |
| `src/agents/pi-embedded-runner/compact.ts` | 压缩阈值与轮换阈值统一;轮换触发 CONSOLIDATE | 待接入 |
| `src/config/*`(Zod) | `sessionRotation.{enabled,triggers,maxWindowTokens}` | 待接入 |

---

## 十、风险与盲点

- **Handoff 遗漏 = 任务断裂**(头号风险):交接包完整性是成败关键 → `[RESUMED]` 完整性断言 + 关键字段非空 + 失败回退不轮换。
- **轮换时机错误**:在多步操作中途切 = 灾难 → §5.2 安全点硬约束,中途绝不轮换。
- **用户追问刚归档细节**:已轮换但用户问"刚才那个" → 必须能 RECALL 回刚归档 session(压缩感知回补,WS-3 §3);Handoff 保留 fromSessionId 供精确回查。
- **轮换过频**:交接开销 > 收益 → 语义边界优先 + 最小窗口存活时长 + 冷却期。
- **记忆回音壁**:错误状态经 Handoff 反复传递 → Handoff 走 CONSOLIDATE 校验 + 可纠错 + 不给 high confidence(同 SUPERADMIN §九)。
- **依赖可用模型提炼 Handoff**:模型不可用 → 降级存原始 todo + 最近消息摘要,恢复后补提炼。
- **用户无感的代价**:debug 时需要可见性 → 提供 `/sessions` 类命令暴露 Conversation 下的 session 链,运维可查。
- **多任务并发于一对话**:一个 Conversation 同时跑多任务 → Handoff.activeTask 单数不够 → 初期限定单活跃任务,并发留待后续(对齐 lanes/子代理)。

---

## 十一、实施路线(分阶段)

```
前置:CONTEXT-INJECTION B3/B4 注入预算器就位(否则 Handoff 无处可注) ✅
阶段 1  Conversation 层 + chat 映射间接化(用户无感的地基,不改行为) ✅
阶段 2  Handoff 生成/注入(手动触发 rotate_session 工具,验证延续精度) ✅
阶段 3  自动轮换:安全点检测 + task_boundary/token_pressure 触发 ✅
阶段 4  Task Segment 追踪集成 + 双轨索引 + CompactionSummary 生成 ✅ (2026-06-07)
阶段 5  端到端验证(需可用模型) + 与压缩/CONSOLIDATE 统一 待续
```

**阶段 4 完成详情 (2026-06-07)**:

| 功能 | 实现 | 测试 |
|------|------|------|
| TaskPhase 四阶段(plan→todo→review→recall) | handoff-types.ts + task-segment-tracker.ts | 43 tests |
| CompressedPhaseResult 分段压缩 | compressCompletedPhase + buildPhaseCompressSummary | 43 tests |
| MicroIndex 增强(phase + compressedPhaseSummaries) | dual-track-index.ts buildMicroIndexFromSegments | 10 tests |
| MacroIndex CompactionSummary 生成 | rotation-controller.ts buildCompactionSummaryFromHandoff | 23 tests |
| ConversationStore appendMacroIndexEntry | conversation-store.ts 增量追加 | 19 tests |
| attempt.ts 主循环集成 | TaskSegmentTracker 初始化 + 工具调用事件 + 封口 + 双轨索引 | tsc 零错误 |
| 双轨索引数据流闭环 | MicroIndex(任务段) + MacroIndex(会话压缩) → ConversationStore → 新会话注入 | 123 tests total |

**验证基准(精度优先)**:阶段 2 用一个真实多步任务,轮换前后对比"新 session 是否准确知道 goal/progress/nextStep"——这是整个系统价值的试金石,不通过则不推进自动轮换。

---

*相关文档:`CONTEXT-INJECTION-ARCHITECTURE.md`(分层注入/B3/B4)· `SUPERADMIN-AGENT-DESIGN.md`(记忆/CONSOLIDATE/状态机)· `TELEGRAM-UX-CONTEXT-PLAN.md`(WS-3 压缩×记忆)· `MEMORY-ACTIVATION-RUNBOOK.md`(记忆引擎已激活)· `ARCHITECTURE.md`*
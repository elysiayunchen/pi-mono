# ElysiaClaw — 参与者持续性架构(Participant Continuity Architecture)

> 起草:2026-06-07 · 状态:**设计宗旨已锁定,实现 W0-W5 待落地** · 维护者:aoseluo(云尘 / 奈緒)
> 定位:本文是上位**总架构**,统摄并**升级** `SESSION-ROTATION-CONTINUITY.md`(后者降级为本文 **L2** 的工作记忆轮换机制)与 `CONTEXT-INJECTION-ARCHITECTURE.md`(本文 **L2 注入** 的静态分层依据)。
> 标注约定:**KNOWN**=有代码证据;**INFERRED**=原理推断/数量级;**PROPOSAL**=设计建议,待实现;**DECISION**=已与 owner 拍板,不得擅自推翻。
>
> **接手 AI 必读**:本文第 **二章(决策记录)** 和 **十一章(DO-NOT-DRIFT)** 是防跑偏核心。任何实现前先读这两章;若你的方案与 DECISION 冲突,停手并向 owner 复核,不要自行"优化"掉一个已拍板的决策。

---

## 〇、一句话主张(Bottom line)

对模型而言,**"会话 / 窗口"不存在**。唯一存在的单元是**参与者(Participant)**——一个人、或一个 agent,各自有规范身份。模型永远在与某个 Participant 进行**一条永不中断的对话**。这条对话之下:

- **工作空间(workspace)** 只在场"正在进行的那一个 task"的完整内容,**不断被替换**(原"session 轮换",对模型透明);
- **认知图谱(cognitive graph)** 是只增不减的**索引累积层**,task/session 封口后降为图节点,节点间有边,构成可遍历的认知网络;
- 模型靠"need → 图遍历 → 索引头注入 → 完整内容按需回查"完成跨时间的认知持续。

红线:**纯靠模糊语义检索延续任务会精度塌陷**(见 `SESSION-ROTATION-CONTINUITY.md §二`)。所以索引必须**双形态**:精确状态走结构化 Handoff(精确轨),背景关联走认知图谱 + 语义召回(模糊轨)。

---

## 一、设计宗旨(第一性归约)

### 1.1 "窗口"是漏抽象,Participant 才是真单元

工作记忆窗口(context window)是**实现细节**,不该泄漏到模型的世界观里。把它暴露给模型 → 模型要操心"我在哪个 session / 要不要轮换",这是认知负担,也是 bug 源。正确做法:**窗口对模型隐形**,模型只知道"我在和谁说话"。

继承链上,`SESSION-ROTATION` 已把会话从"用户可见单元"解耦为"工作记忆周期单元",但它仍把 Conversation 绑 `chat_id`。本文再进一步:**Conversation 绑 `participant_id`**。理由——同一个人在私聊、群聊、不同渠道(Telegram/Discord/...)说话,应该是**同一条认知线**;一个 agent 的信息流,也应被当作**另一个 Participant** 统一接入。绑 chat_id 做不到跨渠道统一,绑 participant_id 可以。

### 1.2 两条正交的轴

| 轴 | 含义 | 载体 | 行为 |
|---|---|---|---|
| **纵轴(降权)** | 完整内容 ↔ 索引头 | TaskSegment(索引头常驻 + 任务体可驱逐) | 消费即降权 |
| **横轴(连接)** | 索引 ↔ 索引 | 认知图谱(节点 + 边) | 只增,构成网络 |

`SESSION-ROTATION` 已实现纵轴雏形(`task-segment-tracker.ts`)。**横轴是本文净新增,当前零实现**——现有 macro/micro 索引是两个**扁平数组**,节点之间没有任何边。横轴是"第一时间识别用户需求并提取对应记忆"的前提。

### 1.3 不变式(Invariants,违反即跑偏)

1. **I1 — 工作空间单任务**:工作空间任一时刻只持有 active task 的完整内容;其余一切以索引形态存在,按需才回填完整内容。
2. **I2 — 索引只增**:认知图谱节点/硬边只追加,不被工作空间替换清空。清空的只是 workspace 里的完整内容副本(留存于归档,经索引可回查)。
3. **I3 — 窗口对模型透明**:模型 prompt / 工具语义里不出现"session/window/rotate 你自己决定"这类概念暴露(rotate_session 工具是 owner 调试入口,不是模型的常规心智模型)。
4. **I4 — 双形态延续**:轮换/重置必带精确轨(Handoff),模糊轨(图 + 语义)只做背景补充,绝不单独承载精确任务状态。
5. **I5 — Participant 为连续性主键**:跨私聊/群/渠道,同一 Participant 是同一条认知线。

---

## 二、决策记录(Decision Log)— 防跑偏核心,逐条已拍板

> 每条都是 owner 拍板的 **DECISION**。括号内是**被否决的替代方案 + 否决理由**,写在这里是为了让接手 AI **不要重新议** 一个已经议完的问题。

| # | 决策 | 否决的替代方案 / 理由 |
|---|---|---|
| **D1** | **连续性主键 = participant_id**,跨私聊/群/渠道统一 | 否决"绑 chat_id":做不到跨渠道统一,与宗旨相悖 |
| **D2** | **群聊 Participant + Locus 双绑双写**:A 在群里的发言**同时**写入 A 的个人连续线 + 群共享线 | 否决"纯 Participant":群多方共享上下文被切碎,B 回应 A 的话落在不同线。否决"纯 Locus":同一人跨私群不统一,违反 D1 |
| **D3** | **认知图谱节点三粒度**:`task`(任务段)/ `session`(会话摘要)/ `topic`(跨会话主题)。**一期只做 task+session 两层,topic 留二期** | 否决"三层一次到位":topic 聚类需另起聚类算法/模型,首版风险大。先闭环再加概念层 |
| **D4** | **图谱边 = 混合**:硬边(temporal/structural)**持久化**在 conversation-store edge 表;软边(semantic)由 `src/memory` 向量近邻**查询时动态生成,不持久化** | 否决"全语义":丢失"task A 接着 task B 做"这类精确因果。否决"全显式":边爆炸 N²、与向量引擎能力重复 |
| **D5** | **agent 即 Participant**,信息流走同一条 channel→身份解析→Conversation 管道,但 **trust tier 独立,不继承 owner**(`ownerOnly` 工具对 agent 不放行) | 否决"agent 等同用户":会让 agent 拿到 owner 权限,是 prompt-injection 攻击面(金律 3/9) |
| **D6** | **agent↔agent 协作不可自主发起**,必须**先向用户确认**;经确认后协作进行,**镜像到发起者的连续线**,用户**可实时打断** | 否决"agent 自主双向回环":A→B→A→B 无限烧 token;以"发起需确认"从根上消除回环 |
| **D7** | **Mirror Lane 统一原语**:协作透明同步、安全审计汇报,是同一个"镜像可观测流"机制的两种 scope;镜像内容**旁路,不进工作空间**(守 I1) | 否决"两个 bespoke 功能":重复造轮、维护两套。复用 `lanes.ts`(s08)+ abort 基础设施 |
| **D8** | **核心管理员(core admin)= 唯一系统级安全主体**(≠ 普通 Participant);**任何来源 inbound 都对 admin 不盲** | —(安全边界,非可选) |
| **D9** | **汇报颗粒度 = 首达 + 行动 + 摘要**:新参与者/新信息源**首次接触必报**;agent **据信息采取行动前必报**;其余走 digest 周期汇总,admin 可对任一源**展开 verbatim** | 否决"全量逐条":淹没 admin。否决"纯摘要":漏掉首达/行动这两个安全关键点 |
| **D10** | 同步目标解析 = **自动优先 + 手动兜底**:优先自动探测群里的 agent 参与者作为同步 locus,歧义/失败时由用户指定 | —(owner 明确表述"最好能检测...或者直接由用户指定") |

---

## 三、全栈分层架构 L0-L4

```
L0 身份解析 (Identity Resolution)
   (channel, chat_id, sender) ──► participant_id  (human | agent)
   群聊额外解析 locus_id
   现状: MsgContext 已带 SenderId/SenderName/SenderUsername/SenderE164/ChatType (KNOWN)
        sender-identity.ts 只校验不规范化 (KNOWN) → 需新增 canonicalize → participant_id

L1 持久会话 (Persistent Conversation, 双绑)
   participant_id ──► 个人连续线 (跨私聊/群/渠道统一)
   locus_id       ──► 群共享线 (多方连贯)
   群消息同时写两条线 (D2)
   现状: conversation-store 绑 chatId (KNOWN) → 需改绑 participant_id + 增 locus 线

L2 认知层 (Cognition)
   累积层: 认知图谱  task/session 节点 + 硬边持久 / 软边语义  (只增, I2)
   工作空间: 仅 active task 完整体  (替换, 对模型透明, I1/I3)
   延续: Handoff(精确轨, 已实现) + 图遍历&语义召回(模糊轨, 图为净新增)
   现状: 纵轴(task-segment + 双轨索引)已实现但未部署; 横轴(图的边)零实现

L3 协作 / 可观测 (Mirror Lane 原语, D7)
   agent↔agent 协作: 用户确认才发起(D6) ─► 镜像发起者线 ─► 可实时打断
   全量 inbound 审计: 镜像 core admin, scope=all, 颗粒度=首达+行动+摘要(D9)
   现状: 零实现; 复用 lanes.ts(s08) + abort

L4 安全边界 (Security Boundary)
   core admin = 唯一系统级安全主体 (D8)
   agent trust tier < owner, 不继承 ownerOnly (D5)
   agent 不能自主发起协作 (D6)
   mandatory report: 任何来源 inbound ──► core admin (D8/D9)
   现状: ownerOnly 检查在 tool-policy.ts/common.ts (KNOWN); 无 agent tier / 无 core admin / 无 report
```

### L0 身份解析 — 详

**职责**:把渠道原始标识 `(channel, chat_id, sender)` 规范化为稳定的 `participant_id`,并在群聊场景额外产出 `locus_id`。

**数据模型(PROPOSAL)**:
```ts
type ParticipantKind = "human" | "agent";
interface ParticipantIdentity {
  participantId: string;          // 规范主键, 跨渠道稳定
  kind: ParticipantKind;
  aliases: Array<{ channel: string; chatId?: string; senderId?: string;
                   username?: string; e164?: string }>;  // 渠道别名集合
  trustTier: "core_admin" | "owner" | "agent" | "guest";  // L4 信任档
}
interface LocusIdentity {
  locusId: string;                // 群/房间稳定主键
  channel: string;
  participants: string[];         // 已知在场 participantId
}
```

**接线点(KNOWN→PROPOSAL)**:
- 输入:`src/channels/*` 的 `MsgContext`(已带 `SenderId/SenderName/SenderUsername/SenderE164/ChatType`)。
- 现有 `src/channels/sender-identity.ts::validateSenderIdentity` 只做校验 → **新增** `resolveParticipantIdentity(ctx): ParticipantIdentity`(别名归并 + 信任档判定)。
- 别名归并策略:配置声明的 alias 表(`config` 显式)优先 + 同渠道 senderId 精确匹配;**不做**自动跨渠道猜测(避免错并身份,安全风险)。

### L1 持久会话 — 详

**职责**:`participant_id → 当前活跃工作空间`;群消息双写。

**接线点**:
- `src/session-rotation/conversation-store.ts`:现 `getOrCreateForChat(chatId, ...)` → 改为 `getOrCreateForParticipant(participantId, ...)`;新增 locus 线表。
- `src/session-rotation/conversation-router.ts::resolveSessionKeyViaConversation`:现按 chatId 查 → 改为先 L0 解析 participant_id 再路由。
- `src/sessions/session-id-resolution.ts`:现按 `updatedAt` 取最新 SessionEntry(KNOWN)→ 上方插入 participant→conversation 间接层。
- **双写**:群消息 → 个人线 append + 群共享线 append。两线各自维护工作空间与图;**精确轨(Handoff)只在个人线**(任务连续性归个人),群共享线主要承载多方上下文与 topic 边。

---

## 四、认知图谱详设(L2 横轴,净新增)

### 4.1 节点(IndexNode)

统一节点模型,三粒度(D3,一期 task+session):
```ts
type NodeGrain = "task" | "session" | "topic";
interface IndexNode {
  nodeId: string;
  grain: NodeGrain;
  conversationId: string;        // 归属连续线
  // 索引头(常驻可注入, 廉价)
  title: string;                 // 一句话(task=goal, session=摘要主题)
  kind?: string;                 // task: TaskType; session: reason
  status: string;
  summary: string;               // 精炼摘要(micro/macro 现有 summary)
  // 指向完整内容(I2: 完整内容留存归档, 节点只存指针)
  archiveRef: string;            // 归档 session offset / 文件 ref
  artifactRefs: string[];
  startedAt: number; endedAt: number;
}
```
- task 节点 ← `buildMicroIndexFromSegments`(KNOWN,已有,需补 nodeId/archiveRef)。
- session 节点 ← `buildMacroEntryFromHandoff` / `buildMacroIndexFromSummaries`(KNOWN,已有)。

### 4.2 边(Edge,D4 混合)

```ts
type EdgeType =
  | "temporal"      // 前驱后继: node A 时间上紧邻 node B          [硬,系统自动]
  | "continues"     // task A 是 task B 的延续                     [硬,模型封口标注/规则]
  | "produces"      // task ──► artifact                          [硬,系统自动从 artifactRefs]
  | "belongs"       // task/session ──► topic                     [硬,二期]
  | "semantic";     // 向量相似                                    [软,查询时 src/memory 动态生成,不存]

interface HardEdge { from: string; to: string; type: Exclude<EdgeType,"semantic">; weight?: number; createdAt: number; }
```
- **硬边持久化**:conversation-store 新增 `edges` 表(`from, to, type, weight, createdAt`)。
- **软边动态**:查询时调 `src/memory` 向量近邻取 top-k,临时构造,**绝不入库**(消除 Fork-B 双源漂移:硬结构归 conversation-store,模糊语义归 memory)。

### 4.3 检索闭环(need → memory)

```
用户输入
  │ ① 语义召回入口节点        (src/memory 向量, 软边)
  ▼
入口 IndexNode
  │ ② 沿硬边图遍历 N 跳扩展   (temporal/continues/produces, conversation-store)
  ▼
命中节点集合
  │ ③ 索引头(title+summary)注入工作空间(B3 区, 廉价)
  │ ④ 需细节 → 按 archiveRef/artifactRef 回查完整内容(re-hydrate)
  ▼
模型在 active task 工作空间内带着精确关联记忆继续
```
- N 跳上限、每跳分支上限、注入 token 预算 → 全部走统一注入预算器(见 §五·B)。

---

## 五、协作 + Mirror Lane 原语(L3)

### 5.1 Mirror Lane(D7,统一原语)

```ts
interface MirrorLane {
  laneId: string;
  scope: "collaboration" | "audit";
  mirrorTo: string;              // 目标连续线(协作: 发起者; 审计: core admin)
  source: { kind: "agent" | "user" | "channel"; id: string };
  interruptible: true;           // 复用现有 abort
}
```
- **不进工作空间**(守 I1):镜像内容是旁路可观测流,用户/admin 看得到、可打断,但不进 active task,除非用户显式介入把它转成任务输入。
- 复用 `src/agents/pi-embedded-runner/lanes.ts`(s08 背景任务)+ abort 信号。

### 5.2 agent↔agent 协作时序(D6)

```
agent A 想找 agent B 协作
   │  ✋ 不可自主发起
   ▼
向 user 发起确认请求 ──► user 批准? ──否──► 丢弃
   │ 是
   ▼
建立协作(A↔B), 同时开 MirrorLane(scope=collaboration, mirrorTo=发起者线)
   │  user 实时看到 A↔B 往来, 可随时 abort
   ▼
协作产出 ──► 作为 artifact 节点入双方图(produces 边), user 可介入采纳
```
- 同步 locus 解析:自动探测群内 agent 成员 → 该群为同步 locus;歧义/失败 → user 指定(D10)。

---

## 六、安全边界 + 核心管理员(L4)

- **core admin**(D8):配置声明唯一 `trustTier: "core_admin"` 的 participant。系统级安全主体,**独立于其普通连续线**,额外拥有一条 **audit MirrorLane(scope=audit, scope-target=all)**。
- **agent trust tier**(D5):`resolveParticipantIdentity` 判定 `kind=agent` → `trustTier="agent"`;`tool-policy.ts` / `common.ts` 的 `ownerOnly` 门控对 agent **不放行**;agent 不能触发破坏性/外发/配置类工具。
- **mandatory report**(D8/D9,颗粒度):
  - **首达必报**:某 participant_id / 信息源**首次**出现 → 即时推 admin(安全边界真正抓点)。
  - **行动前必报**:agent 据某 inbound **将采取行动**(调工具/外发)前 → 即时推 admin。
  - **其余 digest**:常规消息按周期汇总;admin 可对任一源命令 `展开 verbatim`。
- 防回环:report 流本身不构成新的 inbound(否则 report→inbound→report 自环);report 是单向旁路写入 admin 的 audit lane。

---

## 七、现状审查(AS-IS,诚实基线)

> 接手 AI 注意:`SESSION-ROTATION-CONTINUITY.md` 标了大量 "✅ IMPLEMENTED",**真实语义是"代码+测试存在",不是"在生产运行"**。以下为 2026-06-07 实测基线(对应 `PITFALLS.md #91-#94`)。

| # | 声明 | 实际 | 证据 |
|---|---|---|---|
| **AS1** | "阶段3 自动轮换 ✅" | **假自动**:`checkAutoRotation` 命中后只往 prompt 追加一句提示文字劝模型自己调工具,从不真轮换 | `attempt.ts:2789-2798` |
| **AS2** | `executeRotation` = 真实轮换路径 | **生产零调用 = 死代码**,只活在测试 | grep:仅 `index.ts` 再导出 + 注释引用 |
| **AS3** | "轮换=CONSOLIDATE 触发点,归档回写记忆" | **完全没接**:归档 session 不写 `src/memory`,模糊轨无生产者,recallHints 不触发任何 RECALL | 全仓无 archive→memory 调用 |
| **AS4** | "安全点硬约束,中途绝不轮换"(头号风险防线) | **断言而非检查**:auto 路径写死 `pendingToolCalls:0, hasActiveBackgroundLane:false`;`rotate_session` 工具一个安全点都不查 | `attempt.ts:2783-2784` |
| **AS5** | 统一注入预算器(防反身性空转) | `injection-budget.ts` **存在但未喂给轮换**:auto 路径 `injectionTokens = estimateTextTokens(systemPrompt)` 裸估算 | `attempt.ts:2767` |
| **AS6** | B4 RECALL 置 recency 最强位 | **方向反了**:dual-track/handoff/recall 全 prepend 到 prompt **开头**,离当前问题最远,违反自定 R5 | `attempt.ts:2624-2639` |
| **AS7** | 整套 "✅ IMPLEMENTED" | **未部署、从未端到端跑过**:全局 dist 无此模块;无 conversation 表 | 全局只有 `~/.pi/agent`;只有 `user-model.db` 无 conversation 表 |

**已修复(本轮)**:`rotate_session` 工具契约 + 封 macro(#93)、双轨覆盖 bug(#92)、`buildMacroEntryFromHandoff` 共享提取、`attempt.ts` 重复声明(#94)。**注意 AS1-AS7 中除 #92/#93/#94 外仍未闭环**。

---

## 八、落地坐标(file-by-file,AS-IS → TO-BE)

| 文件 | AS-IS | TO-BE |
|---|---|---|
| `src/channels/sender-identity.ts` | `validateSenderIdentity` 仅校验 | + `resolveParticipantIdentity(ctx) → ParticipantIdentity`(L0,别名归并 + 信任档) |
| `src/session-rotation/conversation-store.ts` | 绑 chatId;macro/micro 扁平存储 | 绑 participantId;+ locus 线;+ `edges` 表;+ IndexNode archiveRef |
| `src/session-rotation/conversation-router.ts` | 按 chatId 路由 | 先 L0 解析 participant 再路由;群双写 |
| `src/sessions/session-id-resolution.ts` | 按 updatedAt 取最新 SessionEntry | 上插 participant→conversation 间接层 |
| `src/session-rotation/dual-track-index.ts` | macro/micro 数组 + `buildMacroEntryFromHandoff`(已修) | + IndexNode 模型;+ 硬边产生(temporal/produces);+ 软边查询封装 |
| `src/session-rotation/rotation-controller.ts` | `executeRotation` 死代码(AS2) | **接线**(W2)或显式废弃;安全点真检查(AS4) |
| `src/agents/pi-embedded-runner/run/attempt.ts` | hint-only 自动轮换(AS1);注入顺序反(AS6);裸 injectionTokens(AS5) | 真实轮换接线;RECALL 下沉 recency;接 `injection-budget.ts` |
| `src/context-engine/injection-budget.ts` | 存在,未喂轮换/压缩(AS5) | 统一预算器:图注入/handoff/recall/压缩共享 |
| `src/memory`(source:sessions) | 已索引(KNOWN) | CONSOLIDATE 接线(AS3):归档回写 + 软边向量近邻 |
| `src/agents/pi-embedded-runner/lanes.ts`(s08) | 背景任务(KNOWN) | 复用为 Mirror Lane(L3) |
| `src/agents/tool-policy.ts` / `tools/common.ts` | `ownerOnly` 门控(KNOWN) | + agent trust tier(L4),agent 不继承 ownerOnly |
| `src/config/*`(Zod) | — | + `participant.aliases`、`coreAdmin`、`agentParticipants`、`reporting.granularity`、`sessionRotation.*` |

---

## 九、分期路线(Roadmap,W0-W5)

> 排序原则:**先让 L2 认知持续真正闭环(否则一切是空话),再做 L0/L1 身份升级,最后 L3/L4 协作与安全**。每期末必须**端到端实跑验证**,不接受"代码+测试存在"当完成(见 §十一)。

```
W0  闭环现有 session-rotation(把 AS1-AS7 的红线项做真) ──── 前置, 最高优先
    详见下方 §九·W0 详细任务

W1  认知图谱一期(L2 横轴): task+session 节点 + 硬边(temporal/continues/produces)
    + 软边语义封装 + 检索闭环(need→图遍历→注入→回查)。topic 留 W4。

W2  身份解析 L0 + 持久会话 L1: participant_id 主键 + 群 Participant/Locus 双写(D1/D2)

W3  Mirror Lane L3 + 安全边界 L4: agent=Participant(D5) + 协作用户门控(D6)
    + core admin + mandatory report 首达/行动/摘要(D8/D9) + agent trust tier

W4  认知图谱二期: topic 跨会话聚类层 + belongs 边(D3 二期)

W5  统一与打磨: 与 s06 压缩/CONSOLIDATE 完全统一预算; debug 可见性(/sessions /graph 命令)
```

### §九·W0 详细任务

> 2026-06-07 代码级审查产出。每条任务独立可验证，按依赖排序。
> 完成标准 = 生产路径实跑 + 端到端验证，不是单测绿(§十一 11.3)。

#### 依赖图

```
W0-T2 (RECALL 下沉) ─── 独立，可先做
W0-T1 (安全点真检查) ─── 独立，可先做
W0-T4 (executeRotation 决策) ─── 独立，需先决策
W0-T5 (注入预算器升级) ─── 独立，可先做
W0-T3 (CONSOLIDATE 接线) ─── 依赖 T1（安全点正确才能安全轮换）
W0-T6 (端到端验证) ─── 依赖 T1-T5 全部完成
```

---

#### W0-T1: 安全点运行时真检查

**修**: AS4（P2 核心）· **严重度**: 🔴 高 · **依赖**: 无

**问题**: `attempt.ts:2783-2784` `pendingToolCalls: 0, hasActiveBackgroundLane: false` 写死，安全检查形同虚设。`rotate_session` 工具侧同样零安全点检查。

**方案**:
1. `pendingToolCalls`: 从 `activeSession.agent` 的 pending tool calls 获取（需查 SDK 暴露的接口，如 `session.pendingToolCalls` 或从 `activeSession` 的 `toolResults` 状态推断）
2. `hasActiveBackgroundLane`: 从 `lanes.ts` 的背景任务状态获取（`backgroundLanes.size > 0` 或等价接口）
3. `sessionAgeMs`: 从 session 创建时间计算（已有 `promptStartedAt`，需找 session start time 或 `createdAt`）
4. `rotate_session` 工具侧：在 `execute()` 入口加安全点前置检查（至少检查 pending tool calls），拒绝不安全轮换

**改动文件**:
- `src/agents/pi-embedded-runner/run/attempt.ts` — `checkAutoRotation` 调用处，传入真实值替代写死 0/false
- `src/agents/tools/rotate-session-tool.ts` — `execute()` 入口加安全点检查

**验证标准**:
- [ ] `pendingToolCalls` 从运行时状态获取（非硬编码 0）
- [ ] `hasActiveBackgroundLane` 从运行时状态获取（非硬编码 false）
- [ ] `rotate_session` 工具在 pending tool calls > 0 时拒绝执行
- [ ] 测试：模拟 pending tool calls 场景下 auto-rotation 被安全点阻断
- [ ] `tsgo --noEmit` 0 错误 · 相关 vitest 全绿

---

#### W0-T2: RECALL 注入位置下沉

**修**: AS6（P5）· **严重度**: 🟡 中 · **依赖**: 无

**问题**: `attempt.ts:2624-2638` — B3 handoff + dual-track + B4 RECALL 全部 prepend 到 `effectivePrompt` 开头（离当前用户输入最远），违反 R5 recency 原则。模型最先看到的是索引头，最后才看到用户实际在问什么。

**方案**: 改为 **append** 到 `effectivePrompt` 末尾（当前用户消息之后）。注入顺序：

```
用户原始输入
---
B3 HANDOFF (精确任务状态)
B3 DUAL-TRACK INDEX
B4 RECALL (背景知识)
```

recency 最强的位置是 B4 RECALL 和当前任务状态，符合 R5。

**改动文件**:
- `src/agents/pi-embedded-runner/run/attempt.ts` — 将 `effectivePrompt = ${block}\n\n---\n\n${effectivePrompt}` 改为 `effectivePrompt = ${effectivePrompt}\n\n---\n\n${block}`

**验证标准**:
- [ ] B3/B4 块出现在用户消息之后（recency 最强位）
- [ ] 注入顺序：handoff → dual-track → recall
- [ ] 测试：验证注入顺序和位置
- [ ] `tsgo --noEmit` 0 错误 · 相关 vitest 全绿

---

#### W0-T3: CONSOLIDATE 回写接线

**修**: AS3（P3）· **严重度**: 🔴 高 · **依赖**: T1（安全点正确才能安全轮换）

**问题**: 归档 session 不回写 `src/memory`，模糊轨无生产者。`recallHints` 不触发任何 RECALL。全仓无 archive→memory 调用。

**方案**: 在 `rotate_session` 工具执行成功后，将归档 session 的关键内容回写到 `src/memory`：
1. 从 HandoffPacket 提取 `recallHints` + `activeTask.goal` + `decisions` 作为 memory chunk
2. 调用 `getMemorySearchManager` 的 `indexContent` 或等价方法写入 memory source
3. 这是 CONSOLIDATE 的最小闭环——先接通，后续再优化提炼质量
4. 回写失败不阻塞轮换（fire-and-forget + 日志），避免记忆故障影响核心链路

**改动文件**:
- `src/agents/tools/rotate-session-tool.ts` — 轮换成功后触发回写
- 可能需要 `src/memory/` 暴露一个 `indexSessionArchive` 便捷方法

**验证标准**:
- [ ] 轮换后 `memory_search` 能搜到归档 session 的关键内容
- [ ] 回写失败不阻塞轮换（fire-and-forget + 日志）
- [ ] 测试：模拟轮换 → memory_search 验证
- [ ] `tsgo --noEmit` 0 错误 · 相关 vitest 全绿

---

#### W0-T4: executeRotation 去留决策 + 死代码清理

**修**: AS1/AS2（P1）· **严重度**: 🔴 高 · **依赖**: 无（但需 owner 决策）

**问题**: `executeRotation` 有完整实现 + 23 测试，但零生产调用。当前手动轮换走 `rotate_session` 工具，自动轮换走"提示文字劝模型调工具"。

**决策点**: 两个方向——

**方向 A — 接线 executeRotation（系统自动轮换）**:
- 在 attempt.ts 的 auto-rotation 检测中，当 `shouldRotate=true` 且 `safety.safe=true` 时，直接调用 `executeRotation`
- 需实现 `RotationControllerDeps` 的运行时句柄（spawnNewSession/archiveSession/injectHandoff）
- 优点：轮换由系统执行，确定性高
- 缺点：架构改动大，需实现 spawnNewSession 等运行时句柄

**方向 B — 显式废弃 executeRotation，统一走工具路径（推荐 W0）**:
- 删除或标注 `executeRotation` 为 `@deprecated`
- 自动轮换保持"提示模型调工具"，但改善提示质量：
  - 注入精确 token 压力数据（当前/阈值/余量）
  - 从"Consider using rotate_session"改为更强的指令
  - 附带安全点状态（"当前无待处理工具调用，可安全轮换"）
- 优点：最小改动 + 保持模型控制权（守 I3 窗口对模型透明）
- 缺点：模型可能忽略提示

**推荐**: W0 先走方向 B（最小改动 + 守 I3），方向 A 留 W1+。

**改动文件**:
- `src/session-rotation/rotation-controller.ts` — 标注 `executeRotation` 为 `@deprecated` 或删除
- `src/agents/pi-embedded-runner/run/attempt.ts` — 改善 auto-rotation 提示文本（精确 token 数据 + 明确指令 + 安全点状态）

**验证标准**:
- [ ] 死代码消除（executeRotation 不再导出或标注废弃）
- [ ] 自动轮换提示包含精确 token 数据和明确指令
- [ ] 提示包含安全点状态信息
- [ ] `tsgo --noEmit` 0 错误 · 相关 vitest 全绿

---

#### W0-T5: 注入预算器升级

**修**: AS5（P4）· **严重度**: 🟡 中 · **依赖**: 无

**问题**: runtime 用固定基线 90k/80k 扣减（`sdk.ts:374`），1M 窗口下严重保守。`computeInjectionBudget`（比例算法）已在 `injection-budget.ts` 实现但未接入。SDK 用 `contextPressureBudget` 固定阈值，不随模型实际窗口缩放。

**方案**:
1. 在 `createAgentSession` 调用处传入 `contextWindowTokens` 参数（从模型配置获取）
2. 用 `computeInjectionBudget` 替代简单 `estimateTextTokens` 计算 `contextPressureBudget`
3. 在 SDK 层扩展 `contextPressureBudget` 为 `contextPressureBudget + contextWindowTokens`，让 SDK 用比例算法
4. 爆窗保护：阈值不超过模型实际窗口

**改动文件**:
- `src/context-engine/injection-budget.ts` — 无需改动（已实现）
- `src/agents/pi-embedded-runner/run/attempt.ts` — 调用 `computeInjectionBudget` 替代 `estimateTextTokens`
- `src/agents/pi-embedded-runner/compact.ts` — 同上
- `packages/coding-agent/src/core/sdk.ts` — 扩展参数接收 `contextWindowTokens`

**验证标准**:
- [ ] 1M 窗口下压缩阈值从 ~80k 提升到 ~750k+（比例算法）
- [ ] 注入量计入阈值，杜绝反身性空转
- [ ] 爆窗保护：阈值不超过模型实际窗口
- [ ] `tsgo --noEmit` 0 错误 · 相关 vitest 全绿

---

#### W0-T6: 端到端验证 + 部署

**修**: AS7（P6）· **严重度**: 🔴 高 · **依赖**: T1-T5 全部完成

**问题**: 整套 session-rotation 从未端到端跑过，`conversation-store.db` 不存在于生产。所有 "✅ IMPLEMENTED" 声明无真实运行佐证。

**方案**:
1. 部署后验证 `~/.elysiaclaw/conversation-store.db` 自动创建
2. 通过 Telegram 发送多轮对话，触发 TaskSegmentTracker
3. 手动调用 `rotate_session` 工具，验证 Handoff 注入
4. 验证双轨索引在新会话中可见
5. 验证 `memory_search` 能搜到归档内容（依赖 T3）
6. 多步任务轮换前后 goal/progress/nextStep 精度对比（AS7 试金石）

**验证标准**:
- [ ] `~/.elysiaclaw/conversation-store.db` 存在且有记录
- [ ] 轮换后新会话能看到 Handoff block
- [ ] 双轨索引（macro + micro）在新会话注入
- [ ] `memory_search` 能搜到归档内容
- [ ] 多步任务轮换前后精度对比记录
- [ ] 文档 AS-IS 表更新为真实状态（不写乐观的 ✅）

---

## 十、风险与红线

- **R1 精确轨遗漏 = 任务断裂**(头号):Handoff 完整性断言 + 关键字段非空 + 失败回退不轮换(`SESSION-ROTATION §十`)。
- **R2 轮换时机错误**:安全点必须**真检查**(AS4 当前是假的),中途多步操作绝不轮换。
- **R3 双源漂移**:硬结构(conversation-store)与软语义(src/memory)边界一旦模糊会重演覆盖 bug(#92)。D4 的"硬边持久/软边不存"是纪律,不可破。
- **R4 agent 越权 / prompt injection**:agent 永不继承 owner(D5);report 流防自环(§六)。
- **R5 admin 淹没**:全量逐条会淹死 admin → 必须按 D9 颗粒度,不要图省事改成全量。
- **R6 群双写一致性**:个人线/群线双写需幂等 + 去重,防同一消息在图里出现两次因果。
- **R7 身份错并**:L0 别名归并只走配置声明 + 同渠道精确匹配,**不自动跨渠道猜测**,错并身份是安全事故。

---

## 十一、DO-NOT-DRIFT(接手 AI 强制阅读)

### 11.1 不可推翻的不变式
I1 工作空间单任务 · I2 索引只增 · I3 窗口对模型透明 · I4 双形态延续 · I5 Participant 为主键。**任何实现若违反某条 Invariant,是跑偏,不是优化。**

### 11.2 不可重议的决策
第二章 D1-D10 已由 owner 拍板。若你认为某条应改,**停手,向 owner 复核**,附证据;不要在实现里"顺手"改掉。

### 11.3 本项目反复踩的陷阱(同构,必防)
1. **"模块 + 测试齐全" ≠ "完成"**:历史上 用户画像、computeInjectionBudget、本 session-rotation 都栽在这——代码写完测试绿了,但**接线闭环无测试守护**,生产路径根本没调用(AS1/AS2)。**完成的定义 = 生产路径实跑 + 端到端验证,不是单测绿**(对应 `PITFALLS.md #91`)。
2. **死代码伪装成功能**:`executeRotation` 有完整实现 + 23 测试,却零生产调用(AS2)。新增任何"路径函数"必须同时接线生产调用点,否则就是债。
3. **声明性文档的乐观偏差**:见到 "✅ IMPLEMENTED" 先 grep 生产调用者 + 查全局 dist + 查 DB 实体,再信。
4. **断言冒充检查**:`pendingToolCalls:0` 写死(AS4)是"假装安全",不是安全。安全相关的判据必须真求值。

### 11.4 验证清单(每期 DoD)
- [ ] 生产路径有真实调用者(grep 非测试非导出)
- [ ] 端到端实跑(部署 + 真实任务,非仅 vitest)
- [ ] `tsgo --noEmit` 0 错误 · `oxlint` 0 · 相关 vitest 全绿
- [ ] 对应不变式有测试守护(尤其 I1/I2/I4)
- [ ] 文档 AS-IS 表更新为真实状态(不写乐观的 ✅)

---

*相关文档:`SESSION-ROTATION-CONTINUITY.md`(L2 工作记忆轮换机制,本文上位)· `CONTEXT-INJECTION-ARCHITECTURE.md`(L2 注入分层 B0-B4)· `SUPERADMIN-AGENT-DESIGN.md`(记忆/CONSOLIDATE/World Model)· `PITFALLS.md #91-#94`(本轮审查踩坑)· `ARCHITECTURE.md`*
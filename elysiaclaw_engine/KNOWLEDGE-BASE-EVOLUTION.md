# ElysiaClaw — 知识库与自我进化(Knowledge Base & Self-Evolution)

> 起草:2026-06-06 · 状态:**PROPOSAL,待启动** · 维护者:aoseluo(云尘 / 奈緒)
> 范围:上下文=信息接收系统的范式 · 索引化轻量注入 · 输入分类(任务/闲聊)· 用户画像 · 技能进化 · 自我进化闭环
> 定位:`CONTEXT-INJECTION-ARCHITECTURE.md`(注入分层)与 `SUPERADMIN-AGENT-DESIGN.md`(记忆/CONSOLIDATE)的上层范式;`SESSION-ROTATION-CONTINUITY.md`(任务轨)的非任务侧补全
> 标注:**KNOWN**=代码证据;**INFERRED**=原理推断;**PROPOSAL**=设计建议

---

## 〇、一句话主张(Bottom line)

上下文系统的本质不是"对话缓冲区",而是 **agent 的信息接收器**:每次交互都是输入,处理输入 = 自我进化(更新用户画像、固化技能、沉淀记忆)。受单次上下文物理上限约束,这些**不可能在场全量保有**——必须全部外置为知识库,而**系统强制注入的只能是索引信号(指针),完整内容留在库里按需取**。这套"接收→沉淀→索引化注入→影响行为"的闭环,必须是**内置系统能力,不是靠用户手写 CLAUDE.md 去喂**。

---

## 一、第一性:上下文 = 信息接收系统

```
每次交互(任务/闲聊/反馈)= 信息输入
        │
        ▼
处理 = 认知进化:更新「我对用户的认知」「我自己的技能」「我们的共同记忆」
        │  单次上下文物理上限 → 不可在场全量保有
        ▼
全部外置为知识库(索引信号常驻 · 完整内容在库)
        │
        ▼
注入回认知:只注入轻量索引 → agent 判断相关 → 按需取完整内容 → 影响行为
```

推论:**注入预算的天花板是固定的,知识是无限增长的** → 注入内容/知识总量必然脱钩 → 注入只能是索引,这是物理约束下的唯一解,不是优化选项。

---

## 二、现状验证(KNOWN,带证据)

| 事实 | 证据 | 含义 |
|---|---|---|
| **用户画像几乎为空** | grep `userProfile/userModel/persona` 业务层零命中 | User Model 是真空白,需新建 |
| **memory_get 已存在** | `memory-tool.ts:135 createMemoryGetTool`,描述"after memory_search to pull only the needed lines, keep context small" | **索引→取内容两段式的现成工具,loop 未用对** |
| **memory_search 返回的就是索引** | `memory-tool.ts:88` "returns top snippets with path + lines" | snippet+path+lines 本质是索引信号 |
| **RECALL 把索引当内容注入** | `attempt.ts:1781` 直接拼 snippet 进 system prompt | 既重又不完整——病灶 |
| **skills 只读,不可进化** | grep `writeSkill/evolv` 零命中 | Skill Evolution 空白 |

**结论**:索引化注入**不需从零造**——`memory_search`(索引)+`memory_get`(取内容)已成对存在;缺的是①把它接进认知循环的正确姿势,②用户画像与技能进化两个子系统。

---

## 三、输入分类:不是一切都是任务(边界预想)

`SESSION-ROTATION §4B` 的 Task Segment 默认"一切皆任务"——**错**。用户也会闲聊、寒暄、表达情绪。需前置一个**轻量输入分类器**:

| 类型 | 例 | 进哪条轨 | 沉淀去向 |
|---|---|---|---|
| **task** | "帮我部署"、"查下 X" | Task Segment 任务轨(§4B) | episodic + 技能 |
| **chat** | "今天好累"、"你觉得呢" | **不进任务轨**(不打包 segment) | **用户画像流**(主来源!) |
| **affective** | 情绪表达、关系性对话 | 不进任务轨 | 用户画像(沟通风格/关系) |
| **meta** | "以后回复简短点"、教 agent 规则 | 不进任务轨 | 用户画像(偏好)/ 规则 |

**关键批判 1 — 闲聊也是高价值信息**:闲聊不产生任务,但**是用户画像的主要来源**(偏好、性格、关系、沟通风格藏在闲聊里)。丢弃闲聊 = 丢弃画像养料。所以 chat/affective 不进任务轨,但**必须进画像更新流**。

**关键批判 2 — 误判成本不对称**:把 task 误判为 chat(不打包)→ 任务延续断裂(**严重**);把 chat 误判为 task(空 segment)→ 浪费一个轻量段(**轻微**)。故分类器应**偏向判定 task**(宁可多打包),阈值不对称。

---

## 四、知识库三元组 + 缺口

当前知识库 = **记忆 + 会话 + skills**(用户原话)。映射 `SUPERADMIN` 四类记忆,补全缺口:

| 知识库件 | 内容 | 现状 | 对应四类记忆 |
|---|---|---|---|
| 记忆(memory) | 事实/决策/偏好 | ✅ 引擎已激活 | Semantic |
| 会话(sessions) | 历史对话 | ✅ 已索引 | Episodic |
| skills | 技能/runbook | ⚠️ 只读不可写 | Procedural(进化空白) |
| **用户画像(User Model)** 🆕 | 用户身份/偏好/关系/风格 | ❌ **真空白** | (CoALA 未独列,运维关键) |

**两大缺口 = 用户画像(全新) + 技能进化(只读→可写)**。

---

## 五、索引化注入(Pointer-based Injection)— 核心范式

### 5.1 两段式(复用现成工具)

```
当前(错):memory_search → 把 snippet 当内容拼进 system prompt(重、截断、毁 cache)
改造(对):
  RECALL 注入 = 轻量「索引信号」清单(常驻 B4):
      [mem:deploy-runbook] 部署流程 runbook · score 0.7
      [sess:2026-05-telegram流式] Telegram 流式调试 · score 0.6
  agent 扫索引 → 判断相关 → 主动 memory_get(path, lines) 取完整内容(按需、贵、精确)
```

索引信号结构(轻量):`{ id, type, title, gist(≤一行), ref(path+lines), score }`。
→ 系统强制注入**极度轻量化**(N 条 × 一行),完整内容只在 agent 判定需要时才进上下文。

### 5.2 关键批判 3 — 不应"全部索引化"(对用户主张的修正)

索引化的代价 = **多一轮往返**(注入索引 → agent 判断 → memory_get 取内容)。对简单强相关召回,直接注入 snippet 一步到位反而更优。**正解是分级,不是一刀切**:

| 场景 | 策略 |
|---|---|
| 高分强相关(score≥阈值,明确本轮需要) | **预取**:直接注入精炼内容,省一轮 |
| 中低分/广撒网 | **索引化**:只注入索引信号,按需 memory_get |
| 用户画像核心字段 | **常驻摘要**(慢变,进稳定前缀,见 §六) |

即 **"索引为主 + 强相关预取"**,由注入预算器(`CONTEXT-INJECTION §3.3`)按 score 分流。

---

## 六、用户画像(User Model)— 新建

### 6.1 结构(强类型,index/detail 分离)

```ts
// src/user-model/user-model-types.ts
interface UserModel {
  userId: string;
  // —— 索引层:轻量、常驻注入(进 B0 尾部 / B2,慢变) ——
  summary: string;            // 一句话画像,系统每轮可见
  // —— 明细层:在库,按需 memory_get ——
  identity?: { name?: string; role?: string; timezone?: string };
  preferences: Array<{ topic: string; value: string; confidence: "high"|"medium"|"low"; updatedAt: number }>;
  communicationStyle?: { verbosity?: string; language?: string; tone?: string };
  relationships?: string[];   // 提及的人/项目
  recurringFocus?: string[];  // 反复出现的关注点
  observedAt: number;
}
```

### 6.2 更新来源与时机

- **闲聊/情感**(§三)→ 画像主来源;
- **任务中的偏好表达 + meta 指令**("以后简短点")→ 高置信偏好;
- **CONSOLIDATE 时机**(任务段封口 / 轮换)批量提炼,非每轮(省模型调用)。

### 6.3 注入

画像 `summary`(一行)是**慢变**的 → 进 `CONTEXT-INJECTION` 的稳定前缀(B0 尾或 B2),不进每轮变的 B4 → 保 cache。明细按需 memory_get。

---

## 七、自我进化闭环(内置系统能力)

```
输入 ──分类(§三)──┬─ task → Task Segment → episodic + 技能候选
                  ├─ chat/affective → 用户画像流
                  └─ meta → 偏好/规则
                       │
                  CONSOLIDATE(任务封口/轮换时,SUPERADMIN §四)
                       │  LLM 提炼(可用模型;降级存原始)
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
   更新用户画像     固化技能         沉淀记忆
   (User Model)   (Skill Evol.)    (memory 引擎)
       └───────────────┴───────────────┘
                       ▼
              索引化注入回认知(§五)→ 影响下一轮行为
```

**技能进化(Skill Evolution,Procedural 缺口)**:反复成功的 runbook(部署/排查)→ 从 episode 提炼为 skill 草案 → 沙箱 dry-run + **轻量 HITL 审批**(见风险)→ 写入 skills。这是 `skills 只读→可写` 的破局。

**"内置非用户改善"**:画像更新、技能固化、索引化注入全在 agent loop 自动发生,用户**零配置**。这正是用户诉求——系统自带认知进化,不靠用户喂 CLAUDE.md。

---

## 八、关键批判 4/5 — 风险与盲点

- **回音壁 / 画像漂移**(头号风险):自动沉淀 + 自动注入会**固化错误**(用户某天心情差 → 画像记成"易怒")→ 置信度分级 + temporal-decay + 可纠错 + 低置信不进常驻摘要(同 SUPERADMIN §九)。
- **"全自动内置" × "回音壁"冲突**:全自动 = 错误也自动固化 → 折中:**画像/技能写入走轻量 HITL**(可见 + 可一键纠错),不是无人值守黑箱;低风险偏好可全自动,高影响技能需确认。
- **闲聊误判**(§三批判 2):分类器偏向 task,阈值不对称。
- **索引化往返延迟**(§五批判 3):分级,强相关预取。
- **隐私**:用户画像含敏感信息 → 不写明文密钥(Golden Rule 9);画像库本地、可清空、可导出审查。
- **画像 vs 多用户**:当前单用户(aoseluo),userId 预留;群聊多人画像后置。

---

## 九、落地坐标(PROPOSAL)

| 文件 | 改动 |
|---|---|
| `src/agents/pi-embedded-runner/run/attempt.ts:1758-1786` | RECALL 改索引化:注入索引信号(非 snippet 全文);强相关预取分级 |
| 新增 `src/user-model/*` | UserModel 类型 + node:sqlite 存储 + 更新/查询 |
| 新增 `src/context-engine/input-classifier.ts` | 输入分类(task/chat/affective/meta),偏向 task |
| `src/agents/tools/memory-tool.ts` | memory_get 已有(KNOWN),确认 RECALL 引导 agent 按需调用 |
| 新增 `src/skills/skill-evolution.ts` | episode→skill 草案 + 沙箱 dry-run + HITL 写入 |
| CONSOLIDATE(SUPERADMIN/SESSION-ROTATION) | 封口/轮换时批量更新画像 + 提炼技能 |
| `src/config/*`(Zod) | `userModel.enabled`、`recall.indexOnly`、`skillEvolution.requireApproval` |

---

## 十、与五份设计的关系(收口)

| 文档 | 本文与之关系 |
|---|---|
| `CONTEXT-INJECTION-ARCHITECTURE.md` | 索引化注入 = B4 从"snippet"降为"索引信号";画像 summary 进 B0/B2 |
| `SESSION-ROTATION-CONTINUITY.md` | 输入分类前置于 Task Segment;chat 不进任务轨走画像流 |
| `SUPERADMIN-AGENT-DESIGN.md` | 用户画像 = 第 5 类记忆;技能进化 = Procedural 落地;CONSOLIDATE 扩展 |
| `TELEGRAM-UX-CONTEXT-PLAN.md` | HITL 审批 UX 走 Telegram;画像/技能纠错入口 |
| `MEMORY-ACTIVATION-RUNBOOK.md` | memory_search/get 已激活,本文复用为索引化底座 |

> **架构提示**:引擎现有 5 份关联设计,交叉引用已成网。**强烈建议下一步在 `ARCHITECTURE.md` 画一张总览图**(认知架构全景:输入→分类→任务轨/画像流→CONSOLIDATE→知识库三元组+画像→索引化注入→行为),否则碎片化风险上升。

---

## 十一、实施路线(分阶段)

```
阶段 1  索引化注入(ROI 最高,复用现成工具,不需新子系统)
  └── attempt.ts RECALL:snippet → 索引信号 + 强相关预取分级;系统提示瘦身
阶段 2  输入分类器(task/chat/...,偏向 task)
阶段 3  用户画像 User Model(类型+存储+更新+索引化注入)
  └── 从闲聊/meta 沉淀;summary 进稳定前缀
阶段 4  自我进化闭环接 CONSOLIDATE(封口/轮换时更新画像)
阶段 5  技能进化 Skill Evolution(episode→skill,沙箱+HITL)— 依赖可用模型
```

**先做阶段 1**:它把"系统提示轻量化"的诉求直接落地,复用 memory_get,不依赖任何新子系统,且与 CONTEXT-INJECTION 的 B4 改造是同一处代码——一次改两个目标。

---

*相关文档:`CONTEXT-INJECTION-ARCHITECTURE.md` · `SESSION-ROTATION-CONTINUITY.md` · `SUPERADMIN-AGENT-DESIGN.md` · `TELEGRAM-UX-CONTEXT-PLAN.md` · `MEMORY-ACTIVATION-RUNBOOK.md` · `ARCHITECTURE.md`*

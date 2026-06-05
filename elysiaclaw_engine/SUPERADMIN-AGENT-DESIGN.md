# ElysiaClaw — 超级计算机管理员 Agent 设计

> Super Computer Administrator Agent — Memory Architecture & World Model
> 起草:2026-06-06 · 状态:**设计稿(未实现)** · 维护者:aoseluo(云尘 / 奈緒)
>
> 本文档把"围绕超级计算机管理员打造 ElysiaClaw"的核心设计固化为定稿。
> 范围:记忆架构诊断 + 四类记忆 + 认知循环状态机 + World Model 数字孪生。
> 标注约定:**KNOWN**=有代码/grep 证据;**PROPOSAL**=设计建议,未实现。
> 深挖细节(probe 解析、状态机逐态、CONSOLIDATE 提炼)见文末「待深挖清单」。

---

## 〇、一句话主张(Bottom line)

超算管理员 ≠ 一次性 chatbot,而是**对一台/多台机器负责的常驻有状态主体**。它需要的不是更大上下文,而是**一个持续维护的世界模型 + 把每次操作沉淀回记忆的闭环**。

落到一句话:**不造新记忆系统——把已有的 TS 语义记忆引擎从"被动孤岛工具"重构为"主动认知中枢",新增 World Model 数字孪生,用显式状态机把"感知→检索→行动→沉淀"闭环。记忆即状态,状态即记忆。**

---

## 一、背景与诊断:不是缺记忆,是有引擎没接对

### 1.1 现状证据(KNOWN,均有 grep 佐证)

| 事实 | 证据 |
|---|---|
| `src/memory/` 是**生产级 TS 语义记忆引擎** | embeddings 多 provider(gemini/openai/mistral/ollama/voyage)+ **sqlite-vec 向量** + hybrid 混合检索 + mmr 多样性重排 + temporal-decay 时间衰减 + query-expansion;两 backend(`builtin`/`qmd`)两 source(`memory`/`sessions`) |
| 已暴露为 `memory_search` / `memory_get` 工具 | `src/agents/tools/memory-tool.ts` 接 `getMemorySearchManager`,四层注册在 `tool-catalog.ts` |
| **但没接进主循环** | `attempt.ts` 无任何 `getMemorySearchManager` 调用;记忆纯被动,agent 想起来才查 |
| **Python session_search 旁路了它** | `session-search-tool.ts` 用 `spawnSync` 跑 `scripts/session-indexer.py`(SQLite LIKE 全表扫);而引擎本就支持 `source:"sessions"` 向量检索。`attempt.ts:1733` 还注入 "MANDATORY: session_search" 把 agent 往弱实现上引导 |

### 1.2 根因

ElysiaClaw 不缺记忆引擎——它缺的是**把引擎用对**:

1. **孤岛**:强引擎存在,但未编织进 agent 认知循环;
2. **被动**:记忆只是可选工具,不在每轮自动可用;
3. **被旁路**:用更弱的 Python LIKE(还跨语言冷启进程)替代了现成 TS 向量检索;
4. **只读**:agent 做完操作不回写,记忆永远学不会"这台机器"。

这同时解释了三个体验判断:
- *"记忆是关键问题"* → 引擎孤岛 + 被动 + 被弱实现旁路;
- *"分层压缩已经很好"* → s06 compact 管的是"会话内不溢出",是另一层,确实 OK;
- *"要用本栈语言"* → session_search 每次 `spawnSync` 冷启 Python 做关键词 LIKE,正是反面教材。

> 推论:原"OpenClaw-Next"稿提出的"新建 RAG 向量库"是重复造轮子——已经有了,还更强。方向是**接对 + 回写 + 数字孪生**,不是新建。

---

## 二、定位:超级计算机管理员

超算管理员区别于普通 agent 的本质:**常驻、有状态、对机器负责**。其认知需求:

- **环境感知**:随时知道这台机器现在是什么样(服务/端口/磁盘/网络/版本);
- **操作记忆**:记住做过什么危险操作、改过什么配置、结果如何;
- **经验沉淀**:把"怎么部署/怎么排查"固化为可复用技能;
- **变更警觉**:察觉未授权的外部变更(配置被手工改了)。

这些都不是"更大 context"能解决的,需要**专门的记忆结构 + 回写闭环**。

---

## 三、记忆架构:四类记忆(PROPOSAL,锚定运维)

借 CoALA 认知架构分类(参考模型,非精确引用)映射超算管理员需求,**每类落到现有代码**:

| 记忆类型 | 记什么 | 现状 | 落地 |
|---|---|---|---|
| **World Model(世界模型)** 🆕最关键 | 机器数字孪生:服务/端口/cron/磁盘/Tailscale/版本,随操作增量更新 | **完全没有** | 新建,node:sqlite + 强类型(见 §六) |
| **Episodic(情节/审计)** | 危险操作、配置变更、结果、踩过的坑(PITFALLS 即手工版) | 散落 JSONL + 手工 PITFALLS.md | 自动沉淀:Tier2/3 操作写带结果的 episode → `world_changes` + 回喂 src/memory |
| **Semantic(语义/事实)** | 跨会话事实、用户偏好、决策理由 | **引擎在,没主动用** | 复用 `getMemorySearchManager`,删 session_search |
| **Procedural(程序/技能)** | 部署/重启/排查 runbook | skills 只读不写 | Skill Evolution(后续,见 plan.md) |

**核心缺口 = World Model + CONSOLIDATE(沉淀回写)**。当前记忆是"只读管道",这才是体验差的内核。

---

## 四、认知循环:6 态状态机 × 记忆闭环(PROPOSAL)

状态机的"状态"就是工作记忆的结构化形式——二者一体两面。不替换循环,而是给"名义存在、体验差"的循环一副可靠骨架。

```
PERCEIVE    感知:新消息 + 系统信号(磁盘/服务/cron 到期)
   ▼
RECALL      检索:World Model 当前态 + 相关 episode + 语义记忆   ← 现缺失的"主动注入"
   ▼
PLAN        规划:结合记忆决策(危险操作先查 episode 有没踩过)
   ▼
ACT         执行:工具调用(Tier 分级)
   ▼
REVIEW      校验:断言 + 失败折返(迭代生命值上限防死循环)
   ▼
CONSOLIDATE 沉淀:更新 World Model + 写 episode + 触发技能固化   ← 全新,闭环关键
   └──► 回 PERCEIVE
```

- 6 态用 TS union type 表达,转移函数 `exhaustive switch`——漏态编译报错。
- **CONSOLIDATE 当前 0 实现**,是"越用越懂这台机器"的开关。
- 改造策略:不重写 2861 行的 `attempt.ts`,而是把现有隐式流程**显式包一层状态机外壳**,逐态迁移,每态可单测。

---

## 五、本栈语言(TypeScript / Node)优越性

不是"能用 TS 写",而是**这个设计本质上吃 Node 特性**,Python 原稿做不到:

1. **单进程长驻 = 天生的常驻管理员**。gateway 已是长生命周期 Node 进程;World Model 可作**进程内活对象(热)+ sqlite 持久化(冷)**。对比 session_search 每次 `spawnSync` 冷启 Python——无状态、慢、违背"常驻"本质。
2. **类型系统 = 记忆/状态的编译期契约**。World Model 用 discriminated union;6 状态用 union type,`exhaustive switch` 漏态报错。运维"漏处理一个状态"=事故,这是硬价值。
3. **同构零 IPC**。记忆引擎、agent 循环、工具、gateway 同一运行时,记忆**零拷贝注入 system prompt、被工具直接读写**。Python 方案要跨进程序列化。
4. **node:sqlite 同步快路径 + async 慢路径**。`memory-schema.ts` 已用 `node:sqlite` 的 `DatabaseSync`——World Model 命中走同步(微秒级,不阻塞事件循环),语义检索(embedding)走 async。两档天然分层。
5. **AsyncIterator + AbortController**。记忆检索流式可中断,与 streaming 循环融合;并行盯 cron/lane/子代理用 structured concurrency 管生命周期。

---

## 六、World Model 详细设计(PROPOSAL,已深挖)

### 6.1 定位:与 src/memory 互补,不重复

| | World Model(新) | src/memory(现成) |
|---|---|---|
| 数据形态 | 结构化、强类型、当前态 | 非结构化、语义、历史 |
| 查询 | 精确枚举("现在什么在跑") | 模糊检索("为什么这么配") |
| 存储 | node:sqlite 结构化表 | sqlite-vec 向量 + fts |
| 回答 | **"机器现在什么样"** | "我们的经验/决策" |

RECALL 阶段二者协作:World Model 给当前事实,memory 给相关经验;`world_changes` 可回喂 memory 引擎做语义索引。

### 6.2 数据模型(discriminated union)

```ts
// src/world-model/types.ts
type Host = string; // 多机预留,初期 "elysiaserver"

interface WorldEntityBase {
  id: string;            // 稳定标识 "service:gateway"
  kind: WorldKind;
  host: Host;
  observedAt: number;
  source: "reconcile" | "action" | "user";   // 怎么知道的
  confidence: "high" | "medium" | "low";      // reconcile=high, 推断=medium, 告知=low
  verified: boolean;     // 经 reconcile 校验过
  stale: boolean;        // 最近一次 reconcile 没采集到
}

type WorldEntity =
  | (WorldEntityBase & { kind: "service";    attrs: { name: string; status: "running"|"stopped"|"failed"; pid?: number; manageCmd?: string } })
  | (WorldEntityBase & { kind: "port";       attrs: { port: number; proto: "tcp"|"udp"; boundBy?: string; bindAddr: string } })
  | (WorldEntityBase & { kind: "disk";       attrs: { mount: string; usedPct: number; availGb: number } })
  | (WorldEntityBase & { kind: "network";    attrs: { iface: string; addr: string; tailscale?: boolean; reachable?: boolean } })
  | (WorldEntityBase & { kind: "package";    attrs: { name: string; version?: string; installed: boolean; path?: string } })
  | (WorldEntityBase & { kind: "configfile"; attrs: { path: string; hash: string; managed: boolean } })   // 漂移检测核心
  | (WorldEntityBase & { kind: "deployment"; attrs: { component: string; version: string; lastDeploy: number; distPath?: string } });
```

### 6.3 持久化(仿 memory-schema.ts 的 node:sqlite 风格)

```sql
-- src/world-model/world-model-schema.ts: ensureWorldModelSchema({db})
CREATE TABLE IF NOT EXISTS world_entities (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  host        TEXT NOT NULL DEFAULT 'elysiaserver',
  attrs       TEXT NOT NULL,        -- JSON
  observed_at INTEGER NOT NULL,
  source      TEXT NOT NULL,
  confidence  TEXT NOT NULL,
  verified    INTEGER NOT NULL DEFAULT 0,
  stale       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_world_kind ON world_entities(kind);
CREATE INDEX IF NOT EXISTS idx_world_host ON world_entities(host);

-- 变更历史 = episodic 的结构化部分,可回喂 src/memory 做语义索引
CREATE TABLE IF NOT EXISTS world_changes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id   TEXT NOT NULL,
  changed_at  INTEGER NOT NULL,
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  cause       TEXT,                 -- 关联操作/episode,null=外部变更(警报!)
  detected_by TEXT NOT NULL         -- reconcile | action
);
```

DB 路径仿 memory:`~/.elysiaclaw/agents/<id>/world-model.db`;迁移复用 `ensureColumn` 模式。

### 6.4 Probes — 防漂移采集层(数字孪生的"眼睛")

每个 probe 读真实系统一个切面,产出与 entity 同构类型(采集→存储零转换):

| probe | 命令 | 解决的真实问题 |
|---|---|---|
| serviceProbe | `elysiaclaw status` / `systemctl` / `ps` | gateway/trilium 死活 |
| portProbe | `ss -tlnp` | 18789/8080 占用 |
| diskProbe | `df -h` | Session JSONL 无限增长(ROADMAP 风险) |
| networkProbe | `tailscale status` / `ip addr` | **Pitfall #44**:记录"实际 active 100.111.4.5"而非 `elysiaclaw status` 误报的 off |
| packageProbe | `which node/rg/gh` + `--version` | gh 未装(P2-C 前置)、ripgrep 曾缺失 |
| configProbe | hash `config.yaml`/`elysiaclaw.json` | **外部变更检测** |
| deploymentProbe | 全局 node_modules 版本 | 声明 0.58.0 vs 实际 0.64.0 漂移 |

**reconcile 流程**:probe 采集 → 与 DB diff → 写 `world_changes` → upsert `world_entities`(verified=1) → 未采集到的标 stale=1。

**漂移警报(超算管理员关键安全特性)**:configProbe 发现 hash 变了但 `world_changes` 无对应 `cause` → 标记**未授权外部变更**,主动提醒用户。

### 6.5 触发时机(频率 vs 开销)

- **启动全量**:gateway 启动 → 一次全量 reconcile;
- **周期**:复用现有 cron 系统(`elysiaclaw cron`),默认 30min,`source=reconcile`;
- **操作后定向(CONSOLIDATE)**:Tier2/3 操作后只 reconcile 受影响实体(deploy→deployment+service,改 config→configfile),`cause` 关联操作 id;
- **agent 主动**:`world_model_reconcile` 工具。

不每轮跑——probe 是 shell 成本。

### 6.6 暴露工具(typebox 参数,四层注册)

> 注意:工具参数用 `@sinclair/typebox` 的 `Type.Object`(**不是 Zod**);config 才用 Zod;持久化用 node:sqlite。三者不要混。

```ts
world_model_query     // Type.Object({ kind?, id? })           查当前状态,RECALL 也走它
world_model_reconcile // Type.Object({ kind? })                触发采集校正
world_model_note      // Type.Object({ id, kind, attrs, note }) agent/用户告知,source=user/action,confidence=low,verified=0 待 probe 验证
```

**不给 agent 直接 write 任意 high-confidence 实体**——写入只能经 probe(自动 high)或 note(low,待验证)。这是防"记忆回音壁"(错误事实被反复强化)的硬约束。

四层注册:`world-model-tool.ts` → `elysiaclaw-tools.ts` → `tool-catalog.ts`(新增 `{id:"world_model"}` section)→ `elysiaclaw.json` tools.allow。Bot/TUI 双路径都查。

### 6.7 接入 agent 循环

- **RECALL**(`attempt.ts` 构建 system prompt 时):注入 World Model **紧凑摘要**(非全量),走 node:sqlite 同步查询:
  > 你管理 elysiaserver:gateway✅(:18789) trilium✅(:8080) | 磁盘 62% | tailscale active(100.111.4.5) | node v22.22.1, gh❌未装 | elysiaclaw 0.64.0
  
  让 agent **每轮自带机器认知**,不用现查——超算管理员的"环境感知"。
- **CONSOLIDATE**:工具执行后定向 reconcile + 写 `world_changes`,变更摘要回喂 src/memory 做语义索引。

### 6.8 config(Zod)

```ts
worldModel: z.object({
  enabled: z.boolean().default(true),
  host: z.string().default("elysiaserver"),
  reconcileIntervalMin: z.number().default(30),
  injectSummary: z.boolean().default(true),      // RECALL 注入开关
  probes: z.object({
    services: z.boolean(), ports: z.boolean(), disk: z.boolean(),
    network: z.boolean(), packages: z.boolean(), config: z.boolean(),
    deployment: z.boolean(),
  }).default({ services:true, ports:true, disk:true, network:true, packages:true, config:true, deployment:true }),
}).optional()
```

---

## 七、与现有架构的关系

| 现有件 | 关系 |
|---|---|
| `src/memory/`(语义引擎) | **复用**,不改;World Model 与之互补;`world_changes` 回喂其语义索引 |
| `session-search-tool.ts` + `session-indexer.py` | **删除**,改用 `memory_search` 的 `source:"sessions"` |
| `attempt.ts:1733`(MANDATORY session_search 指引) | **改写**指向 `memory_search`;新增 RECALL 注入 |
| `src/cron/`(工业级 cron) | **复用**,注册周期 reconcile |
| s06 compact 压缩链 | 并存;RECALL 注入量受 mmr + temporal-decay 控制,与压缩协同 |
| s12 Worktree 沙箱 | 后续 Skill Evolution 的 dry-run 复用 |

---

## 八、实施路线(分阶段)

```
前置(技术债,阻塞验证):
  ├── DTS ×6 类型错误(pnpm build 阻塞,Pitfall #38/#63)
  └── 主模型可用性(owl-alpha 400)— CONSOLIDATE 的 LLM 提炼依赖

阶段 1  激活记忆引擎(ROI 最高,不依赖模型)— 执行细节见 MEMORY-ACTIVATION-RUNBOOK.md
  ├── ⚠️ 实测(2026-06-06):线上引擎 0 chunks 空置 · sources 仅 memory · Provider none · FTS ready
  │      → 性质不是"接对一个能用的系统",是"激活一个从未通电的引擎"
  ├── 1.1 开 config(Sacred):memorySearch.enabled + sources:[memory,sessions] + experimental.sessionMemory=true
  ├── 1.2 回填:`elysiaclaw memory index --force`(本地 FTS,无 API 成本)
  ├── 1.3 并行验证(质量门):memory search vs Python session_search 召回对比
  ├── 1.4 验证通过后:attempt.ts:1733 指引改指 memory_search;删 session_search + indexer.py
  └── 1.5 RECALL 注入:attempt.ts 构建 prompt 时主动 search 注入 top-k

阶段 2  World Model 地基
  ├── world-model-schema.ts + types.ts(union)
  ├── probes/*.ts(7 个,各自可测)
  └── world-model-manager.ts(reconcile + diff + 进程内缓存)

阶段 3  World Model 接入
  ├── world-model-tool.ts + 四层注册
  ├── attempt.ts RECALL:注入机器摘要
  └── cron 周期 reconcile

阶段 4  闭环(CONSOLIDATE)
  ├── Tier2/3 操作后定向 reconcile + 写 world_changes
  ├── 外部变更警报(configProbe)
  └── 变更回喂 src/memory

阶段 5  状态机外壳(可后置)
  └── attempt 隐式流程 → 6 态 union,先可观测再可干预

阶段 6  Procedural / Skill Evolution(见 plan.md)
```

---

## 九、风险与盲点

- **主模型不可用**:CONSOLIDATE 的"LLM 提炼 episode/技能"瘫痪 → 降级:只存原始 episode,恢复后补提炼。
- **embedding provider 外部依赖**:离线/限流时语义检索失效 → builtin 用 FTS 兜底(types 已有 `fts` 字段)。
- **probe 跨发行版不可移植**:锁定 Ubuntu 24.04。
- **sudo 依赖**:`systemctl` 可能要 sudo → 失败降级 `ps`/`ss`,标 confidence=medium,不崩。
- **漂移窗口**:两次 reconcile 间外部变更不可见;configProbe hash 比对缩小窗口。
- **记忆回音壁**:自动沉淀 + 自动注入可能强化错误事实 → note 不给 high confidence + temporal-decay + 可纠错。
- **别变垃圾桶**:World Model 只收 7 类对运维有用实体,不做通用 CMDB。
- **多机**:host 字段预留,初期单机,不实现跨机聚合。
- **状态机改造侵入性**:`attempt.ts` 2861 行,逐态包壳,不重写。

---

## 十、待深挖清单(后续)

1. **每个 probe 的解析逻辑**:命令输出 → entity 的精确解析(尤其 `ss`/`tailscale status`/`df` 的格式)。
2. **状态机逐态设计**:每个状态的输入/输出/转移条件/可干预点;REVIEW 折返的迭代生命值机制。
3. **CONSOLIDATE 提炼**:什么操作值得沉淀、episode 的结构化模板、LLM 提炼 prompt、噪声门槛。
4. **RECALL 注入预算**:World Model 摘要 + 语义 top-k 的 token 配额与压缩协同细节。
5. **外部变更警报的 UX**:Telegram 怎么提醒、是否阻塞、如何确认/回滚关联。
6. **Skill Evolution(Procedural)**:运维 runbook 自动固化,沙箱 dry-run + Human-in-the-Loop 审批(plan.md)。
7. **Tool-Log Interceptor**:大工具输出落盘 + 摘要注入(plan.md),与 RECALL/压缩协同。

---

*相关文档:**`MEMORY-ACTIVATION-RUNBOOK.md`(阶段1 执行手册,给执行 agent)** · `plan.md`(进化能力增量计划)· `ARCHITECTURE.md` · `PITFALLS.md`(#38/#44/#63)· `SYSTEM.md`*

---

## 附:文档分工

- **本文档(SUPERADMIN-AGENT-DESIGN.md)= 总架构**:讲"为什么 / 是什么"(诊断、记忆模型、状态机、World Model、TS 优越性)。架构 agent 维护,变更需对齐设计意图。
- **MEMORY-ACTIVATION-RUNBOOK.md = 执行手册**:讲"怎么做"(逐任务 SOP、命令、config diff、代码坐标、DoD、回滚)。执行 agent 照此落地。
- 二者必须一致:执行中发现架构假设不成立 → 回报架构 agent 修订本文档,不在 Runbook 里私自改方向。

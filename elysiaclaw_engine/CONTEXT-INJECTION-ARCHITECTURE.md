# ElysiaClaw — 分层上下文注入架构（Layered Context Injection）

> 起草:2026-06-06 · 状态:**PROPOSAL,待启动** · 维护者:aoseluo(云尘 / 奈緒)
> 范围:系统注入给 LLM 的信息的分层结构 + KV-cache 优化 + 注入预算 + 上下文生命周期管理
> 定位:`TELEGRAM-UX-CONTEXT-PLAN.md` WS-3 的上位设计;`SUPERADMIN-AGENT-DESIGN.md`(World Model/RECALL)的注入承载层
> 标注:**KNOWN**=代码证据;**INFERRED**=原理推断/数量级估算;**NEEDS-VERIFICATION**=需实测;**PROPOSAL**=设计建议

---

## 〇、一句话主张(Bottom line)

注入排布的第一性原则不是"放什么",而是**"按变化频率排序"**。LLM 推理对**逐字节相同的前缀**做 KV-cache 复用,命中即省 ~90% prefill 成本;任何"高频变化内容插在低频内容之前"都会让其后全部缓存失效。当前 ElysiaClaw 把每轮变化的 RECALL 拼进 system prompt 末尾(`attempt.ts:1781`),正是反面教材——**稳定的几 k token 前缀每轮陪葬重算**。修复 = 按变化频率把注入切成有序的「带(Band)」,在稳定与易变之间钉一个 cache 锚点,易变内容一律下沉到锚点之后。

---

## 一、LLM 注入原理(设计依据)

| # | 原理 | 对设计的约束 |
|---|---|---|
| R1 | **KV-cache 前缀复用**(prefix caching):公共前缀逐字节命中才复用,命中 prefill 计费常为 0.1x(INFERRED,provider 相关) | 注入**必须按变化频率从低到高排序**;易变内容绝不能出现在稳定内容之前 |
| R2 | **位置注意力 U 型**(lost in the middle):序列首尾注意力最强,中部最弱 | 强指令(身份/安全红线)放最前;当前任务约束在**消息末尾再压一次**(尾锚);大块参考资料放中部 |
| R3 | **注意力预算/信噪比**:注入越多,关键信号被稀释,有效注意力被摊薄 | 每个 Band 设 token 预算 + 相关性门槛 + 衰减;宁缺毋滥 |
| R4 | **指令/数据分离**:可信指令与不可信/检索数据混排会引发混淆与 prompt injection | Band 间用明确分隔与标签;检索数据(RECALL)标注来源、与指令物理隔离 |
| R5 | **recency**:越靠近生成位置的 token 对输出影响越大 | 最相关的即时上下文(RECALL、当前消息)放最末;稳定知识放前缀 |

---

## 二、现状诊断(KNOWN,带坐标)

当前 `attempt.ts` 注入顺序(1702→1786):

```
systemPromptText =
   base system prompt        (createSystemPromptOverride(appendPrompt))  ← 稳定(含 tools/skills/bootstrap)
 + DELEGATE_CODE_TASK_GUIDANCE  (1729, 常量)                              ← 稳定
 + MEMORY_SEARCH_GUIDANCE       (1756, 常量)                              ← 稳定
 + RECALL block                 (1781, search(params.prompt) 每轮结果)   ← ★每轮变★
→ 作为 system: 传入模型 (2028)
```

**病灶**:RECALL(每轮变)拼在 system prompt 内部 → system prompt 整体每轮变 → 其前缀 KV-cache 每轮失效。base prompt + 两段 GUIDANCE 是稳定的、本应被缓存的数 k token,**每轮全部重 prefill**。

**次生问题**:
- RECALL 是**检索数据**却混在**指令区**(违反 R4),且位置偏中前(违反 R5,该靠近生成位置)。
- World Model 摘要(`SUPERADMIN §6.7`)、CONSOLIDATE 回补若沿用同一 append 方式,会进一步放大失效面。
- 注入量与 s06 压缩**无共享预算**(`TELEGRAM-UX-CONTEXT-PLAN.md` P5):大注入顶爆窗口→触发压缩→丢注入→反身性空转。

---

## 三、分层注入模型(PROPOSAL)

### 3.1 五带 + 消息流(按变化频率 = cache 边界从前到后)

```
┌─ 稳定前缀(KV-cache 命中区,逐字节锁定)──────────────────────┐
│ B0 IDENTITY      身份/人格/安全红线(Tier3)/输出规则         版本级·几乎不变
│ B1 CAPABILITY    工具定义 + skill 索引 + 静态 GUIDANCE        部署级·随构建变
│                  (delegate_code_task / memory_search 指引)
│ B2 ENVIRONMENT   World Model 摘要 + 运行环境快照               慢变·reconcile 周期(30min)
├══ CACHE ANCHOR ══ prefix-caching 断点(cache_control / 自然前缀)═══════════┤
│ B3 WORKING SET   压缩 summary + CLAUDE.md 懒加载 + 会话事实    会话内变·压缩时
│ B4 EPHEMERAL     RECALL top-k + 临时知识 + 压缩感知回补        ★每轮变★
├─ 对话本体 ────────────────────────────────────────────────┤
│    MESSAGES      历史消息 + 当前消息(+ 尾锚:当前约束复述)    每轮追加·recency 最强
└──────────────────────────────────────────────────────────┘
```

### 3.2 各带定义

| Band | 内容 | 变化频率 | 载体位置 | 预算策略 |
|---|---|---|---|---|
| **B0 IDENTITY** | SOUL/人格、安全三级红线、语言规则、输出规则(L1/L2/L3) | 版本级 | system 最前(R2 首锚) | 固定,不裁 |
| **B1 CAPABILITY** | tools schema、skills 索引、delegate/memory_search 静态 GUIDANCE | 部署级 | system | 大但稳定,部署才变 |
| **B2 ENVIRONMENT** | World Model 紧凑摘要(机器现状)、runtime/timezone | reconcile 周期 | system 尾(cache 锚点前) | ≤ `env` 子预算;reconcile 时接受一次失效 |
| **B3 WORKING SET** | 最近压缩 summary、按需加载的 CLAUDE.md 片段、本会话已确立事实 | 会话内(压缩) | 消息流首条(system 之后) | ≤ `working` 子预算 |
| **B4 EPHEMERAL** | RECALL top-k(检索)、临时知识、压缩刚折叠主题的回补 | 每轮 | **最后 user message 之前** | ≤ `recall` 子预算,mmr+temporal-decay |
| **MESSAGES** | 历史 + 当前消息 + 尾锚 | 每轮追加 | 末尾 | 剩余窗口 |

### 3.3 核心改造决策

1. **RECALL 出 system,下沉 B4**:从 `attempt.ts:1781` 的 system append,改为注入到**消息流末尾(最后 user 之前)**的独立 ephemeral 块。一举满足 R1(保前缀稳定)、R4(数据离指令)、R5(贴近生成)。
2. **钉 cache 锚点**:B0-B2 构成稳定前缀。Anthropic 路径用 `cache_control` 断点标在 B2 末;OpenAI/OpenRouter 走自然前缀缓存。B2 reconcile 更新 → 一次失效可接受(30min 一次 vs 每轮)。
3. **静态 GUIDANCE 归 B1**:`DELEGATE_CODE_TASK_GUIDANCE`/`MEMORY_SEARCH_GUIDANCE` 已是常量且在 RECALL 之前(1729/1756),顺序本就对——只要 RECALL 不再污染其后,它们即可缓存。
4. **尾锚(R2)**:当前 turn 的硬约束(如"用中文回复"、当前 plan 步骤)在最末消息再压一句,对冲 lost-in-the-middle。
5. **统一注入预算器**(对应 WS-3 §2):

```
T_total = contextTokens(1M)
T_inj   = 注入预算上限(B2+B3+B4),建议 ≤ 总窗口的某固定比例(NEEDS-VERIFICATION 调参)
分配:   env : working : recall = 例如 1 : 2 : 2(可配)
溢出裁剪优先级(从先裁到绝不裁):  B4 尾部 → B3 → B2 → 【B0/B1 永不裁】
关键:  B2+B3+B4 注入量计入压缩触发阈值 → 杜绝"注入→爆窗→压缩→丢注入"反身性空转
```

---

## 四、上下文精细管理(生命周期)

| 机制 | 规则 |
|---|---|
| **压缩边界** | s06 压缩只作用于 MESSAGES + B3;B0-B2 是**注入非历史**,永不进压缩输入 |
| **去重** | B4 RECALL 跳过已存在于 B3 working set / 近期消息的条目,避免重复占预算 |
| **衰减** | B4 用 temporal-decay + mmr 多样性重排(`src/memory` 引擎已有),旧/冗余条目自然降权 |
| **压缩感知回补** | 压缩刚折叠的主题,下一轮 B4 优先召回(`TELEGRAM-UX-CONTEXT-PLAN.md` WS-3 §3),缓解局部失忆 |
| **失效隔离** | 任何新增易变注入一律下沉到 cache 锚点之后(B3/B4),保护前缀命中率——**这是新增注入的硬规约** |
| **MESSAGES 区工具驱逐(L1)** | tool_result 被消费后即压成一行摘要 + artifactRef,驱逐原文(非删除,可经 ref 回查)。详见 `SESSION-ROTATION-CONTINUITY.md §4B.3`——任务内三级压缩的最高频级 |
| **降级** | embedding/模型不可用时 B4 走 FTS 兜底;B2 probe 失败标 stale 不崩(同 SUPERADMIN §九) |

---

## 五、落地坐标(PROPOSAL)

| 文件 | 改动 |
|---|---|
| `src/agents/pi-embedded-runner/run/attempt.ts:1758-1786` | RECALL 从 system append → 消息流末尾 ephemeral 注入(B4) |
| `attempt.ts:1729/1756` | GUIDANCE 保留在 system(归 B1),确认位于 cache 锚点之前 |
| `attempt.ts` system 构建处 | 引入 Band 顺序组装 + cache 锚点标记(provider 适配在 pi-embedded-helpers) |
| 新增 `src/context-engine/injection-budget.ts` | 统一预算器:分配 + 溢出裁剪 + 注入量回喂压缩阈值 |
| `src/agents/pi-embedded-helpers/*`(OpenAI/Anthropic 适配) | cache_control 断点 / 前缀缓存对接 |
| World Model 摘要(SUPERADMIN §6.7) | 注入到 B2,纳入预算器,不另起 append |
| `src/config/*`(Zod) | `memory.injectionBudgetTokens`、band 分配比例、`cacheAnchor.enabled` |

---

## 六、收益估算

- **token/成本**(INFERRED,数量级):当前每轮失效的稳定前缀 ≈ base prompt + 2×GUIDANCE ≈ 数 k token,每轮重 prefill。改造后命中 prefix cache,该部分 prefill 计费降至约 0.1x。**NEEDS-VERIFICATION**:实际取决于 provider 缓存策略、TTL、最小可缓存长度(OpenRouter/阿里云 Bailian 直连路径需各自实测)。
- **质量**(INFERRED):RECALL 贴近生成位置(R5)+ 离开指令区(R4)→ 召回利用率上升、指令混淆下降。
- **稳定性**:注入纳入压缩预算 → 消除反身性空转(P5),为 World Model 大注入扫清前置。

---

## 七、风险与盲点

- **provider 缓存差异**:不同 provider 的 prefix caching 触发条件/最小长度/TTL 不一 → cache 锚点策略需 per-provider 适配,不能假设统一。**NEEDS-VERIFICATION**。
- **B2 颠簸**:World Model 若 reconcile 过频会频繁失效前缀 → 锁 30min 周期 + 仅在实体真变时才更新摘要(diff 后无变化则不动 B2 文本)。
- **预算误配**:T_inj 过大→挤压对话/触发压缩;过小→召回不足 → 需实测调参,先保守。
- **尾锚冗余**:尾锚复述过多会变噪音 → 只压最关键 1-2 条硬约束。
- **裁剪误伤**:溢出裁剪逻辑必须严守优先级,B0 安全红线绝不可裁——加单测覆盖。

---

## 八、与现有/规划件的关系

| 件 | 关系 |
|---|---|
| `attempt.ts` RECALL(T6) | **重构位置**:system append → B4 消息注入 |
| 静态 GUIDANCE(delegate/memory) | **归类 B1**,锚定缓存 |
| `src/memory` 引擎(mmr/temporal-decay/fts) | **复用**为 B4 衰减/兜底 |
| s06 压缩链 | **预算协同**:B2/B3/B4 注入量计入压缩阈值;压缩只动 MESSAGES+B3 |
| World Model(SUPERADMIN Phase 2) | 摘要注入 **B2**,走统一预算器 |
| `TELEGRAM-UX-CONTEXT-PLAN.md` WS-3 | 本文是其 §2「统一注入预算」的上位设计;WS-3 落地引用本文 |

---

*相关文档:`TELEGRAM-UX-CONTEXT-PLAN.md`(WS-3)· `SUPERADMIN-AGENT-DESIGN.md`(World Model/RECALL/CONSOLIDATE)· `MEMORY-ACTIVATION-RUNBOOK.md`(记忆引擎已激活)· `ARCHITECTURE.md` · `PITFALLS.md`*

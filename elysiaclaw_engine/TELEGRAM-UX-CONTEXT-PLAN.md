# ElysiaClaw — Telegram 输出体验 × 上下文/记忆协同 改造计划

> 起草:2026-06-06 · 状态:**部分实施中** · 维护者:aoseluo(云尘 / 奈緒)
> 范围:Telegram 流式观感重构 + 压缩期可见性 + 上下文压缩与记忆引擎闭环
> 标注约定:**KNOWN**=有代码/grep 证据;**PROPOSAL**=设计建议,未实现。
> 关联文档:`SUPERADMIN-AGENT-DESIGN.md`(记忆/World Model 总架构)· `PITFALLS.md`(#70)· `SYSTEM.md`
> 进度:WS-1(压缩可见性)✅生产验证通过 · WS-2(全流式输出)✅生产验证通过 · WS-3(压缩×记忆协同)=PROPOSAL,依赖记忆引擎+World Model

---

## 〇、一句话主张(Bottom line)

用户在 Telegram 看到的"掉线感"不是 agent 真的停了,而是 **agent 最忙的两段时间(压缩、思考)恰恰对用户完全静默**。修复方向不是加更多消息,而是**把 agent 的内部状态(压缩中 / 思考中 / 工具中)统一收敛为一条持续的流式信道**,并顺势把压缩"丢掉的东西"回写记忆引擎——让上下文管理和记忆引擎共用一套预算与闭环。

---

## 一、问题诊断(KNOWN,逐条带代码证据)

### P1 — 压缩期间是 UX 黑洞,用户以为掉线

- `compact.ts:918` `compactWithSafetyTimeout(() => session.compact(...))` 是**阻塞调用**,内部要跑一次 LLM summary,耗时可达数十秒。
- 整个压缩流程(`compact.ts:903-965`)**不向任何渠道 emit 进度事件**:只有 `emitSessionTranscriptUpdate`(写 transcript 文件)和 `compact:after` internal hook —— 后者注释明确写着 *"current events only report summary metadata"*(TODO #9611),不触达 Telegram dispatch。
- 因此压缩期间:无 draft-stream、无 tool lane、无 reasoning lane 更新。Telegram 端完全静默。

### P2 — "正在输入"会在静默期消失

- `typing.ts:28` `typingTtlMs = 2 * 60_000`(2 分钟 TTL),`typingIntervalSeconds = 6`(6 秒 keepalive)。
- typing loop 靠流式事件 `refreshTypingTtl()` 续命。压缩/长思考期间无事件刷新 → 2 分钟 TTL 到 → `cleanup()` 停 typing。
- Telegram 原生 typing 气泡本身只活 ~5 秒,靠 keepalive 续;一旦 loop 停,气泡立即消失 → 用户判定"掉线"。

### P3 — 思考过程不流式,观察被阻断

- thinking/reasoning lane **已接线**(2026-06-06 Sprint),但 `resolveTelegramReasoningLevel`(`bot-message-dispatch.ts:133`)读 session 的 `reasoningLevel`,而 `directive-handling.impl.ts:306` 默认 `?? "off"`。
- 结果:用户只看得到工具调用(tool lane),看不到 agent 的推理链。中间一大段思考时间表现为静默。

### P4 — 大段信息直发 vs 流式不统一

- 正文走 draft-stream lane(流式),但**工具完整输出、最终长回复**在部分路径上仍是攒够一次性 flush。
- 多信道(text / tool / reasoning)各自为政,没有统一的"一切内部状态都进同一条可见流"的契约。

### P5 — 注入与压缩无预算协同(前瞻隐患)

- RECALL 注入已激活(记忆引擎 T6,`attempt.ts` 每轮 system prompt 注入 top-5)。
- 后续 World Model 摘要注入(`SUPERADMIN-AGENT-DESIGN.md §6.7`)、CONSOLIDATE 回写将**持续增大每轮注入量**。
- 二者与 s06 压缩链**无共享预算**:大量注入会顶高 token → 立刻触发压缩 → 压缩又可能丢掉刚注入的记忆 → **反身性空转**。这是"后续注入大量信息"必须先解决的结构性问题。

---

## 二、三个工作流(WS)

### WS-1 — 压缩可见性(Compaction Heartbeat & Notice)

**目标**:压缩期间用户始终看到"正在压缩上下文",typing 不断。

**方案(PROPOSAL)**:
1. **压缩前置通知**:在 `compact.ts` 进入 `session.compact()` 前,经渠道回调推送一条 reasoning-lane 风格的瞬时状态(非正式消息):`🗜️ 正在压缩上下文(N 条消息)…`。压缩完成后更新为 `🗜️ 压缩完成:N→M 条,省 ~X% tokens`。
2. **心跳续命**:压缩开始时启动一个独立 typing 心跳(复用 `TypingController.refreshTypingTtl` / keepalive),压缩 promise resolve 时停止。确保 2 分钟 TTL 不会在压缩中途到期。
3. **渠道无关接线**:压缩在 `pi-embedded-runner` 层,不直接依赖 Telegram。新增一个 `onCompactionProgress?(phase: "start"|"done", meta)` 回调,沿 `auto-reply → bot-message-dispatch` 注入,Telegram 端映射到 reasoning lane + typing 续命。

**文件改动(预估)**:

| 文件 | 改动 |
|---|---|
| `src/agents/pi-embedded-runner/compact.ts` | 压缩前后调用 `onCompactionProgress` 回调(start/done + meta) |
| `src/auto-reply/reply/agent-runner-execution.ts` | 透传 `onCompactionProgress` 到 dispatch |
| `src/auto-reply/reply/typing.ts` | 暴露压缩期心跳:`startTypingLoop()` 在压缩 start 时强制续命,done 时回归正常 TTL |
| `src/telegram/bot-message-dispatch.ts` | 映射 compaction phase → reasoning lane 文案 + `refreshTypingTtl` |

**DoD**:压缩耗时 >2 分钟时 typing 不消失;Telegram 出现压缩 start/done 两条状态;无渠道泄漏(TUI 路径不报错)。

---

### WS-2 — 全流式输出(Unified Streaming)

**目标**:thinking、正文、工具状态全部走持续流式,取代任何"攒够再发"的大段直发。

**方案(PROPOSAL)**:
1. **思考默认可见**:新增 config `telegram.streaming.reasoning`(默认 `"stream"`),让 `resolveTelegramReasoningLevel` 在 session 未显式设置时回退到该默认值,而非硬编码 `"off"`。保留 `/think off` 指令覆盖。
2. **统一流式契约**:确立"agent 任何内部阶段都必须有可见流"的原则——
   - thinking → reasoning lane(流式增量)
   - 正文 → draft-stream lane(流式增量,已有)
   - 工具 → tool lane(已有,坑 #70 已修)
   - 压缩 → reasoning lane(WS-1)
3. **消除大段直发**:审计最终回复 flush 路径,确保长文本经 draft-stream 增量送达;超长工具输出走"摘要 + 落盘文件路径"(与 `SUPERADMIN-AGENT-DESIGN.md` 待深挖 #7 Tool-Log Interceptor 协同),不一次性灌入聊天。
4. **lane 优先级与防抖**:reasoning lane 用低优先级、可被正文 lane 抢占;沿用 tool lane 的 `minInitialChars` 处理(坑 #70),避免碎片化刷屏。

**文件改动(预估)**:

| 文件 | 改动 |
|---|---|
| `src/config/*`(schema) | 新增 `telegram.streaming.{reasoning,unifyLanes}`(Zod) |
| `src/telegram/bot-message-dispatch.ts` | `resolveTelegramReasoningLevel` 回退到 config 默认 |
| `src/auto-reply/reply/directive-handling.impl.ts` | `?? "off"` → `?? configDefault` |
| `src/telegram/reasoning-lane-coordinator.ts` | reasoning 增量流式 + 与正文 lane 抢占策略 |
| `src/telegram/lane-delivery*.ts` | 长文本增量保证、超长输出落盘摘要 |

**DoD**:开启后 Telegram 可见思考增量;无 >3000 字一次性消息(超长落盘);`/think off` 仍可关。

---

### WS-3 — 压缩 × 记忆引擎协同(Compaction-Memory Bridge)

**目标**:压缩不再是"信息黑洞"——被丢弃的历史先沉淀进记忆引擎;RECALL/World Model 注入与压缩共享预算,杜绝反身性空转。这是把"上下文管理"与"记忆引擎"合并改造的核心,直接服务"后续注入大量信息"的诉求。

**方案(PROPOSAL)**:
1. **压缩即沉淀(CONSOLIDATE 的第一块落地)**:利用 `compact:after` hook(`compact.ts:965` TODO #9611)挂载——压缩产生 summary 时,把被折叠的关键 episode(危险操作、配置变更、决策理由)回写 `src/memory` 语义索引(`getMemorySearchManager`)。压缩丢的是"上下文窗口里的副本",真相沉到记忆,日后可 RECALL 召回。对齐 `SUPERADMIN-AGENT-DESIGN.md §三/§四 CONSOLIDATE`。
2. **统一注入预算(Injection Budget)**:在 `attempt.ts` 构建 system prompt 处建立单一预算器,统筹三类注入:RECALL top-k + World Model 摘要 + CLAUDE.md 懒加载。预算上限作为压缩阈值的输入项——**注入量纳入压缩触发判断**,避免"注入→爆窗→压缩→丢注入"循环。注入量受 mmr + temporal-decay 控制(引擎已有)。
   > **上位设计见 `CONTEXT-INJECTION-ARCHITECTURE.md`**——分层注入(B0-B4 + 消息流)、KV-cache 锚点、预算分配与溢出裁剪的完整设计。本预算器是该架构 §3.3 的落地。关键纠错:当前 RECALL 被 append 进 system prompt(`attempt.ts:1781`,每轮变化致前缀 cache 全失效),须下沉到消息流末尾(B4)。
3. **压缩感知 RECALL**:压缩刚发生的那一轮,RECALL 优先召回"刚被压缩折叠掉的主题",形成"压缩→沉淀→即时回补"的闭环,缓解压缩造成的局部失忆。
4. **去噪前置**:sessions chunks 47% 含 CLAUDE.md project-memory 噪音(已知,ROADMAP),在回写前过滤,避免污染记忆。

**文件改动(预估)**:

| 文件 | 改动 |
|---|---|
| `src/agents/pi-embedded-runner/compact.ts` | `compact:after` 提取 episode → 回写 `getMemorySearchManager` |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 注入预算器:统筹 RECALL + World Model + CLAUDE.md,上限喂给压缩阈值 |
| `src/memory/*` | 回写 API(若现有 manager 无写入入口则补)+ project-memory 去噪过滤 |
| `src/config/*` | `memory.injectionBudgetTokens`、`memory.consolidateOnCompact`(Zod) |

**DoD**:压缩后 `memory_search` 能召回被压缩主题;注入总量不超预算且压缩不再被自身注入触发;去噪后 sessions 噪音占比显著下降。

---

## 三、实施顺序与依赖

```
WS-1 压缩可见性      ← 独立,ROI 最高,不依赖模型,优先做
WS-2 全流式输出       ← 独立,config + lane 改造,与 WS-1 共用 reasoning lane
WS-3 压缩×记忆协同   ← 依赖记忆引擎(✅已激活)+ World Model(部分,Phase 2);
                        CONSOLIDATE 回写依赖可用模型做提炼,降级可只存原始 episode
```

- WS-1 / WS-2 可并行,均为渠道层改造,**不需要可用主模型**即可验证(用静默/思考观察)。
- WS-3 的注入预算器(§2)可先做(纯逻辑);CONSOLIDATE 提炼(§1)等主模型恢复。
- 与 `SUPERADMIN-AGENT-DESIGN.md` Phase 2 World Model 对齐:World Model 摘要注入纳入 WS-3 的统一预算器,不另起炉灶。
- ⚠️ **审查建议**:WS-3 是三个工作流中最重要的(反身性空转的根因修复),但依赖最多(记忆引擎 + World Model + 可用模型)。建议单独拆为独立 Sprint,不与 WS-1/WS-2 并行,确保有足够时间处理依赖。

---

## 四、与现有架构的关系

| 现有件 | 关系 |
|---|---|
| `TypingController`(`typing.ts`) | **复用**,WS-1 压缩期心跳借其 keepalive/TTL |
| reasoning-lane-coordinator | **复用**,WS-1 压缩状态 + WS-2 思考流都走它 |
| tool lane(坑 #70 已修) | **复用**,WS-2 统一流式契约纳入 |
| s06 compact 压缩链 | **改造接口**(加 progress 回调 + compact:after 回写),不动压缩算法 |
| `src/memory`(语义引擎) | **复用 + 补写入入口**,WS-3 回写目标 |
| RECALL 注入(T6) | **纳入** WS-3 统一预算器 |
| World Model(Phase 2) | **预留**,摘要注入走同一预算器 |

---

## 五、风险与盲点

- **渠道泄漏**:压缩/思考回调若硬编码 Telegram,会污染 TUI/其他渠道 → 必须走渠道无关回调,Telegram 仅做映射。
- **刷屏**:思考流式过细会碎片化 → 复用坑 #70 防抖 + reasoning lane 低优先级。
- **反身性空转**(P5):注入预算若没纳入压缩阈值,改造反而加剧空转 → WS-3 §2 是硬前置,World Model 注入前必须就位。
- **CONSOLIDATE 依赖模型**:提炼 episode 需可用模型 → 降级只存原始片段,模型恢复后补提炼(同 SUPERADMIN §九)。
- **记忆回音壁**:压缩回写可能强化错误事实 → 回写走 low confidence + temporal-decay + 可纠错(同 SUPERADMIN §九)。
- **typing TTL 边界**:压缩超长(>safety timeout)时心跳要随压缩 promise 一同终止,避免永久 typing(`typing.ts` 的 `sealed` 机制已防late event,复用)。

---

## 六、DoD 汇总

- [ ] WS-1:压缩 >2min typing 不消失;start/done 状态可见;TUI 不报错
- [ ] WS-2:思考增量可见;无超长一次性消息;`/think off` 可覆盖
- [ ] WS-3:压缩主题可被 RECALL 召回;注入不超预算且不自触发压缩;噪音下降
- [ ] 引擎文档同步(本文件 + ROADMAP + SPRINT + HANDOFF)
- [ ] 新增坑号(若有)记入 PITFALLS.md

---

*相关文档:`SUPERADMIN-AGENT-DESIGN.md`(记忆/World Model 总架构,WS-3 的上位设计)· `archive/MEMORY-ACTIVATION-RUNBOOK.md`(记忆引擎已激活)· `PITFALLS.md` #70(tool lane 防抖)· `ARCHITECTURE.md` · `SYSTEM.md`*
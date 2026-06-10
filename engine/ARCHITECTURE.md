# ARCHITECTURE — Elynyx
> Stage: 认知架构演进中期（PLAN-13 accepted） | Last updated: 2026-06-10
> Class: mixed | CLI-LEAN 下只信任 irreducible 章节（§0/§1/§6/§7），derivable 章节按需从代码现生


## 0. 产品简史  [irreducible]
**为什么要做这个项目：** Elynyx 是 Elynyx（多渠道 AI 助手平台）的个人维护分支。目标是在 pi-mono 框架之上构建一个对标 Claude Code 完整能力的自主 AI 助手，通过 Telegram Bot 提供服务。不是简单的 chatbot——而是常驻的、有状态的、会自我进化的信息接收主体。

**用户核心操作：**
1. 通过 Telegram 与 Elynyx 对话，执行代码分析、文件操作、部署任务
2. Agent 自主执行多步骤任务（规划→执行→审查→沉淀），跨 session 延续
3. 记忆引擎自动索引和召回历史操作与决策，越用越懂用户

**灵感与参考：**
- Claude Code：12 层 Agent 架构的设计对标
- Elynyx：Gateway 多渠道架构的基础
- pi-mono：极简 Agent 框架（"One loop & Bash is all you need"）
- CoALA 认知架构：记忆分类的参考模型


## 1. 项目身份  [irreducible]
| 字段 | 值 |
|------|-----|
| 项目名称 | Elynyx |
| 代号 | elynx |
| 一句话描述 | 基于 pi-mono 的多渠道 AI 助手平台，通过 Telegram Bot 提供对标 Claude Code 的自主 agent 能力 |
| 仓库位置 | `github.com/elysiayunchen/elynx` |
| 上游来源 | Fork of Elynyx `v2026.3.13` |
| 维护者 | aoseluo（云尘 / 奈緒）— 非专业程序员，AI 协作开发 |
| 维护模式 | Solo fork，独立维护，不与上游同步 |
| 服务器 | `elysiaserver` — Ubuntu 24.04，Node.js v22.22.1 |
| 运行平台 | Telegram Bot `@Elynyx_Bot`（主渠道） |
| 项目类型 | 全栈：Agent 框架层（pi-mono）+ 应用层（elynx）+ 多渠道 Gateway |

**两项目结构：**
- `packages/`（框架层）：tui、ai、agent — 3 个核心包
- `elysiaclaw/`（应用层，品牌名 elynx）：渠道适配、应用层工具、Gateway 控制平面、配置系统 + coding-agent 源码（`src/agents/coding-agent/`）


## 2. 技术栈  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`packages/*/package.json`、`elynx/package.json`、`~/.elynx/elynx.json`
> 快速命令：`cat packages/coding-agent/package.json | grep -E '"dependencies"|"devDependencies"' -A 20`


## 3. 目录结构  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`ls -la /home/elysia/projects/pi-mono/`、`ls -la packages/`、`ls -la elynx/src/`
> 快速命令：`find . -maxdepth 2 -type d | sort | head -50`


## 4. 包/服务地图  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`packages/*/package.json`、`elynx/package.json`
> 核心包：tui（终端 UI）→ ai（LLM API）→ agent（核心循环）；coding-agent 已合并到 elysiaclaw/src/agents/coding-agent/


## 5. 核心数据流  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`elynx/src/agents/pi-embedded-runner/run/attempt.ts`、`packages/agent/src/agent-loop.ts`
> 关键路径：Telegram → Gateway (WS :18789) → createAgentSession → Agent.runLoop → streamAssistantResponse → executeToolCalls → Telegram reply


## 6. 关键架构决策  [irreducible]

1. **Fork 而非贡献上游** → **原因：** Elynyx 上游发展方向与个人需求分歧，且需要大量自定义扩展（12 层 Agent 框架、P 系列补丁）→ **后果：** 独立维护，永远不与上游同步；获得完全自主权但需自行处理所有上游更新

2. **Bot vs TUI 双轨工具注册** → **原因：** TUI 模式走 `createPiCodingTools`（加载自定义 pi-coding-agent dist），Bot 模式走 `createElynyxCodingTools`（elynx 自包含 bundle）→ **后果：** 新增工具必须两边验证，这是理解 Elynyx 架构最重要的事实（PITFALLS #17/#54）；两个路径完全独立，部署时需同时更新

3. **pi-agent-core Monkey-patch（P1-A）** → **原因：** 0.64 编译产物缺少 `setSystemPrompt()` 和 `replaceMessages()` 方法，但源码调用了它们 → **后果：** 通过 `scripts/patch-agent.cjs` 手动注入，锚点从 `setAfterToolCall` 改为 `subscribe`；每次 npm install 可能被覆盖，deploy.sh 需验证 patch 存活

4. **Code Mode 废弃 → delegate_code_task 子代理分发** → **原因：** Code Mode（`/code` `/exit`）与 agent 循环耦合复杂，且只需要隔离代码分析上下文 → **后果：** 改用 `spawnSubagentDirect()` 只读子代理，主 agent 保留决策权；子代理只读，修改操作由主 agent 决策后执行

5. **记忆引擎：TS 取代 Python** → **原因：** Python session_search 每次 `spawnSync` 冷启进程做 SQLite LIKE，而现成 TS 引擎支持向量检索 + hybrid + mmr → **后果：** `memory_search` 全面取代 `session_search`，RECALL 注入激活（每轮 system prompt 自动召回 top-5）；Python 代码已清理

6. **认知架构：分层注入 + KV-cache 优化** → **原因：** RECALL 注入在 system prompt 内部（`attempt.ts:1781`），每轮变化导致稳定前缀 KV-cache 全失效 → **后果：** B0-B5 六带分层注入（B0 IDENTITY / B1 CAPABILITY / B2 ENVIRONMENT / B3 INDEX HEADS / B4 ACTIVE TASK / B5 RECALL）；B0-B2 稳定前缀钉 cache 锚点，B3/B4/B5 一律 append 到 effectivePrompt 末尾（同时满足 R1 前缀缓存 + R5 recency）。详见 PLAN-09 §六（注入方向修正 prepend→append 为 P0 任务）

7. **延续机制：事件流 + 认知图谱索引（取代会话轮换）** → **原因：** 会话轮换（窗口满→硬切换→重注入提示词→Handoff 交接）有三重问题——重付 B0-B2 稳定前缀成本、"窗口"概念向模型层泄漏（违反 I3）、Handoff/安全点/CONSOLIDATE 五条管线纠缠。早期 PLAN-02"双轨 Handoff"设计已废弃 → **后果：** 对模型而言会话不存在，交互是一条永不中断的事件流；TaskSegment 封口产生 IndexNode（索引头只增累积在 B3），当前任务完整细节按需替换 B4；延续靠索引头本身 + 硬边图遍历，不靠轮换/Handoff。**权威：PLAN-09（accepted），取代 PLAN-01/02/08 L2**

8. **参与者持续性：persistent identity 绑定** → **原因：** 对模型而言"会话/窗口"不存在，唯一单元是 Participant → **后果：** 连续性绑 participant_id；群聊双写；认知图谱只增不减（I2）；工作空间只留 active task（I1）；窗口对模型透明（I3）。身份/协作/安全层（L0/L1/L3/L4）方向保留（PLAN-08，含决策 D1-D10），L2 认知层实现从"轮换+Handoff"改为"事件流+认知图谱"（PLAN-09）


## 7. 数据模型  [混合：约束/不变量 = irreducible，schema 位置 = derivable]

### 7.1 核心数据约束与不变量  [irreducible]
| 约束 | 说明 |
|------|------|
| 事件流单元 | 对模型而言会话/窗口不存在，交互是一条永不中断的事件流（绑 participant_id）；框架层 session 仅为存储分片，对模型透明（I3）。⚠️ 早期"chat→Conversation→多 Session 轮换"模型已废弃（PLAN-09） |
| 事件记忆不变式 | I1 工作空间单任务 · I2 索引只增（认知图谱节点/硬边只追加） · I3 窗口对模型透明 · I4 双形态延续（精确轨=索引头，模糊轨=语义召回） · I5 Participant 为连续性主键。违反任一 = 跑偏，非优化 |
| 记忆引擎 | memory_search 支持 source: memory + sessions，向量检索 + FTS trigram + hybrid |
| 用户画像 | SQLite 持久化，双路径更新（heuristic + LLM 提炼），identity 空对象不触发变更 |
| 工具注册四层 | L1(allTools) → L2(pi-tools.ts) → L3(tool-catalog.ts) → L4(elynx.json)，四层必须一致 |
| 上下文压缩 | 三层压缩链：snipDeadMessages → microcompact → autoCompactMessages，阈值 80k-90k |
| 注入预算 | B2-B5 注入量计入压缩触发阈值，杜绝"注入→爆窗→压缩→丢注入"反身性空转；预算随模型窗口按比例缩放（PLAN-09 P1 接入运行时） |
| KV-cache 锚点 | B0-B2 构成稳定前缀，B3/B4/B5 append 到 effectivePrompt 末尾（锚点之后），易变内容不能出现在稳定内容之前 |

### 7.2 Schema 位置  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`elynx/src/session-rotation/conversation-types.ts`、`elynx/src/session-rotation/handoff-types.ts`、`elynx/src/user-model/`


## 8. 日志与可观测性  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`elynx logs`、`~/.elynx/` 日志文件
> 快速命令：`elynx status`、`elynx logs --tail 100`


## 9. 外部依赖  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`~/.elynx/elynx.json` providers 段
> 关键依赖：OpenRouter（主 provider）、阿里云 Bailian/DashScope、DeepSeek、智谱


## 10. 快速启动  [derivable]
> [derivable — CLI‑LEAN 下按需现生，见 ENGINE_MAP §0]
> 现生来源：`deploy.sh`、`package.json` scripts
> 快速命令：
> ```bash
> cd ~/pi-mono && pnpm run build    # 构建框架层 3 包（tui → ai → agent）
> cd ~/pi-mono && ./deploy.sh      # 一键部署
> elynx gateway restart        # 重启 Gateway
> ```


## 11. 认知架构全景  [irreducible]
> 统合审定 2026-06-09（第二次）：认知架构 = **3 个正交子系统 + 1 个连接层 + 1 个身份层**。**PLAN-13（accepted）为子系统①+连接层⑤的唯一权威设计**，合并重写 PLAN-09/12。PLAN-09 已落地实现保留（IndexNode/HardEdge/traverseGraph/图谱表/computeInjectionBudget/B3 append），PLAN-13 在其上续建。本节是常驻总图，任何认知架构改动先对齐本图；细节见各 PLAN。

### 11.1 子系统分解

| # | 子系统 | 职责 | 权威 plan | 状态 |
|---|--------|------|-----------|------|
| ① | **上下文与事件记忆** | 四层缓存(Pin/T0-T3)+seal 单动作+动态滑动窗口+三档压缩(C1/C2/C3)+统一预算 | PLAN-13 (accepted) | M0-M9 迁移链已派生(TASK-12~TASK-21)，M0 待启动；PLAN-09 P0/P1 已落地部署 |
| ② | **记忆与世界模型** | 语义记忆引擎(向量+FTS+hybrid) + World Model 数字孪生 + CONSOLIDATE | PLAN-03 | Phase1 ✅ / Phase2 待启 |
| ③ | **知识库与自我进化** | 输入分类 + 用户画像 + 技能进化 + 索引化注入范式 | PLAN-04 | 分类/画像 ✅ / 进化 PROPOSAL |
| ⑤ | **认知工作集连接层** | 忆匣=单 task 惰性分组 + T2 归档体 + archiveRef 解引用 + C3 元压缩 session 节点 | PLAN-13 (accepted) | 合并入①统一设计，不再独立存在 |
| ④ | **身份与协作** | Participant 主键 + L0/L1/L3/L4 + 决策 D1-D10 | PLAN-08 (L0/L1/L3/L4) | 设计锁定，待落地 |

**被取代的草案地质层**：PLAN-01（注入分层 → 并入①）· PLAN-02（会话轮换 → 废弃，TaskSegment/压缩并入①）· PLAN-08 L2（轮换 → 被①重设计）· PLAN-09（事件记忆 → 被 PLAN-13 取代，已落地实现保留）· PLAN-12（忆匣 → 被 PLAN-13 取代，memory-box-store.ts 保留为 T2 body 存储）。superseded plan 保留作历史依据，NEVER 据此动代码。

### 11.2 数据流全景

```
┌──── 输入：永不中断的事件流（绑 participant_id ④，私聊/群/跨渠道统一）────┐
│                                                                          │
用户/agent 消息 ─→ [③ 输入分类器] ─┬─ task ──────────→ [① 控制流边界: task段]
                                   │   (分类器不判边界,只分流)   不再每回合开闭段
                                   ├─ chat/affective ─→ [③ 用户画像流]
                                   └─ meta ──────────→ [③ 偏好/规则]
                                                             │ seal 封口（① 控制流判定）
                                                             ▼
                                                   ┌─ CONSOLIDATE 沉淀 ─┐
                          ┌────────────────────────┼────────────────────┼─────────────┐
                          ▼                         ▼                    ▼             │
                  ② 语义记忆引擎            ② World Model        ③ 用户画像/技能       │
                  (向量+FTS+hybrid)         (数字孪生+7 probes)   (SQLite)            │
                          │                         │                    │             │
                          └──────── 索引化注入回认知（① Pin+B3-B5）──────┘             │
                                                    ▼                                  │
  Pin: B0 IDENTITY · B1 CAPABILITY · B2 ENVIRONMENT(②World Model 摘要)                 │
  ══════════════════ CACHE ANCHOR（前缀缓存断点）══════════════════                     │
  [recent K turns 原始消息]  ← recency 锚（滑动窗口保留区）                            │
  effectivePrompt 末尾 append：B3 INDEX HEADS(① T1 索引头,只增 I2, C3元压缩可聚合)     │
                              B4 ACTIVE TASK(① T0 工作集,当前任务完整体,替换 I1)         │
                              B5 RECALL(② T3 语义召回 + ①图遍历)                        │
                                                    ▼                                  │
        模型在 active task 工作空间继续（I1 单任务 · I3 窗口透明）─────────────────────┘
                                  （seal → T0→T1降级→T2归档 → 回到 CONSOLIDATE，闭环）

  四层缓存 + seal 单动作（PLAN-13 核心模型）:
    Pin  B0-B2        全保真 · 永驻前缀 · KV-cache 锚点
    T0   B4 active    全保真 · 在窗口 · 整体可替换
    T1   B3 索引头    有损摘要 · 在窗口尾部 · 只增(I2)
    T2   忆匣 body   全保真 · 窗口外 · archiveRef 取回(I6)
    T3   B5 语义      模糊 · 窗口外 · 召回入窗
    seal = T0→T1降级 + T2写穿 + 图谱硬边 + 滑动(移除老raw)
```

### 11.3 子系统接口契约（统合关键 — 改任一接口需同步对侧 plan）

| 接口 | 提供方 | 消费方 | 内容 |
|------|--------|--------|------|
| B2 注入源 | ② World Model | ① Pin B2 | 机器现状紧凑摘要（服务/端口/磁盘/版本），慢变 |
| T3 / B5 召回底座 | ② src/memory | ① B5 | 向量近邻 top-k；软边查询时动态生成，**绝不入库**（D4） |
| CONSOLIDATE 时机 | ① seal（§2.1 控制流） | ②③ | seal 信号 → ② 写记忆 + ③ 更新画像/固化技能 |
| 输入分流 | ③ 输入分类器 | 画像流 | **只分流 chat/affective/meta**，不判 task 边界（PLAN-13 §2.1） |
| 索引化注入策略 | ③ | ① B5 | 索引为主 + 强相关预取（score 分级，避免多轮往返） |
| 身份主键 | ④ participant_id | ①②③ | 所有连续线、记忆、画像的归属键（I5） |

### 11.4 不可推翻的不变式（跨子系统，违反即跑偏）

**I1** 工作空间单任务 · **I2** 索引只增 · **I3** 窗口对模型透明 · **I4** 双形态延续（精确轨=索引头+硬边图遍历，模糊轨=语义召回；模糊轨绝不单独承载精确任务状态）· **I5** Participant 为连续性主键 · **I6** 忆匣自包含（sealed task 可由 archiveRef 完整解引用）。

**单路径原则**：任一数据任一时刻仅一条读写路径。B3 注入不得同时走 dual-track 和 IndexNode（PLAN-13 M2 统一为单路径）。

**本项目反复踩的陷阱（同构，必防）**：① "模块+测试齐全 ≠ 完成"，完成定义 = 生产路径实跑 + 端到端验证；② 死代码伪装成功能（executeRotation）；③ 声明性文档乐观偏差，见 ✅ 先 grep 生产调用者；④ 断言冒充检查（安全判据必须真求值）。详见 PITFALLS #85/#91-94。
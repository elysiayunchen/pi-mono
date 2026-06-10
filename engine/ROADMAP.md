# ROADMAP — Elynyx
> 当前版本：认知架构演进中期 → 解耦与自治期 | Last updated: 2026-06-10


## 方向总纲（2026-06-10 架构评审定调，PLAN-15~19 矩阵）
> 本节是 PLAN-15~19 时代的执行原则，与里程碑正交。维护者已授权按此主导方向。

1. **两条线并行，线内严格串行**：认知主线 PLAN-15 → 16 → 17（S0 没绿不动 S4，P1 没绿不动 D2）；体验线 PLAN-18/19 零硬前置，随时插入。最忌两个任务并行改同一个 attempt.ts。
2. **AC 合同制派活**：派任务必须在 task prompt 中引用对应 plan 的 AC 编号，收活只认 AC 证据（PITFALLS #85 的制度化）。
3. **里程碑打 git tag**（s1-done / s7-done / p16-p1-done…）：solo 维护无 staging，tag 即安全网，回滚粒度从 commit 升到里程碑。
4. **eval 基线产物入库**：S0 之后所有 eval 指标 JSON commit 进 `engine/eval-baselines/`，漂移可 diff 可追溯。
5. **PITFALLS 以清空为荣**：能转 guardrail test / lint 规则 / 启动校验的条目，转一条划掉一条（PLAN-15 S6）。
6. **安全先于自治**：PLAN-08 L3/L4 安全层必须排在 PLAN-17 D3（技能固化，自主性最强的一步）之前落地——能力增长不得快于约束。
7. **护城河是认知深度，不是功能广度**：见"明确不做的事"新增三条。


## 完成定义 (v1.0)
1. ✅ 12 层 Agent 框架全部竣工（s01-s12.1）
2. ✅ P 系列补丁全部完成（P1-A/B/C, P2-A/B/D, P3-A/B）
3. ✅ Tool Parity 达到 80%+（15/17 = 88.2%）
4. ✅ 记忆引擎激活（TS memory_search + RECALL 注入）
5. ✅ 序 1-7 统一实施全部完成（分层注入 + 压缩可见性 + 全流式 + 工具驱逐 + 注入预算 + 输入分类 + 用户画像）
6. 🔄 序 8 事件记忆与认知索引架构（PLAN-09 统合，P0 ✅，P1 ✅，P0+P1 已部署 ✅，P2-P3 待实施）
7. 🔄 序 8.5 忆匣统一记忆系统（PLAN-12，P0 ✅，P1-P3 待实施）
8. [ ] 序 9-12 认知架构闭环（元压缩 → 图遍历检索 → 技能进化 → World Model）
9. [ ] Tool Parity 100%（Task 15/16 完成）
10. [ ] 参与者持续性架构落地（W0-W5，L0/L1/L3/L4）
11. [ ] 端到端生产验证全部通过


## 里程碑地图
| ID | 里程碑 | 状态 | 目标时间 |
|----|--------|------|---------|
| M1 | 12 层 Agent 框架竣工 | ✅ 完成 | 2026-04 |
| M2 | 记忆引擎激活 | ✅ 完成 | 2026-06-06 |
| M3 | 认知架构序 1-7 完成 | ✅ 完成 | 2026-06-07 |
| M4 | 认知工作集闭环（PLAN-13） | 🔄 进行中 | 2026-06 |
| M5 | Tool Parity 100% | 📋 计划中 | 2026-06/07 |
| M6 | World Model 数字孪生 | 📋 计划中 | 2026-07 |
| M7 | 参与者持续性 v1 | 📋 计划中 | 2026-07/08 |
| M8 | 资产-躯壳解耦（PLAN-15 S0-S7：eval 护栏+拔patch+注册单源+渠道冻结+cognition 模块+事件脊椎+汇入） | 📋 已定调（accepted） | 2026-06/07 |
| M9 | 记忆宫殿（PLAN-16 P1-P4：准入+驱逐+分形地图+宫殿工具） | 📋 已定调（accepted） | 2026-07 |
| M10 | 睡眠周期（PLAN-17 D1-D4：体检+整理+固化+预热，维护者已采纳） | 📋 已定调（accepted） | 2026-07 |
| M11 | 体验线：全双工对话 + 存在与心跳（PLAN-18 F1-F3 / PLAN-19 H1-H4） | 📋 已定调（accepted），H1/H2 最先行 | 2026-06 起随时 |


## 里程碑详情

### M4: 认知工作集闭环（PLAN-13，取代 PLAN-09）
- **目标：** 废除会话轮换，实现认知工作集架构——固定上下文窗口 = 工作集缓存，四层缓存(T0-T3)+seal 单动作+task=控制流边界+忆匣=单task惰性分组+动态滑动窗口+autoCompact seal-aware+元压缩
- **关键交付物：** ~~B3/B4/B5注入方向修正 + 轮换机制废弃~~ ✅ + ~~预算器接入 + TaskSegment封口产生IndexNode + 认知图谱表~~ ✅ + M0(task≠turn) + M1(C2头模型写) + M2(B3单路径) + M3(删dual-track) + M4(滑动窗口) + M5(autoCompact seal-aware) + M6(统一阈值) + M7(元压缩) + M8(命名收尾) + M9(端到端验证)
- **成功指标：** 多步任务封口后索引头正确注入B3，新任务替换B4，RECALL能搜到已归档内容，元压缩在B3膨胀时触发，autoCompact常见情况零LLM调用
- **已知风险：** 模型不可用阻塞端到端验证；M5框架层monkey-patch风险；M0休止判定需实测调优
- **设计文档：** PLAN-13（认知工作集架构，取代 PLAN-09/12）
- **进度：** PLAN-09 P0 ✅ P1 ✅ 已部署 ✅ → PLAN-13 审核通过，M0-M9 待实施

### M5: Tool Parity 100%
- **目标：** 工具链完整对标 Claude Code
- **关键交付物：** ~~AskUserQuestionTool (Task 14)~~ ✅ + MCP 协议集成 (Task 15) + 并行执行引擎 (Task 16)
- **成功指标：** 17/17 工具全部完成并生产验证
- **已知风险：** Task 15/16 为大工程，可能需要数周

### M6: World Model 数字孪生
- **目标：** 机器环境感知 + 操作记忆 + 经验沉淀
- **关键交付物：** 7 probes 环境快照 + World Model SQLite + 变更检测 + 自动沉淀
- **成功指标：** agent 随时知道机器状态（服务/端口/磁盘/版本）
- **已知风险：** 依赖序 8 闭环 + 模型可用

### M7: 参与者持续性 v1
- **目标：** 认知图谱 + 身份/会话 + 协作/安全
- **关键交付物：** 认知图谱一期 + 参与者身份绑定 + Mirror Lane + 协作门控
- **成功指标：** 多参与者场景下 agent 区分不同用户、保持上下文独立
- **已知风险：** 复杂度高，需迭代交付


## 功能积压
### Tool Parity
- [FB-01] ~~AskUserQuestionTool (Task 14)~~ ✅ — 优先级：中
- [FB-02] MCP 协议集成 (Task 15) — 优先级：中
- [FB-03] 并行执行引擎 (Task 16) — 优先级：中

### 架构深化
- [FB-04] attempt.ts 拆分重构 — 优先级：中（PLAN-09 P0已完成，可启动）
- [FB-05] ~~注入预算器升级（接入运行时）~~ ✅ — 优先级：高（PLAN-09 P1，已完成）
- [FB-06] ~~TaskSegment封口产生IndexNode+硬边~~ ✅ — 优先级：高（PLAN-09 P1，已完成）

### 扩展
- [FB-07] Worktree → Auto PR/Merge (P2-C) — 优先级：低
- [FB-08] Swarm 并发 Worktree 调度器 (P4-A) — 优先级：低
- [FB-09] LSP Tool — 优先级：低（探索性）

### 种子积压（2026-06-10 架构评审，未立 plan，时机到再 INGEST）
- [FB-10] **Agent 自我模型** — 睡眠周期体检班的 vitals 数据积累后，让 agent 拥有对自身能力边界的模型（擅长/常败），注入 B1 CAPABILITY 带，路由决策有据可依。成本近零（数据是 PLAN-17 副产品）。前置：PLAN-17 D1 跑满 ~2 周
- [FB-11] **双脑容灾** — dead-man 接收端落在第二台廉价 VPS 时，顺手放冷备最小 agent（只读宫殿副本 + Telegram 接管），主机死透时能报告最后状态。前置：PLAN-19 H3 选型自建路线
- [FB-12] **C4 epoch 聚合接口预留** — PLAN-16 溢出阶梯第 4 级，session 盒超预算时聚合为 epoch 盒（PLAN-16 P4 已含最小实现，此条跟踪后续演进）


## 已知的未来破坏性变更
- ~~PLAN-09 P0：轮换机制废弃（rotation-controller/auto-trigger/rotate-session-tool删除），B3/B4/B5注入方向改为append~~ ✅ 已完成（2026-06-08）
- ~~PLAN-09 P1：conversation-store增加edges表，TaskSegment封口逻辑改造~~ ✅ 已完成（2026-06-08）
- ~~PLAN-09 P0/P1 部署至生产环境~~ ✅ 已完成（2026-06-09，deploy.sh 5 guards 全部通过）
- PLAN-12 P1：TaskGroup→忆匣转化，task-segment-tracker 需增加 group 管理，attempt.ts B3/B4/B5 需适配忆匣边界
- PLAN-12 P3：conversation-store 简化，session JSONL 降级为调试备份
- **PLAN-13 M0：task 边界从 turn 改为控制流**，startSegment 不再每回合开闭，sealSegment 加休止判定（isQuiescent 含 pending_approval），消息 metadata 加 segmentId
- **PLAN-13 M2/M3：B3 单路径 + 删 dual-track**，resolveIndexHeadBlockForSession 删除，dual-track-index.ts 整文件删除，DB 删 macro/micro 列
- **PLAN-13 M4：动态滑动窗口**，seal 后裁剪老 raw 消息，recency 锚与 computeInjectionBudget keep-recent 统一
- **PLAN-13 M5：autoCompact 改造为 seal-aware**，框架层 auto-compact.ts + sdk.ts transformContext 闭包改造，新增 getSealedTaskIds 回调
- **PLAN-13 M6：统一预算阈值**，80k/90k 硬编码替换为 W×compact_ratio 动态计算
- **PLAN-13 M8：命名收尾**，session-rotation/ → cognitive-memory/，handoff-* → cognitive-* / index-head-*
- attempt.ts 拆分重构：将 2861+ 行拆为 3 个文件，需要仔细迁移
- 参与者持续性架构：可能改变 session 管理模型，从 chat/session 到 participant 绑定
- World Model 注入：B2 层新增环境快照注入，可能影响 KV-cache 布局
- **PLAN-15 S1：patch-agent.cjs 删除**，setSystemPrompt/replaceMessages 写入 packages/agent 源码，deploy.sh 删 Step 3/7 + Guard 2 重定义
- **PLAN-15 S7：pi-mono 汇入**，packages/{agent,ai,tui} → elysiaclaw/src/framework/，根 workspace 收敛，import 全量重写（codemod）
- **PLAN-15 S5：事件溯源脊椎**，cognitive_events 表成为唯一写路径，现有 store 降级为投影，限时双写迁移窗口
- **PLAN-16 P1：IndexNode schema 扩展**（salience/kind/pinned/touches/lastTouchedSeq）+ B3 过滤改评分驱逐制
- **PLAN-18 F1：Telegram 入站改 debounce + steering 队列**，弃用阻塞式排队


## 明确不做的事
- 与上游 Elynyx 同步（独立维护，不再合并上游）
- 重建 Python 记忆系统（TS 引擎已取代）
- 恢复 Code Mode（已由 delegate_code_task 取代）
- 多语言支持（专注中文 + English 双语）
- 多 agent 内阁/评审委员会 — 与"单循环极简"底色冲突，复杂度收益比为负（2026-06-10）
- 插件生态化/市场化 — solo 维护无生态需求（2026-06-10）
- 新增渠道（中期内） — 渠道全冻结于 extensions/，护城河是认知深度不是功能广度（2026-06-10，PLAN-15 R1①）
- 删除任何已冻结渠道代码 — 冻结可逆，删除不可逆（维护者决策 2026-06-10）
# SPRINT — ElysiaClaw
> 开始日期：2026-06-07 | 状态：进行中


## 冲刺参数
| 参数 | 值 |
|------|-----|
| 冲刺开始 | 2026-06-07 |
| 冲刺结束 | TBD |
| 重点 | v5 引擎文件系统规范化 + 核心功能端到端验证 |


## 归档索引
所有已完成 Sprint 的完整记录保留在 `engine/archive/sprint-history.md`。

| # | Sprint 名称 | 日期 | 关键产出 |
|---|---|---|---|
| 1 | 流式输出修复 — Tool Lane 流式 + Reasoning | 2026-06-07 | toolcall 事件处理 + reasoning 默认 stream |
| 2 | 序 8 深度审查 + 接线断链修复 | 2026-06-07 | executeRotation 死代码修复(#91-94) + AgentTool 契约修复 |
| 3 | 早期工具落地测试落实 — Tool Parity Task 1/2 | 2026-06-07 | 25 新测试 + grep 排序代码异味归档 |
| 4 | 序 1-7 健全性审核 + 用户画像写路径闭环 | 2026-06-07 | ingestUserMessage 写路径 + Pitfall #77 |
| 5 | 序 1-7 测试加固 + Bug 修复 | 2026-06-07 | 77 新测试 + Pitfall #73-75 |
| 6 | BashTool Parity + GrepTool Regression Fix | 2026-04-10 | Task 2 BashTool + GrepTool slicedOutput 修复 |
| 7 | Task 1: GrepTool 参数补全 | 2026-04-10 | count 模式 + mtime 排序 + 能力声明 |
| 8 | Tool Parity Sprint — Task 0 + 预存测试修复 | 2026-04-10 | ToolDefinition 11 字段扩展 + type re-export 修复 |
| 9 | Architecture Audit Sprint | 2026-04-09 | 四层注册发现 + 工具缺口映射 |
| 10 | delegate_code_task 子代理分发工具实施 | 2026-06-05 | delegate_code_task 工具 + Code Mode 清理 |
| 11 | 记忆引擎激活（RUNBOOK T1-T6） | 2026-06-06 | TS memory_search 取代 Python session_search |
| 12 | deploy.sh 增强 + dist 部署根因修复 | 2026-06-06 | clean-slate deploy + extensions sync + E2E 验证 |
| 13 | Telegram 工具调用流式输出 | 2026-06-06 | Tool Lane + onToolStart/onToolResult |
| 14 | 跨会话记忆系统（Python session_search） | 2026-06-06 | ⚠️ 已被 TS memory_search 取代 |
| 15 | tsgo 全仓类型检查 53→0 清零 | 2026-06-07 | 7 类错误修复 + Pitfall #86 |
| 16 | 引擎设计审查 + 文档状态校正 | 2026-06-07 | 三级完成标注标准 + 9 文件修正 |
| 17 | 架构优化 Sprint | 2026-04-05 | BUG-1~4 修复 + deploy.sh 守卫 |
| 18 | Code Mode Phase 0 最小可行补丁 | 2026-04-05 | attempt.ts /code /exit 检测 |
| 19 | 流式输出修复 — blockStreamingDefault 错误抑制 | 2026-06-08 | 根因定位 + 配置修复 + 端到端验证 |


## 优先级栈
1. [TASK-01] 序 8 阶段 5 端到端验证 — 会话轮换全流程生产验证，需可用模型
2. [TASK-02] Tool Parity Task 14: AskUserQuestionTool — Telegram inline keyboard 交互
3. [TASK-03] attempt.ts 拆分重构 — 拆为 system-prompt-builder.ts + injection-coordinator.ts + rotation-trigger.ts
4. [TASK-04] CONSOLIDATE 回写接线 — 修复 executeRotation 死代码，接入生产路径
5. [TASK-05] 注入预算器升级 — 接入运行时，随 1M 窗口缩放


## 任务详情


### TASK-01: 序 8 阶段 5 端到端验证
- **用户可见的变化：** 会话轮换功能在生产环境可用，任务跨 session 延续不丢失
- **完成标准：** 
  1. 部署后跑出首条 conversation db
  2. rotate_session 工具在生产环境成功调用
  3. B3 Handoff 注入 + B4 RECALL 在新会话中正常工作
  4. Task Segment 追踪从 plan→todo→review→recall 全流程闭环
- **验证方法：** verify → PLAN-02.spec:AC-5~AC-8
- **约束：** 不能影响现有 session 数据；不能破坏 gateway 稳定性
- **起点：** `elysiaclaw/src/session-rotation/` → `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`
- **前置依赖：** 可用模型（当前阻塞）
- **风险：** 模型不可用导致无法验证；轮换逻辑可能影响现有 session 管理


### TASK-02: Tool Parity Task 14: AskUserQuestionTool
- **用户可见的变化：** Agent 在需要用户决策时通过 Telegram inline keyboard 询问，用户点击按钮回复
- **完成标准：** agent 能发起问题、渲染 inline keyboard、接收用户选择并继续执行
- **验证方法：** verify → PLAN-07.spec:AC-14
- **约束：** 不能影响现有 Telegram 消息处理流程
- **起点：** `elysiaclaw/src/telegram/` → `elysiaclaw/src/agents/tools/`
- **前置依赖：** 无（纯应用层工具，不依赖模型）
- **风险：** inline keyboard callback 处理需要新增 Telegram update handler


### TASK-03: attempt.ts 拆分重构
- **用户可见的变化：** 无直接用户可见变化，但代码可维护性大幅提升
- **完成标准：**
  1. `attempt.ts` 拆分为 3 个文件：system-prompt-builder.ts / injection-coordinator.ts / rotation-trigger.ts
  2. 所有现有测试通过
  3. 类型检查零错误
  4. 生产部署后功能无回归
- **验证方法：** `npm run check` + `npm test` + deploy.sh 后 E2E 验证
- **约束：** 不能改变任何外部行为；不能破坏现有 API 契约
- **起点：** `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`（2861+ 行）
- **前置依赖：** 无（纯重构）
- **风险：** 大文件拆分容易引入回归；需要充分的测试覆盖


### TASK-04: CONSOLIDATE 回写接线
- **用户可见的变化：** 会话轮换时正确沉淀任务状态到记忆引擎
- **完成标准：**
  1. executeRotation 接入生产调用路径
  2. MacroIndex 真实构建并存储（修复 PITFALLS #91/#92）
  3. 自动轮换安全点运行时真检查（修复 PITFALLS #93）
- **验证方法：** verify → PLAN-02.spec:AC-3, PLAN-08.spec:AC-1~AC-3
- **约束：** 不能影响现有 session 管理
- **起点：** `elysiaclaw/src/session-rotation/rotation-controller.ts` → `attempt.ts`
- **前置依赖：** TASK-01（端到端验证）为先决条件
- **风险：** 涉及 session 生命周期，出错可能导致数据丢失


### TASK-05: 注入预算器升级
- **用户可见的变化：** 上下文利用率提升，减少不必要的压缩
- **完成标准：**
  1. `computeInjectionBudget` 接入运行时，替换硬编码阈值
  2. 注入预算随 1M 窗口缩放
  3. B2/B3/B4 按配置比例分配
- **验证方法：** verify → PLAN-01.spec:AC-5
- **约束：** 不能降低现有压缩效果
- **起点：** `elysiaclaw/src/context-engine/` → `packages/coding-agent/src/core/sdk.ts`
- **前置依赖：** 无（纯逻辑增强）
- **风险：** 预算参数选择不当可能导致过早或过晚压缩


## 阻塞中的任务
- TASK-01：阻塞于主模型不可用（OpenRouter owl-alpha 不可用）


## 本冲刺不做的事
- World Model Phase 2（PLAN-03）— 等待序 8 闭环
- 技能进化 Skill Evolution（PLAN-04）— 等待 World Model
- MCP 协议集成（Tool Parity Task 15）— 大工程，排在 Task 14 之后
- 并行执行引擎（Tool Parity Task 16）— 大工程，最后做
- 参与者持续性 W1-W5（PLAN-08）— 等待 W0 闭环
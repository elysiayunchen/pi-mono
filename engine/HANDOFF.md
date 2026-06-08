# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-08 | 会话：3（PLAN-09 P1 实施）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "从这里开始：执行 PLAN-09 P2（元压缩 + 图遍历检索）或 TASK-03（AskUserQuestionTool）。P1 已完成：computeInjectionBudget 接入运行时（按窗口比例缩放阈值），TaskSegment 封口产生 IndexNode + 硬边写入 conversation-store，B3 注入从认知图谱读 IndexNode，conversation-store 新增 index_nodes + edges 表。验证靠 `npm run check`。"
> 入口：`elysiaclaw/src/session-rotation/`（图谱核心）、`elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`（注入管线）。设计权威：`engine/plans/PLAN-09.md`。


## 本次会话总结
### ✅ 完成内容
* PLAN-09 P1 全部完成（TASK-02）：
  - `handoff-types.ts`：新增 IndexNode / HardEdge / NodeGrain / EdgeType 类型
  - `conversation-store.ts`：新增 index_nodes + edges SQLite 表 + CRUD（insertIndexNode, getIndexNodesByConversation, insertEdge, getEdgesFrom/To, traverseGraph）
  - `task-segment-tracker.ts`：封口时产生 IndexNode（grain=task）+ temporal/produces 硬边，通过 onSeal 回调写入 conversation-store
  - `injection-budget.ts`：computeInjectionBudget 接入 attempt.ts 运行时，替代硬编码 estimateTextTokens 基线扣减
  - `handoff-inject.ts`：新增 formatIndexNodesForInjection，B3 注入从 conversation-store 读 IndexNode
  - `attempt.ts`：tracker 创建传入 conversationId + onSeal 回调；B3 注入增加认知图谱 IndexNode 来源
  - `index.ts`：导出新类型和函数
  - `npm run check` 499 文件零错误
### ⚙️ 实现方式
* 按 PLAN-09 spec AC-3~AC-6 逐项实现
* tracker 通过 SealCallback 解耦，不直接依赖 conversation-store
* conversation-store schema 变更用 CREATE TABLE IF NOT EXISTS 幂等
* IndexNode 产生在 sealSegment 内部，onSeal 回调失败不阻塞封口
### 🔜 建议下一步
* TASK-03（AskUserQuestionTool — Telegram inline keyboard）
* 或 TASK-04（attempt.ts 拆分重构）
* 或 TASK-05（PLAN-09 P2：元压缩 + 图遍历检索）


## 本次会话中的决策
| 决策 | 选择 | 放弃 | 原因 |
|------|------|------|------|
| tracker→store 耦合方式 | SealCallback 回调 | tracker 直接 import store | 解耦：tracker 不依赖 SQLite |
| IndexNode 产生时机 | sealSegment 内部 | attempt.ts 封口后手动调用 | 封口是原子操作，节点应同步产生 |
| 预算器接入方式 | 替换 estimateTextTokens | 保留双轨 | computeInjectionBudget 已充分测试，单轨更清晰 |
| B3 IndexNode 来源 | 追加到 b3Blocks | 替换 dual-track index | 双轨互补：flat index + graph nodes |


## 进行中的工作
### 当前任务：PLAN-09 P1 已完成 → 下一步 TASK-03 或 TASK-05
- **状态：** P1 代码改动已完成，npm run check 零错误
- **下一步操作：** 见 ⚡立即恢复点
- **开始前需阅读的文件：** `engine/plans/PLAN-09.md`、`engine/SPRINT.md` TASK-03/05 详情


## 上下文漂移警告
- ⚠️ **`engine/plans/` 被 `.gitignore` 第 37 行忽略** —— PLAN-*.md 的统合改动在磁盘生效但未入 git
- conversation-store.db 新增 index_nodes + edges 表，已有数据库会自动 CREATE IF NOT EXISTS


## 会话历史
| 会话 | 日期 | 关键变更 |
|------|------|---------|
| 1 | 2026-06-08 | 引擎文件 v5 深度重构：迁移至 engine/，创建 ENGINE_MAP + 8 文件 + 8 plan 登记 |
| 2 | 2026-06-08 | 认知架构设计统合审定：PLAN-09 升 accepted 取代 01/02/08，PLAN-03/04 标正交子系统 |
| 3 | 2026-06-08 | PLAN-09 P1 实施：IndexNode/HardEdge 类型 + conversation-store 图谱表 + tracker onSeal + computeInjectionBudget 接入 + B3 图谱注入 |


## 引擎文件变更摘要
| 文件 | 变更类型 | 变更内容 | 原因 |
|------|---------|---------|------|
| engine/HANDOFF.md | 更新 | 会话3：P1完成记录 | 反映代码变更 |
| engine/CONTEXT.md | 更新 | 状态面板+已知不稳定项更新 | 反映P1完成 |
| engine/SPRINT.md | 更新 | TASK-02标记完成 | 反映进度 |
| elysiaclaw/src/session-rotation/handoff-types.ts | 修改 | 新增 IndexNode/HardEdge/NodeGrain/EdgeType 类型 | PLAN-09 P1 认知图谱 |
| elysiaclaw/src/session-rotation/conversation-store.ts | 修改 | 新增 index_nodes + edges 表 + CRUD + traverseGraph | PLAN-09 P1 图谱持久化 |
| elysiaclaw/src/session-rotation/task-segment-tracker.ts | 修改 | SealCallback + onSeal + buildIndexNodeSummary | PLAN-09 P1 封口产生节点 |
| elysiaclaw/src/session-rotation/handoff-inject.ts | 修改 | formatIndexNodesForInjection | PLAN-09 P1 B3图谱注入 |
| elysiaclaw/src/session-rotation/index.ts | 修改 | 导出新类型和函数 | PLAN-09 P1 公开API |
| elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts | 修改 | computeInjectionBudget接入 + onSeal回调 + B3图谱注入 | PLAN-09 P1 运行时接线 |


## 交接检查清单
- [x] 恢复点足够具体，能立即行动
- [x] 所有修改过的文件已列出
- [x] 待解决问题已记录
- [x] 新发现的陷阱已记录到 PITFALLS.md（本次无新陷阱）
- [x] 上下文漂移警告已标注
- [x] 会话历史表已更新
- [x] ENGINE_MAP 已更新（revision / 关系图）
- [x] 引擎文件变更摘要已输出
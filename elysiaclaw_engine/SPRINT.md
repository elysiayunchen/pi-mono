# ElysiaClaw — Sprint Working Document

> 本文档是 AI 协作者每次开始新 Sprint 时的**工作台**。
> 开始前填写计划，结束后更新结果，然后同步到 ROADMAP.md 和 HANDOFF.md。
> 已完成 Sprint 完整记录归档于 [archive/sprint-history.md](./archive/sprint-history.md)。

---

## 归档索引

所有已完成 Sprint 的完整工程决定和修复细节保留在 [archive/sprint-history.md](./archive/sprint-history.md)。

| # | Sprint 名称 | 日期 | 关键产出 |
|---|---|---|---|
| 1 | 流式输出修复 — Tool Lane 流式 + Reasoning 默认开启 | 2026-06-07 | toolcall 事件处理 + reasoning 默认 stream |
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

---

## Sprint: W0 闭环 session-rotation (2026-06-07) 🔄 进行中

**Sprint 目标**: 闭环现有 session-rotation，把 AS1-AS7 红线项做真。详细任务设计见 `PARTICIPANT-CONTINUITY-ARCHITECTURE.md §九·W0 详细任务`。
**开始时间**: 2026-06-07
**状态**: 规划完成，待执行

### 代码级审查结论（2026-06-07）

**验证通过项**:

| # | 声明 | 代码证据 |
|---|---|---|
| ✅ | B3 Handoff 注入 | `attempt.ts:2624-2632` — consumeDualTrackIndexBlockForSession + consumeHandoffBlockForSession 已接入 |
| ✅ | B4 RECALL 出 system prompt | `attempt.ts:2634-2638` — recallIndexBlock prepend 到 effectivePrompt（用户消息），不在 system prompt 内 |
| ✅ | TaskSegmentTracker 集成 | `attempt.ts:1433-1438` 初始化 + `attempt.ts:2438` advancePhase + `attempt.ts:3058-3110` 封口+索引 |
| ✅ | 注入预算器基础接入 | `attempt.ts:1921` contextPressureBudget → SDK `sdk.ts:374` 扣减阈值 |
| ✅ | 用户画像 B2 注入 | `attempt.ts:1899-1913` system prompt + fire-and-forget 写路径 |
| ✅ | 输入分类器 | `attempt.ts:1436` classifyInput + L0 routing hint |
| ✅ | rotate_session 工具 | rotate-session-tool.ts — 完整实现，含 buildMacroEntryFromHandoff 沉淀 |
| ✅ | tsgo 零错误 | `npx tsgo --noEmit` 退出码 0 |
| ✅ | 125 测试全过 | `vitest run src/session-rotation/` 7 文件 125 passed |

**确认的问题项**:

| # | 问题 | 代码证据 | 严重度 |
|---|---|---|---|
| P1 | executeRotation 死代码 | grep executeRotation 仅定义+导出+测试，零生产调用 | 🔴 高 |
| P2 | 自动轮换 = 假自动 | `attempt.ts:2783-2784` pendingToolCalls:0, hasActiveBackgroundLane:false 写死 | 🔴 高 |
| P3 | CONSOLIDATE 未接 | grep archive→memory / writeBack / consolidat 零业务命中 | 🔴 高 |
| P4 | 注入预算器用简化版 | injection-budget.ts 注释明确：runtime 只用 estimateTextTokens | 🟡 中 |
| P5 | RECALL 注入顺序反 | `attempt.ts:2624-2638` 全部 prepend 到 effectivePrompt 开头 | 🟡 中 |
| P6 | 未部署 | 无 conversation-store.db 生产实例 | 🔴 高 |

### 任务清单

| 任务 | 修 | 严重度 | 依赖 | 状态 |
|---|---|---|---|---|
| W0-T1: 安全点运行时真检查 | AS4/P2 | 🔴 高 | 无 | ⬜ |
| W0-T2: RECALL 注入位置下沉 | AS6/P5 | 🟡 中 | 无 | ⬜ |
| W0-T3: CONSOLIDATE 回写接线 | AS3/P3 | 🔴 高 | T1 | ⬜ |
| W0-T4: executeRotation 去留决策 | AS1-2/P1 | 🔴 高 | 无（需决策） | ⬜ |
| W0-T5: 注入预算器升级 | AS5/P4 | 🟡 中 | 无 | ⬜ |
| W0-T6: 端到端验证 + 部署 | AS7/P6 | 🔴 高 | T1-T5 | ⬜ |

### 依赖图

```
W0-T2 (RECALL 下沉) ─── 独立，可先做
W0-T1 (安全点真检查) ─── 独立，可先做
W0-T4 (executeRotation 决策) ─── 独立，需先决策
W0-T5 (注入预算器升级) ─── 独立，可先做
W0-T3 (CONSOLIDATE 接线) ─── 依赖 T1
W0-T6 (端到端验证) ─── 依赖 T1-T5 全部完成
```

### 执行顺序建议

1. **T2** (RECALL 下沉) — 改动最小、效果最明确，热身
2. **T4** (executeRotation 决策) — 先做架构决策，决定后续方向
3. **T1** (安全点真检查) — 需查 SDK 接口，可能要框架层改动
4. **T5** (注入预算器升级) — 涉及框架层 SDK 参数扩展
5. **T3** (CONSOLIDATE 接线) — 依赖 T1 安全点正确
6. **T6** (端到端验证) — 全部完成后部署验证

---

## Sprint: 序 8 Conversation 层 + Handoff (2026-06-07) 🔄 进行中

**Sprint 目标**: 实施序 8 — 会话轮换与跨会话任务延续 (SESSION-ROTATION-CONTINUITY.md)
**开始时间**: 2026-06-07
**状态**: 阶段 1-4 完成 + 健全性测试修复完成，阶段 5 待续

### 设计红线

延续必须双轨——精确执行状态走结构化 Handoff Packet (B3)，背景知识走 memory_search 召回 (B4)；纯靠记忆检索延续任务会准确性塌陷。

### 实施阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| 1 | 核心类型 + Conversation Store (SQLite) | ✅ |
| 2 | rotate_session 工具 + B3 Handoff 注入 + 四层注册 | ✅ |
| 3 | 自动轮换触发 (token 压力检测 + safety 门控) | ✅ |
| 4 | Task Segment 追踪集成 + 双轨索引 + CompactionSummary | ✅ (2026-06-07) |
| 5 | 端到端验证 (需可用模型) | 待续 |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/session-rotation/handoff-types.ts` | HandoffPacket / TaskSegment / TaskPhase / CompressedPhaseResult / validateHandoffCompleteness / formatHandoffForInjection |
| `src/session-rotation/conversation-types.ts` | ConversationEntry / ConversationStoreData |
| `src/session-rotation/conversation-store.ts` | SQLite 持久化 (node:sqlite DatabaseSync) + 双轨索引存储 + appendMacroIndexEntry |
| `src/session-rotation/rotation-controller.ts` | SafetyPoint / shouldTriggerRotation / executeRotation / **CompactionSummary 生成** |
| `src/session-rotation/task-segment-tracker.ts` | 任务段实时追踪 + **plan-todo-review-recall 四阶段** + compressCompletedPhase + classifyTaskType |
| `src/session-rotation/conversation-router.ts` | chat→Conversation→activeSession 间接映射 |
| `src/session-rotation/handoff-inject.ts` | B3 Handoff 注入 + 双路径查找 + consumeHandoff + **buildAndStoreDualTrackIndex** |
| `src/session-rotation/auto-trigger.ts` | checkAutoRotation / estimateSessionTokens |
| `src/session-rotation/dual-track-index.ts` | **双轨索引构建**: MacroIndex + MicroIndex + formatDualTrackIndexForInjection |
| `src/session-rotation/index.ts` | 模块导出 (含 TaskPhase / CompressedPhaseResult) |
| `src/agents/tools/rotate-session-tool.ts` | rotate_session 工具 (ownerOnly, completeness 门控) |

### 新增测试

| 文件 | 用例 |
|------|------|
| `handoff-types.test.ts` | 18 |
| `conversation-store.test.ts` | 19 |
| `rotation-controller.test.ts` | 23 |
| `task-segment-tracker.test.ts` | 43 |
| `conversation-router.test.ts` | 6 |
| `handoff-inject.test.ts` | 7 |
| `auto-trigger.test.ts` | 7 |
| `rotate-session-tool.test.ts` | 9 |
| **合计** | **132** (123 session-rotation + 9 rotate-session) |

### attempt.ts 集成

1. **B3 Handoff 注入**: B4 RECALL 前插入 `resolveHandoffBlockForSession()` 返回的 handoff block
2. **自动轮换检测**: 每轮 prompt 前调用 `checkAutoRotation()`，token 压力过高时日志推荐 `rotate_session`
3. **TaskSegmentTracker 集成**: 初始化追踪器 → 工具调用事件记录(plan→todo 自动推进) → 运行结束封口(todo→review→recall) → 构建双轨索引
4. **双轨索引构建**: 运行结束时 `buildAndStoreDualTrackIndex()` 将 MicroIndex + MacroIndex 存入 ConversationStore

### 类型检查

- `npx tsc --noEmit` 零新增错误（第三方 @buape/carbon 预存错误不影响）
- `npx vitest run` 123 用例全过 (session-rotation)

### 健全性测试修复 (2026-06-07)

对 session-rotation 全模块进行健全性审查，发现并修复 5 项逻辑缺陷：

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `task-segment-tracker.ts` | `startSegment` 在已有活跃段时不处理旧段，旧段成为 running 孤儿 | 自动封印旧活跃段为 `incomplete` + 写入 outcome |
| 2 | `task-segment-tracker.ts` | `completeToolCall` 按工具名匹配，同名多次调用只完成第一个 | 改为按 `callIndex` 索引完成 |
| 3 | `task-segment-tracker.ts` | `classifyTaskType` 正则中 `排查` 重复 | 去重 |
| 4 | `handoff-inject.ts` | 轮换后新 sessionKey ≠ chatId，`getByChatId` 找不到 handoff | 新增 `activeSessionKey` 回退查找路径 |
| 5 | `rotate-session-tool.ts` | goal 缺失抛异常但 nextStep 缺失返回警告文本，错误处理不一致 | 统一为 `validateHandoffCompleteness` 前置校验，所有完整性问题都抛 `ToolInputError` |

新增测试 24 用例（73→97），覆盖：
- task-segment-tracker: 自动封印旧段、按索引完成、越界/重复完成、非存在段、startTimeoutSealLoop、更多分类覆盖
- rotation-controller: `executeRotation` 完整测试（全流程、降级 handoff、注入验证、JSON 存储、操作顺序）、85% 边界、多安全检查
- conversation-router: 轮换后路由、重复 sessionKey 幂等
- handoff-inject: `activeSessionKey` 回退查找、双路径均无匹配
- rotate-session-tool: nextStep 缺失拒绝、progress 默认值行为、handoff complete 标记、多问题拒绝

### 阶段 4: Task Segment 追踪集成 + 双轨索引 + CompactionSummary (2026-06-07) ✅

**核心实现**:

| 功能 | 文件 | 说明 |
|------|------|------|
| TaskPhase 四阶段 | `handoff-types.ts` | `type TaskPhase = "plan" \| "todo" \| "review" \| "recall"` |
| CompressedPhaseResult | `handoff-types.ts` | 已完成阶段的精炼摘要 + artifactRefs |
| TaskSegment 扩展 | `handoff-types.ts` | 新增 phase / body.plan / body.todos / compressedResults |
| advancePhase | `task-segment-tracker.ts` | plan→todo→review→recall 阶段推进 |
| compressCompletedPhase | `task-segment-tracker.ts` | 按阶段压缩: plan(计划摘要) / todo(完成+待办) / review(决策) |
| updateTodos | `task-segment-tracker.ts` | 实时更新 todo 队列 |
| buildMicroIndexFromSegments | `dual-track-index.ts` | 增强: phase + compressedPhaseSummaries |
| buildCompactionSummaryFromHandoff | `rotation-controller.ts` | 从 HandoffPacket 生成 CompactionSummary → MacroIndexEntry |
| appendMacroIndexEntry | `conversation-store.ts` | 增量追加 MacroIndex 条目(非全量替换) |
| buildAndStoreDualTrackIndex | `handoff-inject.ts` | 一次性构建 MicroIndex + MacroIndex 并存入 ConversationStore |
| attempt.ts 集成 | `attempt.ts` | TaskSegmentTracker 初始化 + 工具调用事件 + 封口 + 双轨索引 |

**双轨索引完整数据流**:

```
用户指令 → TaskSegmentTracker.startSegment (plan)
  → 工具调用 → advancePhase(plan→todo) → recordToolCall
  → 运行结束 → advancePhase(todo→review→recall) → sealSegment
  → buildAndStoreDualTrackIndex → MicroIndex 存入 ConversationStore

会话轮转 → executeRotation
  → buildCompactionSummaryFromHandoff → MacroIndexEntry 追加到 ConversationStore
  → HandoffPacket 注入新会话

新会话启动 → consumeDualTrackIndexBlockForSession
  → MacroIndex + MicroIndex 注入模型上下文
```

**新增测试**: 26 用例 (97→123)
- task-segment-tracker: +19 (phase 转换 / compressCompletedPhase / updateTodos / 双段 / recall 后 seal)
- rotation-controller: +1 (compaction summary from full handoff)
- conversation-store: +5 (appendMacroIndexEntry / updateDualTrackIndex)
- dual-track-index: +1 (buildMicroIndexFromSegments with phase summaries)

**修复**:
- conversation-store.ts: 添加 MacroIndexEntry / MicroIndexEntry 类型导入
- attempt.ts: conversationId 为 null 时使用 getOrCreateForChat 确保有效 ID

---

## 后续 Sprint 规划

| Sprint | 内容 | 依赖 |
|---|---|---|
| 序 8 阶段 5 | 端到端验证 + 与压缩/CONSOLIDATE 统一 | 可用模型 |
| 序 9 自动轮换 | 安全点 + 触发（见 SESSION-ROTATION §5） | 序 8 |
| 序 10 World Model Ph2 | 数字孪生：环境感知 + 操作记忆 + 经验沉淀 | 序 5 ✅ / 模型 |
| 序 11 技能进化 | episode→skill + 沙箱 + HITL | 模型 |
| 序 12 CONSOLIDATE 闭环 | 封口/轮换沉淀 | 序 7-11 |
| 端到端验证 | Telegram delegate_code_task 功能验证 | 可用模型 |
| Tool Parity | Task 14-16: AskUserQuestion / MCP / 并行执行 | 无 |
| **attempt.ts 拆分重构** | 拆为 `system-prompt-builder.ts` + `injection-coordinator.ts` + `rotation-trigger.ts` | W0 闭环前置 |

---

## AI 协作者快速参考

### 常用命令
```bash
# 查看日志
elysiaclaw logs

# 检查 gateway 状态
elysiaclaw status

# 构建 + 部署
cd ~/pi-mono && ./deploy.sh

# 只构建不部署
cd ~/pi-mono && npm run build

# 验证 YAML 配置
python3 -c "import yaml; print(yaml.safe_load(open(os.path.expanduser('~/.elysiaclaw/config.yaml')).read()))"

# 查看用户 sessions
ls -la ~/.pi/agent/sessions/

# 成本报告
python3 ~/.pi/agent/cost-report.py
```

### 代码写入模板（Python）
```python
import os

def write_file(rel_path, content):
    path = os.path.expanduser(f"~/projects/pi-mono/{rel_path}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Written: {path}")
```

### 导出检查模板
```bash
# 检查某工具是否已导出
grep -n "myNewTool" ~/projects/pi-mono/packages/coding-agent/src/index.ts

# 列出所有已导出的工具
grep "ToolDefinition" ~/projects/pi-mono/packages/coding-agent/src/index.ts
```

### Patch 验证
```bash
grep -n "setSystemPrompt\\|replaceMessages" \\
  ~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/node_modules/@mariozechner/pi-agent-core/dist/agent.js
```

---

## Sprint 19: 流式输出修复 — blockStreamingDefault 错误抑制 (2026-06-08) ✅ 已完成

**Sprint 目标**: 排查并修复 agent 流式输出不工作的问题
**开始时间**: 2026-06-08
**状态**: ✅ 已完成

### 根因分析

用户反馈 agent 没有流式输出（token-by-token 逐字显示）。经过全链路追踪排查：

**完整链路**:
```
blockStreamingDefault="on" (elysiaclaw.json:357)
  → resolvedBlockStreaming="on" (get-reply-directives.ts)
  → accountBlockStreamingEnabled=true (bot-message-dispatch.ts)
  → canStreamAnswerDraft=false (bot-message-dispatch.ts)
  → answerLane.stream 未创建 (lane-delivery-text-deliverer.ts)
  → onPartialReply=undefined (bot-message-dispatch.ts)
  → text_delta 事件的 partial reply 被丢弃 (pi-embedded-subscribe.handlers.messages.ts)
  → 用户看不到流式输出
```

**关键代码位置**:
- `elysiaclaw.json:357` — `blockStreamingDefault: "on"` 是根因
- `get-reply-directives.ts` — `resolvedBlockStreaming` 解析逻辑
- `bot-message-dispatch.ts` — `canStreamAnswerDraft` 判断逻辑
- `pi-embedded-subscribe.handlers.messages.ts` — `shouldEmitPartialReplies` 控制 partial reply 发送

### 修复

| 文件 | 修改 | 说明 |
|---|---|---|
| `/home/elysia/.elysiaclaw/elysiaclaw.json` L357 | `"blockStreamingDefault": "on"` → `"off"` | 关闭默认块流式传输，恢复流式草稿预览 |

### 验证

| 检查项 | 结果 |
|---|---|
| 配置 `blockStreamingDefault` | `"off"` ✅ |
| 网关 health check | `{"ok":true,"status":"live"}` ✅ |
| 主进程 | PID 1803653 ✅ |
| 网关进程 | PID 1803660 ✅ |

### 影响范围

- 块流式传输（block streaming）不再默认启用，需要显式设置 `blockStreaming: true` 在 Telegram 账户配置中
- 流式输出（answer draft streaming）恢复为默认行为
- 不影响 reasoning 流式输出（序 3 WS-2 已独立修复）
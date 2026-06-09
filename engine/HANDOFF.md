# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-09 | 会话：20（TASK-17 M5 + TASK-20 M8 完成）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "M5 (autoCompact seal-aware) + M8 (命名收尾) 完成。autoCompactMessages 新增 sealedRanges 参数，已封 task 消息零 LLM 调用直接丢弃。框架层通过 CreateAgentSessionOptions.getSealedTaskRanges 正式回调注入（无 monkey-patch）。npm run check 零回归。"
> 当前优先：TASK-18 PLAN-13 M6（统一预算阈值 80k/90k→W×compact_ratio）


## 本次会话总结
### ✅ 完成内容
#### TASK-20 PLAN-13 M8 — 命名收尾（crit:p3）
- **session-rotation/ → cognitive-memory/** 目录重命名
- **handoff-types.ts → cognitive-types.ts** 文件重命名
- **handoff-inject.ts → index-head-injector.ts** 文件重命名
- 所有 import 路径同步更新，npm run check 零回归

#### TASK-17 PLAN-13 M5 — autoCompact 改造为 seal-aware（crit:p1）

**框架层改造（packages/coding-agent）：**
- **auto-compact.ts**：
  - 新增 `SealedRange` 接口 `{ taskId?, startedAt: number, endedAt: number }`
  - 新增 `getMessageTimestamp` / `isInSealedRange` 内部辅助函数
  - `autoCompactMessages` 新增 `sealedRanges?: SealedRange[]` 参数
  - `toSummarize` 中时间戳匹配 sealed range 的消息直接丢弃（零 LLM 调用）
  - 仅对孤儿消息回退 LLM 小摘要
  - 全 orphan 已被 sealed → 跳过 LLM 调用直接返回 toKeep
  - `AutoCompactResult` 新增 `sealedDiscarded: number` 字段
- **sdk.ts**：
  - `CreateAgentSessionOptions` 新增 `getSealedTaskRanges?: () => SealedRange[]` 回调
  - `transformContext` 闭包在 auto-compact 前调用回调获取 sealed ranges 并传递
- **index.ts**：导出 `SealedRange`, `AutoCompactResult`, `shouldAutoCompact` 及常量

**应用层接入（elysiaclaw）：**
- **attempt.ts**：`sessionOpts` 新增 `getSealedTaskRanges: () => taskTracker.getSealedRanges()`
- **架构决策**：patch-agent.cjs 已由 M3 删除，改为通过 `CreateAgentSessionOptions` 正式回调注入。无 monkey-patch 风险。

**验证**：`npm run check` + `npx tsgo --noEmit` 零回归。

### 🔜 建议下一步
* TASK-18 PLAN-13 M6 — 统一预算阈值（80k/90k 双阈值 → W×compact_ratio 单阈值，依赖 M5✅）
* PLAN-13 完成度：M0-M5 ✅ / M6 ⏳ / M7-M9 ⏳（7/9 = 78%）

### 🔍 决策记录
| 决策 | 选择 | 放弃 | 原因 |
|------|------|------|------|
| seal-aware 注入方式 | CreateAgentSessionOptions 正式回调 | monkey-patch (patch-agent.cjs) | M3 已删 patch-agent，正式回调架构更干净 |
| SealedRange 类型位置 | auto-compact.ts 独立定义（taskId?） | 复用 elysiaclaw sliding-window 类型 | 框架层不应依赖应用层类型；可选 taskId 兼容 elysiaclaw 必选 taskId |
| 密封消息处理位置 | toSummarize 阶段过滤 | 预处理阶段全局移除 | 保留 splitForCompaction 语义，toKeep 始终保留 recency |
| 全孤儿已密封时的行为 | 跳过 LLM 调用直接返回 toKeep | 仍调用 LLM 生成空摘要 | 零成本优化，避免无效 API 调用 |

## 本次会话中的文件变更
| 文件 | 变更类型 | 变更内容 | 原因 |
|------|---------|---------|------|
| elysiaclaw/src/session-rotation/ | 删除 | 整个目录 | M8 session-rotation→cognitive-memory |
| elysiaclaw/src/cognitive-memory/ | 重命名 | 从 session-rotation/ 迁移 | M8 命名对齐 |
| elysiaclaw/src/cognitive-memory/handoff-types.ts | 重命名 | → cognitive-types.ts | M8 命名对齐 |
| elysiaclaw/src/cognitive-memory/handoff-inject.ts | 重命名 | → index-head-injector.ts | M8 命名对齐 |
| packages/coding-agent/src/core/compaction/auto-compact.ts | 修改 | 新增 SealedRange + seal-aware 过滤逻辑 + sealedDiscarded 字段 | M5 核心改造 |
| packages/coding-agent/src/core/sdk.ts | 修改 | CreateAgentSessionOptions 新增 getSealedTaskRanges 回调 | M5 框架层桥接 |
| packages/coding-agent/src/index.ts | 修改 | 导出 auto-compact 类型和常量 | M5 公开 API |
| elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts | 修改 | sessionOpts 注入 getSealedTaskRanges | M5 应用层接入 |
| engine/SPRINT.md | 更新 | TASK-17✅ TASK-20✅ | 引擎文件同步 |
| engine/HANDOFF.md | 重写 | 会话 20 记录 | 会话交接 |
| engine/CONTEXT.md | 更新 | M5+M8 完成项 | 引擎文件同步 |
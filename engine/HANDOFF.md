# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-09 | 会话：17（PLAN-13 M1 索引头模型写 + M2 B3 单路径）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "TASK-13 PLAN-13 M1 完成：sealSegment 新增 modelIndexHead 参数，休止 seal 时调 completeSimple 生成 LLM 自述 goal/outcome/关键决策摘要。TASK-14 PLAN-13 M2 完成：删除 resolveIndexHeadBlockForSession，B3 统一为 IndexNode + traverseGraph 单路径。84 个 session-rotation 测试全绿。"
> 当前优先：TASK-15 PLAN-13 M3（删 dual-track）/ TASK-16 PLAN-13 M4（动态滑动窗口）/ TASK-07 P3（MediaPaths 5 bug）


## 本次会话总结
### ✅ 完成内容
#### TASK-13 PLAN-13 M1 — C2 索引头改模型写
* **task-segment-tracker.ts**：`SealSegmentParams` 新增可选 `modelIndexHead` 字段；`sealSegment` 中 IndexNode summary 改用 `params.modelIndexHead ?? buildIndexNodeSummary(segment)`
* **attempt.ts**：
  * 导入 `completeSimple` + `type Api` + `type Model` 从 `@mariozechner/pi-ai`
  * 新增 `createModelIndexHead` 异步函数：构建 prompt → 调用 completeSimple → 提取文本摘要，失败返回 null
  * 新增 `buildIndexHeadPrompt`：从 segment 提取 goal/todos/phase results/tool calls/finalReply 组装提示词
  * 休止 seal 调用点：在密封前获取 API key → 调用 createModelIndexHead → 传入 modelIndexHead 参数
  * 设计：模型失败/nil API key 不影响 seal（回退启发式）；强制 seal 不调模型
* **验证**：84 个 session-rotation 测试全绿；type check 零新增错误

#### TASK-14 PLAN-13 M2 — B3 单路径（上一会话完成，本次记录）
* **attempt.ts**：移除 `resolveIndexHeadBlockForSession` 导入和调用，删除 dual-track B3 注入块
* **handoff-inject.test.ts**：移除 resolveIndexHeadBlockForSession 相关测试和 mockConversations
* **验证**：生产路径零引用 resolveIndexHeadBlockForSession；84 个 session-rotation 测试全绿

### 🔜 建议下一步
* TASK-15 PLAN-13 M3 — 删 dual-track 全套（只依赖 M2，现已可执行）
* TASK-16 PLAN-13 M4 — 动态滑动窗口（只依赖 M0）
* TASK-07 PLAN-11 P3 — 5 个 MediaPaths 预存 bug

### 🔍 决策记录
| 决策 | 选择 | 放弃 | 原因 |
|------|------|------|------|
| modelIndexHead 参数位置 | SealSegmentParams 可选字段 | 在 sealSegment 内部调 LLM | tracker 不应耦合 LLM 关注点；由 attempt.ts 在调用前生成 |
| 模型失败处理 | 吞掉错误，返回 null，回退启发式 | 抛错阻止 seal | seal 不能因模型写头失败而中断 |
| prompt 格式 | 结构化指令（Goal/Outcome/Key decisions） | 纯截断拼接 | 需可提取的结构化信息供认知图谱检索 |
| M1 调 LLM 时机 | 仅休止 seal（quiescent） | 所有 seal | 强制 seal（compaction/abort/error）不走额外 LLM 调用来降低延迟 |
| M2 B3 路径 | 统一 IndexNode + traverseGraph | 保留 dual-track | PLAN-13 I6 单路径原则，消除数据不一致风险 |

## 本次会话中的文件变更
| 文件 | 变更类型 | 变更内容 | 原因 |
|------|---------|---------|------|
| elysiaclaw/src/session-rotation/task-segment-tracker.ts | 修改 | SealSegmentParams 新增 modelIndexHead 可选字段；sealSegment 使用 modelIndexHead ?? buildIndexNodeSummary | PLAN-13 M1 |
| elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts | 修改 | 导入 completeSimple；新增 createModelIndexHead + buildIndexHeadPrompt；休止 seal 调用点调模型写头 | PLAN-13 M1 |
| elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts | 修改（上一会话） | 删除 resolveIndexHeadBlockForSession 导入+调用；更新注释为 I6 单路径原则 | PLAN-13 M2 |
| elysiaclaw/src/session-rotation/handoff-inject.test.ts | 修改（上一会话） | 删除 resolveIndexHeadBlockForSession 测试+mockConversations；更新文件头注释 | PLAN-13 M2 |
| engine/CONTEXT.md | 更新 | 迁移链表 M1/M2→✅；新增 recent completions；不稳定项 B3 双路径→已解决 | 引擎文件同步 |
| engine/HANDOFF.md | 重写 | 会话 17 记录；M1+M2 决策和文件变更 | 会话交接 |
| engine/SPRINT.md | 更新 | TASK-13/TASK-14→✅ | 状态同步 |
| engine/ENGINE_MAP.md | 更新 | revision 12→13 | 引擎文件变更 |
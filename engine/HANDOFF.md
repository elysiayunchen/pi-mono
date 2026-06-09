# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-09 | 会话：15（TASK-07 PLAN-11 Bot 测试修复 P1+P2）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "TASK-07 PLAN-11 Bot 测试修复 P1+P2 完成：grammy mock hoisting 修复 + fetch.test.ts 全绿。剩余 5 个 MediaPaths 预存 bug 待 P3 修复。"
> 入口：`elysiaclaw/src/telegram/bot.create-telegram-bot.test-harness.ts`（harness mock 定义）+ `elysiaclaw/src/telegram/bot.test.ts`（异步 vi.mock 工厂）+ `engine/plans/PLAN-11.md`（验收标准）。


## 本次会话总结
### ✅ 完成内容
* **TASK-07 PLAN-11 P1 — grammy mock 修复**
  * 根因：Vitest 4.x 只 hoist 测试文件中的 `vi.mock`，harness 文件中的 `vi.mock("grammy")` 不被 hoist，导致 `bot.test.ts` 导入 grammy 时 mock 未注册
  * 修复：harness 中所有 grammy mock 变量移入 `vi.hoisted()`；`bot.test.ts` 添加异步 `vi.mock("grammy", async () => { ... })` 工厂函数动态导入 harness
  * 结果：`bot.test.ts` 0/48 → 46/48 passed
* **TASK-07 PLAN-11 P2 — fetch.test.ts 全绿**
  * 20/20 passed（前序会话已完成）
* **loadWebMedia mock 补齐**
  * `bot.test.ts` 导入 `getLoadWebMediaMock`，在需要媒体加载的测试中设置 `loadWebMedia.mockResolvedValueOnce()`
  * 但 MediaPaths 仍为 null——根因在 `resolveMedia` → `downloadAndSaveTelegramFile` 链路，非 mock 层面问题
* **验证无回归**
  * `bot.create-telegram-bot.test.ts` 43/46 passed（与修改前一致）
  * `bot.fetch-abort.test.ts` 3/3 passed
  * `npm run check` 零新增类型错误（预存 27 条 pi-tui/agents 错误不变）
### 🔜 建议下一步
* TASK-07 PLAN-11 P3 — 修复 5 个 MediaPaths 预存 bug：
  - `bot.test.ts`: "includes replied image media in inbound context for text replies" + "defers reply media download until debounce flush"
  - `bot.create-telegram-bot.test.ts`: "drops non-default account DMs without explicit bindings" + "buffers channel_post media groups" + "processes remaining media group photos when one photo download fails"
  - 根因：`resolveMedia` → `resolveTelegramFileWithRetry` → `ctx.getFile()` 返回空对象（无 `file_path`），需在测试中正确 mock `ctx.getFile` 返回值
* TASK-13/14/16 PLAN-13 M1/M2/M4 可并行（均只依赖 M0）


## 本次会话中的决策
| 决策 | 选择 | 放弃 | 原因 |
|------|------|------|------|
| grammy mock 修复方式 | 在 bot.test.ts 中添加异步 vi.mock 工厂 | 修改 harness 中的 vi.mock 位置 | Vitest 只 hoist 测试文件中的 vi.mock；异步工厂可动态导入 harness 变量，确保 mock 注册时机正确 |
| MediaPaths 失败处理 | 记录为预存 bug，不阻塞 P1/P2 交付 | 深入修复 resolveMedia 链路 | 根因在 `downloadAndSaveTelegramFile` → `fetchRemoteMedia` 链路，涉及 transport mock 等深层问题，需单独排查 |

## 上次会话遗留决策
* tracker 生命周期：模块级 Map 注册表（按 sessionKey 持久化）
* 输入到达时 active 段处理：三路分支（无/休止/未休止）
* 回合结束封口策略：仅 force seal（compaction/abort/error）
* classifyInput 门控：完全移除对 startSegment 的门控

## 进行中的工作
### 当前任务：TASK-07 PLAN-11 P3（5 个 MediaPaths 预存 bug）
- **状态：** 待开始
- **根因：** `resolveMedia` → `resolveTelegramFileWithRetry` → `ctx.getFile()` 返回空对象（无 `file_path`），导致 `downloadAndSaveTelegramFile` 抛出 "Telegram getFile returned no file_path"
- **修复方向：** 在测试中正确 mock `ctx.getFile` 返回 `{ file_path: "media/file.jpg" }`，或 mock `resolveMedia` 整体返回

### 并行可做：TASK-13/14/16 PLAN-13 M1/M2/M4
- 均只依赖 M0，与 TASK-07 正交


## 上下文漂移警告
- ⚠️ **`engine/plans/` 被 `.gitignore` 第 37 行忽略** —— PLAN-*.md 的统合改动在磁盘生效但未入 git
- ⚠️ **`elysiaclaw/` 被 pi-mono 根 `.gitignore` 忽略** —— elysiaclaw 有独立 git 仓库，需在 `elysiaclaw/` 目录内提交


## 会话历史
| 会话 | 日期 | 关键变更 |
|------|------|---------|
| 1 | 2026-06-08 | 引擎文件 v5 深度重构：迁移至 engine/，创建 ENGINE_MAP + 8 文件 + 8 plan 登记 |
| 2 | 2026-06-08 | 认知架构设计统合审定：PLAN-09 升 accepted 取代 01/02/08，PLAN-03/04 标正交子系统 |
| 3 | 2026-06-08 | PLAN-09 P1 实施：IndexNode/HardEdge 类型 + conversation-store 图谱表 + tracker onSeal + computeInjectionBudget 接入 + B3 图谱注入 |
| 4 | 2026-06-08 | 引擎文件同步更新：ENGINE_MAP revision 8，ROADMAP/ARCHITECTURE P1✅ 补齐 |
| 5 | 2026-06-09 | PLAN-09 P0/P1 部署至生产：deploy.sh 执行 + 运行时代码对比验证 + engine 文件更新 |
| 6 | 2026-06-09 | TASK-06 PLAN-10 审计修复：AC-1~AC-4 全部完成 + BFS off-by-one 修复 |
| 7 | 2026-06-09 | Bot 测试审计 + PLAN-11 录入 + TASK-07 置顶（31/65 文件失败根因分析） |
| 8 | 2026-06-09 | TASK-08~TASK-11 完成：轮换清理 + 双轨注入 + 压缩→seal + PLAN-12 P0 设计+存储 |
| 9 | 2026-06-09 | 引擎文件 RECONCILE：PLAN-10→done + TASK-08~11 补录 + ARCHITECTURE §11 更新 |
| 10 | 2026-06-09 | PLAN-13 执行计划写入：TASK-12~TASK-21（M0-M9）派生 + ENGINE_MAP 关系图更新 |
| 11 | 2026-06-09 | PLAN-13 详细分支计划 + 引擎文件完善：ARCHITECTURE §11 PLAN-13 权威+四层缓存+I6+单路径原则；CONTEXT 迁移链表+不稳定项+Q-06；SPRINT 详细实现指导 |
| 12 | 2026-06-09 | PLAN-13 详细分支方案审核：Q-06~Q-10 全部回答 + C1-C4 补充纳入 + spec B1-B4 修正 + ROADMAP M4 更新为 PLAN-13 + branch.md draft→reviewed |
| 13 | 2026-06-09 | TASK-12 PLAN-13 M0 实施：task 边界改控制流（3 源文件 + 1 测试文件 + 引擎文件更新）|
| 14 | 2026-06-09 | TASK-12 PLAN-13 M0 审查：维护性排查 → 发现 5 问题（P096–P100）→ 全量录入 PITFALLS + 引擎文件同步 |
| 15 | 2026-06-09 | TASK-07 PLAN-11 Bot 测试修复 P1+P2：grammy mock hoisting 修复 + fetch.test.ts 全绿 + loadWebMedia mock 补齐 |


## 引擎文件变更摘要
| 文件 | 变更类型 | 变更内容 | 原因 |
|------|---------|---------|------|
| engine/CONTEXT.md | 状态更新 | 状态面板测试 31/65→92/97；上次完成更新；不稳定项更新；最近完成事项新增 #1 | 反映 TASK-07 P1+P2 进展 |
| engine/HANDOFF.md | 会话记录 | 重写为会话15；记录 grammy mock 修复决策+MediaPaths 预存 bug | 会话交接 |
| engine/ENGINE_MAP.md | 版本更新 | 全局 revision 10→11 | 反映引擎文件变更 |
| engine/SPRINT.md | 任务状态 | TASK-07 状态更新为 P1+P2 完成 | 反映任务进展 |


## 交接检查清单
- [x] 恢复点足够具体，能立即行动
- [x] 所有修改过的文件已列出
- [x] 待解决问题已记录
- [x] 新发现的陷阱已记录（MediaPaths 预存 bug，非 PITFALLS 级别）
- [x] 上下文漂移警告已标注
- [x] 会话历史表已更新
- [x] ENGINE_MAP 已更新（revision / 关系图）
- [x] 引擎文件变更摘要已输出
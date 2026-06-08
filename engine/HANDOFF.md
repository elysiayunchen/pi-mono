# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-08 | 会话：1（引擎文件 v5 重构）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "从这里开始：执行 PLAN-09 P0 — 注入方向修正（attempt.ts 中 B3/B4/B5 由 prepend 改 append 到 effectivePrompt 末尾）+ 轮换死代码清理（删除 session-rotation/ 的 rotation-controller/auto-trigger/rotate-session-tool，改造 handoff-inject 为索引头注入器，清理 attempt.ts 中 35 处 rotation/handoff 引用）。不依赖模型可用性，验证靠 `npm run check` + vitest。"
> 入口：`elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`，`elysiaclaw/src/session-rotation/`。设计权威：`engine/plans/PLAN-09.md` §六/§十/§十一 + `engine/ARCHITECTURE.md §11`。


## 本次会话总结
### ✅ 完成内容
* 引擎文件系统 v5 深度重构：从 `elysiaclaw_engine/` 迁移至 `engine/`，按 ENGINE_FILE_SYSTEM_v5.md 规范重建。旧目录已删除。
* 创建 ENGINE_MAP.md（索引层）+ 9 个引擎文件 + plans/ 目录（8 plan + 8 spec twin）
* 8 个 plan 登记到 ENGINE_MAP §2，原始设计文档完整迁移至 `engine/plans/`，内容与原始文档 diff 全部通过
* 知识类别分类：irreducible / mixed / derivable 按 v5 规范标注
### ⚙️ 实现方式
* 基于 ENGINE_FILE_SYSTEM_v5.md 规范，结合 ElysiaClaw 项目现状（12 层 Agent 框架、认知架构演进、95+ 踩坑记录）
* 采用 CLI-LEAN profile（直接文件访问），irreducible 文件完整生成，derivable 章节为 stub
* Plan 内容直接复制原始设计文档，保持原设定不变，仅添加 4 行元数据头
### 🔜 建议下一步
* 运行 RECONCILE 对账：验证新引擎文件与代码库的一致性
* 序 8 阶段 5 端到端验证（如果模型可用）
* 或：Tool Parity Task 14（AskUserQuestion）
* 或：attempt.ts 拆分重构（降低复杂度）


## 本次会话中的决策
| 决策 | 选择 | 放弃 | 原因 |
|------|------|------|------|
| 引擎文件位置 | `/engine/`（项目根目录） | `elysiaclaw_engine/`（旧位置，已删除） | 遵循 v5 规范，统一路径 |
| Profile | CLI-LEAN | WEB-FULL | 用户使用 Trae IDE/Claude Code，可直接读代码 |
| 设计文档归属 | 迁移至 `engine/plans/` 作为 plan | 保留在旧目录 | 符合 v5 规范 plan 管理 |
| 知识类别 | 严格按 v5 分类 | 全部保留 | 符合 CLI-LEAN 只持久化 irreducible 的原则 |


## 进行中的工作
### 当前任务：PLAN-09 P0 — 注入方向修正 + 轮换死代码清理
- **状态：** 认知架构设计统合审定完成（PLAN-09 accepted，取代 01/02/08 L2），P0 代码改动待执行
- **下一步操作：** 见 ⚡立即恢复点；不依赖模型，先做注入方向修正再清死代码
- **开始前需阅读的文件：** `engine/plans/PLAN-09.md`（权威，尤其 §六/§十/§十一/§十五）、`engine/ARCHITECTURE.md §11`（全景）、`elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`、`elysiaclaw/src/session-rotation/`


## 上下文漂移警告
- ⚠️ **`engine/plans/` 被 `.gitignore` 第 37 行忽略** —— PLAN-*.md 的统合改动（PLAN-09→accepted、01/02/08→superseded 声明、PLAN-09 §十五）在磁盘生效但**未入 git**。下次 clone/换机会丢失。需 owner 决定是否纳入版本控制（`git add -f` 或改 .gitignore）。
- ARCHITECTURE.md derivable 章节（§2-5, §8-10）为 stub，CLI-LEAN 下按需从代码现生
- SOURCEMAP.md 为 stub，CLI-LEAN 下按需从代码现生


## 会话历史
| 会话 | 日期 | 关键变更 |
|------|------|---------|
| 1 | 2026-06-08 | 引擎文件 v5 深度重构：迁移至 engine/，创建 ENGINE_MAP + 8 文件 + 8 plan 登记 |
| 2 | 2026-06-08 | 认知架构设计统合审定：PLAN-09 升 accepted 取代 01/02/08，PLAN-03/04 标正交子系统，ARCHITECTURE §11 全景图新增，元数据漂移校正，PITFALLS #091 解决路径改 PLAN-09 P0 |


## 引擎文件变更摘要
| 文件 | 变更类型 | 变更内容 | 原因 |
|------|---------|---------|------|
| engine/ENGINE_MAP.md | 新增 | 索引层，profile=CLI-LEAN，8 文件 + 8 plan 注册 | v5 规范核心文件 |
| engine/SYSTEM.md | 新增 | 从原 SYSTEM.md 提取重组，含 Prime Directives、协作协议、维护协议 | 不可重建知识 |
| engine/CONTEXT.md | 新增 | 新建，合成当前状态快照 | v5 规范要求，原无此文件 |
| engine/HANDOFF.md | 新增 | 本文件，会话交接 | v5 规范要求 |
| engine/SPRINT.md | 新增 | 从原 SPRINT.md 提取重组，含当前活跃 sprint | 不可重建知识 |
| engine/ROADMAP.md | 新增 | 从原 ROADMAP.md 提取重组，含里程碑和路线图 | 不可重建知识 |
| engine/PITFALLS.md | 新增 | 从原 PITFALLS.md 提取重组，含 95+ 条坑记录 | 不可重建知识 |
| engine/ARCHITECTURE.md | 新增 | 从原 ARCHITECTURE.md 提取，irreducible 章节完整，derivable 为 stub | mixed 文件 |
| engine/SOURCEMAP.md | 新增 | derivable stub，CLI-LEAN 下按需现生 | v5 规范要求 |
| engine/plans/ | 新增 | 8 个 plan 文件 + 骨架 spec twin | v5 规范 plan 管理 |


## 交接检查清单
- [x] 恢复点足够具体，能立即行动
- [x] 所有修改过的文件已列出
- [x] 待解决问题已记录
- [x] 新发现的陷阱已记录到 PITFALLS.md（本次无新陷阱）
- [x] 上下文漂移警告已标注
- [x] 会话历史表已更新
- [x] ENGINE_MAP 已更新（revision / 关系图）
- [x] 引擎文件变更摘要已输出
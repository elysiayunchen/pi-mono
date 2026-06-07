# ElysiaClaw — 开发进度改动汇总与落地措施

> 生成时间: 2026-06-07
> 数据源: `elysiaclaw_engine/` 全部 20 份引擎文档
> 定位: 架构师当前开发进度的全景汇总，突出架构设计哲学、开发流程、卡点与解决方案，附落地措施路线图

---

## 一、项目概览

ElysiaClaw 是基于 pi-mono（Mario Zechner / badlogic 的 Agent SDK）构建的**个人 AI 助手平台**，通过 Telegram Bot `@ElysiaClaw_Bot` 与用户交互。项目由维护者 aoseluo（云尘 / 奈緒）以**非专业程序员 + AI 协作开发**模式独立维护，是 OpenClaw 的个人 fork，不与上游同步。

核心架构为**双项目结构**：

| 层 | 项目 | 职责 |
|---|---|---|
| 地基 | pi-mono (0.64.0) | Agent 核心循环 + Session 管理 + LLM API 统一接口 + 上下文压缩 + 基础工具 |
| 房子 | elysiaclaw (0.64.x) | 渠道适配(Telegram等) + 应用层工具 + Gateway 控制平面 + 配置系统 + 安全策略 |

**关键架构事实**：Bot 模式(Telegram)与 TUI 模式走完全独立的工具注册路径——TUI 用 `createPiCodingTools`，Bot 用 `createElysiaClawCodingTools`。新增/修改工具必须两边都验证（Pitfall #17/#25/#54）。

---

## 二、架构设计哲学

### 2.1 演进式架构 (Evolutionary Architecture)

ElysiaClaw 将代码生成视为从**模糊意图 (Set A)** 到**精确语法 (Set B)** 的映射。核心原则：

- **最小化推理熵**：通过高保真的系统提示维持映射稳定性
- **不可变映射**：逻辑偏移时重置上下文，而非在损坏状态上打补丁
- **契约优先开发**：pi-mono（结构完整性）+ elysiaclaw（用户面 Gateway），任何对框架核心的修改必须验证 Gateway 协议

### 2.2 差分意识 (Differential Consciousness)

ElysiaClaw 与 Elynyx Code 不是主从关系，而是**认知分工**：

- **ElysiaClaw** = 永恒记忆 / 编排大脑 — 多渠道接入、长期记忆、Agent Teams
- **Elynyx Code** = 精准行动 / 代码之手 — 多 Provider 路由、工具链、沙箱执行

### 2.3 本栈语言优越性 (TypeScript / Node)

不是"能用 TS 写"，而是设计本质上吃 Node 特性：

1. **单进程长驻** = 天生的常驻管理员（World Model 可作进程内活对象）
2. **类型系统** = 记忆/状态的编译期契约（discriminated union + exhaustive switch）
3. **同构零 IPC** = 记忆引擎零拷贝注入 system prompt
4. **node:sqlite 双路径** = 同步快路径(微秒级命中) + async 慢路径(embedding 检索)
5. **AsyncIterator + AbortController** = 与 streaming 循环融合

---

## 三、开发时间线与详细流程

### 3.0 阶段零：项目初始化与上游 fork (2026-03 ~ 2026-04-03)

**开发流程**：
1. 从 OpenClaw v2026.3.13 fork 出个人维护分支
2. 理解 pi-mono 框架的极简主义哲学："One loop & Bash is all you need"
3. 确立双项目结构：pi-mono（地基）+ elysiaclaw（房子）
4. 搭建部署流水线：`deploy.sh` 一键构建+部署+重启

**卡点与解决**：
| 卡点 | 原因 | 解决方案 |
|---|---|---|
| pi-tui 版本不兼容 | 0.58 安装包 API 与 0.64 源码不匹配 | 加兼容层，后升级到 0.64 直接替换（#3） |
| pi-ai 意外覆盖 | 替换 pi 包时误操作 | deploy.sh 明确列出替换包，不动 pi-ai（#4） |
| tsgo 不在 PATH | 直接执行 `tsgo` 报 command not found | 永远用 `npm run build`，不直接调 tsgo（#6） |

### 3.1 阶段一：12 层 Agent 框架 + P 系列补丁 (2026-04-03 ~ 2026-04-07)

**开发流程**：
1. 逐层实现 s01-s12，每层独立可测试
2. P 系列补丁按依赖顺序实施：P1(基础设施) → P2(会话/调度) → P3(安全/快照)
3. 每层完成后立即写测试 + 四层注册验证

**详细实施记录**：

| Sprint | 日期 | 内容 | 卡点 | 解决 |
|---|---|---|---|---|
| s07-s12 + P1-A/P2-A/P2-B/P2-D(Ph3)/P3-A | 04-03 | 大规模功能实现 | s09 路径错误、teammate 权限缺失 | 改用 `node:os` + `path.join`；s12 Worktree 通过 `createBashTool(worktreePath)` 天然沙箱（#18/#19） |
| s09 首次修复 + s12 残留修复 | 04-04 | Bug fixes | 工具类型错误三处（details/execute/status） | 逐一补全，用 `npm run check` 验证（#15） |
| s09 二次修复 + P1-A/P1-C/P2-D(Ph1+2)/P3-B | 04-07 | 补全 + 新功能 | patch-agent.cjs 非幂等导致 gateway 崩溃 | 重写脚本，加 Step 0 清理损坏代码，逐方法严格检测（#22b） |
| 包名迁移 | 04-07 | OpenClaw → ElysiaClaw | symlink 入口断裂、plugin manifest 文件名、.bashrc 残留 | symlink 直接指向 `dist/entry.js`；批量 rename manifest；修正 .bashrc source 路径（#29/#33/#34） |

**核心卡点详解 — patch-agent.cjs 非幂等（#22b）**：
- **现象**：多次运行 patch 脚本后，注入代码被 `// REMOVED_` 前缀包裹，agent.js 第 133 行出现孤立语句，`SyntaxError` 导致 gateway 崩溃
- **根因**：旧补丁没有完全清理干净，marker 仍然存在于文件中，第二次替换又匹配了一次
- **解决**：重写脚本为幂等——Step 0 清理所有损坏代码，逐方法严格检测，按需注入
- **预防**：每次 deploy.sh 前检查 agent.js 语法

**核心卡点详解 — Bot 模式绕过 pi-coding-agent（#25）**：
- **现象**：`elysiaclaw` 是完全自包含 bundle，bot 请求不经过我们替换的 `pi-coding-agent`，`wrapStreamForCost()` 对 bot 无效
- **根因**：TUI 和 Bot 走完全独立的工具注册路径
- **解决**：双轨方案——TUI 走 `wrapStreamForCost()` 拦截 done 事件；Bot 走读取 `sessions.json` 的 Python 报告脚本
- **影响**：这是理解 ElysiaClaw 最重要的架构事实，新增工具必须两边都注册

### 3.2 阶段二：架构优化与系统审计 (2026-04-05 ~ 2026-04-10)

**开发流程**：
1. BUG-1~4 修复 + deploy.sh 守卫
2. 系统盘查：发现四层注册遗漏
3. ToolDefinition 接口扩展（Task 0）
4. GrepTool 参数补全（Task 1）+ BashTool 能力声明（Task 2）

**详细实施记录**：

| Sprint | 日期 | 内容 | 卡点 | 解决 |
|---|---|---|---|---|
| 架构优化 | 04-05 | BUG-1~4 修复 + deploy 守卫 | 四脚本部署路径硬编码错误 | 统一单文件，路径用 `__file__` 推导（#28） |
| Architecture Audit | 04-09 | 四层注册发现 + 工具缺口映射 | allTools/createAllTools 缺少 5 个工具 | 补全 allTools +3、createAllTools +5（#46/#47） |
| Tool Parity Task 0 | 04-10 | ToolDefinition 11 字段扩展 | type re-export 导致类型错误 | 纯 interface re-export 加 `type` 修饰（#56） |
| Tool Parity Task 1 | 04-10 | GrepTool 参数补全 | slicedOutput 截断上下文行 | 移除 effectiveHeadLimit，DEFAULT_MAX_BYTES 作安全网（Task 1 附带修复） |
| Tool Parity Task 2 | 04-10 | BashTool 能力声明 | GrepTool slicedOutput 回归 | 移除 slicedOutput 中的 effectiveHeadLimit 限制 |

**核心卡点详解 — 四层注册遗漏（#46/#47/#51）**：
- **现象**：s07-s12 工具存在于 dist 但未在 `src/index.ts` 导出，bot 环境全部无法使用
- **根因**：手动维护工具注册列表遗漏——新增工具后只改了 `tools/index.ts`，忘了 `src/index.ts`（Master tool export）
- **解决**：补全 14 行导出声明 + deploy.sh 加装 Guard 3（工具注册一致性检查）
- **预防**：每次新增工具后必须检查四层：Layer 1(pi-coding-agent allTools) → Layer 2(elysiaclaw pi-tools.ts) → Layer 3(tool-catalog.ts) → Layer 4(elysiaclaw.json tools.allow)

### 3.3 阶段三：packages 精简 + Code Mode 废弃 (2026-06-05)

**开发流程**：
1. 删除 mom/web-ui/pods 包，只剩 4 个核心包（tui/ai/agent/coding-agent）
2. 废弃 Code Mode (`/code` `/exit`)，设计并实施 `delegate_code_task` 子代理分发
3. 引擎文件整理与归档

**核心卡点详解 — Code Mode 废弃决策**：
- **原问题**：Code Mode 是独立模式切换，但代码能力不应该是"模式"，而是 agent 的内置手段
- **更深层问题**：主 agent 在处理代码任务时会把整个文件系统倒进上下文（读 5-10 个文件 = 15-30k token），导致后续对话质量下降
- **解决**：子代理分发 + 上下文管理——子代理是侦察兵（只读工具集），返回结构化摘要（~400 token vs 直接执行的 2500+ token）
- **三层路由架构**：Layer 0 消息分类器（正则匹配）→ Layer 1 Agent 决策（system prompt 强引导）→ Layer 2 后置检查（3+ 次 read/grep 后提醒）

### 3.4 阶段四：记忆引擎激活 (2026-06-06)

**开发流程**：
1. 诊断现状：发现 TS 语义记忆引擎已存在但从未通电（线上 0 chunks 空置）
2. 逐步激活：开 config → 全量回填 → 并行验证 → 切换清理 → RECALL 注入
3. 同日修复 deploy.sh 的 3 个结构性缺陷

**详细实施记录**：

| 任务 | 内容 | 卡点 | 解决 |
|---|---|---|---|
| T2 | 开 config | 无 | 配置 `memorySearch.sources=[memory,sessions]` + `experimental.sessionMemory=true` |
| T3 | 全量回填 | 无 | 121 files · 508 chunks |
| T4 | 并行验证 | Python LIKE 全表扫 vs TS 向量检索 | TS FTS trigram + pplx-embed-v1-4b (2560d) 完胜 |
| T4b | FTS tokenizer | unicode61 不支持 CJK 3+ 字符搜索 | 切换为 trigram tokenizer |
| T4c | Embedding 模型 | nvidia/llama-nemotron 效果差 | 切换为 perplexity/pplx-embed-v1-4b (2560d) |
| T5 | 切换 + 清理 | Python session_search 旁路了 TS 引擎 | 删 session-search-tool.ts + session-indexer.py + session-index.db |
| T6 | RECALL 注入 | attempt.ts:1733 把 agent 往弱实现上引导 | 改指引指向 memory_search，每轮自动 search top-5 |

**核心卡点详解 — 记忆引擎从未通电**：
- **现象**：线上引擎 0 chunks 空置，sources 仅 memory，Provider none，FTS ready
- **根因**：`src/memory/` 是生产级 TS 语义记忆引擎（embeddings 多 provider + sqlite-vec 向量 + hybrid 混合检索 + mmr 多样性重排 + temporal-decay 时间衰减），但从未被正确配置和激活
- **更深层根因**：Python `session_search` 用 `spawnSync` 跑 `session-indexer.py`（SQLite LIKE 全表扫）旁路了现成 TS 向量检索，而 `attempt.ts:1733` 还注入 "MANDATORY: session_search" 把 agent 往弱实现上引导
- **解决**：激活 TS 引擎 + 删除 Python 旁路 + 改指引指向 memory_search
- **教训**：不缺记忆引擎，缺的是把引擎用对——孤岛、被动、被旁路、只读是四大病灶

**同日修复 — deploy.sh 根因**：
- **现象**：代码提交但 dist 未部署
- **根因 1**：增量部署（cp 不覆盖已删文件）→ 旧文件残留
- **根因 2**：extensions 目录未同步到全局安装
- **根因 3**：无 dist 完整性校验
- **解决**：Clean slate deploy（rm -rf + cp -r + 文件数下限检查 ≥100）+ Extensions 同步（Step 9）+ Dist 完整性校验（Guard 3）+ E2E 验证（Guard 5）

### 3.5 阶段五：序 1-7 统一实施 (2026-06-07)

**开发流程**：
1. 序 1 索引化注入 + B4 改造（修 KV-cache 病灶）
2. 序 2-3 Telegram UX 修复（压缩可见性 + 全流式）
3. 序 4-5 上下文精细管理（工具结果驱逐 + 注入预算器）
4. 序 6-7 认知增强（输入分类器 + 用户画像）

**详细实施记录**：

| 序 | 内容 | 卡点 | 解决 |
|---|---|---|---|
| 1 | 索引化注入 + B4 改造 | RECALL 被 append 进 system prompt 末尾（attempt.ts:1781），每轮变化致稳定前缀 KV-cache 每轮全失效 | RECALL 从 system prompt 移出，改为消息流末尾 B4 注入 |
| 2 | 压缩可见性 WS-1 | compact.ts:918 阻塞调用，压缩期间无 emit，Telegram 端完全静默 | 压缩前置通知 + typing 心跳续命 |
| 3 | 全流式 WS-2 | toolcall_start/delta/end 事件被 `evtType !== "text_delta"` 过滤丢弃；reasoning 默认 off | 新增事件处理分支；`?? "off"` → `?? "stream"` |
| 4 | L0 工具结果驱逐 | consumed tool result 占用大量上下文 | [EVC] sentinel 幂等检测，驱逐原文留摘要 |
| 5 | 统一注入预算器 | 注入与压缩无共享预算，大注入顶爆窗口→触发压缩→丢注入→反身性空转 | system prompt tokens 计入压缩阈值 |
| 6 | 输入分类器 | 一切皆任务，闲聊也打包成 Task Segment | task/chat/affective/meta 四分类，偏向 task |
| 7 | 用户画像 User Model | 用户画像几乎为空 | SQLite 持久化 + 双路径更新 + B2 注入 |

**核心卡点详解 — KV-cache 病灶（序 1）**：
- **现象**：每轮 token 消耗异常高，稳定前缀（base prompt + GUIDANCE 数 k token）每轮全部重 prefill
- **根因**：RECALL（每轮变）拼在 system prompt 内部 → system prompt 整体每轮变 → 其前缀 KV-cache 每轮失效
- **次生问题**：RECALL 是检索数据却混在指令区（违反 R4 指令/数据分离），且位置偏中前（违反 R5 recency）
- **解决**：按变化频率把注入切成有序的「带(Band)」——B0-B4 五带 + 消息流，在稳定与易变之间钉 cache 锚点
- **收益**：改造后命中 prefix cache，稳定前缀 prefill 计费降至约 0.1x

**核心卡点详解 — 反身性空转（序 5）**：
- **现象**：大量注入 → 顶高 token → 触发压缩 → 压缩丢掉刚注入的记忆 → 下一轮又注入 → 又触发压缩
- **根因**：注入量与 s06 压缩无共享预算
- **解决**：统一注入预算器——B2+B3+B4 注入量计入压缩触发阈值，杜绝"注入→爆窗→压缩→丢注入"循环
- **前瞻**：World Model 摘要注入（Phase 2）将进一步增大注入量，此修复是硬前置

### 3.6 阶段六：序 8 Conversation 层 + Handoff (2026-06-07)

**开发流程**：
1. 阶段 1-2：核心类型 + Conversation Store + rotate_session 工具
2. 阶段 3：自动轮换触发
3. 健全性测试：发现并修复 5 项逻辑缺陷
4. 阶段 4：Task Segment 追踪 + 双轨索引 + CompactionSummary
5. 深度审查：暴露接线断链并修复

**详细实施记录**：

| 阶段 | 内容 | 卡点 | 解决 |
|---|---|---|---|
| 1 | 核心类型 + Conversation Store | 无 | SQLite 持久化 (node:sqlite DatabaseSync) |
| 2 | rotate_session 工具 + B3 Handoff 注入 | 四层注册遗漏 | elysiaclaw-tools.ts + tool-catalog.ts 注册 |
| 3 | 自动轮换触发 | 安全点硬约束写死 | checkAutoRotation + safety 门控 |
| 健全性测试 | 5 项逻辑缺陷 | 旧段孤儿、同名匹配、handoff 回退、错误处理不一致、正则重复 | 逐一修复 + 24 新测试 |
| 4 | Task Segment + 双轨索引 | 无 | plan-todo-review-recall 四阶段 + CompressedPhaseResult |
| 深度审查 | 接线断链 | executeRotation 死代码、MacroIndex 恒空、违反 AgentTool 契约 | buildMacroEntryFromHandoff 共享函数 + 保留既有 macro + execute 双参 |

**核心卡点详解 — "代码+测试存在 ≠ 完成"（#85）**：
- **现象**：序 8 多处标记 "✅ IMPLEMENTED"，但深度审查发现真实语义是"代码+测试存在"，不是"在生产运行"
- **具体断链**：
  - `executeRotation` 是死代码（grep 仅定义+导出+测试，零生产调用）
  - 自动轮换只是提示文字（`checkAutoRotation` 命中后只追加一句提示，从不真轮换）
  - CONSOLIDATE 完全没接（归档 session 不写 `src/memory`）
  - 安全点断言而非检查（`pendingToolCalls:0, hasActiveBackgroundLane:false` 写死）
  - RECALL 注入方向反了（全部 prepend 到 prompt 开头，离当前问题最远）
  - 未部署（全局 dist 无此模块，无 conversation 表）
- **解决**：建立三级完成标注标准——✅ 生产验证通过 / 🔄 已接线待验证 / 📝 代码存在
- **教训**：这是项目惯犯模式（用户画像写路径死代码、computeInjectionBudget 架空同构）——"模块+测试齐全"被当成"完成"，但接线闭环无测试守护

**核心卡点详解 — rotate_session 违反 AgentTool 契约（#93）**：
- **现象**：rotate_session 工具的 execute 方法只接受一个参数，返回 `{text}` 格式
- **根因**：AgentTool 框架要求 execute 双参（input, context），返回 content/details/parameters/label
- **解决**：execute 改双参 + 返回完整结构
- **教训**：新增工具时必须对照 AgentTool 接口定义，不能只看其他工具的"简化版"实现

### 3.7 阶段七：tsgo 类型检查清零 + Tool Parity 批量完成 (2026-06-07)

**开发流程**：
1. 全仓 tsgo 53 类型错误 → 0
2. Tool Parity Task 3-13 批量完成（TodoWrite/Edit/Read/Write/Find/Ls/PlanMode/Task/Team/web_fetch/WebSearch）
3. 引擎设计审查 + 文档状态校正

**核心卡点详解 — tsgo 类型错误 7 类（#86）**：
1. 重复 `const` 声明（序 8 新增代码与上方变量同名）
2. `wrapToolDefinition` 未逐字段传播扩展字段（`as` 类型断言导致运行时 `undefined`）
3. 测试 `describe()` 回调捕获 `beforeEach` 变量（`it()` 内拿到 `undefined`）
4. 第三方 @buape/carbon 类型不兼容
5. 纯 interface re-export 缺少 `type` 修饰
6. agent-session.ts CLAUDE.md lazy-load 跳过 extension-origin 消息
7. tool-definition-wrapper.ts 返回值类型断言不完整

---

## 四、已完成工作全景

### 4.1 12 层 Agent 框架 — 全部竣工

| 层 | 机制 | 核心文件 |
|---|---|---|
| s01 | 基础循环 | `agent-loop.ts` |
| s02 | 工具注册 | `tools/index.ts` + `pi-tools.ts` |
| s03 | Plan Mode + Todo | `enter-plan-mode.ts` |
| s04 | 子 Agent 分叉 + 代码委派 | `agent-session.ts` + `delegate-code-task.ts` |
| s05 | 知识懒加载 | `claude-md-loader.ts` |
| s06 | 上下文压缩 | `multi-layer.ts` (三层压缩链) |
| s07 | 任务持久化 | `task-*.ts` |
| s08 | 后台进程 | `background-runner.ts` |
| s09 | Agent Teams | `team-create.ts` |
| s10 | Team 通信协议 | `send-message.ts` |
| s11 | 自主认领 | `autonomous-runner.ts` |
| s12 | Worktree 隔离 | `worktree-manager.ts` |

### 4.2 P 系列补丁 — 全部完成

| 补丁 | 机制 | 状态 |
|---|---|---|
| P1-A | postinstall 补丁保护 | ✅ |
| P1-B | CLAUDE.md 懒加载 | ✅ |
| P1-C | 自动 Compact 阈值触发 | ✅ |
| P2-A | Session Persistence + Resume | ✅ |
| P2-B | Cost Tracker | ✅ |
| P2-D | 速率调度器(三阶段闭环) | ✅ |
| P3-A | PreToolUse Shell Hooks | ✅ |
| P3-B | File History / Undo | ✅ |

### 4.3 序 1-7 统一实施 — 全部完成 (2026-06-07)

| 序 | 内容 | 核心改动 |
|---|---|---|
| 1 | 索引化注入 + B4 改造 | RECALL snippet→索引信号, 移出 system prompt, 修 KV-cache 病灶 |
| 2 | 压缩可见性 WS-1 | 压缩 start/done 状态推送 + typing 心跳续命 |
| 3 | 全流式 WS-2 | thinking 默认流式 + 统一 lane 契约 |
| 4 | L0 工具结果驱逐 | consumed tool result → [EVC] 摘要, 幂等检测 |
| 5 | 统一注入预算器 | system prompt tokens 计入压缩阈值, 防反身性空转 |
| 6 | 输入分类器 | task/chat/affective/meta 四分类, 偏向 task |
| 7 | 用户画像 User Model | SQLite 持久化 + 双路径更新 + B2 注入 |

### 4.4 记忆引擎激活 — 全部完成 (2026-06-06)

| 任务 | 内容 | 状态 |
|---|---|---|
| T2 | 开 config: memorySearch.sources + experimental.sessionMemory | ✅ |
| T3 | 全量回填: 121 files · 508 chunks | ✅ |
| T4 | 并行验证: TS FTS trigram + pplx-embed-v1-4b | ✅ |
| T4b | FTS tokenizer: unicode61 → trigram | ✅ |
| T4c | Embedding 模型: → perplexity/pplx-embed-v1-4b (2560d) | ✅ |
| T5 | 切换 + 清理: 删 Python session_search 全套 | ✅ |
| T6 | RECALL 注入: attempt.ts 每轮自动 search top-5 | ✅ |

### 4.5 delegate_code_task — 已完成 (2026-06-05)

Code Mode (`/code` `/exit`) 已废弃，由子代理分发替代。核心设计：**子代理是侦察兵，不是执行者** — 只读工具集 + 结构化摘要返回，防止主 session 上下文膨胀。

### 4.6 deploy.sh 增强 — 5 Guard / 12 Step

修复了"代码提交但 dist 未部署"的 3 个结构性缺陷：
1. Clean slate deploy（rm -rf + cp -r + 文件数下限检查）
2. Extensions 同步（新增 Step 9）
3. Dist 完整性校验 + E2E 验证

### 4.7 类型检查清零 — tsgo 53→0

全仓类型错误清零，`npm run check` 不再阻塞。

### 4.8 Tool Parity 进度 — 14/17 = 82.4%

已完成：Task 0-13（接口扩展 + Grep/Bash/Todo/Edit/Read/Write/Find/Ls/PlanMode/Task/Team + web_fetch 注册 + WebSearch 超预期 5 provider）

---

## 五、进行中工作

### 5.1 序 8 Conversation 层 + Handoff — 阶段 1-4 完成，阶段 5 待续

**设计红线**：延续必须双轨 — 精确执行状态走结构化 Handoff Packet (B3)，背景知识走 memory_search 召回 (B4)。

已落地模块：`src/session-rotation/` (11 文件, 134 测试)

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | 核心类型 + Conversation Store (SQLite) | ✅ |
| 2 | rotate_session 工具 + B3 Handoff 注入 + 四层注册 | ✅ |
| 3 | 自动轮换触发 (token 压力检测 + safety 门控) | ✅ |
| 4 | Task Segment 追踪 + 双轨索引 + CompactionSummary | ✅ |
| 5 | 端到端验证 (需可用模型) | 待续 |

**深度审查暴露的断链已修复** (2026-06-07)：
- executeRotation 死代码 → buildMacroEntryFromHandoff 共享函数 + 工具轮换沉淀 macro
- updateDualTrackIndex 覆盖冲突 → 保留既有 macro
- rotate_session 违反 AgentTool 契约 → execute 双参 + content/details/parameters/label
- tsgo 19→0, 测试 131→134

**诚实标注 — 未做（需架构决策）**：
- executeRotation 全套接入（需 attempt 层运行时句柄）
- SafetyPoint 运行时检查（需 attempt auto-trigger 路径补）
- TaskSegmentTracker → handoffPacket 自动填充（架构改动较大）
- 端到端验证（需可用模型 + 部署后跑出首条 conversation db 记录）

### 5.2 W0 闭环 session-rotation — 规划完成，待执行

| 任务 | 修 | 严重度 | 卡点 | 解决思路 |
|---|---|---|---|---|
| W0-T1: 安全点运行时真检查 | AS4/P2 | 🔴 高 | pendingToolCalls/hasActiveBackgroundLane 写死 0/false | 需从 attempt 层获取真实运行时状态 |
| W0-T2: RECALL 注入位置下沉 | AS6/P5 | 🟡 中 | dual-track/handoff/recall 全 prepend 到 prompt 开头 | 改为 append 到消息流末尾（贴近生成位置） |
| W0-T3: CONSOLIDATE 回写接线 | AS3/P3 | 🔴 高 | 归档 session 不写 `src/memory`，模糊轨无生产者 | 压缩后提取 episode → 回写 `getMemorySearchManager` |
| W0-T4: executeRotation 去留决策 | AS1-2/P1 | 🔴 高 | executeRotation 零生产调用 = 死代码 | 架构决策：保留为自动轮换接入点 or 显式废弃 |
| W0-T5: 注入预算器升级 | AS5/P4 | 🟡 中 | injection-budget.ts 存在但未喂给轮换/压缩 | computeInjectionBudget 接入运行时，统一预算器 |
| W0-T6: 端到端验证 + 部署 | AS7/P6 | 🔴 高 | 全局 dist 无此模块，无 conversation 表 | 部署后跑出首条 conversation db 记录 |

**W0 依赖图与执行顺序**：
```
W0-T2 (RECALL 下沉) ─── 独立，可先做（改动最小、效果最明确，热身）
W0-T1 (安全点真检查) ─── 独立，可先做（需查 SDK 接口，可能要框架层改动）
W0-T4 (executeRotation 决策) ─── 独立，需先决策（决定后续方向）
W0-T5 (注入预算器升级) ─── 独立，可先做（涉及框架层 SDK 参数扩展）
W0-T3 (CONSOLIDATE 接线) ─── 依赖 T1（安全点正确才能安全回写）
W0-T6 (端到端验证) ─── 依赖 T1-T5 全部完成
```

---

## 六、架构设计核心亮点

### 6.1 分层上下文注入架构 (B0-B4 五带)

按变化频率排序注入，保护 KV-cache 前缀复用：

```
B0 IDENTITY      身份/人格/安全红线         版本级·几乎不变
B1 CAPABILITY    工具定义 + skill 索引      部署级·随构建变
B2 ENVIRONMENT   World Model 摘要           慢变·reconcile 周期
══ CACHE ANCHOR ══ KV-cache 断点 ════════════════════════
B3 WORKING SET   压缩 summary + 会话事实    会话内变·压缩时
B4 EPHEMERAL     RECALL top-k + 临时知识    ★每轮变★
MESSAGES         历史 + 当前消息            每轮追加
```

**关键病灶修复**：RECALL 从 system prompt append 改为消息流末尾 B4 注入，一举满足缓存复用(R1)、指令数据分离(R4)、贴近生成位置(R5)。

**五条设计原理**：
| # | 原理 | 对设计的约束 |
|---|---|---|
| R1 | KV-cache 前缀复用 | 注入必须按变化频率从低到高排序 |
| R2 | 位置注意力 U 型 | 强指令放最前，当前约束在消息末尾再压一次 |
| R3 | 注意力预算/信噪比 | 每个 Band 设 token 预算 + 相关性门槛 |
| R4 | 指令/数据分离 | 检索数据标注来源，与指令物理隔离 |
| R5 | recency | 最相关的即时上下文放最末 |

### 6.2 参与者持续性架构 (Participant Continuity)

核心主张：**对模型而言"会话/窗口"不存在，唯一单元是 Participant**。

- **工作空间**：只留 active task 完整内容，其余以索引形态存在
- **认知图谱**：只增不减的索引累积层，节点间有边构成可遍历的认知网络
- **双形态延续**：精确状态走结构化 Handoff（精确轨），背景关联走认知图谱 + 语义召回（模糊轨）

**已拍板决策 D1-D10**（不可推翻）：
- D1: 连续性主键 = participant_id（跨私聊/群/渠道统一）
- D2: 群聊 Participant + Locus 双绑双写
- D3: 认知图谱节点三粒度（一期只做 task+session）
- D4: 图谱边 = 混合（硬边持久化 + 软边语义动态生成）
- D5: agent 即 Participant，trust tier 独立
- D6: agent↔agent 协作不可自主发起
- D7: Mirror Lane 统一原语
- D8: core admin = 唯一系统级安全主体
- D9: 汇报颗粒度 = 首达 + 行动 + 摘要
- D10: 同步目标解析 = 自动优先 + 手动兜底

**五条不变式**：
1. **I1 — 工作空间单任务**：任一时刻只持有 active task 的完整内容
2. **I2 — 索引只增**：认知图谱节点/硬边只追加，不被替换清空
3. **I3 — 窗口对模型透明**：模型 prompt 里不出现 session/window/rotate 概念
4. **I4 — 双形态延续**：轮换必带精确轨(Handoff)，模糊轨只做背景补充
5. **I5 — Participant 为连续性主键**：跨渠道统一认知线

### 6.3 超级计算机管理员 Agent (Super Computer Administrator)

**一句话**：不造新记忆系统 — 把已有的 TS 语义记忆引擎从"被动孤岛工具"重构为"主动认知中枢"，新增 World Model 数字孪生，用显式状态机把"感知→检索→行动→沉淀"闭环。

**6 态认知循环**：
```
PERCEIVE → RECALL → PLAN → ACT → REVIEW → CONSOLIDATE → (回 PERCEIVE)
```

**四类记忆**：

| 类型 | 记什么 | 现状 |
|---|---|---|
| World Model | 机器数字孪生 | 完全没有（最关键缺口） |
| Episodic | 危险操作/配置变更/结果 | 散落 JSONL + 手工 PITFALLS |
| Semantic | 跨会话事实/偏好/决策 | 引擎在，已主动用 |
| Procedural | 部署/重启/排查 runbook | skills 只读不写 |

### 6.4 知识库与自我进化

**核心范式**：上下文 = 信息接收系统。注入预算的天花板是固定的，知识是无限增长的 → 注入内容/知识总量必然脱钩 → **注入只能是索引**。

**索引化注入两段式**：
1. 系统强制注入轻量索引信号（指针）
2. agent 判断相关 → 主动 `memory_get` 取完整内容

**输入分类器**：task/chat/affective/meta 四分类，误判成本不对称 → 偏向判定 task。

---

## 七、人机协作策略

### 7.1 协作模式定义

ElysiaClaw 的维护者是非专业程序员，采用 **AI 协作开发模型**：

| 角色 | 职责 |
|---|---|
| 架构师 (人类) | 设计决策拍板、方向把控、红线划定、验收审查 |
| AI 协作者 | 代码实现、测试编写、文档维护、技术债清理 |

### 7.2 决策机制

- **DECISION 标记**：已与 owner 拍板的决策，AI 不可擅自推翻（如 D1-D10）
- **PROPOSAL 标记**：设计建议，待实现，需 owner 确认
- **KNOWN 标记**：有代码/grep 证据的事实
- **诚实标注**：Sprint 结束时明确标注"未做"项，不夸大完成度

### 7.3 防跑偏机制

1. **DO-NOT-DRIFT 清单**：参与者持续性架构第十一章，任何实现前必读
2. **PITFALLS.md 94+ 坑记录**：高频警告 13 条 + 详细踩坑记录
3. **Definition of Done**：功能完成必须全部勾选，不接受"差不多"
4. **代码级审查**：用 grep 证据验证"已声明落实的系统是否真正接入运行时"（`grep -rn funcName src | grep -v test`，零命中即死代码）
5. **Sprint 诚实标注**：明确区分"代码+测试存在"与"生产运行"
6. **三级完成标注**：✅ 生产验证通过 / 🔄 已接线待验证 / 📝 代码存在

### 7.4 接手流程

AI 协作者接手时的标准阅读顺序：
1. HANDOFF.md → 当前状态快照
2. SYSTEM.md → 运行环境和规则
3. ARCHITECTURE.md → 架构蓝图
4. PITFALLS.md → 避开已知坑
5. PARTICIPANT-CONTINUITY-ARCHITECTURE.md → 总架构决策 + DO-NOT-DRIFT
6. ROADMAP.md → 选择下一个 sprint

### 7.5 工作规则

1. 写文件用 Python，不用 heredoc（#1）
2. 字符串替换用 `str.replace()`，不用 sed（#2）
3. 新增工具必须检查四层注册（#51）
4. deploy.sh 后验证 gateway（#22b）
5. YAML 缩进敏感（#30）
6. pnpm = elysiaclaw，npm = pi-mono，不可混用（#49/#52）
7. 大文件分段读取（#78）
8. 工具调用失败先报告再重试，最多 2 次（#80）
9. 信 ✅ 前先 grep 生产调用者（#85）
10. wrapToolDefinition 必须逐字段传播（#82）
11. 测试 `describe()` 回调不准捕获 `beforeEach` 变量（#84）

---

## 八、残余技术债与阻塞项

### 8.1 阻塞项

| 项目 | 阻塞原因 | 解决思路 |
|---|---|---|
| delegate_code_task Telegram 端到端验证 | 主模型不可用 | 等模型恢复后验证 |
| 序 8 阶段 5 端到端验证 | 需可用模型 + 部署后跑出首条 conversation db | W0 闭环后部署验证 |
| Telegram 完整 stdout 输出 | 需 `verboseLevel: "full"` 机制改造 | 渠道层改造 |

### 8.2 技术债

| 项目 | 风险 | 严重度 | 解决思路 |
|---|---|---|---|
| OpenRouter→阿里云路由劫持 | 临时规避，根因未修 | 🟡 中 | 对受影响模型添加 `baseUrl` 直连 |
| sessions chunks 47% CLAUDE.md 注入噪音 | 后续 World Model 阶段去噪 | 🟡 中 | 回写前过滤 project-memory 噪音 |
| `computeInjectionBudget` 未接入运行时 | SDK 用硬编码阈值，不随 1M 窗口缩放 | 🟡 中 | W0-T5 注入预算器升级 |
| `input-classifier` 数据源偏窄 | 短陈述句落入 task，identity.name 提不出 | 🟡 中 | 扩展分类特征 |
| stripPluginOnlyAllowlist 时序问题 | cosmetic，不影响功能 | 🟢 低 | 低优先 |
| Tool Parity 剩余 Task 14/15/16 | AskUserQuestion / MCP / 并行执行 | 🟡 中 | 按 PLAN 优先级逐步实施 |
| attempt.ts 复杂度失控 | 2861+ 行上帝文件 | 🔴 高 | 拆分为 system-prompt-builder + injection-coordinator + rotation-trigger |
| 设计-实现鸿沟 | 多模块"代码+测试存在"但未接线生产路径 | 🔴 高 | W0 闭环 |

---

## 九、落地措施路线图

### Phase 1 — 闭环现有轮换 (W0, 当前优先)

**目标**：把序 8 已声明"完成"的模块真正接入运行时

| 步骤 | 任务 | 依赖 | 预期产出 | 卡点与解决 |
|---|---|---|---|---|
| 1 | W0-T2: RECALL 注入位置下沉 | 无 | B4 注入位置修正，KV-cache 命中率提升 | prepend→append 到消息流末尾 |
| 2 | W0-T4: executeRotation 去留决策 | 无 | 架构决策：保留为自动轮换接入点 or 重构 | 需 owner 拍板 |
| 3 | W0-T1: 安全点运行时真检查 | 无 | pendingToolCalls/backgroundLane/cooldown 真检查 | 需从 attempt 层获取运行时状态 |
| 4 | W0-T5: 注入预算器升级 | 无 | computeInjectionBudget 接入运行时 | 涉及框架层 SDK 参数扩展 |
| 5 | W0-T3: CONSOLIDATE 回写接线 | T1 | 操作结果沉淀回记忆引擎 | 压缩后提取 episode → 回写 |
| 6 | W0-T6: 端到端验证 + 部署 | T1-T5 | 首条 conversation db 记录 | 需可用模型 |

### Phase 2 — 参与者持续性落地 (W1-W5)

| 阶段 | 内容 | 核心产出 | 关键卡点 |
|---|---|---|---|
| W1 | 认知图谱一期 | task+session 节点 + 硬边持久化 + 软边语义查询 | 当前横轴(图的边)零实现，macro/micro 是扁平数组 |
| W2 | 身份/会话 | participant_id 解析 + 跨渠道统一连续线 + 群双写 | conversation-store 需从绑 chatId 改为绑 participantId |
| W3 | 协作/安全 | Mirror Lane 原语 + agent trust tier + core admin | 零实现；复用 lanes.ts(s08) + abort |
| W4 | topic 二期 | 跨会话主题聚类 | 需另起聚类算法/模型 |
| W5 | 统一打磨 | 全链路集成测试 + 性能调优 | — |

### Phase 3 — World Model 数字孪生 (SUPERADMIN Phase 2)

| 步骤 | 内容 | 核心产出 | 关键卡点 |
|---|---|---|---|
| 1 | 数据模型 + Schema | WorldEntity discriminated union + world_entities/world_changes 表 | — |
| 2 | Probes 采集层 | service/port/disk/network/package/config/deployment 7 个 probe | probe shell 成本未量化；sudo 依赖需降级 |
| 3 | Reconcile 引擎 | 定期(30min)采集 → diff → 更新 World Model | 漂移窗口：两次 reconcile 间外部变更不可见 |
| 4 | B2 注入 | World Model 摘要注入 system prompt B2 带 | B2 颠簸：reconcile 过频会频繁失效前缀 |
| 5 | CONSOLIDATE 闭环 | 操作结果 → world_changes + 回喂 memory 引擎 | 依赖可用模型做提炼；降级只存原始 episode |

### Phase 4 — 认知循环状态机 (SUPERADMIN Phase 3-4)

| 步骤 | 内容 | 关键卡点 |
|---|---|---|
| 1 | 6 态状态机外壳（不重写 attempt.ts，显式包装） | ⚠️ 包壳意味着隐式流程+显式状态两套逻辑并存，调试复杂度飙升；建议先拆分 attempt.ts |
| 2 | PERCEIVE/RECALL/PLAN/ACT/REVIEW 逐态迁移 | — |
| 3 | CONSOLIDATE 态接入（World Model + episode + 技能固化） | 依赖 Phase 2 + 可用模型 |
| 4 | 状态机 exhaustive switch + 编译期漏态检测 | — |

### Phase 5 — Tool Parity 补全 + 功能扩展

| 优先级 | 任务 | 内容 | 卡点 |
|---|---|---|---|
| 🟡 中 | Task 14 | AskUserQuestionTool (Telegram inline keyboard) | 需 Telegram Bot API inline keyboard 交互 |
| 🟡 中 | Task 15 | MCP 协议集成 | 最复杂，需读 MCP SDK 文档，可能需多个 Sprint |
| 🟡 中 | Task 16 | 并行执行引擎 | 依赖 Task 0 能力声明；需 StreamingToolExecutor |
| 🟢 低 | Task 5-11 | Read/Write/Find/Ls/PlanMode 等能力声明 | ✅ 已全部完成 |

---

## 十、关键诊断坐标

开发与调试时的关键文件定位：

| 坐标 | 文件 | 问题 | 解决状态 |
|---|---|---|---|
| `compact.ts:918` | 压缩阻塞无 emit | 压缩期间 UX 黑洞 | ✅ WS-1 已修 |
| `typing.ts:28` | TTL 2min | 静默期 typing 消失 | ✅ WS-1 心跳续命 |
| `bot-message-dispatch.ts:133` | reasoning 默认 off | 思考过程不可见 | ✅ WS-2 已修 |
| `attempt.ts:1781` | RECALL append 进 system | 毁 KV-cache 前缀 | ✅ 序 1 已修 |
| `attempt.ts:2624-2638` | B3/B4 注入 | Handoff + RECALL 注入点 | 🔄 接线待验证 |
| `attempt.ts:1433-1438` | TaskSegmentTracker | 任务段追踪初始化 | 🔄 接线待验证 |
| `attempt.ts:2783-2784` | 安全点硬约束写死 | 自动轮换假自动 | ⬜ W0-T1 |
| `sdk.ts:374` | contextPressureBudget | 注入预算扣减阈值 | 🔄 基础接入，完整版待升级 |
| `elysiaclaw.json:357` | blockStreamingDefault | `"on"` 导致 `canStreamAnswerDraft=false` → answerLane.stream 未创建 → onPartialReply=undefined → text_delta 流式输出被丢弃 | ✅ 改为 `"off"` (2026-06-08) |
| `get-reply-directives.ts` | resolvedBlockStreaming | agentCfg.blockStreamingDefault 默认 "on" 启动块流式，与流式草稿预览互斥 | ✅ 配置级修复 (2026-06-08) |

---

## 十一、测试基线

| 包 | 结果 |
|---|---|
| @mariozechner/pi-agent-core | 36/36 ✅ |
| @mariozechner/pi-coding-agent | 907/907 ✅ (16 预存失败全部修复) |
| @mariozechner/pi-tui | 505/506 (1 flaky) |
| session-rotation 模块 | 134/134 ✅ |
| user-model 模块 | 23/23 ✅ |

---

## 十二、文档索引

| 文档 | 定位 |
|---|---|
| SYSTEM.md | 运行环境 + 构建部署 + 文件索引 |
| ARCHITECTURE.md | 架构蓝图 + 12 层框架 + 数据流全景 |
| ROADMAP.md | 中长期规划 + Sprint 日志 |
| SPRINT.md | Sprint 工作台（当前进行中任务） |
| HANDOFF.md | AI 接手文档 + 当前状态快照 |
| PITFALLS.md | 94+ 踩坑记录 |
| SUPERADMIN-AGENT-DESIGN.md | 超算管理员 Agent 设计（Phase 1 完成，Phase 2 待启动） |
| PARTICIPANT-CONTINUITY-ARCHITECTURE.md | 参与者持续性总架构（设计宗旨锁定，W0-W5 待落地） |
| CONTEXT-INJECTION-ARCHITECTURE.md | 分层上下文注入架构（B0-B4 五带 + KV-cache 优化） |
| SESSION-ROTATION-CONTINUITY.md | 会话轮换与跨会话任务延续（被 PARTICIPANT-CONTINUITY 统摄，L2 细节稿） |
| KNOWLEDGE-BASE-EVOLUTION.md | 知识库与自我进化（索引化注入 + 输入分类 + 用户画像） |
| TELEGRAM-UX-CONTEXT-PLAN.md | Telegram 输出体验 × 上下文协同计划 |
| SUBAGENT-CODE-DELEGATION.md | 子代理代码委派技术设计 |
| TOOL-PARITY-PLAN.md | Tool Parity 迁移计划（14/17 完成） |
| archive/DELEGATE-CODE-TASK-PLAN.md | 子代理代码委派实施计划（已完成） |
| archive/MEMORY-ACTIVATION-RUNBOOK.md | 记忆引擎激活执行手册（已完成） |
| archive/CLAUD-CODE-COMPARISON.md | Claude Code vs ElysiaClaw 逐层对标 |
| archive/USER-PITFALLS.md | 旧 OpenClaw/Windows 时代历史踩坑 |
| archive/sprint-history.md | 18 个已完成 Sprint 的完整工程记录 |

---

## 十三、高频踩坑模式与防范

> 以下是从 94+ 条踩坑记录中提炼的**反复出现的模式**，理解模式比记忆单条坑号更重要。

### 模式 1：工具注册四层遗漏

**表现**：新工具在 TUI 可用但 Bot 不可用，或 dist 中存在但 `src/index.ts` 未导出
**根因**：四层注册（allTools → pi-tools.ts → tool-catalog.ts → elysiaclaw.json）手动维护，容易遗漏
**防范**：deploy.sh Guard 3 自动检查 + 每次新增工具后跑完整四层验证
**关联坑号**：#16/#23/#46/#47/#51/#54

### 模式 2：Bot/TUI 双路径差异

**表现**：功能在 TUI 正常但 Bot 异常，或反之
**根因**：TUI 走 `createPiCodingTools`，Bot 走 `createElysiaClawCodingTools`，完全独立
**防范**：新增/修改功能必须两边都测试
**关联坑号**：#17/#25/#39/#54

### 模式 3："代码+测试存在" ≠ 完成

**表现**：模块标记完成但生产不工作
**根因**：测试只验证模块内部逻辑，不验证接线闭环
**防范**：信 ✅ 前先 `grep -rn funcName src | grep -v test`；必须有生产路径实跑 + 端到端验证
**关联坑号**：#85/#91/#92/#93

### 模式 4：Python 补丁脚本重复应用

**表现**：代码块重复出现，TypeScript 编译报错
**根因**：旧补丁 marker 残留，第二次替换又匹配了一次
**防范**：补丁脚本替换前检查目标是否已被替换过
**关联坑号**：#37/#22b

### 模式 5：包管理器混用

**表现**：`npm run build` 报大量类型错误，版本号不对
**根因**：pnpm 从 registry 拉取旧版本放进 `node_modules/.pnpm/`
**防范**：pi-mono 用 npm，elysiaclaw 用 pnpm，永远不混用
**关联坑号**：#49/#52

---

## 十四、Sprint 完整日志

| # | Sprint 名称 | 日期 | 关键产出 | 主要卡点 |
|---|---|---|---|---|
| 1 | 流式输出修复 | 06-07 | toolcall 事件处理 + reasoning 默认 stream | toolcall_start/delta/end 被过滤丢弃；reasoning 默认 off |
| 2 | 序 8 深度审查 | 06-07 | executeRotation 死代码修复(#91-94) | MacroIndex 恒空；违反 AgentTool 契约 |
| 3 | 早期工具落地测试 | 06-07 | 25 新测试 + grep 排序代码异味归档 | grep files_with_matches mtime 排序 O(n²) |
| 4 | 序 1-7 健全性审核 | 06-07 | ingestUserMessage 写路径 + Pitfall #77 | 用户画像写路径死代码 |
| 5 | 序 1-7 测试加固 | 06-07 | 77 新测试 + Pitfall #73-75 | wrapToolDefinition 扩展字段 undefined |
| 6 | BashTool + GrepTool | 04-10 | Task 2 BashTool + GrepTool slicedOutput 修复 | slicedOutput 截断上下文行 |
| 7 | GrepTool 参数补全 | 04-10 | count 模式 + mtime 排序 + 能力声明 | output_mode/-A/-B/type/offset/multiline 缺失 |
| 8 | ToolDefinition 扩展 | 04-10 | 11 字段扩展 + type re-export 修复 | type re-export 导致类型错误 |
| 9 | Architecture Audit | 04-09 | 四层注册发现 + 工具缺口映射 | allTools 缺少 5 个工具 |
| 10 | delegate_code_task | 06-05 | 子代理分发工具 + Code Mode 清理 | Code Mode 废弃决策 |
| 11 | 记忆引擎激活 | 06-06 | TS memory_search 取代 Python session_search | 引擎从未通电；Python 旁路弱实现 |
| 12 | deploy.sh 增强 | 06-06 | clean-slate deploy + extensions sync + E2E | 代码提交但 dist 未部署 |
| 13 | Telegram 流式输出 | 06-06 | Tool Lane + onToolStart/onToolResult | — |
| 14 | Python session_search | 06-06 | ⚠️ 已被 TS memory_search 取代 | — |
| 15 | tsgo 类型清零 | 06-07 | 7 类错误修复 + Pitfall #86 | 重复 const/wrapToolDefinition/describe 捕获 |
| 16 | 引擎设计审查 | 06-07 | 三级完成标注标准 + 9 文件修正 | "✅" 真实语义是"代码+测试存在" |
| 17 | 架构优化 | 04-05 | BUG-1~4 修复 + deploy.sh 守卫 | 四脚本部署路径硬编码 |
| 18 | Code Mode Phase 0 | 04-05 | attempt.ts /code /exit 检测 | — |
| 19 | 流式输出修复 — blockStreamingDefault 错误抑制 | 06-08 | 根因定位 + 配置修复 + 端到端验证 | blockStreamingDefault="on" 抑制 answerLane.stream 创建 |

---

*本文档基于 2026-06-08 的引擎文件状态生成。项目处于"框架层竣工 + 认知架构设计完成 + 生产接线进行中"的阶段。核心矛盾是"代码+测试存在"与"生产运行"之间的鸿沟——W0 闭环是当前最优先的落地措施。*
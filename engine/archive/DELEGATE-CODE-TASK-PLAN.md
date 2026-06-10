# delegate_code_task — 实施计划

> 生成时间: 2026-06-05
> 状态: ✅ 已完成 (2026-06-05)

---

## 1. 设计决策摘要

### 已废弃
- **Code Mode** (`/code` `/exit`) — 不再作为独立模式存在。代码能力是 agent 的内置手段，不是特殊状态。

### 已确认
- `delegate_code_task` 是 **elynx 应用层工具**，不在 pi-coding-agent 框架层
- 内部封装 `spawnSubagentDirect()` (subagent-spawn.ts)
- 子代理生命周期由 elynx 子代理系统管理（37 个文件，完整的 spawn/kill/steer/list/announce）
- 完成通知是 push-based（announce 机制），主 agent 无需轮询
- 工具限制通过 `pi-tools.policy.ts` 的 deny list 机制实现
- 子代理和主 agent 共享同一个 RateLimitScheduler（P2-D）
- 子代理使用 `mode: "run"`（一次性执行，不保持 session）

### 架构层级

delegate_code_task (新工具)
→ elynx/tools/delegate-code-task.ts
→ spawnSubagentDirect() (subagent-spawn.ts)
→ callGateway("agent") (Gateway RPC)
→ 子 agent session (fresh context)
→ 只读工具集 (policy 限制)
→ 精简 system prompt
→ 完成后 announce 回主 session

---

## 2. 待读取文件（下个窗口第一步）

在开始写代码前，必须读取以下文件：

| 文件 | 目的 | 状态 |
|---|---|---|
| `elynx-tools.ts` L30+ | `createElynyxTools()` 完整实现，理解 elynx 工具注册模式 | 待读 |
| `attempt.ts` 完整 | system prompt 构建 + 消息注入点，确定分类器注入位置 | 待读 |
| `common.ts` L1-80 | `jsonResult()`, `readStringParam()` 等工具辅助函数 | 待读 |
| `subagent-announce.ts` `buildSubagentSystemPrompt` | 子代理 system prompt 构建方式 | 待读 |
| `pi-tools.ts` L227-600 | `createElynyxCodingTools()` 中 sessions_spawn/subagents 注册方式 | 待读 |
| `tool-catalog.ts` sessions_spawn/subagents 定义 | 工具在 catalog 中的 profile/section 归属 | 待读 |

---

## 3. 实施步骤

### Step 1: 创建工具文件

**文件**: `elynx/src/agents/tools/delegate-code-task.ts`

```typescript
// 关键接口
export function createDelegateCodeTaskTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  // ... 同 createSessionsSpawnTool 的 opts
}): AnyAgentTool
```

Schema:

```typescript
{
  task: string;           // 任务描述
  scope?: string;         // 搜索范围限定 (目录/glob)
  files?: string[];       // 已知需要关注的文件
  expected_output?: string; // 期望的输出格式
}

内部逻辑:

1.将 task + scope + files + expected_output 组装为完整的子代理任务描述
2.在任务描述前注入"只读指令 + 结构化输出格式"的 system prompt 段
3.调用 spawnSubagentDirect():
mode: "run" (一次性)
runTimeoutSeconds: 120
cleanup: "keep" (便于调试)
label: "code-analysis" (标识)
expectsCompletionMessage: true
4.返回 spawn 结果（accepted/error）

只读约束: 通过 pi-tools.policy.ts 现有机制，配置 tools.subagents.tools.deny 中加入 write/edit/exec 等写操作工具。或者在 SUBAGENT_TOOL_DENY_ALWAYS 中追加（需确认是否应修改通用 deny list）。


Step 2: 工具注册（四层链）

注意: delegate_code_task 在 elynx 层定义，不需要 pi-coding-agent 的四层链。


注册路径：

1.工具定义: elynx/src/agents/tools/delegate-code-task.ts (Step 1)
2.createElynyxTools(): elynx/src/agents/elynx-tools.ts — import + 注册
3.tool-catalog.ts: 添加 delegate_code_task 定义（section: "sessions", profile: "coding"）
4.elynx.json tools.allow: 添加 delegate_code_task

Step 3: 子代理 system prompt 注入

在 spawnSubagentDirect 的 task 参数中嵌入精简 coding prompt：

```
[CODE_ANALYSIS_INSTRUCTIONS]
你是一个代码分析子代理。你的唯一任务是执行给定的代码分析任务，返回结构化结果。

## 执行策略（严格遵守）

### 搜索优先
1. 先用 grep 定位关键代码位置，不要直接读文件
2. 用 find 确认文件结构，再针对性读取
3. 只读 grep 命中区域的相关上下文，不要读整个文件

### 渐进深入
1. 第一轮: grep + find，建立全局视图
2. 第二轮: 读关键文件的核心段落
3. 第三轮: 深入特定实现细节（如有必要）
4. 如果已足够回答任务，立即停止，不要过度调查

### Token 意识
- 你只有有限的上下文空间
- 每次读文件都是成本，问自己："这行对回答任务有帮助吗？"
- 宁可返回部分结果 + "由于上下文限制，以下区域未深入调查"

### 输出格式（严格遵守）
分析完成后，你的最后一条消息必须是以下格式：

---RESULT_START---
summary: [2-5 句话概括核心发现]
findings:
- [发现1: 具体描述 + file:line 引用]
- [发现2: ...]
files_analyzed: [file1, file2, ...]
recommendations: [主 agent 可执行的建议动作]
confidence: [high/medium/low]
partial: [true/false]
---RESULT_END---

### 禁止事项
- 不要写入或修改任何文件
- 不要闲聊，直接执行任务
- 不要重复已经读过的内容

[CODE_ANALYSIS_INSTRUCTIONS_END]

## 任务
{task}

## 搜索范围
{scope}

## 重点关注文件
{files}

## 期望输出
{expected_output}

Step 4: 主 agent system prompt 策略指引

需要在主 agent 的 system prompt 中添加任务分发决策流程。


注入位置: attempt.ts 中 createSystemPromptOverride() 附近，在 system prompt 尾部追加。


策略内容:

```
## 代码任务分发决策流程

### 评估任务类型
| 类型 | 标准 | 行动 |
|------|------|------|
| 简单直接 | 读单个指定文件、单文件小修改、快速 grep | 直接执行 |
| 复杂代码 | 涉及 3+ 文件、需要理解系统/模块/架构 | delegate_code_task |
| 边界模糊 | 2 个文件、不确定范围 | 先 delegate_code_task |

### 关键规则
1. 不要先自己调查再决定是否分发 — 如果你已在主 session 中读了 2 个以上文件，说明你本应分发
2. 宁可多分发，不可少分发 — 分发的代价远低于上下文污染的代价
3. 分发后不要再重复子代理的工作 — 直接使用子代理的返回结果
4. 子代理只读不写 — 如需修改代码，审查结果后你自行执行或向用户确认

Step 5: Layer 0 消息分类器（可选，首期可不实现）

在 attempt.ts 中消息到达 LLM 之前运行正则分类，注入路由提示。


首期策略: 先只依赖 system prompt 引导，不实现自动分类器。观察 agent 是否能自主判断。如果总是先入为主自己调查，再实现分类器。


Step 6: 构建部署测试

```bash
cd ~/projects/pi-mono && npm run build    # pi-mono 框架层（delegate_code_task 不在此层）
cd ~/projects/pi-mono/elynx && pnpm build  # 可能触发 DTS 错误，需绕过
cd ~/projects/pi-mono && ./deploy.sh
elynx gateway restart
```

# 测试
# Telegram: "梳理 P2-D 速率调度器的完整调用链"
# 验证: 主 session 上下文增长 < 1000 token

Step 7: 文档更新

文档	变更
ROADMAP.md	删除 Code Mode 内容，新增 Sub-agent Delegation
SPRINT.md	更新当前 Sprint 目标
ARCHITECTURE.md	更新架构图
SYSTEM.md	删除 Code Mode 相关，新增 delegate_code_task
PITFALLS.md	追加新坑（如有）
CLAUDE.md	删除 Code Mode Phase 0 内容
HANDOFF.md	更新项目状态


4. 完成标准

- [x] delegate_code_task 工具在 TUI 和 Bot 两条路径都可用
- [x] 子代理具备只读工具集（read/grep/find/ls/git-log/diff/status）
- [x] 子代理完成通知通过 push-based announce 返回主 session
- [x] 主 agent system prompt 包含分发决策流程
- [x] 单文件任务主 agent 直接执行，不分发
- [x] 多文件任务主 agent 自动分发
- [x] npm run build 无错误（pi-mono 层）
- [x] 测试通过 858/861 不回退
- [x] 所有引擎文件路径已修正为 ~/projects/pi-mono/
- [ ] Telegram 端到端测试通过


5. 风险与注意事项

风险	说明	缓解
DTS 错误阻塞	pnpm build 在 build:plugin-sdk:dts 阶段报 6 个 TS 错误	绕过: node scripts/tsdown-build.mjs
子代理工具限制	SUBAGENT_TOOL_DENY_ALWAYS 可能不够精确	需要在 elynx.json tools.subagents.tools.deny 中配置
agent 不分发	LLM 可能总是自己调查	system prompt 强引导 + Layer 2 后置提醒
announce 格式	子代理结果可能被截断或格式化	验证 announce 链路完整性
路径偏移	项目根目录已从 ~/pi-mono/ 变为 ~/projects/pi-mono/	引擎文件已全部修正


6. 与现有机制的关系

现有机制	关系	说明
sessions_spawn	基础	delegate_code_task 内部调用 spawnSubagentDirect()
subagents (list/kill/steer)	管理	可用 subagents 工具查看/控制 delegate 产生的子代理
pi-tools.policy.ts	权限	子代理工具 deny list 决定只读约束
P2-D RateLimitScheduler	共享	子代理和主 agent 共享同一个调度器
s06 Context Compression	独立	子代理有独立的上下文窗口和压缩阈值
task_assign (s07)	并行	task_assign 是持久化后台任务，delegate_code_task 是即时分析
team_create (s09)	不使用	子代理是临时的，不需要持久化团队
Code Mode	已废弃	删除所有 Code Mode 相关内容


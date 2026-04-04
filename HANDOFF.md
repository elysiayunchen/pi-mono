# OpenClaw / pi-mono 项目交接文档

## 一、项目概览

OpenClaw 是一个基于 pi-mono 的多渠道 AI 网关（Telegram/Discord/WhatsApp 等）。
pi-mono 是 OpenClaw 的底层依赖库，提供 agent loop、工具系统、TUI 等核心能力。
本项目日志是为了让下一位 AI 接手项目并进行下一步针对 Claude Code 的设计思维而对 OpenClaw 源代码的优化改进的。本项目经理并非专业程序员，特此说明，你我为协作关系，需要你发挥卓越工程师的能力与我进行沟通并达成高效的开发。

- GitHub 原仓库: https://github.com/badlogic/pi-mono
- 我们的 fork: https://github.com/elysiayunchen/pi-mono
- 分支: `feat/claude-code-inspired-improvements`

## 二、项目结构

```text
pi-mono/
├── packages/
│   ├── tui/                      # 终端 UI 组件（@mariozechner/pi-tui）
│   ├── ai/                       # LLM API 封装（@mariozechner/pi-ai）
│   ├── agent/                    # Agent 核心循环（@mariozechner/pi-agent-core）
│   ├── coding-agent/             # 编码 agent（@mariozechner/pi-coding-agent）
│   ├── mom/                      # 内存/会话管理
│   ├── web-ui/                   # Web UI
│   └── pods/                     # CLI 入口（openclaw 命令）
```

### 核心调用链

```text
OpenClaw CLI
  └── packages/coding-agent/src/core/sdk.ts (createAgentSession)
        └── new Agent({
              convertToLlm,       # 消息转换
              transformContext,   # 上下文转换（压缩在这里接入）
              streamFn,           # API 调用
              beforeToolCall,     # 工具执行前钩子（权限在这里接入）
              afterToolCall,      # 工具执行后钩子
              toolExecution,      # "sequential" | "parallel" | "smart"
            })
                  │
                  └── packages/agent/src/agent.ts (Agent 类)
                        │
                        └── packages/agent/src/agent-loop.ts (runLoop)
                              ├── streamAssistantResponse()
                              │     └── transformContext()  # 压缩
                              ├── executeToolCalls()
                              │     ├── sequential  # 串行
                              │     ├── parallel    # 并行
                              │     └── smart       # 读并行+写串行（新增）
                              └── beforeToolCall / afterToolCall  # 钩子
```

### 关键文件速查表 (含 s07-s12 完整更新)

| 文件 | 作用 |
|------|------|
| `packages/coding-agent/src/core/sdk.ts` | createAgentSession，创建 Agent 实例，配置 transformContext |
| `packages/coding-agent/src/core/agent-session.ts` | AgentSession 类，管理会话生命周期、工具钩子。s11 注入 `injectNotification()` + `setCoordinatorMode()` |
| `packages/coding-agent/src/core/agent-session-runtime.ts` | 运行时封装，管理 session 切换 |
| `packages/agent/src/agent.ts` | Agent 类，状态管理、事件订阅、prompt/continue 入口 |
| `packages/agent/src/agent-loop.ts` | 核心 agent 循环，LLM 调用 + 工具执行 |
| `packages/agent/src/types.ts` | 类型定义（AgentEvent、AgentTool、ToolExecutionMode 等） |
| `packages/coding-agent/src/core/compaction/multi-layer.ts` | **[新增]** 多层压缩（snip + microcompact） |
| `packages/coding-agent/src/core/tools/enter-plan-mode.ts` | **[新增]** Plan Mode 入口工具 |
| `packages/coding-agent/src/core/tools/exit-plan-mode.ts` | **[新增]** Plan Mode 退出工具 |
| `packages/coding-agent/src/core/tools/todo-write.ts` | **[新增]** Todo 列表管理工具 |
| `packages/coding-agent/src/core/permissions/rule-engine.ts` | **[新增]** 权限规则引擎 + 危险命令检查 |
| `packages/coding-agent/src/core/background-runner.ts` | **[新增]** s08 后台进程管理单例 |
| `packages/coding-agent/src/core/tools/task-stop.ts` | **[新增]** s08 task_stop 工具 |
| `packages/coding-agent/src/core/tools/task-output.ts` | **[新增]** s08 task_output 工具 |
| `packages/coding-agent/src/index.ts` | **[修改]** s09 统一导出 team 协作等所有新增工具 |
| `packages/coding-agent/src/core/autonomous-runner.ts` | **[新增/改]** s11 后台执行单例；s12.1 新增 `ClaimAndRunOptions`、`_runInWorktree` 函数、worktree 专属 notification |
| `packages/coding-agent/src/core/tools/task-assign.ts` | **[新增/改]** s11 task_assign 工具；s12.1 新增 `worktree?: boolean` 参数，`teammate_id` 改可选，两路分发 |
| `packages/coding-agent/src/core/worktree-manager.ts` | **[新增]** s12 模块级单例，管理 worktree 生命周期，自动回退机制 |
| `packages/coding-agent/src/core/tools/enter-worktree.ts` | **[新增]** s12 enter_worktree 工具 |
| `packages/coding-agent/src/core/tools/exit-worktree.ts` | **[新增]** s12 exit_worktree 工具 |

## 三、构建系统

### 编译器
- 使用 `tsgo`（TypeScript Go 编译器，v7.0.0-dev）
- 位置: `node_modules/.bin/tsgo`
- 不在系统 PATH 里，必须通过 `npm run build` 或 `npx tsgo` 调用

### 构建命令
```bash
cd ~/pi-mono
npm run build          # 构建全部包（按依赖顺序）
npm run check          # biome lint + tsgo type check
npm test               # 运行全部测试
```

### 构建顺序
```text
tui → ai → agent → coding-agent → mom → web-ui → pods
```

### 测试结果
- agent-core: 36/36 ✅
- coding-agent: 860/861 ✅（1个需要 API Key 的 E2E 测试，无关）
- tui: 505/506（1个无关的 flaky test）

## 四、OpenClaw 运行方式

### 全局安装位置
```text
~/.nvm/versions/node/v22.22.1/lib/node_modules/openclaw/
├── dist/                           # 打包后的代码（639个 .js 文件）
├── node_modules/
│   └── @mariozechner/
│       ├── pi-coding-agent/        # 实际运行时从这里加载 ← 我们替换这个
│       ├── pi-agent-core/          # 保持原版 0.58
│       ├── pi-ai/                  # 保持原版 0.58
│       └── pi-tui/                 # 保持原版 0.58 + 兼容层
├── openclaw.mjs                    # 入口
└── package.json
```

### 配置文件
```text
~/.openclaw/openclaw.json           # 主配置（models、providers）
~/.openclaw/.env                    # API keys（重要！所有 key 都在这里）
~/.openclaw/config.yaml             # 渠道配置（Telegram 等）
~/.pi/agent/                        # pi-coding-agent 的数据目录（sessions 等）
~/.pi/agent/tasks/                  # s07/s08 任务持久化目录
```

### API Key 配置 (`~/.openclaw/.env`)
```env
DEEPSEEK_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
OPENROUTER_API_KEY=xxx
ZAI_API_KEY=xxx
BAILIAN_API_KEY=xxx
ZHIPU_API_KEY=xxx
GROQ_API_KEY=xxx
DASHSCOPE_API_KEY=xxx
```

### 一键部署（推荐）
```bash
cd ~/pi-mono
./deploy.sh
```

**手动部署步骤：**
```bash
OPENCLAW="$HOME/.nvm/versions/node/v22.22.1/lib/node_modules/openclaw"
cd ~/pi-mono
npm run build
cp -r ~/pi-mono/packages/coding-agent/dist "$OPENCLAW/node_modules/@mariozechner/pi-coding-agent/"
openclaw gateway restart
```
⚠️ **注意：不要替换 pi-tui、pi-ai、pi-agent-core** —— 我们已经在 pi-tui@0.58 里加了兼容层，替换会破坏它。

### Agent 类补丁（pi-agent-core）
- **文件**: `node_modules/@mariozechner/pi-agent-core/dist/agent.js`
- 添加 `setSystemPrompt(prompt)` 方法：设置 systemPrompt
- 添加 `replaceMessages(messages)` 方法：替换消息列表
- **原因**: 0.64 的 agent-session.js 调用了这些方法，但 0.58 的 Agent 类没有。注意: 这个补丁在 node_modules 里，每次 npm install 后需要重新应用。

### 版本兼容性
```text
OpenClaw 2026.3.13 依赖:
  @mariozechner/pi-tui@0.58.0          ← 已加兼容层（getKeybindings 等别名）
  @mariozechner/pi-ai@0.58.0           ← 保持原版
  @mariozechner/pi-agent-core@0.58.0   ← 保持原版
  @mariozechner/pi-coding-agent@0.58.0 ← 被我们的 0.64 dist 替换

pi-mono 源码版本: 0.64.0
pi-agent-core (0.64) API 向下兼容 0.58 ✅
```

## 五、Claude Code 机制参考与系统改造

```text
Windows: E:\下载\claude-code-source-code-main\
Linux:   ~/.nvm/versions/node/v22.22.1/lib/node_modules/@anthropic-ai/claude-code/
```

### Claude Code 的 12 层渐进式 Agent 框架进度

| 层级 | 机制 | 我们的状态 |
|------|------|-----------|
| s01 | The Loop — 基础 agent 循环 | ✅ 已有 |
| s02 | Tool Dispatch — 工具注册 | ✅ 已有 |
| s03 | Planning — Plan Mode + Todo | ✅ 已实现 |
| s04 | Sub-Agents — 子 agent 分叉 | ✅ 已有（agent-loop） |
| s05 | Knowledge on Demand — 技能加载 | ⚠️ 部分（skills.ts） |
| s06 | Context Compression — 上下文压缩 | ✅ 已实现（multi-layer） |
| s07 | Persistent Tasks — 任务持久化 | ✅ 已完成 (2026-04-03) |
| s08 | Background Tasks — 后台任务 | ✅ 已完成 (2026-04-03) |
| s09 | Agent Teams — 团队协作 | ✅ 已完成 (2026-04-04) |
| s10 | Team Protocols — 团队协议 | ✅ 已完成 (2026-04-03) |
| s11 | Autonomous Agents — 自主 agent | ✅ 已完成 (2026-04-03) |
| s12 | Worktree Isolation — 工作区隔离 | ✅ **全架构竣工 (2026-04-03)** |
| s12.1 | task_assign worktree 参数 — 自主任务自动进入 worktree 沙箱 | ✅ **已完成 (2026-04-03)** |
| P1-A | postinstall 补丁保护 — patch-agent.cjs 幂等脚本 + deploy.sh 集成 | ✅ **已完成 (2026-04-03)** |

## 六、踩坑记录

- **坑 1: heredoc 截断**。Shell heredoc (`<< 'EOF'`) 在终端里会被截断，导致文件内容不完整。**解决**: 用 `python3` 写文件，或者 `tee /tmp/script.py > /dev/null << 'PYEOF'`
- **坑 2: sed 转义地狱**。sed 的正则转义在 bash 里有三层转义（shell → sed → regex），极易出错。**解决**: 用 `python3` 的 `str.replace()` 或 `bytes.replace()` 替代。
- **坑 3: 版本不兼容**。pi-mono 0.64 的 pi-tui API 跟 OpenClaw 依赖的 0.58 不兼容。**解决**: 在 0.58 的 pi-tui 中添加兼容层（别名导出），不再需要 sed 替换。
- **坑 4: pi-ai 没有备份**。第一次替换时把 pi-ai 覆盖了。**解决**: 执行 `npm install @mariozechner/pi-ai@0.58.0 --no-save` 重新安装。
- **坑 5: biome lint 阻止 git commit**。pre-commit hook 运行 `biome check` 有 warning 即拒绝。**解决**: 用 template literal 替代字符串拼接，删除未使用的变量。
- **坑 6: tsgo 不在 PATH**。`tsgo` 位于 `node_modules/.bin/` 里。**解决**: 用 `npm run build` 或 `npx tsgo`。
- **坑 7: OpenClaw 的 pi 包加载路径**。并非从 dist/ 加载，而是从 node_modules/@mariozechner/ 加载。**解决**: 准确替换 node_modules 里的目标包。
- **坑 8: isContextOverflowError 不存在**。pi-ai 实际导出的是 `isContextOverflow`。**解决**: 修改 import 引用为正确名称。
- **坑 9: AgentEvent 缺失重试事件**。`auto_retry_start/end` 仅存在于 AgentSessionEvent。**解决**: 在 agent-loop.ts 里直接处理重试，不发事件或仅发 turn_end。
- **坑 10: 0.64 与 0.58 的导出差异**。`getKeybindings` 等在 0.58 不存在。**解决**: 在 0.58 的 pi-tui 中添加别名导出作兼容层。
- **坑 11: Agent 类方法缺失**。0.64 的 agent-session.js 调用了 0.58 缺少的 `setSystemPrompt` 和 `replaceMessages`。**解决**: 手动在编译产物 Agent 类中添加该两项方法。
- **坑 12: deploy 脚本粘贴中断**。deploy 脚本直接粘贴到终端会导致进程中断。**解决**: 用 VS Code SSH 写入文件后，通过 `bash` 执行。
- **坑 13: 模块导出重复**。Python 脚本多次运行导致 `index.ts` 出现 import/export 三重重复。**解决**: 使用 python3 去重脚本清理。
- **坑 14: 自动注入点错位**。`agent-session.ts` 自动注入时位置找错，代码被插入到 return 对象内部。**解决**: 使用 sed 删除错误代码后，手动定位到 `prompt()` 方法首行进行准确注入。
- **坑 15: s08 工具的三个类型错误**。
  1. `details` 在 AgentToolResult 里是必填，不能省略（不能用可选分支）。
  2. `execute` 签名必须包含 `signal, onUpdate, ctx` 三个参数，即使不用也要写占位。
  3. `"cancelled"` 不在 TaskStatus 里，停止的任务应标为 `"failed"`。
  **解决**: 补全 execute 签名，所有 return 分支都带 details，status 改为 `"failed"`。
- **坑 16: dist/index.js 是手动维护的导出文件**。`tsgo` 编译不自动生成 `dist/index.js`，它由 `src/index.ts` 手动维护。新增工具必须在 `src/index.ts` 中显式导出，否则构建产物中不会包含。
- **坑 17: OpenClaw 的两个工具路径**。`createPiCodingTools` 用于 TUI/CLI，`createOpenClawCodingTools` 用于 bot。两者都从 `codingTools` 基础工具列表扩展，但 `createOpenClawCodingTools` 额外显式添加了 plan/todo/team 工具。调试时需要区分两个路径。
- **坑 18: team-create.ts 路径与变量错误 (s10 阶段实际发生)**。`team-create.ts` 引用了不存在的 `../config.js` 路径，以及直接使用了注释占位符 `_hostSessionId` 变量名。**解决**: 用 `node:os` 的 `homedir()` 拼路径，从 `teammate-runner.ts` 暴露 `getHostSessionId()` 函数。
- **坑 19: teammate 工具权限缺失的架构边界限制 [已于 s12 解决]**。s11 阶段 teammate 以 `tools: []` 创建，只能做纯对话型任务。**完美解决**: 通过 s12 Worktree Isolation 的实装，`createWorktreeTeammate` 会自动为隔离环境注入绑定了特定工作目录的 `createBashTool(worktreePath)`，彻底解决了队友的权限沙箱及全量工具集（bash/read/write/edit/grep/find/ls）赋权问题。

## 七、快速启动

```bash
# 构建 + 部署（一键）
cd ~/pi-mono
./deploy.sh

# 或手动
cd ~/pi-mono
npm run build
OPENCLAW="$HOME/.nvm/versions/node/v22.22.1/lib/node_modules/openclaw"
cp -r ~/pi-mono/packages/coding-agent/dist "$OPENCLAW/node_modules/@mariozechner/pi-coding-agent/"
openclaw gateway restart

# 查看日志
openclaw gateway logs

# 进入 TUI
openclaw tui
```

`deploy.sh` 内容留存：
```bash
#!/bin/bash
set -e

OPENCLAW="$HOME/.nvm/versions/node/v22.22.1/lib/node_modules/openclaw"
SRC="$HOME/pi-mono/packages/coding-agent/dist"
DST="$OPENCLAW/node_modules/@mariozechner/pi-coding-agent/dist"

echo "=== Step 1: Build ==="
cd ~/pi-mono
npm run build

echo ""
echo "=== Step 2: Deploy ==="
cp -r "$SRC" "$DST"
echo "[OK] dist copied"

echo ""
echo "=== Step 3: Restart ==="
openclaw gateway restart
echo "[OK] Done!"
```

## 八、s07 Persistent Task System（2026-04-03）

### 新增文件

| 文件 | 作用 |
|------|------|
| `packages/coding-agent/src/core/tasks/types.ts` | Task 类型系统（TaskStatus、Task、TaskCreateInput、TaskUpdateInput） |
| `packages/coding-agent/src/core/tasks/task-store.ts` | 文件持久化层（createTask/getTask/listTasks/updateTask/deleteTask/blockTask） |
| `packages/coding-agent/src/core/tasks/index.ts` | barrel export |
| `packages/coding-agent/src/core/tools/task-create.ts` | task_create 工具 |
| `packages/coding-agent/src/core/tools/task-get.ts` | task_get 工具 |
| `packages/coding-agent/src/core/tools/task-update.ts` | task_update 工具 |
| `packages/coding-agent/src/core/tools/task-list.ts` | task_list 工具 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/coding-agent/src/core/tools/index.ts` | 注册 task_create/get/update/list 的 tool + toolDefinition |
| `packages/coding-agent/src/core/agent-session.ts` | import setCurrentSessionId；在 prompt() 方法开头注入 setCurrentSessionId(this.sessionId) |

### 架构设计

- **存储路径**: `~/.pi/agent/tasks/<sessionId>/` + `index.json` + `<taskId>.json`
- **Session ID 同步**: `setCurrentSessionId()` / `getCurrentSessionId()` 模块级变量，prompt() 每次调用时同步
- **blocking 关系**: 双向维护（blockTask 同时更新 blocks 和 blockedBy 两侧）
- **metadata null 删除**: 与 Claude Code 行为一致
- **status="deleted"**: 触发硬删除 + 关系清理

### 重要 API 约定（后续开发必读）

```typescript
// 1. task-store 函数签名——sessionId 必须显式传入
createTask(sessionId, input)
getTask(sessionId, taskId)
updateTask(sessionId, taskId, input)

// 2. 工具定义格式——使用 @sinclair/typebox，不是 zod
import { Type } from "@sinclair/typebox";
const schema = Type.Object({ ... });

// 3. execute 签名——全部 5 个参数都要写，即使只用前两个
async execute(_toolCallId, params, _signal, _onUpdate, _ctx) { ... }

// 4. 返回值——details 是必填，所有 return 分支都要带
return {
  content: [{ type: "text", text: "..." }],
  details: { ... },  // 不能省略
};

// 5. TaskStatus 合法值（来自 types.ts）
// "pending" | "in_progress" | "completed" | "failed"
// 注意：没有 "cancelled"，停止的任务用 "failed"
```

## 九、s08 Background Task System（2026-04-03）

### 新增文件

| 文件 | 作用 |
|------|------|
| `packages/coding-agent/src/core/background-runner.ts` | 进程管理单例（spawnBackground / stopBackground / isRunning） |
| `packages/coding-agent/src/core/tools/task-stop.ts` | task_stop 工具 |
| `packages/coding-agent/src/core/tools/task-output.ts` | task_output 工具 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/coding-agent/src/core/tools/task-create.ts` | 新增 command + cwd 字段，调用 spawnBackground |
| `packages/coding-agent/src/core/tools/index.ts` | 注册 task_stop / task_output |

### 架构设计

- **进程注册表**: `Map<taskId, ProcessEntry>`，模块级单例，进程退出后自动清理。
- **输出存储**: stdout/stderr 实时通过 `appendTaskOutput()` 写入 `task.output` 字段，无单独文件。
- **状态流转**: pending → in_progress（spawn时）→ completed（exitCode=0）/ failed（其他）。
- **优雅停止**: SIGTERM → 等3秒 → SIGKILL。
- **server restart 后**: registry 清空，但 `task.output` 已持久化，task_output 仍可读历史输出。

### 工具行为说明

| 工具 | 行为 |
|------|------|
| `task_create + command` | 创建任务后立即后台执行，立刻返回 task_id，不阻塞对话。 |
| `task_output` | 读 task.output 字段，支持 tail_lines 限制行数。 |
| `task_stop` | 发送 SIGTERM→SIGKILL，process 不在 registry 时直接标 failed。 |

### ⚠️ 当前限制与配置

工具默认不启用。`_buildRuntime` 的默认 active 工具只有 `["read", "bash", "edit", "write"]`。
`task_*` 系列工具存在于注册表但默认不激活，需要通过以下方式之一启用：

```typescript
// 方式1: sdk.ts 里 initialActiveToolNames 加入
initialActiveToolNames: [
  "read", "bash", "edit", "write",
  "task_create", "task_get", "task_update", "task_list",
  "task_stop", "task_output"
]

// 方式2: 系统提示词里告知 agent 可以用这些工具（需要先在 active 里）
```

## 十、s09 Agent Teams — 工具导出修复（2026-04-04）

### 问题发现

部署 s09 工具后，bot 列出的工具中没有 `team_create`、`team_list`、`send_message`。

### 根因分析

OpenClaw 的 `auth-profiles-DRjqKE3G.js` 第 67 行从 `@mariozechner/pi-coding-agent` 导入了 `teamCreateTool`、`teamListTool`、`sendMessageTool`：

```javascript
import { ... teamCreateTool, teamListTool, sendMessageTool } from "@mariozechner/pi-coding-agent";
```

但 `pi-coding-agent` 的 `src/index.ts` 没有导出这些工具，导致导入值为 `undefined`，工具被静默忽略。

### 追踪过程

1. OpenClaw 有两个工具创建路径：`createPiCodingTools`（TUI/CLI 用）和 `createOpenClawCodingTools`（bot 用）
2. bot 走的是 `createOpenClawCodingTools`，在第 95976 行显式加入了这三个工具：
   ```javascript
   ...[enterPlanModeTool, exitPlanModeTool, todoWriteTool, teamCreateTool, teamListTool, sendMessageTool]
   ```
3. 验证 pi-coding-agent 包的导出：`node -e "const m = require('...'); console.log(typeof m.teamCreateTool)"` → `undefined`
4. 检查 `src/index.ts` 的 Tools 导出行（第 280-287 行），发现只有 `enterPlanModeTool`、`exitPlanModeTool`、`todoWriteTool`，缺少 team 工具

### 修复

在 `packages/coding-agent/src/index.ts` 第 286 行后添加导出：

```typescript
        todoWriteTool, todoWriteToolDefinition,
        teamCreateTool, teamCreateToolDefinition,
        teamListTool, teamListToolDefinition,
        sendMessageTool, sendMessageToolDefinition,
} from "./core/tools/index.js";
```

### 验证

重新构建部署后，bot 列出全部 27 个工具，包括：
- `team_create` — 创建 AI 队友
- `team_list` — 列出 AI 队友
- `send_message` — 向 AI 队友发消息

## 十一、s11 Autonomous Agents（2026-04-03）

### 机制总结
- `autonomous-runner.ts`: 实现了后台执行单例机制，采用 fire-and-forget 模式，并在执行完毕后完成 `<task-notification>` 的通知注入。
- `tools/task-assign.ts`: 引入了 `task_assign` 工具，实现了任务向 worker 的非阻塞式分配。
- `agent-session.ts`: 新增了 `injectNotification()` 接口方法，将其融合进 coordinator 的系统提示（system prompt）中，并加入了 `setCoordinatorMode()` 控制逻辑。

## 十二、s12 Worktree Isolation 全架构竣工（2026-04-03）

伴随着 s12 层的成功部署，Claude Code 机制 12 层全栈演进计划**圆满完成**。

### 核心机制总结
- **核心文件**: 
  - `worktree-manager.ts`: 模块级单例，管理 worktree 生命周期（创建/移除/保留）。
  - `enter-worktree.ts`: 工具注入点，负责创建隔离目录并生成绑定该目录的 teammate。
  - `exit-worktree.ts`: 提供 teammate 关闭逻辑，支持 `keep` / `remove` 两种退出策略回收。
- **设计决策 1 (工具级沙箱化)**: `createWorktreeTeammate` 强制给 worktree agent 注入基于特定目录的 `createBashTool(worktreePath)` 等能力。所有文件操作天然限制在沙箱范围内，无需外挂额外权限拦截逻辑。
- **设计决策 2 (智能降级)**: 遵循“优先 Git + 智能降级”原则。自动检测 Git Repo 并优先调用 `git worktree add`；一旦失败，立即平滑 fallback 至普通目录机制，绝不中断核心调度流。

---

> **🚀 对话启动提示词（供下一位 AI 接手）：**
> 请阅读 `~/pi-mono/HANDOFF.md` 了解项目现状。当前基于 Claude Code 的 **12 层渐进式架构 + s12.1 扩展均已竣工部署**。
> s12.1 已实现 `task_assign` 的 `worktree: true` 参数，自主任务可自动进入 worktree 沙箱执行。
> 下一步方向待定，可考虑：(1) worktree 任务完成后自动 PR/merge 流程；(2) 多任务并发 worktree 调度；(3) model 超时 failover 策略优化。

---

## 附录：Claude Code v2.1.88 — Source Code Analysis

> Extracted from npm package `@anthropic-ai/claude-code` version **2.1.88**.
> The published package ships a single bundled `cli.js` (~12MB). The `src/` directory in this repo contains the **unbundled TypeScript source** extracted from the npm tarball.

**Language**: **English** | [中文](README_CN.md)

### Table of Contents
- [Deep Analysis Reports (`docs/`)](#deep-analysis-reports-docs) — Telemetry, codenames, undercover mode, remote control, future roadmap
- [Missing Modules Notice](#missing-modules-notice-108-modules) — 108 feature-gated modules not in the npm package
- [Architecture Overview](#architecture-overview) — Entry → Query Engine → Tools/Services/State
- [Tool System & Permissions](#tool-system-architecture) — 40+ tools, permission flow, sub-agents
- [The 12 Progressive Harness Mechanisms](#the-12-progressive-harness-mechanisms) — How Claude Code layers production features on the agent loop
- [Build Notes](#build-notes) — Why this source isn't directly compilable

### Deep Analysis Reports (`docs/`)
Source code analysis reports derived from decompiled v2.1.88. Bilingual (EN/ZH).

```text
docs/
├── en/                                        # English
│   ├── [01-telemetry-and-privacy.md]          # Telemetry & Privacy — what's collected, why you can't opt out
│   ├── [02-hidden-features-and-codenames.md]  # Codenames (Capybara/Tengu/Numbat), feature flags, internal vs external
│   ├── [03-undercover-mode.md]                # Undercover Mode — hiding AI authorship in open-source repos
│   ├── [04-remote-control-and-killswitches.md]# Remote Control — managed settings, killswitches, model overrides
│   └── [05-future-roadmap.md]                 # Future Roadmap — Numbat, KAIROS, voice mode, unreleased tools
│
└── zh/                                        # 中文
    ├── [01-遥测与隐私分析.md]                    # 遥测与隐私 — 收集了什么，为什么无法退出
    ├── [02-隐藏功能与模型代号.md]                # 隐藏功能 — 模型代号，feature flag，内外用户差异
    ├── [03-卧底模式分析.md]                     # 卧底模式 — 在开源项目中隐藏 AI 身份
    ├── [04-远程控制与紧急开关.md]                # 远程控制 — 托管设置，紧急开关，模型覆盖
    └── [05-未来路线图.md]                       # 未来路线图 — Numbat，KAIROS，语音模式，未上线工具
```

| # | Topic | Key Findings |
|---|-------|-------------|
| 01 | **Telemetry & Privacy** | Two analytics sinks (1P → Anthropic, Datadog). Environment fingerprint, process metrics, repo hash on every event. **No UI-exposed opt-out** for 1st-party logging. `OTEL_LOG_TOOL_DETAILS=1` enables full tool input capture. |
| 02 | **Hidden Features & Codenames** | Animal codenames (Capybara v8, Tengu, Fennec→Opus 4.6, **Numbat** next). Feature flags use random word pairs (`tengu_frond_boric`) to obscure purpose. Internal users get better prompts, verification agents, and effort anchors. Hidden commands: `/btw`, `/stickers`. |
| 03 | **Undercover Mode** | Anthropic employees auto-enter undercover mode in public repos. Model instructed: *"Do not blow your cover"* — strip all AI attribution, write commits "as a human developer would." **No force-OFF exists.** Raises transparency questions for open-source communities. |
| 04 | **Remote Control** | Hourly polling of `/api/claude_code/settings`. Dangerous changes show blocking dialog — **reject = app exits**. 6+ killswitches (bypass permissions, fast mode, voice mode, analytics sink). GrowthBook flags can change any user's behavior without consent. |
| 05 | **Future Roadmap** | **Numbat** codename confirmed. Opus 4.7 / Sonnet 4.8 in development. **KAIROS** = fully autonomous agent mode with `<tick>` heartbeats, push notifications, PR subscriptions. Voice mode (push-to-talk) ready but gated. 17 unreleased tools found. |

### Missing Modules Notice (108 modules)
> **This source is incomplete.** 108 modules referenced by `feature()`-gated branches are **not included** in the npm package.
> They exist only in Anthropic's internal monorepo and were dead-code-eliminated at compile time.
> They **cannot** be recovered from `cli.js`, `sdk-tools.d.ts`, or any published artifact.

#### Anthropic Internal Code (~70 modules, never published)
These modules have no source files anywhere in the npm package. They are internal Anthropic infrastructure.

<details>
<summary>Click to expand full list</summary>

| Module | Purpose | Feature Gate |
|--------|---------|-------------|
| `daemon/main.js` | Background daemon supervisor | `DAEMON` |
| `daemon/workerRegistry.js` | Daemon worker registry | `DAEMON` |
| `proactive/index.js` | Proactive notification system | `PROACTIVE` |
| `contextCollapse/index.js` | Context collapse service (experimental) | `CONTEXT_COLLAPSE` |
| `contextCollapse/operations.js` | Collapse operations | `CONTEXT_COLLAPSE` |
| `contextCollapse/persist.js` | Collapse persistence | `CONTEXT_COLLAPSE` |
| `skillSearch/featureCheck.js` | Remote skill feature check | `EXPERIMENTAL_SKILL_SEARCH` |
| `skillSearch/remoteSkillLoader.js` | Remote skill loader | `EXPERIMENTAL_SKILL_SEARCH` |
| `skillSearch/remoteSkillState.js` | Remote skill state | `EXPERIMENTAL_SKILL_SEARCH` |
| `skillSearch/telemetry.js` | Skill search telemetry | `EXPERIMENTAL_SKILL_SEARCH` |
| `skillSearch/localSearch.js` | Local skill search | `EXPERIMENTAL_SKILL_SEARCH` |
| `skillSearch/prefetch.js` | Skill prefetch | `EXPERIMENTAL_SKILL_SEARCH` |
| `coordinator/workerAgent.js` | Multi-agent coordinator worker | `COORDINATOR_MODE` |
| `bridge/peerSessions.js` | Bridge peer session management | `BRIDGE_MODE` |
| `assistant/index.js` | Kairos assistant mode | `KAIROS` |
| `assistant/AssistantSessionChooser.js` | Assistant session picker | `KAIROS` |
| `compact/reactiveCompact.js` | Reactive context compaction | `CACHED_MICROCOMPACT` |
| `compact/snipCompact.js` | Snip-based compaction | `HISTORY_SNIP` |
| `compact/snipProjection.js` | Snip projection | `HISTORY_SNIP` |
| `compact/cachedMCConfig.js` | Cached micro-compact config | `CACHED_MICROCOMPACT` |
| `sessionTranscript/sessionTranscript.js` | Session transcript service | `TRANSCRIPT_CLASSIFIER` |
| `commands/agents-platform/index.js` | Internal agents platform | `ant` (internal) |
| `commands/assistant/index.js` | Assistant command | `KAIROS` |
| `commands/buddy/index.js` | Buddy system notifications | `BUDDY` |
| `commands/fork/index.js` | Fork subagent command | `FORK_SUBAGENT` |
| `commands/peers/index.js` | Multi-peer commands | `BRIDGE_MODE` |
| `commands/proactive.js` | Proactive command | `PROACTIVE` |
| `commands/remoteControlServer/index.js` | Remote control server | `DAEMON` + `BRIDGE_MODE` |
| `commands/subscribe-pr.js` | GitHub PR subscription | `KAIROS_GITHUB_WEBHOOKS` |
| `commands/torch.js` | Internal debug tool | `TORCH` |
| `commands/workflows/index.js` | Workflow commands | `WORKFLOW_SCRIPTS` |
| `jobs/classifier.js` | Internal job classifier | `TEMPLATES` |
| `memdir/memoryShapeTelemetry.js` | Memory shape telemetry | `MEMORY_SHAPE_TELEMETRY` |
| `services/sessionTranscript/sessionTranscript.js` | Session transcript | `TRANSCRIPT_CLASSIFIER` |
| `tasks/LocalWorkflowTask/LocalWorkflowTask.js` | Local workflow task | `WORKFLOW_SCRIPTS` |
| `protectedNamespace.js` | Internal namespace guard | `ant` (internal) |
| `protectedNamespace.js` (envUtils) | Protected namespace runtime | `ant` (internal) |
| `coreTypes.generated.js` | Generated core types | `ant` (internal) |
| `devtools.js` | Internal dev tools | `ant` (internal) |
| `attributionHooks.js` | Internal attribution hooks | `COMMIT_ATTRIBUTION` |
| `systemThemeWatcher.js` | System theme watcher | `AUTO_THEME` |
| `udsClient.js` / `udsMessaging.js` | UDS messaging client | `UDS_INBOX` |
| `systemThemeWatcher.js` | Theme watcher | `AUTO_THEME` |
</details>

#### Feature-Gated Tools (~20 modules, DCE'd from bundle)
These tools have type signatures in `sdk-tools.d.ts` but their implementations were stripped at compile time.

<details>
<summary>Click to expand full list</summary>

| Tool | Purpose | Feature Gate |
|------|---------|-------------|
| `REPLTool` | Interactive REPL (VM sandbox) | `ant` (internal) |
| `SnipTool` | Context snipping | `HISTORY_SNIP` |
| `SleepTool` | Sleep/delay in agent loop | `PROACTIVE` / `KAIROS` |
| `MonitorTool` | MCP monitoring | `MONITOR_TOOL` |
| `OverflowTestTool` | Overflow testing | `OVERFLOW_TEST_TOOL` |
| `WorkflowTool` | Workflow execution | `WORKFLOW_SCRIPTS` |
| `WebBrowserTool` | Browser automation | `WEB_BROWSER_TOOL` |
| `TerminalCaptureTool` | Terminal capture | `TERMINAL_PANEL` |
| `TungstenTool` | Internal perf monitoring | `ant` (internal) |
| `VerifyPlanExecutionTool` | Plan verification | `CLAUDE_CODE_VERIFY_PLAN` |
| `SendUserFileTool` | Send files to users | `KAIROS` |
| `SubscribePRTool` | GitHub PR subscription | `KAIROS_GITHUB_WEBHOOKS` |
| `SuggestBackgroundPRTool` | Suggest background PRs | `KAIROS` |
| `PushNotificationTool` | Push notifications | `KAIROS` |
| `CtxInspectTool` | Context inspection | `CONTEXT_COLLAPSE` |
| `ListPeersTool` | List active peers | `UDS_INBOX` |
| `DiscoverSkillsTool` | Skill discovery | `EXPERIMENTAL_SKILL_SEARCH` |
</details>

#### Text/Prompt Assets (~6 files)
These are internal prompt templates and documentation, never published.

<details>
<summary>Click to expand</summary>

| File | Purpose |
|------|---------|
| `yolo-classifier-prompts/auto_mode_system_prompt.txt` | Auto-mode system prompt for classifier |
| `yolo-classifier-prompts/permissions_anthropic.txt` | Anthropic-internal permission prompt |
| `yolo-classifier-prompts/permissions_external.txt` | External user permission prompt |
| `verify/SKILL.md` | Verification skill documentation |
| `verify/examples/cli.md` | CLI verification examples |
| `verify/examples/server.md` | Server verification examples |
</details>

#### Why They're Missing
```text
  Anthropic Internal Monorepo              Published npm Package
  ──────────────────────────               ─────────────────────
  feature('DAEMON') → true    ──build──→   feature('DAEMON') → false
  ↓                                        ↓
  daemon/main.js  ← INCLUDED  ──bundle─→  daemon/main.js  ← DELETED (DCE)
  tools/REPLTool  ← INCLUDED  ──bundle─→  tools/REPLTool  ← DELETED (DCE)
  proactive/      ← INCLUDED  ──bundle─→  (referenced but absent from src/)
```
Bun's `feature()` is a **compile-time intrinsic**:
- Returns `true` in Anthropic's internal build → code is kept in the bundle
- Returns `false` in the published build → code is dead-code-eliminated
- The 108 modules simply do not exist anywhere in the published artifact

### Copyright & Disclaimer
```text
Copyright (c) Anthropic PBC. All rights reserved.

All source code in this repository is the intellectual property of Anthropic.
This repository is provided strictly for technical research and educational purposes.
Commercial use is strictly prohibited.

If you are the copyright owner and believe this repository infringes your rights,
please contact the repository owner for immediate removal.
```

### Stats
| Item | Count |
|------|-------|
| Source files (.ts/.tsx) | ~1,884 |
| Lines of code | ~512,664 |
| Largest single file | `query.ts` (~785KB) |
| Built-in tools | ~40+ |
| Slash commands | ~80+ |
| Dependencies (node_modules) | ~192 packages |
| Runtime | Bun (compiled to Node.js >= 18 bundle) |

### The Agent Pattern
```text
                    THE CORE LOOP
                    =============

    User --> messages[] --> Claude API --> response
                                          |
                                stop_reason == "tool_use"?
                               /                          \
                             yes                           no
                              |                             |
                        execute tools                    return text
                        append tool_result
                        loop back -----------------> messages[]


    That is the minimal agent loop. Claude Code wraps this loop
    with a production-grade harness: permissions, streaming,
    concurrency, compaction, sub-agents, persistence, and MCP.
```

### Directory Reference
```text
src/
├── main.tsx                 # REPL bootstrap, 4,683 lines
├── QueryEngine.ts           # SDK/headless query lifecycle engine
├── query.ts                 # Main agent loop (785KB, largest file)
├── Tool.ts                  # Tool interface + buildTool factory
├── Task.ts                  # Task types, IDs, state base
├── tools.ts                 # Tool registry, presets, filtering
├── commands.ts              # Slash command definitions
├── context.ts               # User input context
├── cost-tracker.ts          # API cost accumulation
├── setup.ts                 # First-run setup flow
│
├── bridge/                  # Claude Desktop / remote bridge
│   ├── bridgeMain.ts        #   Session lifecycle manager
│   ├── bridgeApi.ts         #   HTTP client
│   ├── bridgeConfig.ts      #   Connection config
│   ├── bridgeMessaging.ts   #   Message relay
│   ├── sessionRunner.ts     #   Process spawning
│   ├── jwtUtils.ts          #   JWT refresh
│   ├── workSecret.ts        #   Auth tokens
│   └── capacityWake.ts      #   Capacity-based wakeup
│
├── cli/                     # CLI infrastructure
│   ├── handlers/            #   Command handlers
│   └── transports/          #   I/O transports (stdio, structured)
│
├── commands/                # ~80 slash commands
│   ├── agents/              #   Agent management
│   ├── compact/             #   Context compaction
│   ├── config/              #   Settings management
│   ├── help/                #   Help display
│   ├── login/               #   Authentication
│   ├── mcp/                 #   MCP server management
│   ├── memory/              #   Memory system
│   ├── plan/                #   Plan mode
│   ├── resume/              #   Session resume
│   ├── review/              #   Code review
│   └── ...                  #   70+ more commands
│
├── components/              # React/Ink terminal UI
│   ├── design-system/       #   Reusable UI primitives
│   ├── messages/            #   Message rendering
│   ├── permissions/         #   Permission dialogs
│   ├── PromptInput/         #   Input field + suggestions
│   ├── LogoV2/              #   Branding + welcome screen
│   ├── Settings/            #   Settings panels
│   ├── Spinner.tsx          #   Loading indicators
│   └── ...                  #   40+ component groups
│
├── entrypoints/             # Application entry points
│   ├── cli.tsx              #   CLI main (version, help, daemon)
│   ├── sdk/                 #   Agent SDK (types, sessions)
│   └── mcp.ts               #   MCP server entry
│
├── hooks/                   # React hooks
│   ├── useCanUseTool.tsx    #   Permission checking
│   ├── useReplBridge.tsx    #   Bridge connection
│   ├── notifs/              #   Notification hooks
│   └── toolPermission/      #   Tool permission handlers
│
├── services/                # Business logic layer
│   ├── api/                 #   Claude API client
│   │   ├── claude.ts        #     Streaming API calls
│   │   ├── errors.ts        #     Error categorization
│   │   └── withRetry.ts     #     Retry logic
│   ├── analytics/           #   Telemetry + GrowthBook
│   ├── compact/             #   Context compression
│   ├── mcp/                 #   MCP connection management
│   ├── tools/               #   Tool execution engine
│   │   ├── StreamingToolExecutor.ts  # Parallel tool runner
│   │   └── toolOrchestration.ts      # Batch orchestration
│   ├── plugins/             #   Plugin loader
│   └── settingsSync/        #   Cross-device settings
│
├── state/                   # Application state
│   ├── AppStateStore.ts     #   Store definition
│   └── AppState.tsx         #   React provider + hooks
│
├── tasks/                   # Task implementations
│   ├── LocalShellTask/      #   Bash command execution
│   ├── LocalAgentTask/      #   Sub-agent execution
│   ├── RemoteAgentTask/     #   Remote agent via bridge
│   ├── InProcessTeammateTask/ # In-process teammate
│   └── DreamTask/           #   Background thinking
│
├── tools/                   # 40+ tool implementations
│   ├── AgentTool/           #   Sub-agent spawning + fork
│   ├── BashTool/            #   Shell command execution
│   ├── FileReadTool/        #   File reading (PDF, image, etc)
│   ├── FileEditTool/        #   String-replace editing
│   ├── FileWriteTool/       #   Full file creation
│   ├── GlobTool/            #   File pattern search
│   ├── GrepTool/            #   Content search (ripgrep)
│   ├── WebFetchTool/        #   HTTP fetching
│   ├── WebSearchTool/       #   Web search
│   ├── MCPTool/             #   MCP tool wrapper
│   ├── SkillTool/           #   Skill invocation
│   ├── AskUserQuestionTool/ #   User interaction
│   └── ...                  #   30+ more tools
│
├── types/                   # Type definitions
│   ├── message.ts           #   Message discriminated unions
│   ├── permissions.ts       #   Permission types
│   ├── tools.ts             #   Tool progress types
│   └── ids.ts               #   Branded ID types
│
├── utils/                   # Utilities (largest directory)
│   ├── permissions/         #   Permission rule engine
│   ├── messages/            #   Message formatting
│   ├── model/               #   Model selection logic
│   ├── settings/            #   Settings management
│   ├── sandbox/             #   Sandbox runtime adapter
│   ├── hooks/               #   Hook execution
│   ├── memory/              #   Memory system utils
│   ├── git/                 #   Git operations
│   ├── github/              #   GitHub API
│   ├── bash/                #   Bash execution helpers
│   ├── swarm/               #   Multi-agent swarm
│   ├── telemetry/           #   Telemetry reporting
│   └── ...                  #   30+ more util groups
│
└── vendor/                  # Native module source stubs
    ├── audio-capture-src/   #   Audio input
    ├── image-processor-src/ #   Image processing
    ├── modifiers-napi-src/  #   Native modifiers
    └── url-handler-src/     #   URL handling
```

### Architecture Overview
```text
┌─────────────────────────────────────────────────────────────────────┐
│                        ENTRY LAYER                                  │
│  cli.tsx ──> main.tsx ──> REPL.tsx (interactive)                   │
│                     └──> QueryEngine.ts (headless/SDK)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        QUERY ENGINE                                 │
│  submitMessage(prompt) ──> AsyncGenerator<SDKMessage>               │
│    │                                                                │
│    ├── fetchSystemPromptParts()    ──> assemble system prompt       │
│    ├── processUserInput()          ──> handle /commands             │
│    ├── query()                     ──> main agent loop              │
│    │     ├── StreamingToolExecutor ──> parallel tool execution      │
│    │     ├── autoCompact()         ──> context compression          │
│    │     └── runTools()            ──> tool orchestration           │
│    └── yield SDKMessage            ──> stream to consumer           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│   TOOL SYSTEM    │ │  SERVICE LAYER  │ │   STATE LAYER    │
│                  │ │                 │ │                  │
│ Tool Interface   │ │ api/claude.ts   │ │ AppState Store   │
│  ├─ call()       │ │  API client     │ │  ├─ permissions  │
│  ├─ validate()   │ │ compact/        │ │  ├─ fileHistory  │
│  ├─ checkPerms() │ │  auto-compact   │ │  ├─ agents       │
│  ├─ render()     │ │ mcp/            │ │  └─ fastMode     │
│  └─ prompt()     │ │  MCP protocol   │ │                  │
│                  │ │ analytics/      │ │ React Context    │
│ 40+ Built-in:    │ │  telemetry      │ │  ├─ useAppState  │
│  ├─ BashTool     │ │ tools/          │ │  └─ useSetState  │
│  ├─ FileRead     │ │  executor       │ │                  │
│  ├─ FileEdit     │ │ plugins/        │ └──────────────────┘
│  ├─ Glob/Grep    │ │  loader         │
│  ├─ AgentTool    │ │ settingsSync/   │
│  ├─ WebFetch     │ │  cross-device   │
│  └─ MCPTool      │ │ oauth/          │
│                  │ │  auth flow      │
└──────────────────┘ └─────────────────┘
              │                │
              ▼                ▼
┌──────────────────┐ ┌─────────────────┐
│   TASK SYSTEM    │ │   BRIDGE LAYER  │
│                  │ │                 │
│ Task Types:      │ │ bridgeMain.ts   │
│  ├─ local_bash   │ │  session mgmt   │
│  ├─ local_agent  │ │ bridgeApi.ts    │
│  ├─ remote_agent │ │  HTTP client    │
│  ├─ in_process   │ │ workSecret.ts   │
│  ├─ dream        │ │  auth tokens    │
│  └─ workflow     │ │ sessionRunner   │
│                  │ │  process spawn  │
│ ID: prefix+8chr  │ └─────────────────┘
│  b=bash a=agent  │
│  r=remote t=team │
└──────────────────┘
```

### Data Flow: A Single Query Lifecycle
```text
 USER INPUT (prompt / slash command)
     │
     ▼
 processUserInput()                ← parse /commands, build UserMessage
     │
     ▼
 fetchSystemPromptParts()          ← tools → prompt sections, CLAUDE.md memory
     │
     ▼
 recordTranscript()                ← persist user message to disk (JSONL)
     │
     ▼
 ┌─→ normalizeMessagesForAPI()     ← strip UI-only fields, compact if needed
 │   │
 │   ▼
 │   Claude API (streaming)        ← POST /v1/messages with tools + system prompt
 │   │
 │   ▼
 │   stream events                 ← message_start → content_block_delta → message_stop
 │   │
 │   ├─ text block ──────────────→ yield to consumer (SDK / REPL)
 │   │
 │   └─ tool_use block?
 │       │
 │       ▼
 │   StreamingToolExecutor         ← partition: concurrent-safe vs serial
 │       │
 │       ▼
 │   canUseTool()                  ← permission check (hooks + rules + UI prompt)
 │       │
 │       ├─ DENY ────────────────→ append tool_result(error), continue loop
 │       │
 │       └─ ALLOW
 │           │
 │           ▼
 │       tool.call()               ← execute the tool (Bash, Read, Edit, etc.)
 │           │
 │           ▼
 │       append tool_result        ← push to messages[], recordTranscript()
 │           │
 └─────────┘                       ← loop back to API call
     │
     ▼ (stop_reason != "tool_use")
 yield result message              ← final text, usage, cost, session_id
```

### Tool System Architecture
```text
                    TOOL INTERFACE
                    ==============

    buildTool(definition) ──> Tool<Input, Output, Progress>

    Every tool implements:
    ┌────────────────────────────────────────────────────────┐
    │  LIFECYCLE                                             │
    │  ├── validateInput()      → reject bad args early      │
    │  ├── checkPermissions()   → tool-specific authz        │
    │  └── call()               → execute and return result  │
    │                                                        │
    │  CAPABILITIES                                          │
    │  ├── isEnabled()          → feature gate check         │
    │  ├── isConcurrencySafe()  → can run in parallel?       │
    │  ├── isReadOnly()         → no side effects?           │
    │  ├── isDestructive()      → irreversible ops?          │
    │  └── interruptBehavior()  → cancel or block on user?   │
    │                                                        │
    │  RENDERING (React/Ink)                                 │
    │  ├── renderToolUseMessage()     → input display        │
    │  ├── renderToolResultMessage()  → output display       │
    │  ├── renderToolUseProgressMessage() → spinner/status   │
    │  └── renderGroupedToolUse()     → parallel tool groups │
    │                                                        │
    │  AI FACING                                             │
    │  ├── prompt()             → tool description for LLM   │
    │  ├── description()        → dynamic description        │
    │  └── mapToolResultToAPI() → format for API response    │
    └────────────────────────────────────────────────────────┘
```

#### Complete Tool Inventory
```text
    FILE OPERATIONS          SEARCH & DISCOVERY        EXECUTION
    ═════════════════        ══════════════════════    ══════════
    FileReadTool             GlobTool                  BashTool
    FileEditTool             GrepTool                  PowerShellTool
    FileWriteTool            ToolSearchTool
    NotebookEditTool                                   INTERACTION
                                                       ═══════════
    WEB & NETWORK            AGENT / TASK              AskUserQuestionTool
    ════════════════         ══════════════════        BriefTool
    WebFetchTool             AgentTool
    WebSearchTool            SendMessageTool           PLANNING & WORKFLOW
                             TeamCreateTool            ════════════════════
    MCP PROTOCOL             TeamDeleteTool            EnterPlanModeTool
    ══════════════           TaskCreateTool            ExitPlanModeTool
    MCPTool                  TaskGetTool               EnterWorktreeTool
    ListMcpResourcesTool     TaskUpdateTool            ExitWorktreeTool
    ReadMcpResourceTool      TaskListTool              TodoWriteTool
                             TaskStopTool
                             TaskOutputTool            SYSTEM
                                                       ════════
                             SKILLS & EXTENSIONS       ConfigTool
                             ═════════════════════     SkillTool
                             SkillTool                 ScheduleCronTool
                             LSPTool                   SleepTool
                                                       TungstenTool
```

### Permission System
```text
    TOOL CALL REQUEST
          │
          ▼
    ┌─ validateInput() ──────────────────────────────────┐
    │  reject invalid inputs before any permission check │
    └────────────────────┬───────────────────────────────┘
                         │
                         ▼
    ┌─ PreToolUse Hooks ─────────────────────────────────┐
    │  user-defined shell commands (settings.json hooks) │
    │  can: approve, deny, or modify input               │
    └────────────────────┬───────────────────────────────┘
                         │
                         ▼
    ┌─ Permission Rules ─────────────────────────────────┐
    │  alwaysAllowRules:  match tool name/pattern → auto │
    │  alwaysDenyRules:   match tool name/pattern → deny │
    │  alwaysAskRules:    match tool name/pattern → ask  │
    │  Sources: settings, CLI args, session decisions    │
    └────────────────────┬───────────────────────────────┘
                         │
                    no rule match?
                         │
                         ▼
    ┌─ Interactive Prompt ───────────────────────────────┐
    │  User sees tool name + input                       │
    │  Options: Allow Once / Allow Always / Deny         │
    └────────────────────┬───────────────────────────────┘
                         │
                         ▼
    ┌─ checkPermissions() ───────────────────────────────┐
    │  Tool-specific logic (e.g. path sandboxing)        │
    └────────────────────┬───────────────────────────────┘
                         │
                    APPROVED → tool.call()
```

### Sub-Agent & Multi-Agent Architecture
```text
                        MAIN AGENT
                        ==========
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │  FORK AGENT  │ │ REMOTE   │ │ IN-PROCESS   │
     │              │ │ AGENT    │ │ TEAMMATE     │
     │ Fork process │ │ Bridge   │ │ Same process │
     │ Shared cache │ │ session  │ │ Async context│
     │ Fresh msgs[] │ │ Isolated │ │ Shared state │
     └──────────────┘ └──────────┘ └──────────────┘

    SPAWN MODES:
    ├─ default    → in-process, shared conversation
    ├─ fork       → child process, fresh messages[], shared file cache
    ├─ worktree   → isolated git worktree + fork
    └─ remote     → bridge to Claude Code Remote / container

    COMMUNICATION:
    ├─ SendMessageTool     → agent-to-agent messages
    ├─ TaskCreate/Update   → shared task board
    └─ TeamCreate/Delete   → team lifecycle management

    SWARM MODE (feature-gated):
    ┌─────────────────────────────────────────────┐
    │  Lead Agent                                 │
    │    ├── Teammate A ──> claims Task 1         │
    │    ├── Teammate B ──> claims Task 2         │
    │    └── Teammate C ──> claims Task 3         │
    │                                             │
    │  Shared: task board, message inbox          │
    │  Isolated: messages[], file cache, cwd      │
    └─────────────────────────────────────────────┘
```

### Context Management (Compact System)
```text
    CONTEXT WINDOW BUDGET
    ═════════════════════

    ┌─────────────────────────────────────────────────────┐
    │  System Prompt (tools, permissions, CLAUDE.md)      │
    │  ══════════════════════════════════════════════     │
    │                                                     │
    │  Conversation History                               │
    │  ┌─────────────────────────────────────────────┐    │
    │  │ [compacted summary of older messages]        │    │
    │  │ ═══════════════════════════════════════════  │    │
    │  │ [compact_boundary marker]                    │    │
    │  │ ───────────────────────────────────────────  │    │
    │  │ [recent messages — full fidelity]            │    │
    │  │ user → assistant → tool_use → tool_result   │    │
    │  └─────────────────────────────────────────────┘    │
    │                                                     │
    │  Current Turn (user + assistant response)           │
    └─────────────────────────────────────────────────────┘

    THREE COMPRESSION STRATEGIES:
    ├─ autoCompact     → triggers when token count exceeds threshold
    │                    summarizes old messages via a compact API call
    ├─ snipCompact     → removes zombie messages and stale markers
    │                    (HISTORY_SNIP feature flag)
    └─ contextCollapse → restructures context for efficiency
                         (CONTEXT_COLLAPSE feature flag)

    COMPACTION FLOW:
    messages[] ──> getMessagesAfterCompactBoundary()
                        │
                        ▼
                  older messages ──> Claude API (summarize) ──> compact summary
                        │
                        ▼
                  [summary] + [compact_boundary] + [recent messages]
```

### MCP (Model Context Protocol) Integration
```text
    ┌─────────────────────────────────────────────────────────┐
    │                  MCP ARCHITECTURE                       │
    │                                                         │
    │  MCPConnectionManager.tsx                               │
    │    ├── Server Discovery (config from settings.json)     │
    │    │     ├── stdio  → spawn child process               │
    │    │     ├── sse    → HTTP EventSource                  │
    │    │     ├── http   → Streamable HTTP                   │
    │    │     ├── ws     → WebSocket                         │
    │    │     └── sdk    → in-process transport              │
    │    │                                                    │
    │    ├── Client Lifecycle                                 │
    │    │     ├── connect → initialize → list tools          │
    │    │     ├── tool calls via MCPTool wrapper             │
    │    │     └── disconnect / reconnect with backoff        │
    │    │                                                    │
    │    ├── Authentication                                   │
    │    │     ├── OAuth 2.0 flow (McpOAuthConfig)            │
    │    │     ├── Cross-App Access (XAA / SEP-990)           │
    │    │     └── API key via headers                        │
    │    │                                                    │
    │    └── Tool Registration                                │
    │          ├── mcp__<server>__<tool> naming convention    │
    │          ├── Dynamic schema from MCP server             │
    │          ├── Permission passthrough to Claude Code      │
    │          └── Resource listing (ListMcpResourcesTool)    │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

### Bridge Layer (Claude Desktop / Remote)
```text
    Claude Desktop / Web / Cowork          Claude Code CLI
    ══════════════════════════            ═════════════════

    ┌───────────────────┐                 ┌──────────────────┐
    │  Bridge Client    │  ←─ HTTP ──→   │  bridgeMain.ts   │
    │  (Desktop App)    │                 │                  │
    └───────────────────┘                 │  Session Manager │
                                          │  ├── spawn CLI   │
    PROTOCOL:                             │  ├── poll status  │
    ├─ JWT authentication                 │  ├── relay msgs   │
    ├─ Work secret exchange               │  └── capacityWake │
    ├─ Session lifecycle                  │                  │
    │  ├── create                         │  Backoff:        │
    │  ├── run                            │  ├─ conn: 2s→2m  │
    │  └─ stop                            │  └─ gen: 500ms→30s│
    └─ Token refresh scheduler            └──────────────────┘
```

### Session Persistence
```text
    SESSION STORAGE
    ══════════════

    ~/.claude/projects/<hash>/sessions/
    └── <session-id>.jsonl           ← append-only log
        ├── {"type":"user",...}
        ├── {"type":"assistant",...}
        ├── {"type":"progress",...}
        └── {"type":"system","subtype":"compact_boundary",...}

    RESUME FLOW:
    getLastSessionLog() ──> parse JSONL ──> rebuild messages[]
         │
         ├── --continue     → last session in cwd
         ├── --resume <id>  → specific session
         └── --fork-session → new ID, copy history

    PERSISTENCE STRATEGY:
    ├─ User messages  → await write (blocking, for crash recovery)
    ├─ Assistant msgs → fire-and-forget (order-preserving queue)
    ├─ Progress       → inline write (dedup on next query)
    └─ Flush          → on result yield / cowork eager flush
```

### Feature Flag System
```text
    DEAD CODE ELIMINATION (Bun compile-time)
    ══════════════════════════════════════════

    feature('FLAG_NAME')  ──→  true  → included in bundle
                          ──→  false → stripped from bundle

    FLAGS (observed in source):
    ├─ COORDINATOR_MODE      → multi-agent coordinator
    ├─ HISTORY_SNIP          → aggressive history trimming
    ├─ CONTEXT_COLLAPSE      → context restructuring
    ├─ DAEMON                → background daemon workers
    ├─ AGENT_TRIGGERS        → cron/remote triggers
    ├─ AGENT_TRIGGERS_REMOTE → remote trigger support
    ├─ MONITOR_TOOL          → MCP monitoring tool
    ├─ WEB_BROWSER_TOOL      → browser automation
    ├─ VOICE_MODE            → voice input/output
    ├─ TEMPLATES             → job classifier
    ├─ EXPERIMENTAL_SKILL_SEARCH → skill discovery
    ├─ KAIROS                → push notifications, file sends
    ├─ PROACTIVE             → sleep tool, proactive behavior
    ├─ OVERFLOW_TEST_TOOL    → testing tool
    ├─ TERMINAL_PANEL        → terminal capture
    ├─ WORKFLOW_SCRIPTS      → workflow tool
    ├─ CHICAGO_MCP           → computer use MCP
    ├─ DUMP_SYSTEM_PROMPT    → prompt extraction (ant-only)
    ├─ UDS_INBOX             → peer discovery
    ├─ ABLATION_BASELINE     → experiment ablation
    └─ UPGRADE_NOTICE        → upgrade notifications

    RUNTIME GATES:
    ├─ process.env.USER_TYPE === 'ant'  → Anthropic-internal features
    └─ GrowthBook feature flags         → A/B experiments at runtime
```

### State Management
```text
    ┌──────────────────────────────────────────────────────────┐
    │                  AppState Store                          │
    │                                                          │
    │  AppState {                                              │
    │    toolPermissionContext: {                              │
    │      mode: PermissionMode,           ← default/plan/etc │
    │      additionalWorkingDirectories,                       │
    │      alwaysAllowRules,               ← auto-approve      │
    │      alwaysDenyRules,                ← auto-reject       │
    │      alwaysAskRules,                 ← always prompt     │
    │      isBypassPermissionsModeAvailable                    │
    │    },                                                    │
    │    fileHistory: FileHistoryState,    ← undo snapshots    │
    │    attribution: AttributionState,    ← commit tracking   │
    │    verbose: boolean,                                     │
    │    mainLoopModel: string,           ← active model      │
    │    fastMode: FastModeState,                              │
    │    speculation: SpeculationState                         │
    │  }                                                       │
    │                                                          │
    │  React Integration:                                      │
    │  ├── AppStateProvider   → creates store via createContext │
    │  ├── useAppState(sel)   → selector-based subscriptions   │
    │  └── useSetAppState()   → immer-style updater function   │
    └──────────────────────────────────────────────────────────┘
```

### The 12 Progressive Harness Mechanisms
This source code demonstrates 12 layered mechanisms that a production AI agent harness needs beyond the basic loop. Each builds on the previous:

```text
    s01  THE LOOP             "One loop & Bash is all you need"
         query.ts: the while-true loop that calls Claude API,
         checks stop_reason, executes tools, appends results.

    s02  TOOL DISPATCH        "Adding a tool = adding one handler"
         Tool.ts + tools.ts: every tool registers into the dispatch
         map. The loop stays identical. buildTool() factory provides
         safe defaults.

    s03  PLANNING             "An agent without a plan drifts"
         EnterPlanModeTool/ExitPlanModeTool + TodoWriteTool:
         list steps first, then execute. Doubles completion rate.

    s04  SUB-AGENTS           "Break big tasks; clean context per subtask"
         AgentTool + forkSubagent.ts: each child gets fresh messages[],
         keeping the main conversation clean.

    s05  KNOWLEDGE ON DEMAND  "Load knowledge when you need it"
         SkillTool + memdir/: inject via tool_result, not system prompt.
         CLAUDE.md files loaded lazily per directory.

    s06  CONTEXT COMPRESSION  "Context fills up; make room"
         services/compact/: three-layer strategy:
         autoCompact (summarize) + snipCompact (trim) + contextCollapse

    s07  PERSISTENT TASKS     "Big goals → small tasks → disk"
         TaskCreate/Update/Get/List: file-based task graph with
         status tracking, dependencies, and persistence.

    s08  BACKGROUND TASKS     "Slow ops in background; agent keeps thinking"
         DreamTask + LocalShellTask: daemon threads run commands,
         inject notifications on completion.

    s09  AGENT TEAMS          "Too big for one → delegate to teammates"
         TeamCreate/Delete + InProcessTeammateTask: persistent
         teammates with async mailboxes.

    s10  TEAM PROTOCOLS       "Shared communication rules"
         SendMessageTool: one request-response pattern drives
         all negotiation between agents.

    s11  AUTONOMOUS AGENTS    "Teammates scan and claim tasks themselves"
         coordinator/coordinatorMode.ts: idle cycle + auto-claim,
         no need for lead to assign each task.

    s12  WORKTREE ISOLATION   "Each works in its own directory"
         EnterWorktreeTool/ExitWorktreeTool: tasks manage goals,
         worktrees manage directories, bound by ID.
```

### Key Design Patterns

| Pattern | Where | Purpose |
|---------|-------|---------|
| **AsyncGenerator streaming** | `QueryEngine`, `query()` | Full-chain streaming from API to consumer |
| **Builder + Factory** | `buildTool()` | Safe defaults for tool definitions |
| **Branded Types** | `SystemPrompt`, `asSystemPrompt()` | Prevent string/array confusion |
| **Feature Flags + DCE** | `feature()` from `bun:bundle` | Compile-time dead code elimination |
| **Discriminated Unions** | `Message` types | Type-safe message handling |
| **Observer + State Machine** | `StreamingToolExecutor` | Tool execution lifecycle tracking |
| **Snapshot State** | `FileHistoryState` | Undo/redo for file operations |
| **Ring Buffer** | Error log | Bounded memory for long sessions |
| **Fire-and-Forget Write** | `recordTranscript()` | Non-blocking persistence with ordering |
| **Lazy Schema** | `lazySchema()` | Defer Zod schema evaluation for performance |
| **Context Isolation** | `AsyncLocalStorage` | Per-agent context in shared process |

### Build Notes

This source is **not directly compilable** from this repo alone:

- Missing `tsconfig.json`, build scripts, and Bun bundler config
- `feature()` calls are Bun compile-time intrinsics — resolved during bundling
- `MACRO.VERSION` is injected at build time
- `process.env.USER_TYPE === 'ant'` sections are Anthropic-internal
- The compiled `cli.js` is a self-contained 12MB bundle requiring only Node.js >= 18
- Source maps (`cli.js.map`, 60MB) map back to these source files for debugging

**See QUICKSTART.md for build instructions and workarounds.**

### License

All source code in this repository is copyright **Anthropic PBC**. This repository is for technical research and education only. See the original npm package for full license terms.




## 十三、s12.1 task_assign Worktree 参数扩展（2026-04-03）

### 需求背景

s12 完成后，`task_assign` 要求调用方必须提前用 `team_create` + `enter_worktree` 手动准备好 teammate 和隔离环境。
s12.1 的目标：**一个参数 `worktree: true` 即可让 LLM 自动完成全套 worktree 环境的创建与任务执行，无需任何前置步骤。**

### 改动文件

| 文件 | 改动 |
|------|------|
| `packages/coding-agent/src/core/tools/task-assign.ts` | `worktree?: boolean` 参数；`teammate_id` 改可选；两路分发逻辑 |
| `packages/coding-agent/src/core/autonomous-runner.ts` | `ClaimAndRunOptions` 接口；`_runInWorktree()` 内部函数；worktree 专属 notification 格式 |

### 架构设计
```text
task_assign 调用路径：

worktree: false（默认）          worktree: true
       │                                │
  getTeammate()                  claimAndRun(..., {useWorktree:true})
       │                                │
  claimAndRun()                  _runInWorktree()
       │                                ├── createWorktree()        # 生成隔离目录
  sendToTeammate()               ├── createWorktreeTeammate()  # 注入全套工具
                                 ├── sendToTeammate()          # 执行任务
                                 ├── 成功 → 保留 worktree      # 供检查
                                 └── 失败 → removeWorktree()   # 清理残留
```

### Notification 格式对比

| 原格式（teammate 路径） | 新格式（worktree 路径） |
|---|---|
| `<task-id>` / `<status>` / `<summary>` / `<r>` | 同上 + `<worktree-path>` + `<branch>`（git 时） |

### 设计决策

- **成功保留，失败清理**：成功时 worktree 留磁盘供 review，用户可用已有 `exit_worktree` 手动清理；失败时 `removeWorktree(force=true)` 防止残留损坏目录。
- **ephemeral teammate**：worktree 模式下的 teammate ID 格式为 `wt-auto-<uuid8>`，生命周期随任务，不进入持久 registry。
- **零前置依赖**：调用方无需先 `team_create` / `enter_worktree`，LLM 只需知道 `task_id` 即可。

### 坑记录（s12.1 新增）

- **坑 20: Python heredoc 写 TS 模板字符串的三重转义地狱**。Python `<< 'PYEOF'` 里写含反引号模板字符串的 TS 代码，`\`` 被 Python 解析为无效转义序列（`SyntaxWarning: invalid escape sequence`），写入文件后 tsgo 遇到破损语法直接 panic（goroutine stack trace）。**解决**: 用 `lines = [...]` + `"\n".join(lines)` 逐行拼接，彻底消除 heredoc 内的转义层。
- **坑 21: Python 脚本硬编码 `/root/` 路径**。脚本内写死 `/root/pi-mono/` 而服务器用户为 `elysia`，导致 `PermissionError: [Errno 13]`。**解决**: 一律用 `os.path.expanduser("~/...")` 展开家目录。

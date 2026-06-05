# @mariozechner/pi-coding-agent — ElysiaClaw Agent SDK

> pi-coding-agent 是 ElysiaClaw 平台的 Agent SDK 层。在 pi-mono 原版基础上实现了对标 Claude Code 的完整 12 层 Agent 架构。

### ElysiaClaw 扩展能力

ElysiaClaw 通过 pi-mono 的 SDK/Hooks/Extension 体系，实现了以下扩展：

**12 层 Agent 框架**：

| 层 | 能力 | 核心模块 |
|------|------|------|
| s01-s02 | Agent Loop + Tool Dispatch | `agent-loop.ts`, `tools/index.ts`（31 工具，ToolDefinition 18 字段） |
| s03 | Planning | `enter-plan-mode.ts`, `exit-plan-mode.ts`, `todo-write.ts` |
| s04 | Sub-Agents | `agent-session.ts` fork path |
| s05 | Knowledge on Demand | `knowledge/claude-md-loader.ts` + Skills 系统 |
| s06 | Context Compression | `compaction/multi-layer.ts`（三层压缩链） |
| s07 | Persistent Tasks | `tasks/task-store.ts`（6 个 task_* 工具） |
| s08 | Background Tasks | `background-runner.ts` |
| s09-s10 | Agent Teams + Protocols | `team-create.ts`, `send-message.ts` 等 |
| s11 | Autonomous Agents | `autonomous-runner.ts` |
| s12 | Worktree Isolation | `worktree-manager.ts` |

**基础设施补丁**：

| 补丁 | 功能 |
|------|------|
| P1-B | CLAUDE.md 懒加载（通过 tool_result 注入，保护 prompt cache） |
| P1-C | Context Pressure 事件（80k token 阈值主动预警） |
| P2-A | Session Persistence + Resume（continueRecent / sessionPath） |
| P2-B | Cost Tracker（TUI 实时 + Bot 报告） |
| P2-D | 三阶段速率调度器（令牌桶 + 任务分析 + 模型路由 + 自适应 guard） |
| P3-A | PreToolUse Shell Hooks（工具级 + 全局级） |
| P3-B | File History + Undo（文件快照与回滚） |

**Code Mode**：独立的 `/code` 编码模式，环境隔离（`~/.pi/agent/code-sessions/`），工具集完整保留。

**测试基线**：858/861 passed（3 failures 预存）。

详细架构文档见 [elysiaclaw_engine/ARCHITECTURE.md](../../elysiaclaw_engine/ARCHITECTURE.md)。

---

Pi 是一个极简的终端编程工具。让 Pi 适应你的工作流，而不是反过来——无需 fork 和修改 Pi 的内部代码。你可以通过 TypeScript [扩展](#扩展)、[技能](#技能)、[提示词模板](#提示词模板)和[主题](#主题)来扩展它。将你的扩展、技能、提示词模板和主题打包为 [Pi 包](#pi-包)，通过 npm 或 git 与他人分享。

Pi 开箱即用，拥有强大的默认配置，但刻意省略了子代理（sub agent）和计划模式（plan mode）等功能。你可以让 Pi 为你构建所需的功能，或者安装第三方 Pi 包来匹配你的工作流。

Pi 有四种运行模式：交互模式、打印/JSON 模式、RPC 模式（用于进程集成）以及 SDK 模式（嵌入到你自己的应用中）。

## 目录

- [快速开始](#快速开始)
- [提供者与模型](#提供者与模型)
- [交互模式](#交互模式)
  - [编辑器](#编辑器)
  - [命令](#命令)
  - [键盘快捷键](#键盘快捷键)
  - [消息队列](#消息队列)
- [会话](#会话)
  - [分支](#分支)
  - [压缩](#压缩)
- [设置](#设置)
- [上下文文件](#上下文文件)
- [自定义](#自定义)
  - [提示词模板](#提示词模板)
  - [技能](#技能)
  - [扩展](#扩展)
  - [主题](#主题)
  - [Pi 包](#pi-包)
- [编程式使用](#编程式使用)
- [设计哲学](#设计哲学)
- [CLI 参考](#cli-参考)

---

## 快速开始

```bash
npm install -g @mariozechner/pi-coding-agent
```

通过 API 密钥进行认证：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

或使用你已有的订阅：

```bash
pi
/login  # 然后选择提供者
```

然后直接和 Pi 对话即可。默认情况下，Pi 会向模型提供四个工具：`read`、`write`、`edit` 和 `bash`。模型会使用这些工具来完成你的请求。你可以通过[技能](#技能)、[提示词模板](#提示词模板)、[扩展](#扩展)或 [Pi 包](#pi-包)来添加更多功能。

**平台说明：** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [终端设置](docs/terminal-setup.md) | [Shell 别名](docs/shell-aliases.md)

---

## 提供者与模型

对于每个内置提供者，Pi 会维护一份支持工具调用的模型列表，并在每次发布时更新。通过订阅（`/login`）或 API 密钥认证后，可以通过 `/model`（或 Ctrl+L）选择该提供者的任意模型。

**订阅方式：**
- Anthropic Claude Pro/Max
- OpenAI ChatGPT Plus/Pro (Codex)
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

**API 密钥方式：**
- Anthropic
- OpenAI
- Azure OpenAI
- Google Gemini
- Google Vertex
- Amazon Bedrock
- Mistral
- Groq
- Cerebras
- xAI
- OpenRouter
- Vercel AI Gateway
- ZAI
- OpenCode Zen
- OpenCode Go
- Hugging Face
- Kimi For Coding
- MiniMax

详见 [docs/providers.md](docs/providers.md) 了解详细配置说明。

**自定义提供者与模型：** 如果提供者支持已有 API（OpenAI、Anthropic、Google），可通过 `~/.pi/agent/models.json` 添加。对于自定义 API 或 OAuth，使用扩展。详见 [docs/models.md](docs/models.md) 和 [docs/custom-provider.md](docs/custom-provider.md)。

---

## 交互模式

<p align="center"><img src="docs/images/interactive-mode.png" alt="交互模式" width="600"></p>

界面从上到下依次为：

- **启动头部** - 显示快捷键（`/hotkeys` 查看全部）、已加载的 AGENTS.md 文件、提示词模板、技能和扩展
- **消息区** - 你的消息、助手回复、工具调用及结果、通知、错误和扩展 UI
- **编辑器** - 你输入文字的地方；边框颜色指示思维级别
- **底部栏** - 工作目录、会话名称、总 token/缓存使用量、费用、上下文使用率、当前模型

编辑器可以被其他 UI 临时替代，比如内置的 `/settings` 界面或扩展提供的自定义 UI（例如一个问答工具，让用户以结构化格式回答模型的问题）。[扩展](#扩展)还可以替换编辑器、在其上方/下方添加组件、状态栏、自定义底部栏或覆盖层。

### 编辑器

| 功能 | 操作方式 |
|------|---------|
| 文件引用 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | Tab 键补全路径 |
| 多行输入 | Shift+Enter（Windows Terminal 中为 Ctrl+Enter） |
| 图片 | Ctrl+V 粘贴（Windows 中为 Alt+V），或拖拽到终端 |
| Bash 命令 | `!command` 运行并将输出发送给 LLM，`!!command` 运行但不发送 |

支持标准编辑键绑定，如删除单词、撤销等。详见 [docs/keybindings.md](docs/keybindings.md)。

### 命令

在编辑器中输入 `/` 触发命令。[扩展](#扩展)可以注册自定义命令，[技能](#技能)以 `/skill:name` 形式调用，[提示词模板](#提示词模板)通过 `/模板名` 展开。

| 命令 | 说明 |
|------|------|
| `/login`、`/logout` | OAuth 认证 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用 Ctrl+P 循环切换的模型 |
| `/settings` | 思维级别、主题、消息传递、传输方式 |
| `/resume` | 从历史会话中选择 |
| `/new` | 开始新会话 |
| `/name <名称>` | 设置会话显示名称 |
| `/session` | 显示会话信息（路径、token 数、费用） |
| `/tree` | 跳转到会话中的任意节点并从该处继续 |
| `/fork` | 从当前分支创建新会话 |
| `/compact [提示词]` | 手动压缩上下文，可选自定义指令 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [文件]` | 将会话导出为 HTML 文件 |
| `/share` | 上传为私有 GitHub Gist 并生成可分享的 HTML 链接 |
| `/reload` | 重新加载键绑定、扩展、技能、提示词和上下文文件（主题自动热重载） |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit`、`/exit` | 退出 Pi |

### 键盘快捷键

通过 `/hotkeys` 查看完整列表。可通过 `~/.pi/agent/keybindings.json` 自定义。详见 [docs/keybindings.md](docs/keybindings.md)。

**常用快捷键：**

| 按键 | 操作 |
|------|------|
| Ctrl+C | 清空编辑器 |
| Ctrl+C 连按两次 | 退出 |
| Escape | 取消/中止 |
| Escape 连按两次 | 打开 `/tree` |
| Ctrl+L | 打开模型选择器 |
| Ctrl+P / Shift+Ctrl+P | 正向/反向循环切换限定模型 |
| Shift+Tab | 循环切换思维级别 |
| Ctrl+O | 折叠/展开工具输出 |
| Ctrl+T | 折叠/展开思维块 |

### 消息队列

在代理工作时提交消息：

- **Enter** 排入一条*转向*消息，在当前助手回合完成工具调用执行后传递
- **Alt+Enter** 排入一条*后续*消息，仅在代理完成所有工作后才传递
- **Escape** 中止并将排队消息恢复到编辑器
- **Alt+Up** 将排队消息取回编辑器

在 Windows Terminal 中，`Alt+Enter` 默认是全屏切换。请在 [docs/terminal-setup.md](docs/terminal-setup.md) 中重新映射，以便 Pi 能接收后续消息快捷键。

可在[设置](docs/settings.md)中配置消息传递方式：`steeringMode` 和 `followUpMode` 可设为 `"one-at-a-time"`（默认，等待回复）或 `"all"`（一次性传递所有排队消息）。`transport` 选择提供者的传输偏好（`"sse"`、`"websocket"` 或 `"auto"`），适用于支持多种传输方式的提供者。

---

## 会话

会话以 JSONL 文件存储，采用树形结构。每条记录都有 `id` 和 `parentId`，支持原地分支而无需创建新文件。详见 [docs/session.md](docs/session.md) 了解文件格式。

### 管理

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择历史会话
pi --no-session        # 临时模式（不保存）
pi --session <路径>    # 使用指定的会话文件或 ID
pi --fork <路径>       # 从指定会话文件或 ID 派生新会话
```

### 分支

**`/tree`** - 在会话树中原地导航。选择任意历史节点，从该处继续，并在分支之间切换。所有历史记录保存在一个文件中。

<p align="center"><img src="docs/images/tree-view.png" alt="树视图" width="600"></p>

- 通过输入进行搜索，Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ 展开/折叠并在分支间跳转，←/→ 翻页
- 过滤模式（Ctrl+O）：默认 → 无工具 → 仅用户消息 → 仅标签 → 全部
- Shift+L 为条目添加书签标签，Shift+T 切换标签时间戳显示

**`/fork`** - 从当前分支创建新的会话文件。打开选择器，复制到选定节点为止的历史记录，并将该消息放入编辑器供你修改。

**`--fork <路径|ID>`** - 直接从 CLI 派生指定的会话文件或部分会话 UUID。这会将源会话完整复制到当前项目的新会话文件中。

### 压缩

长时间会话可能耗尽上下文窗口。压缩会总结较早的消息，同时保留近期消息。

**手动：** `/compact` 或 `/compact <自定义指令>`

**自动：** 默认启用。在上下文溢出时触发（恢复并重试）或接近限制时触发（主动）。通过 `/settings` 或 `settings.json` 配置。

压缩是有损的。完整历史记录保留在 JSONL 文件中；使用 `/tree` 回溯查看。可通过[扩展](#扩展)自定义压缩行为。详见 [docs/compaction.md](docs/compaction.md) 了解内部机制。

---

## 设置

使用 `/settings` 修改常用选项，或直接编辑 JSON 文件：

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目级（覆盖全局） |

详见 [docs/settings.md](docs/settings.md) 了解所有选项。

---

## 上下文文件

Pi 启动时会加载 `AGENTS.md`（或 `CLAUDE.md`），搜索路径包括：
- `~/.pi/agent/AGENTS.md`（全局）
- 父目录（从当前目录向上遍历）
- 当前目录

用于项目说明、约定、常用命令等。所有匹配的文件会被拼接在一起。

### 系统提示词

通过 `.pi/SYSTEM.md`（项目级）或 `~/.pi/agent/SYSTEM.md`（全局）替换默认系统提示词。通过 `APPEND_SYSTEM.md` 追加内容而不替换。

---

## 自定义

### 提示词模板

可复用的 Markdown 格式提示词。输入 `/名称` 即可展开。

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
审查这段代码的 bug、安全问题和性能问题。
重点关注：{{focus}}
```

放置在 `~/.pi/agent/prompts/`、`.pi/prompts/` 或 [Pi 包](#pi-包)中与他人分享。详见 [docs/prompt-templates.md](docs/prompt-templates.md)。

### 技能

遵循 [Agent Skills 标准](https://agentskills.io)的按需功能包。通过 `/skill:name` 调用，或让代理自动加载。

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# 我的技能
当用户询问 X 时使用此技能。

## 步骤
1. 做这件事
2. 然后做那件事
```

放置在 `~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/` 或 `.agents/skills/` 中（从当前目录向上遍历父目录），或放在 [Pi 包](#pi-包)中与他人分享。详见 [docs/skills.md](docs/skills.md)。

### 扩展

<p align="center"><img src="docs/images/doom-extension.png" alt="Doom 扩展" width="600"></p>

TypeScript 模块，可通过自定义工具、命令、键盘快捷键、事件处理器和 UI 组件来扩展 Pi。

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

**可能的用途：**
- 自定义工具（或完全替换内置工具）
- 子代理和计划模式
- 自定义压缩和摘要
- 权限门控和路径保护
- 自定义编辑器和 UI 组件
- 状态栏、头部、底部栏
- Git 检查点和自动提交
- SSH 和沙箱执行
- MCP 服务器集成
- 让 Pi 看起来像 Claude Code
- 等待时玩游戏（没错，Doom 能跑起来）
- ……任何你能想到的

放置在 `~/.pi/agent/extensions/`、`.pi/extensions/` 或 [Pi 包](#pi-包)中与他人分享。详见 [docs/extensions.md](docs/extensions.md) 和 [examples/extensions/](examples/extensions/)。

### 主题

内置主题：`dark`、`light`。主题支持热重载：修改活动主题文件，Pi 会立即应用更改。

放置在 `~/.pi/agent/themes/`、`.pi/themes/` 或 [Pi 包](#pi-包)中与他人分享。详见 [docs/themes.md](docs/themes.md)。

### Pi 包

通过 npm 或 git 打包和分享扩展、技能、提示词和主题。

> **安全提示：** Pi 包拥有完整的系统访问权限。扩展可执行任意代码，技能可指示模型执行任何操作，包括运行可执行文件。安装第三方包前请审查源代码。

```bash
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3      # 固定版本
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1  # 标签或提交
pi install git:git@github.com:user/repo
pi install git:git@github.com:user/repo@v1  # 标签或提交
pi install https://github.com/user/repo
pi install https://github.com/user/repo@v1      # 标签或提交
pi install ssh://git@github.com/user/repo
pi install ssh://git@github.com/user/repo@v1    # 标签或提交
pi remove npm:@foo/pi-tools
pi uninstall npm:@foo/pi-tools          # remove 的别名
pi list
pi update                               # 跳过固定版本的包
pi config                               # 启用/禁用扩展、技能、提示词、主题
```

包安装到 `~/.pi/agent/git/`（git）或全局 npm。使用 `-l` 进行项目本地安装（`.pi/git/`、`.pi/npm/`）。如果你使用 Node 版本管理器，并希望包安装复用稳定的 npm 环境，可在 `settings.json` 中设置 `npmCommand`，例如 `["mise", "exec", "node@20", "--", "npm"]`。

在 `package.json` 中添加 `pi` 字段来创建包：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

如果没有 `pi` 清单，Pi 会从约定目录（`extensions/`、`skills/`、`prompts/`、`themes/`）自动发现。

详见 [docs/packages.md](docs/packages.md)。

---

## 编程式使用

### SDK

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("当前目录下有哪些文件？");
```

对于高级的多会话运行时替换，使用 `createAgentSessionRuntime()` 和 `AgentSessionRuntimeHost`。

详见 [docs/sdk.md](docs/sdk.md) 和 [examples/sdk/](examples/sdk/)。

### RPC 模式

对于非 Node.js 集成，通过 stdin/stdout 使用 RPC 模式：

```bash
pi --mode rpc
```

RPC 模式使用严格的 LF 分隔 JSONL 帧。客户端必须仅在 `\n` 处分割记录。不要使用通用行读取器（如 Node 的 `readline`），因为它还会在 JSON 负载内的 Unicode 分隔符处分割。

详见 [docs/rpc.md](docs/rpc.md) 了解协议细节。

---

## 设计哲学

Pi 强调可扩展性，因此它不需要规定你的工作流。其他工具内置的功能可以通过[扩展](#扩展)、[技能](#技能)或第三方 [Pi 包](#pi-包)来构建。这保持了核心的精简，同时让你可以按需塑造 Pi。

**不内置 MCP。** 用 CLI 工具加 README 即可（参见[技能](#技能)），或者构建一个添加 MCP 支持的扩展。

**不内置子代理。** 实现方式多种多样。通过 tmux 启动 Pi 实例，或用[扩展](#扩展)构建自己的方案，或安装一个符合你需求的包。

**不内置权限弹窗。** 在容器中运行，或用[扩展](#扩展)构建你自己的确认流程，与你的环境和安全需求保持一致。

**不内置计划模式。** 将计划写入文件，或用[扩展](#扩展)构建，或安装一个包。

**不内置待办事项。** 它们会迷惑模型。使用 TODO.md 文件，或用[扩展](#扩展)构建你自己的方案。

**不内置后台 Bash。** 使用 tmux。完全可见，直接交互。

这便是 pi-mono 的核心设计哲学。

> **ElysiaClaw 实现说明**：上述哲学正是 ElysiaClaw 扩展层的设计基础。pi-mono 说"不内置子代理、计划模式、后台 Bash"，而 ElysiaClaw 正是通过 Extension/Tool/Skill 体系把这些能力作为扩展实现——这正是 pi-mono 期望的方式。"原语，而非功能" = 框架给你钩子，你在钩子上构建你需要的功能。

---

## CLI 参考

```bash
pi [选项] [@文件...] [消息...]
```

### 包命令

```bash
pi install <源> [-l]     # 安装包，-l 表示项目本地安装
pi remove <源> [-l]      # 移除包
pi uninstall <源> [-l]   # remove 的别名
pi update [源]           # 更新包（跳过固定版本）
pi list                  # 列出已安装的包
pi config                # 启用/禁用包中的资源
```

### 模式

| 标志 | 说明 |
|------|------|
| （默认） | 交互模式 |
| `-p`、`--print` | 打印响应后退出 |
| `--mode json` | 以 JSON 行输出所有事件（参见 [docs/json.md](docs/json.md)） |
| `--mode rpc` | 用于进程集成的 RPC 模式（参见 [docs/rpc.md](docs/rpc.md)） |
| `--export <输入> [输出]` | 将会话导出为 HTML |

在打印模式下，Pi 还会读取管道输入的 stdin 并将其合并到初始提示词中：

```bash
cat README.md | pi -p "总结这段文本"
```

### 模型选项

| 选项 | 说明 |
|------|------|
| `--provider <名称>` | 提供者（anthropic、openai、google 等） |
| `--model <模式>` | 模型模式或 ID（支持 `provider/id` 和可选的 `:<thinking>`） |
| `--api-key <密钥>` | API 密钥（覆盖环境变量） |
| `--thinking <级别>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh` |
| `--models <模式>` | 逗号分隔的模式列表，用于 Ctrl+P 循环切换 |
| `--list-models [搜索]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|------|------|
| `-c`、`--continue` | 继续最近的会话 |
| `-r`、`--resume` | 浏览并选择会话 |
| `--session <路径>` | 使用指定的会话文件或部分 UUID |
| `--fork <路径>` | 从指定会话文件或部分 UUID 派生新会话 |
| `--session-dir <目录>` | 自定义会话存储目录 |
| `--no-session` | 临时模式（不保存） |

### 工具选项

| 选项 | 说明 |
|------|------|
| `--tools <列表>` | 启用指定的内置工具（默认：`read,bash,edit,write`） |
| `--no-tools` | 禁用所有内置工具（扩展工具仍然可用） |

可用的内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`

### 资源选项

| 选项 | 说明 |
|------|------|
| `-e`、`--extension <源>` | 从路径、npm 或 git 加载扩展（可重复） |
| `--no-extensions` | 禁用扩展自动发现 |
| `--skill <路径>` | 加载技能（可重复） |
| `--no-skills` | 禁用技能自动发现 |
| `--prompt-template <路径>` | 加载提示词模板（可重复） |
| `--no-prompt-templates` | 禁用提示词模板自动发现 |
| `--theme <路径>` | 加载主题（可重复） |
| `--no-themes` | 禁用主题自动发现 |

将 `--no-*` 与显式标志结合使用，可以只加载你需要的内容，忽略 settings.json（例如 `--no-extensions -e ./my-ext.ts`）。

### 其他选项

| 选项 | 说明 |
|------|------|
| `--system-prompt <文本>` | 替换默认提示词（上下文文件和技能仍会追加） |
| `--append-system-prompt <文本>` | 追加到系统提示词 |
| `--verbose` | 强制详细启动输出 |
| `-h`、`--help` | 显示帮助 |
| `-v`、`--version` | 显示版本 |

### 文件参数

以 `@` 为前缀的文件会包含在消息中：

```bash
pi @prompt.md "回答这个问题"
pi -p @screenshot.png "这张图片里是什么？"
pi @code.ts @test.ts "审查这些文件"
```

### 示例

```bash
# 带初始提示的交互模式
pi "列出 src/ 下的所有 .ts 文件"

# 非交互模式
pi -p "总结这个代码库"

# 非交互模式配合管道输入
cat README.md | pi -p "总结这段文本"

# 使用不同模型
pi --provider openai --model gpt-4o "帮我重构"

# 带提供者前缀的模型（无需 --provider）
pi --model openai/gpt-4o "帮我重构"

# 思维级别简写
pi --model sonnet:high "解决这个复杂问题"

# 限制可切换的模型范围
pi --models "claude-*,gpt-4o"

# 只读模式
pi --tools read,grep,find,ls -p "审查代码"

# 高思维级别
pi --thinking high "解决这个复杂问题"
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录（默认：`~/.pi/agent`） |
| `PI_PACKAGE_DIR` | 覆盖包目录（适用于 Nix/Guix 等存储路径分词困难的场景） |
| `PI_SKIP_VERSION_CHECK` | 跳过启动时的版本检查 |
| `PI_CACHE_RETENTION` | 设为 `long` 以延长提示词缓存（Anthropic：1 小时，OpenAI：24 小时） |
| `VISUAL`、`EDITOR` | Ctrl+G 使用的外部编辑器 |

---

## 贡献与开发

参见 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解贡献指南，[docs/development.md](docs/development.md) 了解开发环境搭建、fork 和调试。

---

## 许可证

MIT


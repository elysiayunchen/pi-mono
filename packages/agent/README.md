# @elynyx/agent-core

具有工具执行和事件流的有状态代理。基于 `@elynyx/ai` 构建。

## 安装

```bash
npm install @elynyx/agent-core
```

## 快速上手

```typescript
import { Agent } from "@elynyx/agent-core";
import { getModel } from "@elynyx/ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
  },
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // 仅流式输出新增的文本片段
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## 核心概念

### AgentMessage 与 LLM Message

代理使用 `AgentMessage`，这是一种灵活的类型，可以包含：
- 标准 LLM 消息（`user`、`assistant`、`toolResult`）
- 通过声明合并（declaration merging）支持自定义的应用专属消息类型

LLM 只理解 `user`、`assistant` 和 `toolResult`。`convertToLlm` 函数负责在每次 LLM 调用前对消息进行过滤和转换，弥合这一差距。

### 消息流转

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
                    （可选）                              （必需）
```

1. **transformContext**：裁剪旧消息、注入外部上下文
2. **convertToLlm**：过滤掉仅用于 UI 展示的消息，将自定义类型转换为 LLM 格式

## 事件流

代理通过发射事件来驱动 UI 更新。理解事件序列有助于构建响应式界面。

### prompt() 事件序列

当你调用 `prompt("Hello")` 时：

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { message: userMessage }      // 你的输入
├─ message_end     { message: userMessage }
├─ message_start   { message: assistantMessage } // LLM 开始响应
├─ message_update  { message: partial... }       // 流式文本片段
├─ message_update  { message: partial... }
├─ message_end     { message: assistantMessage } // 完整响应
├─ turn_end        { message, toolResults: [] }
└─ agent_end       { messages: [...] }
```

### 包含工具调用时

如果助手调用了工具，循环会继续：

```
prompt("Read config.json")
├─ agent_start
├─ turn_start
├─ message_start/end  { userMessage }
├─ message_start      { assistantMessage with toolCall }
├─ message_update...
├─ message_end        { assistantMessage }
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_update { partialResult }           // 如果工具支持流式输出
├─ tool_execution_end    { toolCallId, result }
├─ message_start/end  { toolResultMessage }
├─ turn_end           { message, toolResults: [toolResult] }
│
├─ turn_start                                        // 下一轮
├─ message_start      { assistantMessage }           // LLM 根据工具结果进行响应
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

工具执行模式可配置：

- `parallel`（默认）：按顺序预检工具调用，并发执行已允许的工具，最终的 `tool_execution_end` 和 `toolResult` 消息按助手消息中的源顺序发出
- `sequential`：逐个执行工具调用，兼容历史行为

`beforeToolCall` 钩子在 `tool_execution_start` 之后、参数校验通过后执行，可以阻止工具执行。`afterToolCall` 钩子在工具执行完成后、`tool_execution_end` 和最终工具结果消息事件发出之前执行。

使用 `Agent` 类时，助手 `message_end` 的处理被视为一个屏障（barrier），在工具预检开始之前完成。这意味着 `beforeToolCall` 看到的代理状态已经包含了请求工具调用的助手消息。

### continue() 事件序列

`continue()` 从现有上下文恢复，不添加新消息。适用于出错后的重试。

```typescript
// 出错后从当前状态重试
await agent.continue();
```

上下文中的最后一条消息必须是 `user` 或 `toolResult`（不能是 `assistant`）。

### 事件类型

| 事件 | 描述 |
|------|------|
| `agent_start` | 代理开始处理 |
| `agent_end` | 运行的最终事件。被 await 的该事件订阅者仍计入 settlement |
| `turn_start` | 新一轮开始（一次 LLM 调用 + 工具执行） |
| `turn_end` | 一轮完成，包含助手消息和工具结果 |
| `message_start` | 任意消息开始（user、assistant、toolResult） |
| `message_update` | **仅限助手消息。** 包含 `assistantMessageEvent` 及增量内容 |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始执行 |
| `tool_execution_update` | 工具流式输出进度 |
| `tool_execution_end` | 工具执行完成 |
| `context_pressure` | 上下文 token 超过 `contextPressureThreshold` 阈值时发出，提示即将触发压缩 |
| `context_compacted` | 上下文压缩完成后发出，包含压缩前后的消息摘要 |

`Agent.subscribe()` 的监听器按注册顺序 await。`agent_end` 表示不会再有循环事件发出，但 `await agent.waitForIdle()` 和 `await agent.prompt(...)` 会在被 await 的 `agent_end` 监听器执行完毕后才 settle。

## Agent 选项

```typescript
const agent = new Agent({
  // 初始状态
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // 将 AgentMessage[] 转换为 LLM Message[]（自定义消息类型时必需）
  convertToLlm: (messages) => messages.filter(...),

  // 在 convertToLlm 之前转换上下文（用于裁剪、压缩）
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // 引导模式："one-at-a-time"（默认）或 "all"
  steeringMode: "one-at-a-time",

  // 跟进模式："one-at-a-time"（默认）或 "all"
  followUpMode: "one-at-a-time",

  // 自定义流式函数（用于代理后端）
  streamFn: streamProxy,

  // 用于提供商缓存的会话 ID
  sessionId: "session-123",

  // 动态 API 密钥解析（用于会过期的 OAuth 令牌）
  getApiKey: async (provider) => refreshToken(),

  // 工具执行模式："parallel"（默认）或 "sequential"
  toolExecution: "parallel",

  // 上下文压力阈值（token 数）。超过此值时发出 context_pressure 事件
  contextPressureThreshold: 80000,

  // 在参数校验后对每个工具调用进行预检，可阻止执行
  beforeToolCall: async ({ toolCall, args, context }) => {
    if (toolCall.name === "bash") {
      return { block: true, reason: "bash is disabled" };
    }
  },

  // 在最终工具事件发出前对每个工具结果进行后处理
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    if (!isError) {
      return { details: { ...result.details, audited: true } };
    }
  },

  // 针对基于 token 的提供商的自定义思考预算
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

## Agent 状态

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  readonly isStreaming: boolean;
  readonly streamingMessage?: AgentMessage;
  readonly pendingToolCalls: ReadonlySet<string>;
  readonly errorMessage?: string;
}
```

通过 `agent.state` 访问状态。

赋值 `agent.state.tools = [...]` 或 `agent.state.messages = [...]` 会在存储前复制顶层数组。对返回数组的修改会直接影响当前代理状态。

在流式传输期间，`agent.state.streamingMessage` 包含当前的部分助手消息。

`agent.state.isStreaming` 在运行完全 settle 之前保持 `true`，包括被 await 的 `agent_end` 订阅者完成。

## 方法

### 提示（Prompting）

```typescript
// 文本提示
await agent.prompt("Hello");

// 包含图片
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// 直接传入 AgentMessage
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// 从当前上下文继续（最后一条消息必须是 user 或 toolResult）
await agent.continue();
```

### 状态管理

```typescript
agent.state.systemPrompt = "新提示词";
agent.state.model = getModel("openai", "gpt-4o");
agent.state.thinkingLevel = "medium";
agent.state.tools = [myTool];
agent.toolExecution = "sequential";
agent.beforeToolCall = async ({ toolCall }) => undefined;
agent.afterToolCall = async ({ toolCall, result }) => undefined;
agent.state.messages = newMessages; // 顶层数组会被复制
agent.state.messages.push(message);
agent.reset();
```

### 会话与思考预算

```typescript
agent.sessionId = "session-123";

agent.thinkingBudgets = {
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
```

### 控制

```typescript
agent.abort();              // 取消当前操作
await agent.waitForIdle();  // 等待完成
```

### 事件

```typescript
const unsubscribe = agent.subscribe(async (event, signal) => {
  if (event.type === "agent_end") {
    // 运行结束时的屏障性工作
    await flushSessionState(signal);
  }
});
unsubscribe();
```

## 引导与跟进

引导消息（Steering）让你在工具运行期间中断代理。跟进消息（Follow-up）让你在代理即将停止时排队额外工作。

```typescript
agent.steeringMode = "one-at-a-time";
agent.followUpMode = "one-at-a-time";

// 在代理运行工具时
agent.steer({
  role: "user",
  content: "停一下！改做这个。",
  timestamp: Date.now(),
});

// 在代理完成当前工作后
agent.followUp({
  role: "user",
  content: "另外再总结一下结果。",
  timestamp: Date.now(),
});

const steeringMode = agent.steeringMode;
const followUpMode = agent.followUpMode;

agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

使用 clearSteeringQueue、clearFollowUpQueue 或 clearAllQueues 来清除排队的消息。

当一轮结束后检测到引导消息时：
1. 当前助手消息中的所有工具调用已经完成
2. 引导消息被注入
3. LLM 在下一轮进行响应

跟进消息仅在没有更多工具调用且没有引导消息时才被检查。如果队列中有消息，则注入后会再执行一轮。

## 自定义消息类型

通过声明合并扩展 `AgentMessage`：

```typescript
declare module "@elynyx/agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

// 现在合法了
const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

在 `convertToLlm` 中处理自定义类型：

```typescript
const agent = new Agent({
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // 过滤掉
    return [m];
  }),
});
```

## 工具

使用 `AgentTool` 定义工具：

```typescript
import { Type } from "@sinclair/typebox";

const readFileTool: AgentTool = {
  name: "read_file",
  label: "读取文件",  // 用于 UI 展示
  description: "读取文件内容",
  parameters: Type.Object({
    path: Type.String({ description: "文件路径" }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // 可选：流式输出进度
    onUpdate?.({ content: [{ type: "text", text: "读取中..." }], details: {} });

    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.state.tools = [readFileTool];
```

### 错误处理

当工具失败时**抛出错误**。不要将错误信息作为正常内容返回。

```typescript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // 仅在成功时返回内容
  return { content: [{ type: "text", text: "..." }] };
}
```

抛出的错误会被代理捕获，并以 `isError: true` 的工具错误形式报告给 LLM。

## 代理用法

适用于通过后端代理的浏览器应用：

```typescript
import { Agent, streamProxy } from "@elynyx/agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## 底层 API

无需 Agent 类即可直接控制：

```typescript
import { agentLoop, agentLoopContinue } from "@elynyx/agent-core";

const context: AgentContext = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
  toolExecution: "parallel",
  contextPressureThreshold: 80000,
  beforeToolCall: async ({ toolCall, args, context }) => undefined,
  afterToolCall: async ({ toolCall, result, isError, context }) => undefined,
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

for await (const event of agentLoop([userMessage], context, config)) {
  console.log(event.type);
}

// 从现有上下文继续
for await (const event of agentLoopContinue(context, config)) {
  console.log(event.type);
}
```

这些底层流是观察性质的。它们保持事件顺序，但不会等待你的异步事件处理完成后再继续后续的生产者阶段。如果你需要消息处理作为屏障在工具预检之前完成，请使用 `Agent` 类而非原始的 `agentLoop()` 或 `agentLoopContinue()`。

## 许可证

MIT
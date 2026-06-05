# @mariozechner/pi-ai

统一的 LLM API，支持自动模型发现、提供商配置、令牌与成本追踪，以及简单的上下文持久化和会话中途切换到其他模型。

**注意**：此库仅包含支持工具调用（函数调用）的模型，因为这对代理式工作流至关重要。

## 目录

- [支持的提供商](#支持的提供商)
- [安装](#安装)
- [快速入门](#快速入门)
- [工具](#工具)
  - [定义工具](#定义工具)
  - [处理工具调用](#处理工具调用)
  - [流式工具调用与部分 JSON](#流式工具调用与部分-json)
  - [验证工具参数](#验证工具参数)
  - [完整事件参考](#完整事件参考)
- [图像输入](#图像输入)
- [思考/推理](#思考推理)
  - [统一接口](#统一接口streamsimplecompletesimple)
  - [提供商特定选项](#提供商特定选项streamcomplete)
  - [流式思考内容](#流式思考内容)
- [停止原因](#停止原因)
- [错误处理](#错误处理)
  - [中止请求](#中止请求)
  - [中止后继续](#中止后继续)
- [API、模型与提供商](#api模型与提供商)
  - [提供商与模型](#提供商与模型)
  - [查询提供商与模型](#查询提供商与模型)
  - [自定义模型](#自定义模型)
  - [OpenAI 兼容性设置](#openai-兼容性设置)
  - [类型安全](#类型安全)
- [跨提供商切换](#跨提供商切换)
- [上下文序列化](#上下文序列化)
- [浏览器使用](#浏览器使用)
  - [浏览器兼容性说明](#浏览器兼容性说明)
  - [环境变量](#环境变量仅限-nodejs)
  - [检查环境变量](#检查环境变量)
- [OAuth 提供商](#oauth-提供商)
  - [Vertex AI](#vertex-ai)
  - [CLI 登录](#cli-登录)
  - [编程式 OAuth](#编程式-oauth)
  - [登录流程示例](#登录流程示例)
  - [使用 OAuth 令牌](#使用-oauth-令牌)
  - [提供商说明](#提供商说明)
- [许可证](#许可证)

## 支持的提供商

- **OpenAI**
- **Azure OpenAI（Responses）**
- **OpenAI Codex**（需要 ChatGPT Plus/Pro 订阅，需要 OAuth，见下文）
- **Anthropic**
- **Google**
- **Vertex AI**（通过 Vertex AI 使用 Gemini）
- **Mistral**
- **Groq**
- **Cerebras**
- **xAI**
- **OpenRouter**
- **Vercel AI Gateway**
- **MiniMax**
- **GitHub Copilot**（需要 OAuth，见下文）
- **Google Gemini CLI**（需要 OAuth，见下文）
- **Antigravity**（需要 OAuth，见下文）
- **Amazon Bedrock**
- **OpenCode Zen**
- **OpenCode Go**
- **Kimi For Coding**（Moonshot AI，使用 Anthropic 兼容 API）
- **任何 OpenAI 兼容 API**：Ollama、vLLM、LM Studio 等

## 安装

```bash
npm install @mariozechner/pi-ai
```

TypeBox 的导出已从 `@mariozechner/pi-ai` 重新导出：`Type`、`Static` 和 `TSchema`。

## 快速入门

```typescript
import { Type, getModel, stream, complete, Context, Tool, StringEnum } from '@mariozechner/pi-ai';

// 完全类型化，支持提供商和模型的自动补全
const model = getModel('openai', 'gpt-4o-mini');

// 使用 TypeBox schema 定义工具，实现类型安全和验证
const tools: Tool[] = [{
  name: 'get_time',
  description: '获取当前时间',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: '可选的时区（例如 America/New_York）' }))
  })
}];

// 构建对话上下文（易于序列化和在模型之间传递）
const context: Context = {
  systemPrompt: '你是一个有帮助的助手。',
  messages: [{ role: 'user', content: '现在几点了？' }],
  tools
};

// 方式一：流式处理，包含所有事件类型
const s = stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'start':
      console.log(`开始，模型为 ${event.partial.model}`);
      break;
    case 'text_start':
      console.log('\n[文本开始]');
      break;
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'text_end':
      console.log('\n[文本结束]');
      break;
    case 'thinking_start':
      console.log('[模型正在思考...]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_end':
      console.log('[思考完成]');
      break;
    case 'toolcall_start':
      console.log(`\n[工具调用开始：索引 ${event.contentIndex}]`);
      break;
    case 'toolcall_delta':
      // 工具参数正在流式传输
      const partialCall = event.partial.content[event.contentIndex];
      if (partialCall.type === 'toolCall') {
        console.log(`[正在为 ${partialCall.name} 流式传输参数]`);
      }
      break;
    case 'toolcall_end':
      console.log(`\n工具已调用：${event.toolCall.name}`);
      console.log(`参数：${JSON.stringify(event.toolCall.arguments)}`);
      break;
    case 'done':
      console.log(`\n完成：${event.reason}`);
      break;
    case 'error':
      console.error(`错误：${event.error}`);
      break;
  }
}

// 流式传输后获取最终消息，并将其添加到上下文
const finalMessage = await s.result();
context.messages.push(finalMessage);

// 如果存在工具调用，则处理
const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
for (const call of toolCalls) {
  // 执行工具
  const result = call.name === 'get_time'
    ? new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      })
    : '未知工具';

  // 将工具结果添加到上下文（支持文本和图像）
  context.messages.push({
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text: result }],
    isError: false,
    timestamp: Date.now()
  });
}

// 如果有工具调用则继续
if (toolCalls.length > 0) {
  const continuation = await complete(model, context);
  context.messages.push(continuation);
  console.log('工具执行后：', continuation.content);
}

console.log(`总令牌数：输入 ${finalMessage.usage.input}，输出 ${finalMessage.usage.output}`);
console.log(`费用：$${finalMessage.usage.cost.total.toFixed(4)}`);

// 方式二：不使用流式传输，直接获取完整响应
const response = await complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`工具：${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

## 工具

工具使 LLM 能够与外部系统交互。此库使用 TypeBox schema 实现类型安全的工具定义，并通过 AJV 进行自动验证。TypeBox schema 可以作为纯 JSON 序列化和反序列化，非常适合分布式系统。

### 定义工具

```typescript
import { Type, Tool, StringEnum } from '@mariozechner/pi-ai';

// 使用 TypeBox 定义工具参数
const weatherTool: Tool = {
  name: 'get_weather',
  description: '获取指定位置的当前天气',
  parameters: Type.Object({
    location: Type.String({ description: '城市名称或坐标' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};

// 注意：为兼容 Google API，请使用 StringEnum 辅助函数而非 Type.Enum
// Type.Enum 生成的 anyOf/const 模式 Google 不支持

const bookMeetingTool: Tool = {
  name: 'book_meeting',
  description: '安排会议',
  parameters: Type.Object({
    title: Type.String({ minLength: 1 }),
    startTime: Type.String({ format: 'date-time' }),
    endTime: Type.String({ format: 'date-time' }),
    attendees: Type.Array(Type.String({ format: 'email' }), { minItems: 1 })
  })
};
```

### 处理工具调用

工具结果使用内容块，可以包含文本和图像：

```typescript
import { readFileSync } from 'fs';

const context: Context = {
  messages: [{ role: 'user', content: '伦敦的天气怎么样？' }],
  tools: [weatherTool]
};

const response = await complete(model, context);

// 检查响应中的工具调用
for (const block of response.content) {
  if (block.type === 'toolCall') {
    // 使用参数执行工具
    // 参见"验证工具参数"章节了解验证方法
    const result = await executeWeatherApi(block.arguments);

    // 将文本内容的工具结果添加到上下文
    context.messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
      timestamp: Date.now()
    });
  }
}

// 工具结果也可以包含图像（适用于支持视觉的模型）
const imageBuffer = readFileSync('chart.png');
context.messages.push({
  role: 'toolResult',
  toolCallId: 'tool_xyz',
  toolName: 'generate_chart',
  content: [
    { type: 'text', text: '已生成显示温度趋势的图表' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

### 流式工具调用与部分 JSON

在流式传输过程中，工具调用参数会逐步解析。这使得在完整参数可用之前就能进行实时 UI 更新：

```typescript
const s = stream(model, context);

for await (const event of s) {
  if (event.type === 'toolcall_delta') {
    const toolCall = event.partial.content[event.contentIndex];

    // 流式传输期间，toolCall.arguments 包含部分解析的 JSON
    // 这允许进行渐进式 UI 更新
    if (toolCall.type === 'toolCall' && toolCall.arguments) {
      // 注意防御性编程：参数可能不完整
      // 示例：即使内容尚未完整，也可以显示正在写入的文件路径
      if (toolCall.name === 'write_file' && toolCall.arguments.path) {
        console.log(`正在写入：${toolCall.arguments.path}`);

        // 内容可能是部分的或缺失的
        if (toolCall.arguments.content) {
          console.log(`内容预览：${toolCall.arguments.content.substring(0, 100)}...`);
        }
      }
    }
  }

  if (event.type === 'toolcall_end') {
    // 此处 toolCall.arguments 是完整的（但尚未验证）
    const toolCall = event.toolCall;
    console.log(`工具完成：${toolCall.name}`, toolCall.arguments);
  }
}
```

**关于部分工具参数的重要说明：**
- 在 `toolcall_delta` 事件期间，`arguments` 包含对部分 JSON 的尽力解析结果
- 字段可能缺失或不完整——使用前务必检查是否存在
- 字符串值可能被截断在单词中间
- 数组可能不完整
- 嵌套对象可能部分填充
- `arguments` 至少会是一个空对象 `{}`，永远不会是 `undefined`
- Google 提供商不支持函数调用流式传输。相反，你将收到一个包含完整参数的 `toolcall_delta` 事件。

### 验证工具参数

使用 `agentLoop` 时，工具参数会在执行前根据你的 TypeBox schema 自动验证。如果验证失败，错误会作为工具结果返回给模型，允许其重试。

当使用 `stream()` 或 `complete()` 实现自己的工具执行循环时，请使用 `validateToolCall` 在将参数传递给工具之前进行验证：

```typescript
import { stream, validateToolCall, Tool } from '@mariozechner/pi-ai';

const tools: Tool[] = [weatherTool, calculatorTool];
const s = stream(model, { messages, tools });

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;

    try {
      // 根据工具的 schema 验证参数（无效参数会抛出异常）
      const validatedArgs = validateToolCall(tools, toolCall);
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ... 将工具结果添加到上下文
    } catch (error) {
      // 验证失败——将错误作为工具结果返回，以便模型重试
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

### 完整事件参考

助手消息生成期间发出的所有流式事件：

| 事件类型 | 描述 | 关键属性 |
|----------|------|----------|
| `start` | 流开始 | `partial`：初始助手消息结构 |
| `text_start` | 文本块开始 | `contentIndex`：内容数组中的位置 |
| `text_delta` | 收到文本块 | `delta`：新文本，`contentIndex`：位置 |
| `text_end` | 文本块完成 | `content`：完整文本，`contentIndex`：位置 |
| `thinking_start` | 思考块开始 | `contentIndex`：内容数组中的位置 |
| `thinking_delta` | 收到思考块 | `delta`：新文本，`contentIndex`：位置 |
| `thinking_end` | 思考块完成 | `content`：完整思考内容，`contentIndex`：位置 |
| `toolcall_start` | 工具调用开始 | `contentIndex`：内容数组中的位置 |
| `toolcall_delta` | 工具参数流式传输 | `delta`：JSON 块，`partial.content[contentIndex].arguments`：部分解析的参数 |
| `toolcall_end` | 工具调用完成 | `toolCall`：完整验证的工具调用，包含 `id`、`name`、`arguments` |
| `done` | 流完成 | `reason`：停止原因（"stop"、"length"、"toolUse"），`message`：最终助手消息 |
| `error` | 发生错误 | `reason`：错误类型（"error" 或 "aborted"），`error`：包含部分内容的助手消息 |

## 图像输入

具有视觉功能的模型可以处理图像。你可以通过 `input` 属性检查模型是否支持图像。如果你将图像传递给不支持视觉的模型，它们会被静默忽略。

```typescript
import { readFileSync } from 'fs';
import { getModel, complete } from '@mariozechner/pi-ai';

const model = getModel('openai', 'gpt-4o-mini');

// 检查模型是否支持图像
if (model.input.includes('image')) {
  console.log('模型支持视觉');
}

const imageBuffer = readFileSync('image.png');
const base64Image = imageBuffer.toString('base64');

const response = await complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '这张图片里有什么？' },
      { type: 'image', data: base64Image, mimeType: 'image/png' }
    ]
  }]
});

// 访问响应
for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

## 思考/推理

许多模型支持思考/推理功能，可以展示其内部思维过程。你可以通过 `reasoning` 属性检查模型是否支持推理。如果你将推理选项传递给不支持推理的模型，它们会被静默忽略。

### 统一接口（streamSimple/completeSimple）

```typescript
import { getModel, streamSimple, completeSimple } from '@mariozechner/pi-ai';

// 多个提供商的许多模型支持思考/推理
const model = getModel('anthropic', 'claude-sonnet-4-20250514');
// 或 getModel('openai', 'gpt-5-mini')
// 或 getModel('google', 'gemini-2.5-flash')
// 或 getModel('xai', 'grok-code-fast-1')
// 或 getModel('groq', 'openai/gpt-oss-20b')
// 或 getModel('cerebras', 'gpt-oss-120b')
// 或 getModel('openrouter', 'z-ai/glm-4.5v')

// 检查模型是否支持推理
if (model.reasoning) {
  console.log('模型支持推理/思考');
}

// 使用简化的推理选项
const response = await completeSimple(model, {
  messages: [{ role: 'user', content: '求解：2x + 5 = 13' }]
}, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'（xhigh 在非 OpenAI 提供商上映射为 high）
});

// 访问思考和文本块
for (const block of response.content) {
  if (block.type === 'thinking') {
    console.log('思考：', block.thinking);
  } else if (block.type === 'text') {
    console.log('响应：', block.text);
  }
}
```

### 提供商特定选项（stream/complete）

如需精细控制，请使用提供商特定选项：

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';

// OpenAI 推理（o1、o3、gpt-5）
const openaiModel = getModel('openai', 'gpt-5-mini');
await complete(openaiModel, context, {
  reasoningEffort: 'medium',
  reasoningSummary: 'detailed'  // 仅限 OpenAI Responses API
});

// Anthropic 思考（Claude Sonnet 4）
const anthropicModel = getModel('anthropic', 'claude-sonnet-4-20250514');
await complete(anthropicModel, context, {
  thinkingEnabled: true,
  thinkingBudgetTokens: 8192  // 可选的令牌上限
});

// Google Gemini 思考
const googleModel = getModel('google', 'gemini-2.5-flash');
await complete(googleModel, context, {
  thinking: {
    enabled: true,
    budgetTokens: 8192  // -1 为动态，0 为禁用
  }
});
```

### 流式思考内容

流式传输时，思考内容通过特定事件传递：

```typescript
const s = streamSimple(model, context, { reasoning: 'high' });

for await (const event of s) {
  switch (event.type) {
    case 'thinking_start':
      console.log('[模型开始思考]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);  // 流式传输思考内容
      break;
    case 'thinking_end':
      console.log('\n[思考完成]');
      break;
  }
}
```

## 停止原因

每个 `AssistantMessage` 都包含一个 `stopReason` 字段，指示生成如何结束：

- `"stop"` - 正常完成，模型已完成响应
- `"length"` - 输出达到了最大令牌限制
- `"toolUse"` - 模型正在调用工具并期望工具结果
- `"error"` - 生成过程中发生错误
- `"aborted"` - 请求通过中止信号被取消

`AssistantMessage` 还可能包含 `responseId`，即当底层 API 暴露该信息时的提供商特定上游响应或消息标识符。不要假设它在所有提供商上都始终存在。

## 错误处理

当请求以错误结束（包括中止和工具调用验证错误）时，流式 API 会发出错误事件：

```typescript
// 在流式传输中
for await (const event of stream) {
  if (event.type === 'error') {
    // event.reason 为 "error" 或 "aborted"
    // event.error 是包含部分内容的助手消息
    console.error(`错误（${event.reason}）：`, event.error.errorMessage);
    console.log('部分内容：', event.error.content);
  }
}

// 最终消息将包含错误详情
const message = await stream.result();
if (message.stopReason === 'error' || message.stopReason === 'aborted') {
  console.error('请求失败：', message.errorMessage);
  // message.content 包含错误前收到的任何部分内容
  // message.usage 包含部分令牌计数和费用
}
```

### 中止请求

中止信号允许你取消正在进行的请求。被中止的请求的 `stopReason` 为 `"aborted"`：

```typescript
import { getModel, stream } from '@mariozechner/pi-ai';

const model = getModel('openai', 'gpt-4o-mini');
const controller = new AbortController();

// 2 秒后中止
setTimeout(() => controller.abort(), 2000);

const s = stream(model, {
  messages: [{ role: 'user', content: '写一个长故事' }]
}, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason 告诉你是 "error" 还是 "aborted"
    console.log(`${event.reason === 'aborted' ? '已中止' : '错误'}：`, event.error.errorMessage);
  }
}

// 获取结果（如果被中止则可能是部分内容）
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('请求已中止：', response.errorMessage);
  console.log('收到的部分内容：', response.content);
  console.log('已使用的令牌：', response.usage);
}
```

### 中止后继续

被中止的消息可以添加到对话上下文中，并在后续请求中继续：

```typescript
const context = {
  messages: [
    { role: 'user', content: '详细解释量子计算' }
  ]
};

// 第一个请求在 2 秒后被中止
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await complete(model, context, { signal: controller1.signal });

// 将部分响应添加到上下文
context.messages.push(partial);
context.messages.push({ role: 'user', content: '请继续' });

// 继续对话
const continuation = await complete(model, context);
```

### 调试提供商载荷

使用 `onPayload` 回调检查发送给提供商的请求载荷。这对于调试请求格式问题或提供商验证错误非常有用。

```typescript
const response = await complete(model, context, {
  onPayload: (payload) => {
    console.log('提供商载荷：', JSON.stringify(payload, null, 2));
  }
});
```

该回调受 `stream`、`complete`、`streamSimple` 和 `completeSimple` 支持。

## API、模型与提供商

该库使用 API 实现的注册表。内置 API 包括：

- **`anthropic-messages`**：Anthropic Messages API（`streamAnthropic`、`AnthropicOptions`）
- **`google-generative-ai`**：Google Generative AI API（`streamGoogle`、`GoogleOptions`）
- **`google-gemini-cli`**：Google Cloud Code Assist API（`streamGoogleGeminiCli`、`GoogleGeminiCliOptions`）
- **`google-vertex`**：Google Vertex AI API（`streamGoogleVertex`、`GoogleVertexOptions`）
- **`mistral-conversations`**：Mistral Conversations API（`streamMistral`、`MistralOptions`）
- **`openai-completions`**：OpenAI Chat Completions API（`streamOpenAICompletions`、`OpenAICompletionsOptions`）
- **`openai-responses`**：OpenAI Responses API（`streamOpenAIResponses`、`OpenAIResponsesOptions`）
- **`openai-codex-responses`**：OpenAI Codex Responses API（`streamOpenAICodexResponses`、`OpenAICodexResponsesOptions`）
- **`azure-openai-responses`**：Azure OpenAI Responses API（`streamAzureOpenAIResponses`、`AzureOpenAIResponsesOptions`）
- **`bedrock-converse-stream`**：Amazon Bedrock Converse API（`streamBedrock`、`BedrockOptions`）

### 用于测试的模拟提供商

`registerFauxProvider()` 注册一个临时的内存中提供商，用于测试和演示。它是可选的，不属于内置提供商集合。

```typescript
import {
  complete,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  registerFauxProvider,
  stream,
} from '@mariozechner/pi-ai';

const registration = registerFauxProvider({
  tokensPerSecond: 50 // 可选
});

const model = registration.getModel();
const context = {
  messages: [{ role: 'user', content: '总结 package.json 然后调用 echo', timestamp: Date.now() }]
};

registration.setResponses([
  fauxAssistantMessage([
    fauxThinking('需要先检查包的元数据。'),
    fauxToolCall('echo', { text: 'package.json' })
  ], { stopReason: 'toolUse' })
]);

const first = await complete(model, context, {
  sessionId: 'session-1',
  cacheRetention: 'short'
});
context.messages.push(first);

context.messages.push({
  role: 'toolResult',
  toolCallId: first.content.find((block) => block.type === 'toolCall')!.id,
  toolName: 'echo',
  content: [{ type: 'text', text: 'package.json 的内容在此' }],
  isError: false,
  timestamp: Date.now()
});

registration.setResponses([
  fauxAssistantMessage([
    fauxThinking('现在可以总结工具输出了。'),
    fauxText('这是总结。')
  ])
]);

const s = stream(model, context);
for await (const event of s) {
  console.log(event.type);
}

// 可选：注册多个模拟模型用于模型切换测试
const multiModel = registerFauxProvider({
  models: [
    { id: 'faux-fast', reasoning: false },
    { id: 'faux-thinker', reasoning: true }
  ]
});
const thinker = multiModel.getModel('faux-thinker');

console.log(thinker?.reasoning);
console.log(registration.getPendingResponseCount());
console.log(registration.state.callCount);
registration.unregister();
multiModel.unregister();
```

说明：
- 响应按请求开始顺序从队列中消费。
- 如果队列为空，模拟提供商返回一个助手错误消息，`errorMessage: "No more faux responses queued"`。
- 使用 `registration.setResponses([...])` 替换剩余队列，使用 `registration.appendResponses([...])` 添加更多响应。
- `registration.models` 暴露所有已注册的模拟模型。`registration.getModel()` 返回第一个，`registration.getModel(id)` 返回指定模型。
- 使用 `fauxAssistantMessage(...)` 创建脚本化的助手回复。使用 `fauxText(...)`、`fauxThinking(...)` 和 `fauxToolCall(...)` 构建内容块，无需手动填写低级字段。
- `registration.unregister()` 从全局 API 注册表中移除临时提供商。
- 使用量按大约每 4 个字符 1 个令牌估算。当存在 `sessionId` 且 `cacheRetention` 不为 `"none"` 时，会自动模拟提示缓存读写。
- 工具调用参数通过 `toolcall_delta` 块增量流式传输。
- 默认情况下，每个流式块在其自身的微任务上发出。设置 `tokensPerSecond` 可以按实际时间节奏传递块。
- 预期用途是每个注册一个确定性的脚本化流程。如果需要独立的并发流程，请注册单独的模拟提供商。

### 提供商与模型

**提供商**通过特定 API 提供模型。例如：
- **Anthropic** 模型使用 `anthropic-messages` API
- **Google** 模型使用 `google-generative-ai` API
- **OpenAI** 模型使用 `openai-responses` API
- **Mistral** 模型使用 `mistral-conversations` API
- **xAI、Cerebras、Groq 等**模型使用 `openai-completions` API（OpenAI 兼容）

### 查询提供商与模型

```typescript
import { getProviders, getModels, getModel } from '@mariozechner/pi-ai';

// 获取所有可用提供商
const providers = getProviders();
console.log(providers); // ['openai', 'anthropic', 'google', 'xai', 'groq', ...]

// 获取某个提供商的所有模型（完全类型化）
const anthropicModels = getModels('anthropic');
for (const model of anthropicModels) {
  console.log(`${model.id}: ${model.name}`);
  console.log(`  API: ${model.api}`); // 'anthropic-messages'
  console.log(`  上下文窗口：${model.contextWindow} 个令牌`);
  console.log(`  视觉：${model.input.includes('image')}`);
  console.log(`  推理：${model.reasoning}`);
}

// 获取特定模型（提供商和模型 ID 在 IDE 中都支持自动补全）
const model = getModel('openai', 'gpt-4o-mini');
console.log(`通过 ${model.api} API 使用 ${model.name}`);
```

### 自定义模型

你可以为本地推理服务器或自定义端点创建自定义模型：

```typescript
import { Model, stream } from '@mariozechner/pi-ai';

// 示例：使用 OpenAI 兼容 API 的 Ollama
const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};

// 示例：带有显式兼容性设置的 LiteLLM 代理
const litellmModel: Model<'openai-completions'> = {
  id: 'gpt-4o',
  name: 'GPT-4o（通过 LiteLLM）',
  api: 'openai-completions',
  provider: 'litellm',
  baseUrl: 'http://localhost:4000/v1',
  reasoning: false,
  input: ['text', 'image'],
  cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 16384,
  compat: {
    supportsStore: false,  // LiteLLM 不支持 store 字段
  }
};

// 示例：带有请求头的自定义端点（绕过 Cloudflare 机器人检测）
const proxyModel: Model<'anthropic-messages'> = {
  id: 'claude-sonnet-4',
  name: 'Claude Sonnet 4（代理）',
  api: 'anthropic-messages',
  provider: 'custom-proxy',
  baseUrl: 'https://proxy.example.com/v1',
  reasoning: true,
  input: ['text', 'image'],
  cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  contextWindow: 200000,
  maxTokens: 8192,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'X-Custom-Auth': 'bearer-token-here'
  }
};

// 使用自定义模型
const response = await stream(ollamaModel, context, {
  apiKey: 'dummy' // Ollama 不需要真实的密钥
});
```

某些 OpenAI 兼容服务器不理解用于推理模型的 `developer` 角色。对于这些提供商，将 `compat.supportsDeveloperRole` 设置为 `false`，这样系统提示就会以 `system` 消息发送。如果服务器也不支持 `reasoning_effort`，还需将 `compat.supportsReasoningEffort` 设置为 `false`。

这通常适用于 Ollama、vLLM、SGLang 及类似的 OpenAI 兼容服务器。你可以在提供商级别或每个模型上设置 `compat`。

```typescript
const ollamaReasoningModel: Model<'openai-completions'> = {
  id: 'gpt-oss:20b',
  name: 'GPT-OSS 20B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 32000,
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }
};
```

### OpenAI 兼容性设置

`openai-completions` API 被许多提供商实现，但存在细微差异。默认情况下，库会根据 `baseUrl` 自动检测一小部分已知 OpenAI 兼容提供商（Cerebras、xAI、Chutes、DeepSeek、zAi、OpenCode 等）的兼容性设置。对于自定义代理或未知端点，你可以通过 `compat` 字段覆盖这些设置。对于 `openai-responses` 模型，compat 字段仅支持 Responses 特定的标志。

```typescript
interface OpenAICompletionsCompat {
  supportsStore?: boolean;           // 提供商是否支持 `store` 字段（默认：true）
  supportsDeveloperRole?: boolean;   // 提供商是否支持 `developer` 角色与 `system`（默认：true）
  supportsReasoningEffort?: boolean; // 提供商是否支持 `reasoning_effort`（默认：true）
  supportsUsageInStreaming?: boolean; // 提供商是否支持 `stream_options: { include_usage: true }`（默认：true）
  supportsStrictMode?: boolean;      // 提供商是否在工具定义中支持 `strict`（默认：true）
  maxTokensField?: 'max_completion_tokens' | 'max_tokens';  // 使用哪个字段名（默认：max_completion_tokens）
  requiresToolResultName?: boolean;  // 工具结果是否需要 `name` 字段（默认：false）
  requiresAssistantAfterToolResult?: boolean; // 工具结果后是否必须跟助手消息（默认：false）
  requiresThinkingAsText?: boolean;  // 思考块是否需要转换为文本（默认：false）
  thinkingFormat?: 'openai' | 'zai' | 'qwen'; // 推理参数格式：'openai' 使用 reasoning_effort，'zai' 使用 thinking: { type: "enabled" }，'qwen' 使用 enable_thinking: boolean（默认：openai）
  openRouterRouting?: OpenRouterRouting; // OpenRouter 路由偏好（默认：{}）
  vercelGatewayRouting?: VercelGatewayRouting; // Vercel AI Gateway 路由偏好（默认：{}）
}

interface OpenAIResponsesCompat {
  // 保留供将来使用
}
```

如果未设置 `compat`，库会回退到基于 URL 的检测。如果 `compat` 被部分设置，未指定的字段使用检测到的默认值。这对于以下场景很有用：

- **LiteLLM 代理**：可能不支持 `store` 字段
- **自定义推理服务器**：可能使用非标准字段名
- **自托管端点**：可能有不同的功能支持

### 类型安全

模型按其 API 进行类型化，这保证了模型元数据的准确性。当你直接调用提供商函数时，提供商特定的选项类型会被强制执行。通用的 `stream` 和 `complete` 函数接受带有额外提供商字段的 `StreamOptions`。

```typescript
import { streamAnthropic, type AnthropicOptions } from '@mariozechner/pi-ai';

// TypeScript 知道这是一个 Anthropic 模型
const claude = getModel('anthropic', 'claude-sonnet-4-20250514');

const options: AnthropicOptions = {
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048
};

await streamAnthropic(claude, context, options);
```

## 跨提供商切换

该库支持在同一对话中不同 LLM 提供商之间的无缝切换。这允许你在对话中途切换模型，同时保留上下文，包括思考块、工具调用和工具结果。

### 工作原理

当来自一个提供商的消息发送到不同的提供商时，库会自动转换它们以确保兼容性：

- **用户和工具结果消息**保持不变
- **来自相同提供商/API 的助手消息**按原样保留
- **来自不同提供商的助手消息**的思考块被转换为带有 `<thinking>` 标签的文本
- **工具调用和普通文本**保持不变

### 示例：多提供商对话

```typescript
import { getModel, complete, Context } from '@mariozechner/pi-ai';

// 从 Claude 开始
const claude = getModel('anthropic', 'claude-sonnet-4-20250514');
const context: Context = {
  messages: []
};

context.messages.push({ role: 'user', content: '25 * 18 等于多少？' });
const claudeResponse = await complete(claude, context, {
  thinkingEnabled: true
});
context.messages.push(claudeResponse);

// 切换到 GPT-5——它会将 Claude 的思考看作带 <thinking> 标签的文本
const gpt5 = getModel('openai', 'gpt-5-mini');
context.messages.push({ role: 'user', content: '这个计算正确吗？' });
const gptResponse = await complete(gpt5, context);
context.messages.push(gptResponse);

// 切换到 Gemini
const gemini = getModel('google', 'gemini-2.5-flash');
context.messages.push({ role: 'user', content: '最初的问题是什么？' });
const geminiResponse = await complete(gemini, context);
```

### 提供商兼容性

所有提供商都可以处理来自其他提供商的消息，包括：
- 文本内容
- 工具调用和工具结果（包括工具结果中的图像）
- 思考/推理块（为跨提供商兼容性转换为带标签的文本）
- 带有部分内容的被中止消息

这使得灵活的工作流成为可能，你可以：
- 从快速模型开始获取初始响应
- 切换到更强大的模型进行复杂推理
- 为特定任务使用专门的模型
- 在提供商中断期间保持对话连续性

## 上下文序列化

`Context` 对象可以使用标准 JSON 方法轻松序列化和反序列化，使得持久化对话、实现聊天历史或在服务之间传递上下文变得简单：

```typescript
import { Context, getModel, complete } from '@mariozechner/pi-ai';

// 创建并使用上下文
const context: Context = {
  systemPrompt: '你是一个有帮助的助手。',
  messages: [
    { role: 'user', content: '什么是 TypeScript？' }
  ]
};

const model = getModel('openai', 'gpt-4o-mini');
const response = await complete(model, context);
context.messages.push(response);

// 序列化整个上下文
const serialized = JSON.stringify(context);
console.log('序列化后的上下文大小：', serialized.length, '字节');

// 保存到数据库、localStorage、文件等
localStorage.setItem('conversation', serialized);

// 稍后：反序列化并继续对话
const restored: Context = JSON.parse(localStorage.getItem('conversation')!);
restored.messages.push({ role: 'user', content: '告诉我更多关于它的类型系统' });

// 使用任何模型继续
const newModel = getModel('anthropic', 'claude-3-5-haiku-20241022');
const continuation = await complete(newModel, restored);
```

> **注意**：如果上下文包含图像（如图像输入章节所示编码为 base64），它们也会被序列化。

## 浏览器使用

该库支持浏览器环境。你必须显式传递 API 密钥，因为浏览器中不可用环境变量：

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';

// 浏览器中必须显式传递 API 密钥
const model = getModel('anthropic', 'claude-3-5-haiku-20241022');

const response = await complete(model, {
  messages: [{ role: 'user', content: '你好！' }]
}, {
  apiKey: 'your-api-key'
});
```

> **安全警告**：在前端代码中暴露 API 密钥是危险的。任何人都可以提取和滥用你的密钥。仅在内部工具或演示中使用此方法。对于生产应用，请使用后端代理来保护你的 API 密钥安全。

### 浏览器兼容性说明

- Amazon Bedrock（`bedrock-converse-stream`）不支持浏览器环境。
- OAuth 登录流程不支持浏览器环境。在 Node.js 中使用 `@mariozechner/pi-ai/oauth` 入口点。
- 在浏览器构建中，Bedrock 仍可能出现在模型列表中。调用 Bedrock 模型会在运行时失败。
- 如果你需要 Bedrock 或基于 OAuth 的认证，请使用服务端代理或后端服务。

### 环境变量（仅限 Node.js）

在 Node.js 环境中，你可以设置环境变量来避免传递 API 密钥：

| 提供商 | 环境变量 |
|--------|----------|
| OpenAI | `OPENAI_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`（可选 `AZURE_OPENAI_API_VERSION`、`AZURE_OPENAI_DEPLOYMENT_NAME_MAP`，格式如 `model=deployment,model2=deployment2`） |
| Anthropic | `ANTHROPIC_API_KEY` 或 `ANTHROPIC_OAUTH_TOKEN` |
| Google | `GEMINI_API_KEY` |
| Vertex AI | `GOOGLE_CLOUD_API_KEY` 或 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）+ `GOOGLE_CLOUD_LOCATION` + ADC |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| zAI | `ZAI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| OpenCode Zen / OpenCode Go | `OPENCODE_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` 或 `GH_TOKEN` 或 `GITHUB_TOKEN` |

设置后，库会自动使用这些密钥：

```typescript// 使用环境中的 OPENAI_API_KEY
const model = getModel('openai', 'gpt-4o-mini');
const response = await complete(model, context);

// 或使用显式密钥覆盖
const response = await complete(model, context, {
  apiKey: 'sk-different-key'
});
```

#### Antigravity 版本覆盖

设置 `PI_AI_ANTIGRAVITY_VERSION` 以在 Google 更新要求时覆盖 Antigravity User-Agent 版本：

```bash
export PI_AI_ANTIGRAVITY_VERSION="1.23.0"
```

#### 缓存保留

设置 `PI_CACHE_RETENTION=long` 以延长提示缓存保留时间：

| 提供商 | 默认 | 使用 `PI_CACHE_RETENTION=long` |
|--------|------|-------------------------------|
| Anthropic | 5 分钟 | 1 小时 |
| OpenAI | 内存中 | 24 小时 |

这仅影响直接调用 `api.anthropic.com` 和 `api.openai.com`。代理和其他提供商不受影响。

> **注意**：延长缓存保留可能会增加 Anthropic 的费用（缓存写入以更高的费率计费）。OpenAI 的 24 小时保留没有额外费用。

### 检查环境变量

```typescript
import { getEnvApiKey } from '@mariozechner/pi-ai';

// 检查是否在环境变量中设置了 API 密钥
const key = getEnvApiKey('openai');  // 检查 OPENAI_API_KEY
```

## OAuth 提供商

某些提供商需要 OAuth 认证而非静态 API 密钥：

- **Anthropic**（Claude Pro/Max 订阅）
- **OpenAI Codex**（ChatGPT Plus/Pro 订阅，访问 GPT-5.x Codex 模型）
- **GitHub Copilot**（Copilot 订阅）
- **Google Gemini CLI**（通过 Google Cloud Code Assist 使用 Gemini 2.0/2.5；免费或付费订阅）
- **Antigravity**（通过 Google Cloud 免费使用 Gemini 3、Claude、GPT-OSS）

对于付费的 Cloud Code Assist 订阅，设置 `GOOGLE_CLOUD_PROJECT` 或 `GOOGLE_CLOUD_PROJECT_ID` 为你的项目 ID。

### Vertex AI

Vertex AI 模型支持 Google Cloud API 密钥或应用默认凭据（ADC）：

- **API 密钥**：设置 `GOOGLE_CLOUD_API_KEY` 或在调用选项中传递 `apiKey`。
- **本地开发（ADC）**：运行 `gcloud auth application-default login`
- **CI/生产（ADC）**：设置 `GOOGLE_APPLICATION_CREDENTIALS` 指向服务账户 JSON 密钥文件

使用 ADC 时，还需设置 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）和 `GOOGLE_CLOUD_LOCATION`。你也可以在调用选项中传递 `project`/`location`。使用 `GOOGLE_CLOUD_API_KEY` 时，不需要 `project` 和 `location`。

示例：

```bash
# 本地（使用你的用户凭据）
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project"
export GOOGLE_CLOUD_LOCATION="us-central1"

# CI/生产（服务账户密钥文件）
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';

(async () => {
  const model = getModel('google-vertex', 'gemini-2.5-flash');
  const response = await complete(model, {
    messages: [{ role: 'user', content: '来自 Vertex AI 的问候' }]
  }, {
    apiKey: process.env.GOOGLE_CLOUD_API_KEY,
  });

  for (const block of response.content) {
    if (block.type === 'text') console.log(block.text);
  }
})().catch(console.error);
```

官方文档：[应用默认凭据](https://cloud.google.com/docs/authentication/application-default-credentials)

### CLI 登录

最快的认证方式：

```bash
npx @mariozechner/pi-ai login              # 交互式提供商选择
npx @mariozechner/pi-ai login anthropic    # 登录特定提供商
npx @mariozechner/pi-ai list               # 列出可用提供商
```

凭据保存在当前目录的 `auth.json` 中。

### 编程式 OAuth

该库通过 `@mariozechner/pi-ai/oauth` 入口点提供登录和令牌刷新函数。凭据存储由调用者负责。

```typescript
import {
  // 登录函数（返回凭据，不存储）
  loginAnthropic,
  loginOpenAICodex,
  loginGitHubCopilot,
  loginGeminiCli,
  loginAntigravity,

  // 令牌管理
  refreshOAuthToken,   // (provider, credentials) => new credentials
  getOAuthApiKey,      // (provider, credentialsMap) => { newCredentials, apiKey } | null

  // 类型
  type OAuthProvider,  // 'anthropic' | 'openai-codex' | 'github-copilot' | 'google-gemini-cli' | 'google-antigravity'
  type OAuthCredentials,
} from '@mariozechner/pi-ai/oauth';
```

### 登录流程示例

```typescript
import { loginGitHubCopilot } from '@mariozechner/pi-ai/oauth';
import { writeFileSync } from 'fs';

const credentials = await loginGitHubCopilot({
  onAuth: (url, instructions) => {
    console.log(`打开：${url}`);
    if (instructions) console.log(instructions);
  },
  onPrompt: async (prompt) => {
    return await getUserInput(prompt.message);
  },
  onProgress: (message) => console.log(message)
});

// 自行存储凭据
const auth = { 'github-copilot': { type: 'oauth', ...credentials } };
writeFileSync('auth.json', JSON.stringify(auth, null, 2));
```

### 使用 OAuth 令牌

使用 `getOAuthApiKey()` 获取 API 密钥，过期时自动刷新：

```typescript
import { getModel, complete } from '@mariozechner/pi-ai';
import { getOAuthApiKey } from '@mariozechner/pi-ai/oauth';
import { readFileSync, writeFileSync } from 'fs';

// 加载你存储的凭据
const auth = JSON.parse(readFileSync('auth.json', 'utf-8'));

// 获取 API 密钥（过期时刷新）
const result = await getOAuthApiKey('github-copilot', auth);
if (!result) throw new Error('未登录');

// 保存刷新后的凭据
auth['github-copilot'] = { type: 'oauth', ...result.newCredentials };
writeFileSync('auth.json', JSON.stringify(auth, null, 2));

// 使用 API 密钥
const model = getModel('github-copilot', 'gpt-4o');
const response = await complete(model, {
  messages: [{ role: 'user', content: '你好！' }]
}, { apiKey: result.apiKey });
```

### 提供商说明

**OpenAI Codex**：需要 ChatGPT Plus 或 Pro 订阅。提供对具有扩展上下文窗口和推理能力的 GPT-5.x Codex 模型的访问。当在流选项中提供 `sessionId` 时，库会自动处理基于会话的提示缓存。你可以在流选项中设置 `transport` 为 `"sse"`、`"websocket"` 或 `"auto"` 以选择 Codex Responses 传输方式。当使用 WebSocket 且存在 `sessionId` 时，每个会话会重用连接，并在 5 分钟不活动后过期。

**Azure OpenAI（Responses）**：仅使用 Responses API。设置 `AZURE_OPENAI_API_KEY` 和 `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`。使用 `AZURE_OPENAI_API_VERSION`（默认为 `v1`）在需要时覆盖 API 版本。部署名称默认被视为模型 ID，可通过 `azureDeploymentName` 或 `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` 使用逗号分隔的 `model-id=deployment` 对来覆盖（例如 `gpt-4o-mini=my-deployment,gpt-4o=prod`）。不支持基于旧版部署的 URL。

**GitHub Copilot**：如果遇到"The requested model is not supported"错误，请在 VS Code 中手动启用该模型：打开 Copilot Chat，点击模型选择器，选择模型（警告图标），然后点击"Enable"。

**Google Gemini CLI / Antigravity**：这些使用 Google Cloud OAuth。`getOAuthApiKey()` 返回的 `apiKey` 是一个包含令牌和项目 ID 的 JSON 字符串，库会自动处理。

## 开发

### 添加新提供商

添加新的 LLM 提供商需要修改多个文件。此检查清单涵盖了所有必要步骤：

#### 1. 核心类型（`src/types.ts`）

- 将 API 标识符添加到 `KnownApi`（例如 `"bedrock-converse-stream"`）
- 创建扩展 `StreamOptions` 的选项接口（例如 `BedrockOptions`）
- 将提供商名称添加到 `KnownProvider`（例如 `"amazon-bedrock"`）

#### 2. 提供商实现（`src/providers/`）

创建新的提供商文件（例如 `amazon-bedrock.ts`），导出：

- `stream<Provider>()` 函数，返回 `AssistantMessageEventStream`
- `streamSimple<Provider>()` 用于 `SimpleStreamOptions` 映射
- 提供商特定的选项接口
- 消息转换函数，将 `Context` 转换为提供商格式
- 工具转换（如果提供商支持工具）
- 响应解析以发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）

#### 3. API 注册表集成（`src/providers/register-builtins.ts`）

- 使用 `registerApiProvider()` 注册 API
- 在 `package.json` 中为提供商模块添加包子路径导出（`./dist/providers/<provider>.js`）
- 在 `src/providers/register-builtins.ts` 中添加惰性加载器包装器，不要在那里静态导入提供商实现模块
- 在 `src/index.ts` 中添加需要从 `@mariozechner/pi-ai` 保持可用的根级别 `export type` 重新导出
- 在 `env-api-keys.ts` 中为新提供商添加凭据检测
- 确保 `streamSimple` 通过 `getEnvApiKey()` 或提供商特定认证处理认证查找

#### 4. 模型生成（`scripts/generate-models.ts`）

- 添加从提供商来源（如 models.dev API）获取和解析模型的逻辑
- 将提供商模型数据映射到标准化的 `Model` 接口
- 处理提供商特定的特殊性（定价格式、功能标志、模型 ID 转换）

#### 5. 测试（`test/`）

创建或更新测试文件以覆盖新提供商：

- `stream.test.ts` - 基本流式传输和工具使用
- `tokens.test.ts` - 令牌使用报告
- `abort.test.ts` - 请求取消
- `empty.test.ts` - 空消息处理
- `context-overflow.test.ts` - 上下文限制错误
- `image-limits.test.ts` - 图像支持（如适用）
- `unicode-surrogate.test.ts` - Unicode 处理
- `tool-call-without-result.test.ts` - 孤立的工具调用
- `image-tool-result.test.ts` - 工具结果中的图像
- `total-tokens.test.ts` - 令牌计数准确性
- `cross-provider-handoff.test.ts` - 跨提供商上下文重放

对于 `cross-provider-handoff.test.ts`，至少添加一个提供商/模型对。如果提供商暴露多个模型系列（例如 GPT 和 Claude），每个系列至少添加一个对。

对于具有非标准认证的提供商（AWS、Google Vertex），创建类似 `bedrock-utils.ts` 的实用程序，包含凭据检测辅助函数。

#### 6. 编码代理集成（`../coding-agent/`）

更新 `src/core/model-resolver.ts`：

- 在 `DEFAULT_MODELS` 中为提供商添加默认模型 ID

更新 `src/cli/args.ts`：

- 在帮助文本中添加环境变量文档

更新 `README.md`：

- 在提供商部分添加提供商及设置说明

#### 7. 文档

更新 `packages/ai/README.md`：

- 添加到支持的提供商表中
- 记录任何提供商特定的选项或认证要求
- 在环境变量部分添加环境变量

#### 8. 变更日志

在 `packages/ai/CHANGELOG.md` 的 `## [Unreleased]` 下添加条目：

```markdown
### 新增
- 添加了对 [提供商名称] 提供商的支持（[#PR](link)，由 [@author](link) 提交）
```

## 许可证

MIT
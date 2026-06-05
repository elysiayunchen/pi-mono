# Sub-agent Code Delegation — 技术设计文档

## 1. 策略概述

### 核心理念

**Code Mode 已废弃。** 代码能力不是"模式"，是 agent 的内置手段。

关键问题不是"如何让 agent 写代码"，而是 **"如何防止 agent 在处理代码任务时把整个文件系统倒进上下文"**。解法是 **子代理分发 + 上下文管理**，不是模式切换。

### 问题根因

```
当前行为：
  用户: "梳理 RateLimitScheduler 的调用链"
  │
  ▼ 主 agent 开始自己调查（先入为主）
  ├── read rate-limit-scheduler.ts     ← 800 token
  ├── read agent-loop.ts               ← 500 token  
  ├── read model-router.ts             ← 400 token
  ├── read sdk.ts                      ← 600 token
  ├── grep -r "acquire"               ← 200 token
  └── 总结                              ← 但上下文已膨胀 2500 token
      └── 后续对话质量下降 ← 根因
```

### 目标行为

```
用户: "梳理 RateLimitScheduler 的调用链"
│
▼ 主 agent 判断: 多文件分析任务 → delegate_code_task
  │
  ▼ 子代理 (fresh context, 独立执行)
  │ ├── grep → read → grep → read → 分析
  │ └── 返回结构化摘要 (~400 token)
  │
  ▼ 主 session 只收到摘要
  └── "调用链: acquire() 在 agent-loop.ts:178 被调用,
       release() 在 model-router.ts:45,
       配置在 sdk.ts:112 初始化。中间经过..."
       
  主 session 增加: ~400 token (vs 直接执行的 2500+)
```

---

## 2. 权限架构

### 设计原则

**子代理是侦察兵，不是执行者。** 子代理负责收集信息、分析模式、返回发现。主 agent 负责决策，向用户确认或自行纠正后执行。

### 工具权限分级

```
┌─────────────────────────────────────────────────────┐
│                    子代理工具集                      │
│                                                     │
│  ✅ 信息采集（完整权限）                              │
│     read, grep, find, ls                            │
│                                                     │
│  ✅ 只读 bash（受限）                                │
│     git log, git diff, git status, git show         │
│     cat, head, tail, wc, file, stat                 │
│     grep -r (通过 bash 的时候)                       │
│                                                     │
│  ❌ 禁止（任何写操作）                                │
│     write, edit                                     │
│     rm, mv, cp, mkdir, touch, chmod                 │
│     git commit, git push, git checkout, git stash   │
│     npm install, pnpm install, pip install          │
│     任何包管理器命令                                  │
│                                                     │
│  ❌ 禁止（元操作）                                   │
│     delegate_code_task（禁止递归分发）                │
│     task_assign, team_create, send_message          │
│     enter_worktree, exit_worktree                   │
│                                                     │
│  ❌ 禁止（敏感操作）                                  │
│     任何涉及 .env, credentials, API keys 的读取      │
│     任何涉及 config.yaml, elysiaclaw.json 的写入     │
└─────────────────────────────────────────────────────┘
```

### 权限执行机制

子代理的 bash 工具通过 PreToolUse Hook (P3-A) 进行二次校验：

```
Sub-agent bash 调用
  │
  ▼ PreToolUse Hook
  ├── 检查: sessionId 是否标记为 sub-agent?
  │     └── 是 → 进入严格模式
  ├── 解析 command
  │     ├── 白名单命令 (git log/diff/status/show, cat, head, tail, wc, file, stat, ls, grep, find, rg)
  │     │     └── ✅ APPROVE
  │     ├── 写操作命令 (rm, mv, cp, write, echo >, tee, sed -i, git commit/push/checkout)
  │     │     └── ❌ DENY: "Sub-agent 不允许写操作，将分析结果返回主 agent 决策"
  │     └── 未识别命令
  │           └── ❌ DENY: "未识别的命令，子代理仅限只读操作"
  └── 超时: 30 秒 (比主 session 的 10 秒更短)
```

### 结果流向

```
子代理 → 返回结构化分析结果 → 主 agent 审查
  │
  ▼ 主 agent 拿到结果后
  ├── 简单修改: 主 agent 自己执行 write/edit，完成后通知用户
  ├── 复杂修改: 主 agent 向用户展示方案，等待确认后执行
  ├── 分析不足: 主 agent 可要求子代理补充调查（再发一次 delegate_code_task，更精确的 scope）
  └── 结果有误: 主 agent 自行纠正（它有完整工具权限）
```

---

## 3. 自主路由机制

### 核心挑战

主 agent 天然倾向于"自己先看看"。系统提示必须足够强势，让 agent 在接触工具之前就做出分发决策。

### 三层路由架构

```
用户消息进入
  │
  ▼ Layer 0: 消息分类器 (attempt.ts 注入，非 LLM)
  ├── 正则匹配关键词 → 初步分类
  ├── 生成路由提示 ("⚠️ 建议使用 delegate_code_task")
  └── 注入到 system prompt 尾部
  │
  ▼ Layer 1: Agent 决策 (受 system prompt 强引导)
  ├── 读取路由提示
  ├── 评估任务复杂度
  └── 决定: 直接执行 OR delegate_code_task
  │
  ▼ Layer 2: 后置检查 (如果 agent 选择了直接执行)
  └── 如果直接执行中已调用 3+ 次 read/grep 且未完成
      → injectNotification: "当前任务已消耗大量上下文，是否考虑分发给子代理？"
```

### Layer 0: 消息分类器

在 `attempt.ts` 中，消息到达 LLM 之前运行分类：

```typescript
type TaskClassification = {
  category: "direct" | "delegate" | "ambiguous";
  signals: string[];       // 匹配到的信号词
  confidence: number;      // 0-1
  hint: string;            // 注入到 system prompt 的提示
};

function classifyCodeTask(message: string): TaskClassification {
  // 强信号: 必须分发
  const strongDelegate = [
    /搜索.*所有|查找.*所有|找出.*所有/i,
    /梳理|理清|分析.*(调用链|依赖|架构|流程|模块)/i,
    /重构|优化.*代码|改进.*实现/i,
    /对比.*实现|比较.*代码/i,
    /整个.*系统|整体.*结构|全局.*搜索/i,
    /影响.*范围|修改.*会影响/i,
  ];

  // 弱信号: 建议分发
  const weakDelegate = [
    /代码|源码|实现|函数|类|模块|组件/i,
    /bug|错误|异常|报错|崩溃/i,
    /为什么.*这样|怎么.*实现的/i,
  ];

  // 排除信号: 直接执行
  const directSignals = [
    /读一下|打开|帮我看看.*第.*行/i,
    /改成|替换|删除.*第.*行/i,
    /就是.*那个.*文件/i,  // 明确指定了单个文件
  ];

  // ...匹配逻辑
}
```

分类结果注入到该轮 system prompt：

```
[如果 category === "delegate"]
## ⚠️ 任务路由提示

这是一个多文件代码分析任务。请使用 delegate_code_task 工具分发给子代理执行。

检测到的信号: [signals.join(", ")]

不要自行开始逐文件调查。直接使用 delegate_code_task，让子代理返回结构化分析结果。
```

### Layer 1: Agent 决策流程

System prompt 中嵌入决策框架：

```
## 任务分发决策流程（每次收到用户请求时，先执行此流程，再采取行动）

### 第一步: 评估任务类型

| 类型 | 标准 | 行动 |
|------|------|------|
| 简单直接 | 读单个指定文件、单文件小修改、快速 grep | 直接执行 |
| 复杂代码 | 涉及 3+ 文件、需要理解系统/模块/架构 | delegate_code_task |
| 边界模糊 | 2 个文件、不确定范围 | 先 delegate_code_task，让子代理评估 |

### 第二步: 关键规则

1. **不要先自己调查再决定是否分发** — 如果你已经在主 session 中读了 2 个以上的文件，说明你本应分发
2. **宁可多分发，不可少分发** — 子代理返回很快，分发的代价远低于上下文污染的代价
3. **分发不是甩锅** — 子代理返回结果后，你仍然需要审查、整合、向用户解释
4. **分发后不要再重复子代理的工作** — 直接使用子代理的返回结果

### 第三步: scope 精确化

分发时，尽可能精确地指定 scope:
- 明确的目录范围: `packages/coding-agent/src/core/`
- 明确的文件列表: `["agent-loop.ts", "sdk.ts"]`
- 明确的搜索目标: "RateLimitScheduler 的所有调用点和配置入口"
- 期望的输出格式: "调用链图 + 每个调用点的上下文"
```

### Layer 2: 后置提醒

在 `agent-loop.ts` 的工具执行阶段，追踪主 session 的文件读取次数：

```typescript
// 在 AgentLoop 状态中追踪
let directReadCount = 0;
let lastDelegateReminderAt = 0;

// afterToolCall hook
if (toolName in ["read", "grep", "find"] && !isSubAgentSession) {
  directReadCount++;
  if (directReadCount >= 3 && lastDelegateReminderAt < directReadCount) {
    // 通过 injectNotification 提醒
    injectNotification(
      "你已在主 session 中直接执行了 " + directReadCount + " 次代码查询。" +
      "考虑使用 delegate_code_task 分发剩余任务以保护上下文。"
    );
    lastDelegateReminderAt = directReadCount;
  }
}

// 轮次结束后重置
onTurnEnd(() => { directReadCount = 0; });
```

---

## 4. 上下文管理策略

> 用户原话："上下文管理是 agent 是否高效执行任务的关键"

这是整个设计中最核心的部分。

### 4.1 主 Agent 上下文保护

```
主 session 的上下文预算:
┌─────────────────────────────────────────┐
│  system prompt          ~8k token       │  固定开销
│  user memory            ~2k token       │  固定开销
│  对话历史               ~20k token      │  正常增长
│  子代理返回结果          ~0.5k token/次  │  替代了 5-15k 的原始工具输出
│  当前轮工具输出          ~2-5k token     │  仅简单任务
├─────────────────────────────────────────┤
│  总计                   ~35k token      │  余量 65k (context 100k)
│  压缩阈值               80k             │  正常情况下不会触发
└─────────────────────────────────────────┘

对比不使用子代理:
┌─────────────────────────────────────────┐
│  system prompt + memory  ~10k token     │
│  对话历史                ~20k token     │
│  当前轮工具输出           ~15-30k token  │  读 5-10 个文件
├─────────────────────────────────────────┤
│  总计                    ~50-60k token  │  余量 40k，很快触发压缩
│  压缩后信息损失           不可避免       │
└─────────────────────────────────────────┘
```

### 4.2 子代理上下文管理

子代理的上下文管理比主 agent 更严格，因为它的任务目标单一，不需要保留大量历史。

#### 4.2.1 Token 预算

```typescript
const SUB_AGENT_CONFIG = {
  // 上下文窗口
  maxTokens: 50_000,                    // 主 agent 是 100k
  contextPressureThreshold: 30_000,     // 主 agent 是 80k
  
  // 压缩策略
  autoCompactThreshold: 35_000,         // 主 agent 是 90k
  autoCompactKeepRecent: 10_000,        // 主 agent 是 20k
  autoCompactReserve: 8_192,            // 主 agent 是 16k
  
  // 执行限制
  maxToolCalls: 20,                     // 硬限制，超过强制 wrap up
  maxTurns: 10,                         // 最大轮次
  timeoutMs: 120_000,                   // 2 分钟超时
  
  // 结果限制
  maxFilesRead: 15,                     // 最多读 15 个文件
  maxOutputTokens: 2_000,               // 返回结果最长 2k token
};
```

#### 4.2.2 子代理 System Prompt（高效执行指令）

```
你是一个代码分析子代理。你的唯一任务是：执行给定的代码分析任务，返回结构化结果。

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
- 你只有 50k token 的上下文空间
- 每次读文件都是成本，问自己："这行对回答任务有帮助吗？"
- 如果上下文压力高，开始整合已有发现，不要继续读新文件
- 宁可返回部分结果 + "由于上下文限制，以下区域未深入调查"

### 输出格式（严格遵守）

分析完成后，你的最后一条消息必须是以下格式：

---RESULT_START---
summary: [2-5 句话概括核心发现]
findings:
- [发现1: 具体描述 + file:line 引用]
- [发现2: ...]
files_analyzed: [file1, file2, ...]
recommendations: [如果有的话，主 agent 可执行的建议动作]
confidence: [high/medium/low]
partial: [true/false — 是否因限制而不完整]
---RESULT_END---

不要在结果中包含原始工具输出。只包含分析结论。

### 禁止事项
- 不要写入或修改任何文件
- 不要尝试递归分发任务
- 不要闲聊，直接执行任务
- 不要重复已经读过的内容
```

#### 4.2.3 上下文压缩策略对比

```
主 Agent:                          子代理:
                                   
  压缩阈值: 80k                    压缩阈值: 30k
  保留近期: 20k                    保留近期: 10k
  摘要预留: 16k                    摘要预留: 8k
                                   
  触发频率: 低                     触发频率: 中
  (因为子代理已吸收了大量           (任务复杂时仍然需要
   代码读取的开销)                   压缩，但窗口小，压缩快)
                                   
  压缩后: 对话历史被摘要            压缩后: 早期搜索结果被摘要，
          关键发现保留                       最新分析保留
```

### 4.3 结果传递——零污染原则

子代理返回给主 agent 的 **不是** 原始的工具调用历史，而是 **提取后的结构化摘要**。

```
子代理内部执行 (主 session 看不到):
  ├── grep "RateLimitScheduler" → 50 行输出
  ├── read rate-limit-scheduler.ts → 300 行输出  
  ├── read agent-loop.ts → 200 行输出
  ├── grep "acquire(" → 30 行输出
  └── 分析总结

主 session 实际收到 (delegate_code_task 的 tool_result):
  ┌──────────────────────────────────────────────────────┐
  │ summary: RateLimitScheduler 在 3 个位置被调用，       │
  │ 形成 "初始化→获取→释放" 的令牌桶模式                   │
  │                                                      │
  │ findings:                                            │
  │ - sdk.ts:112 — 初始化配置 (bucket size, refill rate)  │
  │ - agent-loop.ts:178 — acquire() 在 LLM 调用前阻塞    │
  │ - model-router.ts:45 — release() 在完成后归还令牌     │
  │                                                      │
  │ files_analyzed: [sdk.ts, agent-loop.ts, model-router.ts] │
  │ recommendations: ["检查 acquire() 的超时处理逻辑"]     │
  │ confidence: high                                     │
  │ partial: false                                       │
  └──────────────────────────────────────────────────────┘
  
  Token 占用: ~300 (vs 原始 1000+)
```

---

## 5. 模型选择策略

### 约束

- 不使用弱模型（会降低分析质量）
- 不多分布跑（避免触发同步 API 限制）
- 子代理和主代理使用同一个 RateLimitScheduler

### 策略

```
主 Agent 模型: 当前配置的默认模型 (如 qwen3.6-plus:free)
子代理模型:   与主 Agent 相同
              │
              ▼ 不同的只有:
              ├── system prompt (精简 coding prompt)
              ├── 工具集 (只读子集)
              ├── token 预算 (50k vs 100k)
              └── 上下文 (fresh vs 累积)

调度:
  主 agent 和子代理的 LLM 调用都经过 RateLimitScheduler
  ├── 同一个令牌桶 (共享 RPM/TPM 限额)
  ├── 优先级: 用户对话 > 子代理任务
  └── 子代理排队等待时，主 agent 不阻塞（异步结果注入）
```

为什么不用更便宜的模型：
1. 代码分析需要理解力，弱模型容易遗漏或误解
2. 统一模型避免了 RPM 管理的复杂性
3. P2-D 已经处理了限流，不需要用弱模型来"省"

### 未来可选优化（不在本次实现范围内）

```
场景: 用户使用昂贵的主模型 (如 claude-sonnet)
  → 子代理使用便宜但有能力的模型 (如 qwen3-plus)
  → 节省成本，同时保持分析质量

实现: delegate_code_task 增加 model 参数
  → 覆盖子代理的模型选择
  → RateLimitScheduler 按 provider 分桶
```

---

## 6. 实施计划

### Step 1: 子代理基础设施

**新文件**: `packages/coding-agent/src/core/code-delegator.ts`

```typescript
// 子代理会话工厂
export async function createCodeSubAgent(options: {
  task: string;
  scope?: string;
  files?: string[];
  cwd: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  sessionManager: SessionManager;
}): Promise<CodeSubAgentResult> {
  // 1. 创建受限 agent session
  const session = await createAgentSession({
    sessionManager: SessionManager.inMemory(),  // 不持久化子代理 session
    // ... 其他配置
  });

  // 2. 注入精简 system prompt (SUB_AGENT_SYSTEM_PROMPT)
  // 3. 限制工具集 (只读子集)
  // 4. 设置 token 预算
  // 5. 执行任务
  // 6. 提取结构化结果
  // 7. 返回
}
```

### Step 2: 工具定义

**新文件**: `packages/coding-agent/src/core/tools/delegate-code-task.ts`

```typescript
export const delegateCodeTaskToolDefinition: ToolDefinition = {
  name: "delegate_code_task",
  label: "Delegate Code Task",
  description: `将代码分析任务分发给独立子代理执行，防止主会话上下文膨胀。
  
适用场景：
- 多文件搜索和分析 (3+ 文件)
- 理解模块/系统/组件的架构和调用链
- 跨文件重构分析
- 复杂 bug 排查涉及多个文件
  
子代理只具备只读权限，分析完成后返回结构化摘要。
如需修改代码，由你审查结果后决定执行。`,

  parameters: Type.Object({
    task: Type.String({ description: "任务描述，尽可能具体和精确" }),
    scope: Type.Optional(Type.String({ 
      description: "搜索范围限定，如 'packages/coding-agent/src/core/' 或 '*.ts'" 
    })),
    files: Type.Optional(Type.Array(Type.String({ minLength: 1 }), {
      description: "已知需要关注的文件列表，可选"
    })),
    expected_output: Type.Optional(Type.String({
      description: "期望的输出格式和内容，如 '调用链图 + 每个调用点的上下文说明'"
    })),
  }),

  // 能力声明
  isConcurrencySafe: () => false,
  isReadOnly: () => true,
  isDestructive: () => false,

  execute: async (input, ctx) => {
    // 调用 code-delegator.ts 的 createCodeSubAgent
    // 管理子代理生命周期
    // 提取并返回结构化结果
  },
};
```

### Step 3: 子代理 Bash 白名单 Hook

**新文件**: `~/.pi/agent/hooks/pre-tool-use.d/bash.sh`（或在代码中内置）

```bash
#!/bin/bash
INPUT=$(cat)
SESSION_TYPE=$(echo "$INPUT" | jq -r '.sessionId // ""')

# 如果是子代理 session，检查命令安全性
if [[ "$SESSION_TYPE" == *"sub-agent"* ]]; then
  COMMAND=$(echo "$INPUT" | jq -r '.input.command // ""')
  
  # 白名单模式
  SAFE_PATTERNS="^(git (log|diff|status|show|branch)|cat |head |tail |wc |file |stat |ls |grep |find |rg |echo )"
  
  if echo "$COMMAND" | grep -qE "$SAFE_PATTERNS"; then
    echo "APPROVE"
  else
    echo "DENY: 子代理仅限只读操作，写操作请返回主 agent 处理"
  fi
  exit 0
fi

# 主 agent 正常放行
exit 0
```

### Step 4: 主 Agent System Prompt 更新

在主 agent 的 system prompt 中追加任务分发决策流程（见第 3 节 Layer 1 内容）。

### Step 5: attempt.ts 路由注入

**修改**: `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`

在消息发送给 LLM 之前，运行分类器，将路由提示注入 system prompt 尾部。

### Step 6: 四层注册

```
L1: packages/coding-agent/src/core/tools/index.ts  (+delegateCodeTask)
L2: elysiaclaw/src/agents/pi-tools.ts              (+import +register)
L3: elysiaclaw/src/agents/tool-catalog.ts           (+definition)
L4: ~/.elysiaclaw/elysiaclaw.json tools.allow       (+delegate_code_task)
```

### Step 7: 构建部署测试

```bash
npm run build
./deploy.sh
# Telegram 测试: "梳理 P2-D 速率调度器的完整调用链"
# 验证: 主 session 上下文增长 < 1000 token (子代理结果)
```

### 完成标准

- [ ] `delegate_code_task` 工具在 TUI 和 Bot 两条路径都可用
- [ ] 子代理具备只读工具集，write/edit 被拒绝
- [ ] 子代理 bash 白名单生效（只允许读命令）
- [ ] 主 agent system prompt 包含分发决策流程
- [ ] Layer 0 消息分类器注入路由提示
- [ ] 子代理返回结构化摘要，不包含原始工具输出
- [ ] 子代理 token 预算为 50k，压缩阈值 30k
- [ ] 单文件任务主 agent 直接执行，不分发
- [ ] 多文件任务主 agent 自动分发
- [ ] `npm run build` 无错误
- [ ] 测试通过 858/861 不回退
- [ ] Telegram 端到端测试: 上下文增长明显少于直接执行

---

## 7. 与现有机制的关系

| 现有机制 | 关系 | 说明 |
|---|---|---|
| s04 Sub-Agents | **底层基础** | delegate_code_task 内部使用 createAgentSession(fork) |
| s09 Agent Teams | 不使用 | 子代理是临时的，不需要持久化团队 |
| s12 Worktree | 可选 | 修改类任务的子代理可启用，但不在首期实现 |
| task_assign (s07) | 并行 | task_assign 是持久化后台任务，delegate_code_task 是即时分析 |
| P2-D RateLimitScheduler | 共享 | 子代理和主 agent 共享同一个调度器 |
| P3-A PreToolUse Hooks | 依赖 | 子代理 bash 白名单通过 hook 实现 |
| s06 Context Compression | 独立配置 | 子代理使用更激进的压缩阈值 |
| Code Mode | **已废弃** | 删除 ROADMAP.md 中的 Code Mode 部分 |

---

## 8. 文档需要的变更

| 文档 | 变更 |
|---|---|
| ROADMAP.md | 删除 Code Mode 全部内容，新增 Sub-agent Delegation 章节 |
| SPRINT.md | 更新当前 Sprint 目标为 delegate_code_task 实现 |
| ARCHITECTURE.md | 更新架构图，加入子代理分发路径 |
| SYSTEM.md | 更新系统提示策略说明，删除 Code Mode 相关 |
| PITFALLS.md | （实现过程中追加新坑） |
| CLAUDE.md | 删除 Code Mode Phase 0 相关内容 |
| HANDOFF.md | 更新项目状态 |

---

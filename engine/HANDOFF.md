# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-09 | 会话：26（流式空白 bug 修复 + 分块参数调优 + 上游测试修复 + 部署）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "Telegram 流式输出空白 bug 修复（tool lane archivedToolPreviewIds 归档+清理）+ 分块参数调优（短句模式 sentence breakPreference）+ 上游 Telegram 测试 18→0 修复（fetch.test.ts globalThis.fetch 替换 + audit.test.ts 同方案 + topic-agentid.test.ts pickFirstExistingAgentId mock）+ 部署 5 guards 全绿（gateway pid 814440, memory 122 files / 1373 chunks）。"
> 当前优先：TASK-21 PLAN-13 M9 端到端验证（通过日志调查落实）


## 本次会话总结

### ✅ 完成内容

#### Telegram 流式输出空白 bug 修复

- **问题**：手机端 Telegram 流式输出 tool 调用时，用户发送消息导致对话页面出现大片空白（空气墙）
- **根因**：tool lane `forceNewMessage()` 重置 `streamMessageId` 导致旧 preview 消息孤儿化，answer lane 有 `archivedAnswerPreviews` 归档机制但 tool lane 没有
- **修复**：`bot-message-dispatch.ts` 添加 `archivedToolPreviewIds` 数组，在 `forceNewMessage()` 前归档 tool preview ID，finally 块中清理归档消息
- **GitHub**: https://github.com/elysiayunchen/pi-mono

#### 消息分块参数调优（短句模式）

- **目标**：改变 elysiaclaw 发送信息频率，发短句避免大段长句子，更符合流式输出观感
- **改动**：
  - `draft-chunking.ts`: minChars 200→80, maxChars 800→300, breakPreference "paragraph"→"sentence"
  - `block-streaming.ts`: DEFAULT_BLOCK_STREAM_MIN 800→200, DEFAULT_BLOCK_STREAM_MAX 1200→500, breakPreference 默认 "paragraph"→"sentence"
  - `pi-embedded-block-chunker.ts`: fallback breakPreference "paragraph"→"sentence"
- **测试**：draft-chunking 3/3, block-streaming 3/3, block-chunker 7/7 全绿

#### 上游 Telegram 测试修复（18→0）

1. **fetch.test.ts 15 failures** — `agent.dispatch is not a function`
   - 根因：`resolveTelegramTransport` 内部 `globalThis.fetch` 优先于 mock 的 `undiciFetch`
   - 修复：`beforeAll` 中手动替换 `globalThis.fetch = undiciFetch`，`afterAll` 恢复
2. **audit.test.ts 2 failures** — 同 fetch.test.ts 根因和修复方案
3. **topic-agentid.test.ts 1 failure** — `agent:ghost:` vs expected `agent:main:`
   - 根因：vitest ESM mock 无法拦截 `bot-message-context.ts` 中的 `loadConfig()` 调用
   - 修复：直接 mock `pickFirstExistingAgentId`（从 `../routing/resolve-route.js`）

#### 部署验证

- `npm run check` 零错误
- `deploy.sh` 5 guards 全部通过（G1 Config / G2 Patch / G3 Dist / G4 Tool parity / G5 memory_search E2E）
- Gateway 正常运行（pid 814440, Telegram OK, memory 122 files / 1373 chunks）

### 📋 代码改动清单
| 文件 | 改动 |
|------|------|
| `elysiaclaw/src/telegram/bot-message-dispatch.ts` | 添加 `archivedToolPreviewIds` 归档 + finally 清理（流式空白 bug 修复） |
| `elysiaclaw/src/telegram/draft-chunking.ts` | minChars 200→80, maxChars 800→300, breakPreference→"sentence" |
| `elysiaclaw/src/telegram/draft-chunking.test.ts` | 更新期望值匹配新默认参数 |
| `elysiaclaw/src/auto-reply/reply/block-streaming.ts` | MIN 800→200, MAX 1200→500, breakPreference→"sentence" |
| `elysiaclaw/src/agents/pi-embedded-block-chunker.ts` | fallback breakPreference→"sentence" |
| `elysiaclaw/src/telegram/fetch.test.ts` | beforeAll/afterAll 替换 globalThis.fetch 修复 15 failures |
| `elysiaclaw/src/telegram/audit.test.ts` | 同 fetch.test.ts 方案修复 2 failures |
| `elysiaclaw/src/telegram/bot-message-context.topic-agentid.test.ts` | mock pickFirstExistingAgentId 修复 1 failure |

### ⏳ 未完成 / 待追踪
- **TASK-21 PLAN-13 M9**（端到端验证+部署）— 需通过日志调查验证认知架构端到端功能
- **Telegram 网络恢复** — 代理节点全部不可达，需用户更新代理订阅


## 架构状态
| 维度 | 状态 |
|------|------|
| PLAN-13 迁移链 | M0✅ M1✅ M2✅ M3✅ M4✅ M5✅ M6✅ M7✅ M8✅ — M9 进行中（端到端日志验证） |
| PITFALLS Active | P080 Mitigated + P101 + 基础工具条目 |
| attempt.ts 行数 | 2359（4 个新模块提取） |
| 测试覆盖 | cognitive-memory 111/111 + attempt 149/149 + Telegram 867/867（上游 18 修复后全绿） |
| 风险点 | P101(Active) — 🟠 MEDIUM |

# HANDOFF — ElysiaClaw
> 初始化日期：2026-06-09 | 会话：22（M6 统一预算阈值完成）
> 每次会话结束后重写此文件。


## ⚡ 立即恢复点
> "M6 统一预算阈值完成。injection-budget.ts 新增 computeCompactThreshold(W, compactRatio=0.8)，sdk.ts 新增 contextWindowTokens 选项动态计算阈值替代 80k/90k 硬编码，attempt.ts/compact.ts 传递 contextWindowTokens。injection-budget 测试 14/14 全绿，npm run check 零回归。"
> 当前优先：TASK-19 PLAN-13 M7（C3 元压缩，依赖 M6✅）


## 本次会话总结

### ✅ 完成内容

#### TASK-18 PLAN-13 M6 — 统一预算阈值 80k/90k→W×compact_ratio

**问题**：auto-compact 的 `AUTO_COMPACT_THRESHOLD=80_000` 和 multi-layer 的 `DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD=90_000` 都是硬编码，不随模型窗口缩放。1M 窗口下 80k/90k 过于保守，白白浪费上下文空间。

**方案**：PLAN-13 §4 统一为 `W × compact_ratio`（默认 0.8），替代双阈值。

**改动**：

1. **`injection-budget.ts`**（elysiaclaw）：
   - 新增 `computeCompactThreshold(contextWindowTokens, compactRatio?)` 函数
   - 新增 `DEFAULT_COMPACT_RATIO = 0.8` 常量
   - 新增 `MIN_COMPACT_THRESHOLD = 20_000` 常量（小窗口保护）
   - 更新模块文档，标注 `computeInjectionBudget` 精密版已接入 runtime

2. **`sdk.ts`**（packages/coding-agent）：
   - `CreateAgentSessionOptions` 新增 `contextWindowTokens?: number` 选项
   - 新增 `compactThreshold` 计算：`W × 0.8 - safeBudget`，下限 20k
   - `transformContext` 中 multi-layer 阈值优先使用 `compactThreshold`，fallback 保留硬编码
   - `contextPressureThreshold` 同样优先使用 `compactThreshold`，统一双阈值

3. **`attempt.ts`**（elysiaclaw）：
   - `sessionOpts` 新增 `contextWindowTokens` 传递

4. **`compact.ts`**（elysiaclaw）：
   - `sessionOptions` 新增 `contextWindowTokens: effectiveModel.contextWindow`

5. **`injection-budget.test.ts`**（elysiaclaw）：
   - 新增 7 个 `computeCompactThreshold` 测试（默认比例、1M 窗口缩放、小窗口下限、自定义比例、常量值）

**效果**：
- 1M 窗口：阈值从 80k → 800k（10 倍提升）
- 200k 窗口：阈值从 80k → 160k（2 倍提升）
- 100k 窗口：阈值从 80k → 80k（等价）
- 32k 窗口：阈值从 80k → 25.6k→20k（下限保护，不再过度压缩）
- 向后兼容：不传 `contextWindowTokens` 时走原硬编码路径

### 📋 代码改动清单
| 文件 | 改动 |
|------|------|
| `elysiaclaw/src/context-engine/injection-budget.ts` | 新增 `computeCompactThreshold` + `DEFAULT_COMPACT_RATIO` + `MIN_COMPACT_THRESHOLD` + 文档更新 |
| `packages/coding-agent/src/core/sdk.ts` | 新增 `contextWindowTokens` 选项 + `compactThreshold` 动态计算 + multi-layer/pressure 统一阈值 |
| `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts` | `sessionOpts` 新增 `contextWindowTokens` |
| `elysiaclaw/src/agents/pi-embedded-runner/compact.ts` | `sessionOptions` 新增 `contextWindowTokens` |
| `elysiaclaw/src/context-engine/injection-budget.test.ts` | 新增 7 个 computeCompactThreshold 测试 |

### 📋 引擎文件更新
| 文件 | 改动 |
|------|------|
| CONTEXT.md | M6→✅、当前优先→M7、产品完成度→80%、不稳定项更新、A6→已完成 |
| HANDOFF.md | 会话 22 完整交接 |

### ⏳ 未完成 / 待追踪
- **TASK-19 PLAN-13 M7**（C3 元压缩）为下一优先级
- **P097** taskTrackerRegistry 内存泄漏 — 仍 Active
- **P098** finalReply 紧耦合 — 仍 Active（已有 setFinalReply 方法）
- **PLAN-14** 审批超时释放增强 — 待排期


## 架构状态
| 维度 | 状态 |
|------|------|
| PLAN-13 迁移链 | M0✅ M1✅ M2✅ M3✅ M4✅ M5✅ M6✅ M8✅ — M7 待启动 |
| PITFALLS Active | P097 P098 P101 + 基础工具条目 |
| 测试覆盖 | cognitive-memory 65/65 + Telegram Bot 94/94 + auto-compact-seal-aware 6/6 + injection-budget 14/14 |
| 风险点 | P097(内存泄漏) > P098(紧耦合) — 均为 🟡 MEDIUM |
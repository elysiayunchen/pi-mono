# ElysiaClaw — 进化能力增量计划（Evolution Increment Plan）

> 本文档由原 "OpenClaw-Next 架构设计说明书" 优化而来（2026-06-06）。
> 原稿基于过时的 OpenClaw 品牌 + Python 技术栈 + 错误对标对象（Hermes），约 60% 内容与 ElysiaClaw 已竣工能力重复。
> 本版剥离错误前提，提炼 3 个**项目尚未实现**的真增量，并映射到 ElysiaClaw 的真实 TS 架构与扩展点。

---

## 〇、为什么重写：原稿与现状的 gap

| 原稿主张 | ElysiaClaw 现状（证据） | 处置 |
|---|---|---|
| "OpenClaw-Next" / `~/.openclaw/` | 品牌迁移已完成：`.openclaw` 引用 0 处，`.elysiaclaw` 265 处 | 全部改名 |
| Python 装饰器 / LangGraph StateGraph / `.py` 技能 | 核心是 **TypeScript**（packages + elysiaclaw/src），Python 仅辅助脚本 | 核心引擎一律 TS |
| 对标 / 超越 Hermes | Hermes 是另一项目（LCM/Trilium 体系），不在本仓语境 | 删除对标叙事 |
| DAG 状态机替换"线性 Loop" | **12 层框架竣工**：s01 Loop / s03 Plan Mode+Todo / s04 Sub-Agents | 砍（不全量替换） |
| 双通道 Coder/Reviewer 评审折返 | 已有 `delegate_code_task` 只读子代理分析 | 降级为**可选质量门** |
| 分层记忆 Meta/滑动/RAG | s06 三层压缩链 + P1-C 压力事件 + `session_search`(SQLite FTS, 70 会话) | RAG 降级为 session_search v2 |
| 多租户物理隔离 | 已有 s12 Worktree + Gateway 多渠道隔离 | 砍 |
| 边云协同（云端 Reviewer / 本地 Coder） | 单机 elysiaserver 部署 | 推长期探索，砍 |

**保留的有效内核**：原稿抓对了一个真痛点——*工具输出污染上下文导致模型变笨*（ElysiaClaw 反复踩坑：免费模型忽略工具输出、context 膨胀）。由此提炼出 3 个真增量。

---

## 一、增量清单（3 个真增量 + 1 个可选项）

### 增量 1 — Tool-Log Interceptor（工具输出落盘 + 摘要注入）🔥 优先

**痛点**：大体量 stdout / traceback 整段进 messages → context 爆炸 + 模型被噪声带偏（PITFALLS 多次记录免费模型忽略工具输出自行编造）。

**落地接入点**：
- 拦截位置：工具结果回传链路 `elysiaclaw/src/agents/pi-embedded-runner/.../agent-runner-execution.ts`，置于 s06 压缩链 `compact.ts` 上游。
- 触发规则：单工具结果 > N KB（建议 4–8KB，可配）或匹配堆栈特征（Traceback / exit code ≠ 0）。
- 行为：原始输出落盘 `~/.elysiaclaw/agents/<id>/.cache/raw_logs/<tool>_<ts>.log`；注入 messages 的内容精简为 **摘要 + 文件路径 + 提取的核心错误行**（如 `ModuleNotFoundError: No module named 'numpy'`）。
- 读回：agent 可用现有 `read` 工具按需读取 raw log 全文。

**DoD**：
- 超阈值工具结果不再整段进 context；
- token 占用下降可量化（用 cost-report 对比前后）；
- agent 能按路径读回原始日志，不丢信息。

**风险**：
- 须确认与现有 s06 压缩链不重复处理（避免双重截断）；
- 摘要提取规则别误删关键信息（核心错误行抽取要保守）。

---

### 增量 2 — 运行时技能自迭代（Skill Evolution）🧬 最有价值，复杂度最高

**痛点**：skills 子系统目前只读不写（`bundled-dir / filter / refresh / plugin-skills`，无生成/进化），agent 不会"越用越聪明"。

**落地接入点**（全 TS，非 Python）：
1. Diff Analyzer：任务标记 SUCCESS 时，对比初始与成功状态，提取有效命令/工具调用序列。
2. LLM Synthesizer：合成为标准 **TS** 技能（含描述、输入 schema、frontmatter），复用 `skills/frontmatter.ts` 格式。
3. Sandbox Test：在隔离环境 dry-run（可复用 s12 worktree 沙箱）。
4. Write + 热加载：写入 `elysiaclaw/skills/dynamic/`，走现有 `skills/refresh.ts` 热加载。

**强制安全门**（不可省）：
- 自动写可执行技能 = 任意代码执行风险；
- 必须 沙箱测试 **且** 经增量 3 的 Human-in-the-Loop 审批后才激活；
- 禁止全自动并入技能库。

**DoD**：
- 能从一次成功任务沉淀出一个可复用技能；
- 经审批后，下次同类任务自动命中该技能。

**风险**：
- 依赖主模型可用（当前受阻，见前置技术债）；
- 合成技能质量依赖模型能力，免费模型易产出垃圾技能 → 审批门兜底。

---

### 增量 3 — Telegram 技能审批（Human-in-the-Loop）

**落地**：增量 2 产出 Draft Skill → 推 Telegram inline 按钮 [Approve]/[Reject]（`bot-message-dispatch.ts` 已具备按钮能力）→ 仅 Approve 才并入技能库。

**DoD**：Draft Skill 不经人工 Approve 不会激活；审批动作有记录。

**依赖**：增量 2 + 现有 Telegram 渠道。

---

### 可选 — Reviewer 折返子图（Quality Gate，默认关）

**定位**：不替换 Loop。在 `attempt.ts` 增加**可选**的 review 折返：重要 / code 任务时，输出先过 Reviewer 断言校验，失败折返 Fix Node（带 `maxIterations` 上限防死循环），通过才返回用户。

**成本**：双倍 token + 延迟 → **默认关闭，按需开启**（如 code 任务或显式高保真模式）。

**与现状关系**：理念与 `delegate_code_task` 部分重叠，可复用子代理 spawn 基础设施做 Reviewer 角色。

---

## 二、砍掉项（明确不做）

- DAG 全量替换执行循环 —— 12 层框架够用，全替换风险极高、ROI 低。
- 边云协同拓扑 —— 与单机部署现状脱节，推长期探索。
- 独立 RAG 向量库 —— 并入 `session_search` v2（升级为 sqlite-vec），不另起一套。
- 多租户物理隔离 —— 已有 s12 Worktree + Gateway 隔离。

---

## 三、实施顺序（依赖 + ROI）

```
前置：清技术债
  ├── DTS ×6 类型错误（pnpm build 阻塞，PITFALLS #38/#63）
  └── 主模型可用性（owl-alpha 400，端到端验证受阻）
        │
        ▼
增量 1  Tool-Log Interceptor   ← 独立、ROI 高、不依赖模型，先做
        │
        ▼
增量 3  Telegram 技能审批       ← 轻量，为增量 2 铺路
        │
        ▼
增量 2  Skill Evolution         ← 最重，依赖沙箱 + 审批 + 可用模型
        │
        ▼
可选    Reviewer 折返子图        ← 按需
```

**前置说明**：增量 2 必须等主模型恢复，否则合成技能无法验证；增量 1 不依赖模型，可立即启动。

---

## 四、统一约束（落地时遵守）

- 技术栈：核心引擎 TS，Python 仅限辅助脚本。
- 新工具走**四层注册链**：coding-agent tools → `pi-tools.ts` → `tool-catalog.ts` → `tools.allow`，Bot/TUI 双路径都要查。
- 路径：配置 `~/.elysiaclaw/`，数据 `~/.pi/agent/`，技能 `elysiaclaw/skills/`。
- 构建绕过 DTS：`node scripts/tsdown-build.mjs`；部署用 `./deploy.sh`（6 道守卫）。
- 每个增量独立 DoD + 文件改动清单，完成后同步 ROADMAP.md / HANDOFF.md / SPRINT.md。

---

## 附：原稿保留的设计语汇（供实现参考）

- **System Reflector 注入格式**（增量 1 摘要模板）：
  > Tool `execute_bash` failed with exit code 1. 500-line traceback saved to `.cache/raw_logs/err_042.log`. Core error: `ModuleNotFoundError: No module named 'numpy'`.
- **进化四段流水线**（增量 2）：Diff Analyzer → LLM Synthesizer → Sandbox Test → Write to Plugin。
- **受控进化**（增量 3）：Draft Skill 信号 → 渠道按钮 → Approve 并入。

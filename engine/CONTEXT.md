# CONTEXT — ElysiaClaw
> 快照日期：2026-06-08 | 每次会话开始时，读完 ENGINE_MAP 后优先阅读此文件。


## 状态面板
| 维度 | 状态 |
|------|------|
| 构建 | ✅ 正常（`npm run build` 通过，`npm run check` 零错误） |
| 上次完成 | 流式输出修复（blockStreamingDefault="off" 配置修复，2026-06-08） |
| 进行中 | 序 8 Conversation+Handoff 阶段 5（端到端验证，待可用模型） |
| 阻塞 | delegate_code_task Telegram 端到端验证 — 受阻于主模型不可用 |
| 产品目标完成度 | 约 70% — 12 层 Agent 框架竣工，认知架构演进至序 8，Tool Parity 82.4% |


## 当前状态概述
ElysiaClaw 是基于 pi-mono 框架构建的多渠道 AI 助手平台，运行在 `elysiaserver` (Ubuntu 24.04)，通过 Telegram Bot `@ElysiaClaw_Bot` 交互。项目维护者为 aoseluo（云尘 / 奈緒），采用 AI 协作开发模式，独立维护，不与上游 OpenClaw 同步。

当前处于认知架构演进的关键阶段：序 1-7（分层注入、压缩可见性、全流式、工具结果驱逐、注入预算器、输入分类器、用户画像）已全部完成；序 8（会话轮换与跨会话延续）阶段 1-4 代码落地，待端到端验证。上方有参与者持续性总架构（PLAN-08）统摄后续方向。


## 当前假设
- 本地开发环境使用 `elysiaclaw.json` 和 `config.yaml` 配置，不影响生产
- 主模型 OpenRouter/owl-alpha 当前不可用，部分端到端验证受阻
- `~/.pi/agent/sessions/` 下的 session JSONL 文件正常增长，自动 compact 机制有效
- Gateway 绑定 `lan` 模式（Tailscale IP `100.111.4.5`），局域网内可访问
- pi-agent-core monkey-patch 由 `scripts/patch-agent.cjs` 保护，每次 deploy 后验证


## 运行时上下文
- 项目根目录：`/home/elysia/projects/pi-mono/`（非 `~/pi-mono/`）
- 引擎文件目录：`/home/elysia/projects/pi-mono/engine/`（v5 重构后）
- 原 `elysiaclaw_engine/` 已归档删除，所有内容迁移至 `engine/`
- Node.js v22.22.1，通过 nvm 管理
- tsgo 不在 PATH，必须用 `npm run build` 调用
- pi-mono 框架层使用 npm workspaces，elysiaclaw 应用层使用 pnpm（不可混用）
- `deploy.sh` 结构：3 Phase · 12 Step · 5 Guard


## 常用请求翻译表
> 将日常业务语言映射到技术入口点。AI 每次会话后根据实际请求更新。
| 如果你说想要… | 实际需要动到的文件/地方 | 复杂度 | 备注 |
|---------------|--------------------------|------|------|
| 部署更新 | `cd ~/pi-mono && ./deploy.sh` | 低 | 一键部署 |
| 新增框架层工具 | `packages/coding-agent/src/core/tools/` + 四层注册 | 高 | 需两边验证 TUI/Bot |
| 新增应用层工具 | `elysiaclaw/src/agents/tools/` + pi-tools.ts + tool-catalog.ts | 中 | 需 deploy 到全局 |
| 修改 Agent 循环/压缩 | `packages/coding-agent/src/core/` + `packages/agent/src/` | 高 | 影响全局，需充分测试 |
| 修复 Telegram 输出 | `elysiaclaw/src/telegram/` | 中 | 涉及 bot-message-dispatch |
| 增加新的 LLM provider | `~/.elysiaclaw/elysiaclaw.json` agents 段 | 低 | 配置修改 |
| 查看 gateway 状态 | `elysiaclaw status` | 低 | 命令行 |
| 查 session 数据 | `find ~/.pi/agent/sessions/ -name "*.jsonl"` | 低 | 递归查找 |
| 成本报告 | `python3 ~/.pi/agent/cost-report.py` | 低 | Python 脚本 |
| 修复流式输出 | `~/.elysiaclaw/elysiaclaw.json` L357 `blockStreamingDefault` | 低 | 配置项 |
| 回滚到旧版 | `git checkout` + `npm run build` + `./deploy.sh` | 中 | 需要完整重部署 |


## 会话交接记录
引擎文件 v5 重构完成。从 `elysiaclaw_engine/` 迁移至 `engine/`，按 v5 规范重组。8 个 plan 已登记，设计文档从旧目录迁移至 `engine/plans/`。旧目录 `elysiaclaw_engine/` 已删除。


## 最近完成的事项
1. 流式输出修复 — blockStreamingDefault="off" 配置修复（2026-06-08）
2. 序 1-7 统一实施全部完成 + 边缘情况加固（2026-06-07）
3. 序 8 阶段 4：Task Segment 追踪 + 双轨索引 + CompactionSummary（2026-06-07）
4. 序 8 深度审查 + 接线断链修复：executeRotation 死代码等（2026-06-07）
5. tsgo 全仓类型检查 53→0 清零（2026-06-07）


## 已知不稳定项
- executeRotation 死代码：仅定义+导出+测试，零生产调用（PITFALLS #91）
- CONSOLIDATE 未接入生产：MacroIndex 真实路径恒空，双轨退化单轨（PITFALLS #92）
- 自动轮换假自动：pendingToolCalls:0, hasActiveBackgroundLane:false 写死（PITFALLS #93）
- 注入预算器用简化版：运行时用硬编码阈值，不随 1M 窗口缩放
- 输入分类器数据源偏窄：短陈述句落入 task，identity.name 提不出
- sessions chunks 47% CLAUDE.md 注入噪音
- delegate_code_task Telegram 端到端验证未完成（需可用模型）
- attempt.ts 复杂度失控：2861+ 行，建议拆分


## 待解决问题
- [ ] [Q-01] 序 8 阶段 5 端到端验证 — 需要可用模型才能进行
- [ ] [Q-02] Tool Parity Task 14-16（AskUserQuestion / MCP / 并行执行）— 优先级排序
- [ ] [Q-03] attempt.ts 拆分重构时机 — 拆为 system-prompt-builder.ts + injection-coordinator.ts + rotation-trigger.ts
- [ ] [Q-04] World Model Phase 2 启动时机 — 阻塞项：序 8 闭环 + 模型可用
- [ ] [Q-05] 参与者持续性 W0-W5 路线确认 — 需架构师排优先级
# ElysiaClaw — AI 协作文档体系

> ElysiaClaw 是基于 OpenClaw (v2026.3.13) fork 的个人 AI 助手平台，进入独立维护阶段。
> 本目录包含所有面向 AI 协作者的系统级 Prompt 文档。

---

## 文档位置

~/projects/pi-mono/elysiaclaw_engine/ ← 所有文档在此目录下


## 文档导航

| 文档 | 用途 | 更新频率 |
|---|---|---|
| **[HANDOFF.md](./HANDOFF.md)** | AI 接手快照：当前状态、关键路径、起步清单 | 每个 Sprint 结束 |
| **[SYSTEM.md](./SYSTEM.md)** | 核心系统信息：环境、部署、规则、文件索引 | 架构变更时 |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 架构蓝图：pi-mono、ElysiaClaw 扩展层 | 架构变更时 |
| **[PITFALLS.md](./PITFALLS.md)** | 踩坑记录：已知问题及解决方案，持续追加 | 每次遇到新坑 |
| **[ROADMAP.md](./ROADMAP.md)** | 规划与目标：未竟工作项、优先级、Sprint 日志 | 每次 Sprint 结束 |
| **[SPRINT.md](./SPRINT.md)** | 当前 Sprint 工作台：计划、检查清单、快速参考 | 每次 Sprint |
| **[SUPERADMIN-AGENT-DESIGN.md](./SUPERADMIN-AGENT-DESIGN.md)** | 超算管理员 Agent 架构设计（Phase 1 ✅, Phase 2 待启动） | 架构讨论 |
| **[MEMORY-ACTIVATION-RUNBOOK.md](./MEMORY-ACTIVATION-RUNBOOK.md)** | 记忆引擎激活执行手册（T1-T6，已完成，参考用） | 已完成 |
| **[SUBAGENT-CODE-DELEGATION.md](./SUBAGENT-CODE-DELEGATION.md)** | 子代理代码委派技术设计 | 架构讨论 |
| **[DELEGATE-CODE-TASK-PLAN.md](./DELEGATE-CODE-TASK-PLAN.md)** | delegate_code_task 实施计划 | 已完成 |
| **[TOOL-PARITY-PLAN.md](./TOOL-PARITY-PLAN.md)** | Tool Parity 迁移计划（3/16 完成） | 进行中 |
| **[CLAUD-CODE-COMPARISON.md](./CLAUD-CODE-COMPARISON.md)** | Claude Code v2.1.88 逐层对标分析 | 参考 |

---

## AI 接手时的阅读顺序

```
1. HANDOFF.md     → 当前状态快照，最快了解项目
2. SYSTEM.md      → 了解是什么、在哪跑、规则是什么
3. ARCHITECTURE.md → 理解系统怎么设计的
4. PITFALLS.md    → 避开已踩过的坑（必读！）
5. SUPERADMIN-AGENT-DESIGN.md → 记忆架构总设计
6. ROADMAP.md     → 选择下一个 Sprint
7. SPRINT.md      → 开始工作
```

---

## 项目一句话描述

ElysiaClaw = **elysiaclaw**（应用层 + 渠道 + Gateway）+ **pi-coding-agent**（底层 Agent 框架 + 12 层扩展）

运行在 `elysiaserver` (Ubuntu 24.04)，通过 Tailscale + Telegram bot `@ElysiaClaw_Bot` 与用户交互。

---

## 两个上游项目简介

### elysiaclaw（主项目，开发目标）
- 位置：~/projects/pi-mono/elysiaclaw/
- 定位：多渠道个人 AI 助手平台
- 提供：Telegram/WhatsApp/Discord 等 20+ 渠道、web_fetch/web_search/cron/browser 等应用层工具、Gateway 控制平面
- 构建：cd ~/projects/pi-mono/elysiaclaw && pnpm build
- 部署：cp -r dist/* ~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/dist/

### pi-coding-agent（底层框架）
- 位置：~/projects/pi-mono/packages/coding-agent/
- 定位：极简主义 AI agent toolkit，核心理念 "One loop & Bash is all you need"
- 提供：Agent 循环、统一 LLM API (20+ 提供商)、工具框架、12 层扩展
- 构建：cd ~/pi-mono && npm run build
- 部署：cd ~/pi-mono && ./deploy.sh

---

## 关键规则（TL;DR）

1. 写文件 → Python 脚本，不用 heredoc
2. 字符串替换 → Python str.replace()，不用 sed
3. 新增工具 → 检查 `src/index.ts` 导出 + `tools/index.ts` allTools + deploy.sh Guard 3
4. deploy 后 → 验证 gateway 响应
5. 修改 YAML → 用 Python 验证缩进
6. 读代码再写代码 → cat/grep 先行
7. 代码分析委托给只读子代理 — 使用 delegate_code_task 防止上下文污染
8. Bot/TUI 双路径 — 新增工具必须两处都检查

完整规则见 [SYSTEM.md §6](./SYSTEM.md)

---

*文档版本：2026-06-06*

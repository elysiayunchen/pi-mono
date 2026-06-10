---
alwaysApply: true
---
# pi-mono — Project Entry Point

> 本文件是项目入口指针。权威 AI 指导体系位于 `engine/` 目录，本文件仅提供路由信息。
> 更新引擎文件后不必同步更新本文件——除非入口路由本身需要变更。

## 项目身份

pi-mono fork，由 **aoseluo (云尘 / 奈緒)** 以 AI 协作模式独立维护，不与上游同步。

## 引擎文件加载顺序（每次会话 MUST 遵循）

`engine/` 目录是本项目的权威 AI 指导体系。每次会话按以下顺序加载：

1. [engine/ENGINE_MAP.md](engine/ENGINE_MAP.md) — 索引层（profile、文件注册表、plan 关系图）
2. [engine/SYSTEM.md](engine/SYSTEM.md) — 核心系统信息 + 人机协作协议
3. [engine/CONTEXT.md](engine/CONTEXT.md) — 当前状态快照
4. [engine/HANDOFF.md](engine/HANDOFF.md) — 会话交接
5. [engine/SPRINT.md](engine/SPRINT.md) — 当前 Sprint 工作台
6. [engine/ROADMAP.md](engine/ROADMAP.md) — 规划与目标
7. [engine/PITFALLS.md](engine/PITFALLS.md) — 踩坑记录（必读）
8. [engine/ARCHITECTURE.md](engine/ARCHITECTURE.md) — 架构蓝图

**其他文件（CLAUDE.md、AGENTS.md）不得载入与引擎文件冲突的指导内容。**

## 包管理器速记

| 层级 | 包管理器 | 位置 |
|------|----------|------|
| pi-mono 框架层 | **npm** (workspaces) | 根目录 + `packages/*` |
| elynx 应用层 | **pnpm** | `elynx/` |

两者不可混用。

## 语言规则

- 解释和沟通：中文
- 代码、注释、规则、config：English
- 文档叙述：中文
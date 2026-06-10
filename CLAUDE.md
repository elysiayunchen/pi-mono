# Elynyx — Agent Entry
> 本文件是引导器，不是知识仓库。权威知识在 `engine/`，以 `engine/ENGINE_MAP.md` 为索引。

## FIRST ACTION (MUST)
Read `engine/ENGINE_MAP.md` BEFORE anything else. Active profile: CLI-LEAN.
按其 §0 读取流程加载引擎文件，用一句中文复述当前状态理解，架构师确认后动手。

## TOP RULES (source: engine/SYSTEM.md — 完整规则以彼为准)
1. ALWAYS check what exists before implementing. Source‑first.
2. NEVER make silent assumptions. Ask before proceeding on unclear points.
3. NEVER commit unless user asks
4. NEVER use inline imports (`await import()` / `import("pkg").Type`) — always top-level imports
5. NEVER 在根目录运行 npm install（与 pnpm workspace 冲突）

## SESSION PROTOCOL
- 开始：见 engine/SYSTEM.md「会话加载流程」
- 结束：更新 HANDOFF.md + ENGINE_MAP，输出引擎文件变更摘要（见「会话结束流程」）

## MAP
- 引擎索引：engine/ENGINE_MAP.md ｜ 规则：engine/SYSTEM.md ｜ 当前状态：engine/CONTEXT.md
- 各代码包的局部上下文见各包根部 README.md `## For AI Agents` 章节

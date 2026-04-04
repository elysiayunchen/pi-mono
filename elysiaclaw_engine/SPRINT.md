# ElysiaClaw — Sprint Working Document

> 本文档是 AI 协作者每次开始新 Sprint 时的**工作台**。
> 开始前填写计划，结束后更新结果，然后同步到 ROADMAP.md 和 HANDOFF.md。

---

## 当前 Sprint

**Sprint 目标**: Code Mode 基础框架 — 独立 Claude Code 风格模式（Phase 0）
**开始时间**: 2026-04-05
**预期完成**: TBD

### 背景

在 ElysiaClaw 内部设立独立的 Code Mode，用户通过 `/code` 手动切换。
完整复刻 Claude Code 的 12 层机制，只做环境隔离，不做功能裁剪。

### 实现计划

```
Step 1: 读源码
  - cat packages/coding-agent/src/core/agent-session.ts
  - cat packages/coding-agent/src/core/sdk.ts
  - cat packages/coding-agent/src/index.ts
  - grep -r "createPiCodingTools|createElysiaClawCodingTools"
  - 确认当前工具注册和 session 管理逻辑

Step 2: 写代码（Python 脚本写文件）
  - 新增 src/core/code-mode/code-agent-config.ts
  - 新增 src/core/code-mode/code-session-manager.ts
  - 新增 src/core/code-mode/code-system-prompt.ts
  - 新增 src/core/code-mode/code-tool-registry.ts
  - 新增 src/tools/enter-code-mode.ts
  - 新增 src/tools/exit-code-mode.ts

Step 3: 修改现有文件
  - src/core/agent-session.ts — 添加 codeMode 状态 + 路由逻辑
  - src/index.ts — 导出新工具（enter_code_mode, exit_code_mode）

Step 4: 构建验证
  - npm run build
  - npm run check (lint + type-check)

Step 5: 部署
  - ./deploy.sh
  - 验证 gateway 响应：elysiaclaw status

Step 6: 功能测试
  - Telegram 发送 /code → 确认进入 Code Mode
  - 执行 coding 任务 → 确认工具可用
  - 发送 /exit → 确认返回用户模式
  - 确认 code-sessions/ 目录有新的 session 文件

Step 7: 文档更新
  - HANDOFF.md — 更新项目状态
  - ROADMAP.md — 标记 Phase 0 完成
  - PITFALLS.md — 新坑追加（如有）
```

### 文件改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/core/code-mode/code-agent-config.ts` | 新增 | Code 模式 Agent 配置工厂 |
| `src/core/code-mode/code-session-manager.ts` | 新增 | 独立 session 目录管理 |
| `src/core/code-mode/code-system-prompt.ts` | 新增 | 精简 coding system prompt |
| `src/core/code-mode/code-tool-registry.ts` | 新增 | 完整工具集注册（不裁剪） |
| `src/tools/enter-code-mode.ts` | 新增 | /code 命令入口 |
| `src/tools/exit-code-mode.ts` | 新增 | /exit 命令出口 |
| `src/core/agent-session.ts` | 修改 | 添加 codeMode 状态 + 消息路由 |
| `src/index.ts` | 修改 | 导出 enter_code_mode, exit_code_mode |

### 关键设计决策

1. **不裁剪工具**: Code 模式保留全部工具（team, background, autonomous 等），只排除环境噪声
2. **独立 session 目录**: `~/.pi/agent/code-sessions/` 与用户模式 `~/.pi/agent/sessions/` 完全隔离
3. **不续会**: Code 模式每次 `/code` 都是全新 session，不读取用户模式历史
4. **项目级 skills/hooks 保留**: 只排除全局 `~/.pi/agent/skills/` 和 `~/.pi/agent/hooks/`，项目级 `.pi/skills/` 和 `.pi/hooks/` 正常加载
5. **共享资源**: tasks/, file-history/, learning/ 共享，不隔离

### 完成标准 (Definition of Done)

- [ ] `npm run build` 无错误
- [ ] `npm run check` 无错误
- [ ] 测试通过（860/861 基准不回退）
- [ ] `./deploy.sh` 成功
- [ ] Telegram `/code` 进入 Code Mode，回复确认信息
- [ ] Code Mode 下 read/write/edit/bash/grep/find 全部可用
- [ ] Code Mode 下 team/task/background/worktree 工具全部可用
- [ ] Code Mode session 文件写入 `~/.pi/agent/code-sessions/`
- [ ] `/exit` 退出 Code Mode，返回用户模式
- [ ] 用户模式 session 和 Code 模式 session 互不干扰
- [ ] `src/index.ts` 新工具已导出
- [ ] HANDOFF.md 已更新

---

## Sprint 结果记录

**实际完成时间**: TBD
**测试结果**: TBD
**新增踩坑**（坑号追加到 PITFALLS.md）: TBD
**遗留问题**: TBD

---

## 后续 Sprint 规划

| Sprint | 内容 | 依赖 |
|---|---|---|
| Sprint 2 | Phase 1: 并行工具执行 (StreamingToolExecutor) | Phase 0 完成 |
| Sprint 3 | Phase 3: Web 工具 (web_fetch + web_search) | 独立 |
| Sprint 4 | Phase 2: 权限系统增强 (PermissionRules) | Phase 1 完成 |
| Sprint 5 | Phase 4: MCP 协议集成 | 独立，最复杂 |
| Sprint 6 | Phase 5: 结构化用户交互 (ask_user_question) | 独立 |

---

## AI 协作者快速参考

### 常用命令
```bash
# 查看日志
elysiaclaw logs

# 检查 gateway 状态
elysiaclaw status

# 构建 + 部署
cd ~/pi-mono && ./deploy.sh

# 只构建不部署
cd ~/pi-mono && npm run build

# 验证 YAML 配置
python3 -c "import yaml; print(yaml.safe_load(open(os.path.expanduser('~/.elysiaclaw/config.yaml')).read()))"

# 查看 code-sessions
ls -la ~/.pi/agent/code-sessions/

# 查看用户 sessions
ls -la ~/.pi/agent/sessions/

# 成本报告
python3 ~/.pi/agent/cost-report.py
```

### 代码写入模板（Python）
```python
import os

def write_file(rel_path, content):
    path = os.path.expanduser(f"~/pi-mono/{rel_path}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Written: {path}")
```

### 导出检查模板
```bash
# 检查某工具是否已导出
grep -n "myNewTool" ~/pi-mono/packages/coding-agent/src/index.ts

# 列出所有已导出的工具
grep "ToolDefinition" ~/pi-mono/packages/coding-agent/src/index.ts
```

### Patch 验证
```bash
grep -n "setSystemPrompt\\|replaceMessages" \\
  ~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/node_modules/@mariozechner/pi-agent-core/dist/agent.js
```

---

*模板版本：2026-04-07*

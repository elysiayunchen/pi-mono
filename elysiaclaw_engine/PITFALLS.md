# ElysiaClaw — 踩坑记录 (Pitfalls & Lessons)

> 本文档记录项目开发过程中遇到的所有坑点及解决方案。
> 每次遇到新坑必须追加记录。AI 协作者在执行相关操作前请先检索本文档。

---

## 高频警告（必读）

在执行任何操作前，先过这 6 条：

1. **写文件用 Python**，不要用 heredoc（坑 #1）
2. **字符串替换用 Python `str.replace()`**，不要用 sed（坑 #2）
3. **新增工具必须检查 `src/index.ts` 导出**（坑 #16 / #23）
4. **deploy.sh 后验证 gateway 能正常响应**（坑 #22b）
5. **YAML 缩进错误会静默破坏 gateway**（坑 #30）
6. **功能完成必须 Definition of Done 全部勾选**（坑 #64）

---

## 坑记录

### #1 — heredoc 截断
**现象**: Shell heredoc 在某些终端/SSH 场景下内容被截断  
**解决**: 用 `python3` 脚本写文件，逐行拼接字符串

```python
import os
content = "line1\nline2\n"
path = os.path.expanduser("~/target.ts")
with open(path, "w") as f:
    f.write(content)
```

---

### #2 — sed 转义地狱
**现象**: `sed` 正则在 bash 里有三层转义，特殊字符极易出错  
**解决**: 用 Python `str.replace()` 或 `re.sub()`

---

### #3 — pi-tui 版本不兼容
**现象**: pi-mono 0.64 的 `pi-tui` API 与安装包里的 0.58 不兼容  
**解决**: 在全局安装的 0.58 上加兼容层，不替换 pi-tui
**后续**: 2026-04-07 升级到 0.64 后确认 diff 为空，兼容层已原生包含，直接替换即可

---

### #4 — pi-ai 覆盖风险
**现象**: 第一次替换 pi 包时意外把 pi-ai 也覆盖了  
**解决**: 出现后用 `npm install @mariozechner/pi-ai@0.58.0 --no-save` 恢复
**后续**: 2026-04-07 统一升级到 0.64，deploy.sh 明确列出替换包  
**预防**: deploy.sh 只替换 `pi-coding-agent`，明确不动其他包

---

### #5 — biome lint 阻止 git commit
**现象**: biome 报错导致 commit 失败  
**解决**: 用 template literal 替代字符串拼接；删除未使用变量

---

### #6 — tsgo 不在 PATH
**现象**: 直接执行 `tsgo` 报 command not found  
**解决**: 永远用 `npm run build`，不直接调 tsgo

---

### #7 — 包加载路径
**现象**: ElysiaClaw 从 `node_modules/@mariozechner/` 加载 pi 包，不从系统全局  
**解决**: 替换对应的目录：`~/.nvm/.../elysiaclaw/node_modules/@mariozechner/pi-coding-agent/`

---

### #8 — isContextOverflow 名称错误
**现象**: `isContextOverflowError` 不存在，实际导出名是 `isContextOverflow`  
**解决**: 修改 import，用 `grep` 核实实际导出名再写代码

---

### #9 — AgentEvent 缺失重试事件
**现象**: `auto_retry_start`/`auto_retry_end` 在 `AgentEvent` 里不存在，只在 `AgentSessionEvent` 里  
**解决**: 在 `agent-loop.ts` 里直接处理，不依赖事件类型

---

### #10 — 0.64 与 0.58 导出差异
**现象**: `getKeybindings` 等函数在 0.58 包里不存在
**后续**: 0.64 已原生包含这些导出，升级后无需兼容层  
**解决**: 在兼容层加别名导出

---

### #11 — Agent 类方法缺失
**现象**: 0.64 源码调用了 0.58 缺少的 `setSystemPrompt()` 和 `replaceMessages()`
**后续**: 2026-04-07 确认 0.64 编译产物中仍然缺少这两个方法，patch 仍需保留，但锚点从 `setAfterToolCall` 改为 `subscribe`  
**解决**: 手动 monkey-patch，由 `patch-agent.cjs` 管理

---

### #12 — deploy 脚本粘贴中断
**现象**: 通过 SSH 粘贴长脚本时中断  
**解决**: 通过 VS Code SSH 扩展直接写文件，再 `bash` 执行

---

### #13 — 模块导出重复
**现象**: Python 脚本多次运行导致 `index.ts` 中有三重重复导出  
**解决**: 写去重脚本，先读取→去重→写回

---

### #14 — 自动注入点错位
**现象**: sed 注入代码到错误位置  
**解决**: sed 删除错误代码后，手动定位正确注入点，用 Python 写入

---

### #15 — s08 工具类型错误（三处）
**现象**: `details` 必填字段缺失、`execute` 签名缺参数、`status` 值非法  
**解决**: 逐一补全，用 `npm run check` 验证

---

### #16 — dist/index.js 手动维护
**现象**: 新增工具若不在 `src/index.ts` 显式导出，构建后 bot 无法使用  
**解决**: 每次新增工具后必须检查并更新 `packages/coding-agent/src/index.ts`

---

### #17 — 两个工具注册路径
**现象**: TUI 走 `createPiCodingTools`，Bot 走 `createElysiaClawCodingTools`，是完全独立的路径  
**解决**: 新增工具时，两个路径都需要注册

---

### #18 — team-create.ts 路径错误
**现象**: 引用了不存在的路径和占位变量名  
**解决**: 改用 `node:os` + `path.join` 拼路径，避免硬编码

---

### #19 — teammate 工具权限缺失
**现象**: teammate 没有操作文件的权限  
**解决**: s12 Worktree 通过 `createBashTool(worktreePath)` 注入，天然沙箱

---

### #20 — Python heredoc 写 TS 模板字符串三重转义
**现象**: Python heredoc 内含 TypeScript 模板字符串时产生三重转义混乱  
**解决**: 逐行拼接字符串，彻底消除 heredoc

---

### #21 — Python 脚本硬编码 /root/ 路径
**现象**: 在 elysia 用户下运行时路径不正确  
**解决**: 改用 `os.path.expanduser("~/...")`

---

### #22 — TS2663 参数名冲突
**现象**: 函数参数 `prompt` 与方法名 `prompt()` 冲突，TypeScript 报 TS2663  
**解决**: 检测实际参数名并替换为非冲突名，同时添加 `async`

---

### #22b — patch-agent.cjs 非幂等导致 gateway 崩溃 ⚠️
**现象**: 多次运行 patch 脚本后，注入代码被 `// REMOVED_` 前缀包裹，agent.js 第 133 行出现孤立语句，`SyntaxError` 导致 gateway 崩溃  
**解决**: 重写脚本，加 Step 0 清理损坏代码，逐方法严格检测，按需注入（幂等）  
**预防**: 每次 deploy.sh 前检查 agent.js 语法

---

### #23 — src/index.ts 工具导出遗漏
**现象**: s07-s12 工具存在于 dist 但未在 `src/index.ts` 导出，bot 环境全部无法使用  
**解决**: 补全 14 行导出声明（见 s09 二次修复记录）

---

### #24 — P1-C 类型错误三连
| 错误 | 解决 |
|---|---|
| `msg as Record<string, unknown>` 报 TS2352 | 改为 `msg as unknown as Record<string, unknown>` |
| `timestamp` 参数是 string，传了 number | 改为 `new Date().toISOString()` |
| `auth.apiKey` 是 `string \| undefined` | 加 `!` 非空断言（auth.ok 已保证） |
| `contextPressureThreshold` 不在 AgentOptions | 在 agent.ts 的三处（接口/类属性/构造器）同步添加 |

---

### #25 — Bot 模式绕过 pi-coding-agent ⚠️
**现象**: `elysiaclaw` 是完全自包含 bundle，bot 请求不经过我们替换的 `pi-coding-agent`，`wrapStreamForCost()` 对 bot 无效  
**解决**: 双轨方案：TUI 走 `wrapStreamForCost()` 拦截 done 事件；Bot 走读取 `sessions.json` 的 Python 报告脚本  
**关键**: 这是理解 ElysiaClaw 架构的核心差异点，永远记住

---

### #26 — ModelSpeedMetrics 字段名猜错
**现象**: 猜测字段名为 `ttft`/`tokensPerSecond`，实际是 `ttftMs`/`tps`/`latencyMs`  
**解决**: `grep` 实际接口定义后再写代码，永远不猜字段名

---

### #27 — EfficiencyGuardConfig 是比例阈值
**现象**: `warnThreshold=0.7` 是相对比例，不是绝对 RPM 调用次数  
**解决**: 将 P95 RPM 映射为比例调整量，而非直接赋值

---

### #28 — 四脚本部署路径硬编码错误
**现象**: 子脚本路径写成 `~/`，实际在 `~/projects/pi-mono/`  
**解决**: 所有部署统一单文件，路径用 `__file__` 所在目录推导

---

### #29 — openclaw→elysiaclaw 包名迁移导致入口断裂
**现象**: `elysiaclaw.mjs` 里的 `import("./dist/entry.js")` 是相对路径，通过 symlink 运行时 CWD 不对，CLI 静默失败无输出  
**解决**: symlink 直接指向 `dist/entry.js`，不指向 `dist/`

---

### #30 — config.yaml 缩进错误静默破坏 gateway ⚠️
**现象**: `gateway:` 段被嵌套在 `workspace:` 下，YAML 解析后 `gateway.mode` 不存在，启动报 `mode=unset`  
**解决**: 修正 YAML 缩进，确保 `gateway:` 在顶层  
**预防**: 修改 config.yaml 后用 `python3 -c "import yaml; yaml.safe_load(open('config.yaml'))"` 验证

---

### #31 — 新版 schema 校验比旧版严格
**现象**: 
- `gateway.mode: "lan"` → 只允许 `local`/`remote`
- `agents.defaults.defaultModel` → 不再支持
- `models.mode: "safeguard"` → 只允许 `merge`/`replace`

`--allow-unconfigured` 也无法跳过  
**解决**: 按新版 schema 修正字段值，不要照搬旧配置

---

### #32 — Token 认证是两层的
**现象**: config 里写了 token 还不够，systemd service 的环境变量里也要有 `OPENCLAW_GATEWAY_TOKEN`  
**解决**: systemd service 文件添加 `Environment=OPENCLAW_GATEWAY_TOKEN=xxx`

---

### #33 — Plugin manifest 文件名跟包名走
**现象**: extensions 目录里的 `openclaw.plugin.json` 需要复制为 `elysiaclaw.plugin.json`，否则 34 个插件全部报 manifest not found  
**解决**: 批量 rename `openclaw.plugin.json` → `elysiaclaw.plugin.json`

---

### #34 — .bashrc 补全脚本路径残留
**现象**: 原来引用 `~/.openclaw/completions/openclaw.bash`，每次开终端报 No such file or directory  
**解决**: 修改 `.bashrc` 中的 source 路径为 `~/.elysiaclaw/completions/elysiaclaw.bash` 或直接删除

---

### #35 — CLI 输出被吞（根因是 symlink）
**现象**: `elysiaclaw status` exit 0 但无输出  
**根因**: 同坑 #29，入口 symlink 问题，不是 stdout 被劫持  
**解决**: 修复入口 symlink 后解决

---

### #36 — systemd service ExecStart 路径旧包名
**现象**: service 文件 ExecStart 指向旧目录，重装后包移位，路径不匹配  
**解决**: 更新 service 文件 ExecStart 为正确的包安装路径

---


### #37 — Python 补丁脚本重复应用
**现象**: Python 脚本的 `str.replace()` marker 匹配了两次（第一次是旧补丁残留，第二次是新补丁），导致代码块重复出现，`const CODE_MODE_PROMPT` 被声明两次，TypeScript 编译报错
**根因**: 旧补丁没有完全清理干净，marker 仍然存在于文件中，第二次替换又匹配了一次
**解决**: `git checkout` 恢复文件后重新用 Python 干净应用补丁
**预防**: 补丁脚本应该在替换前检查目标是否已经被替换过（如检查 `CODE_MODE_PROMPT` 是否已存在）

---

### #38 — DTS 类型错误阻塞完整构建
**现象**: `pnpm build` 在 `build:plugin-sdk:dts` 阶段报 4 个 TS 错误（compaction.ts / compaction-safeguard.ts / model-discovery.ts / skills/config.ts），导致整个构建失败
**根因**: 这些是 elysiaclaw 与 pi-mono 0.64 API 的预存类型不匹配，不是我们引入的
**解决**: 绕过 `pnpm build`，直接运行 `node scripts/tsdown-build.mjs` + 手动跑剩余构建步骤
**预防**: 考虑修复这 4 个类型错误，或在 `build:plugin-sdk:dts` 增加 `--skipLibCheck`

---

### #39 — elysiaclaw 自建 system prompt 不使用 agent-session 的 _buildSystemPrompt
**现象**: 在 agent-session.ts 的 `_buildSystemPrompt` 里注入 CODE MODE ACTIVE 段，但 Bot 模式下 LLM 仍然以普通模式回复
**根因**: elysiaclaw 的 `attempt.ts` 自己通过 `createSystemPromptOverride()` 构建 system prompt，然后用 `applySystemPromptOverrideToSession()` 覆盖 agent session 的 system prompt。agent session 的 `_buildSystemPrompt` 返回值被覆盖掉了
**解决**: 在 `attempt.ts` 里直接检测 `/code` 和 `/exit`，注入 code mode system prompt 到 `systemPromptText`，同时改变 `effectivePrompt` 为友好消息
**关键文件**: `elysiaclaw/src/agents/pi-embedded-runner/run/attempt.ts`
**预防**: 理解 Bot 模式和 TUI 模式的 system prompt 构建路径不同（Pitfall #25 的延伸）

---

### #40 — OpenRouter→阿里云路由劫持
**现象**: OpenRouter 免费模型请求被静默路由到阿里云 Bailian 端点，响应头显示 provider 不一致，部分工具调用格式不兼容
**根因**: OpenRouter 对某些免费模型启用了透明代理，实际执行模型与请求模型不同
**解决**: 临时规避——在 `elysiaclaw.json` 中对受影响模型添加 `baseUrl` 直连阿里云，绕过 OpenRouter 路由层
**状态**: 根因未修，规避方案稳定运行中
**影响文件**: `~/.elysiaclaw/elysiaclaw.json`（agents 段 baseUrl 配置）

---

### #41 — config.yaml 结构性损坏导致 gateway 启动报错
**现象**: gateway 启动时报 schema 校验错误，字段缺失或类型不匹配
**根因**: 手动编辑 config.yaml 时引入了结构错误（嵌套层级错误或非法字段值）
**解决**: 用 `python3 -c "import yaml; print(yaml.safe_load(open('/home/elysia/.elysiaclaw/config.yaml').read()))"` 验证，对照错误信息逐字段修正
**预防**: deploy.sh Guard 1 已加入 config.yaml 校验；修改 YAML 后必须先验证再重启

---

### #42 — Telegram inline keyboard / 富文本渲染限制
**现象**: 某些 Markdown 格式（如嵌套列表、代码块内特殊字符）在 Telegram 消息中渲染异常或被截断
**根因**: Telegram Bot API 的 MarkdownV2 模式对特殊字符（`_`, `*`, `[`, `]` 等）要求严格转义，未转义时消息发送失败
**解决**: 使用 HTML 模式替代 MarkdownV2，或在发送前对特殊字符做完整转义
**影响**: 影响 Bot 模式下所有富文本回复的格式化逻辑

---

### #49 — pnpm install 污染 npm workspace 依赖树
**现象**: 在 pi-mono 根目录运行 `pnpm install` 后，`npm run build` 报大量 `@mariozechner/pi-agent-core@0.30.2` 相关类型错误，而正确版本是 0.64.0
**根因**: pnpm 从 registry 拉取了旧版本放进 `node_modules/.pnpm/`，pods 包的 TypeScript 解析器找到了错误版本
**解决**: `rm -rf node_modules && npm install` — 清掉 pnpm 引入的垃圾，恢复 npm workspace
**预防**: pi-mono 的包管理器是 npm，**永远不要在根目录运行 pnpm install**；新增依赖用 `npm install --workspace=packages/coding-agent <pkg>`

---
### #43 — pi-coding-agent package.json 版本号未同步（原 #37 重编号）
**现象**: deploy.sh 替换了 dist 目录但未更新 package.json，导致 package.json 仍显示 0.58.0
**解决**: 2026-04-07 手动更新 package.json 版本号为 0.64.0
**预防**: 考虑在 deploy.sh 中增加同步 package.json 版本号的步骤

---

### #44 — elysiaclaw status 显示 Tailscale off 但实际运行中（原 #38 重编号）
**现象**: `elysiaclaw status` 显示 "Tailscale off"，但 `tailscale status` 确认 Tailscale active (IP 100.111.4.5)
**原因**: elysiaclaw status 的 Tailscale 检测逻辑可能未正确识别运行状态
**影响**: 文档记录需以 `tailscale status` 实际输出为准

---

### #45 — Session 文件存储在 tmp-pi-runtime-events 子目录（原 #39 重编号）
**现象**: `~/.pi/agent/sessions/` 下的 .jsonl 文件位于 `--tmp-pi-runtime-events-*` 子目录中
**说明**: 这是 pi-mono 的正常行为，session 文件按运行时事件目录组织
**影响**: 查找 session 文件时需要递归搜索 `find ~/.pi/agent/sessions/ -name "*.jsonl"`

---

### #46 — allTools/createAllTools 缺少 worktree 和 model_speed_probe 工具
**现象**: `tools/index.ts` 中 `enterWorktreeTool`、`exitWorktreeTool`、`modelSpeedProbeTool` 有 re-export 但从未加入 `allTools` 对象和 `createAllTools()` 返回值。`createAllTools()` 还额外缺少 `undoActionTool` 和 `fileHistoryListTool`。
**影响**: 这些工具在 TUI 模式下通过 `allTools` 调用时不可用；通过 `createAllTools(cwd)` 创建的工具集不完整
**根因**: 坑 #16/#23 的翻版 — 手动维护工具注册列表遗漏
**解决**: 2026-04-05 架构优化 Sprint 中修复，allTools +3、createAllTools +5
**预防**: deploy.sh 已加装 Guard 3（工具注册一致性检查）

---

### #47 — src/index.ts 缺少 undoAction/fileHistoryList/modelSpeedProbe re-export
**现象**: `tools/index.ts` 已导出 `modelSpeedProbeTool/Definition`、`undoActionTool/Definition`、`fileHistoryListTool/Definition`，但 `src/index.ts`（Master tool export）未 re-export
**影响**: 外部消费者（如 elysiaclaw.mjs bundle）无法通过 `@mariozechner/pi-coding-agent` 包导入这三对工具
**解决**: 2026-04-05 架构优化 Sprint 中在 src/index.ts 追加 6 个 re-export
**预防**: 同 #46

---

### #48 — config.yaml gateway.mode 仍为非法值 "lan"
**现象**: 坑 #31 已明确记录 `gateway.mode` 只允许 `local` 或 `remote`，但 config.yaml 实际仍为 `lan`
**影响**: gateway 行为可能不可预期
**解决**: 2026-04-05 架构优化 Sprint 中修正为 `local`
**预防**: deploy.sh Guard 1 已加入 config.yaml mode 值校验

---


### #59 — Python str.replace Tab vs 空格不匹配
**现象**: Python 脚本用空格字符串做 `str.replace()`，但目标 TypeScript 文件用 Tab 缩进，导致匹配失败
**根因**: Python 字面量 `"    model_speed_probe"` 无法匹配文件中的 `"\tmodel_speed_probe"`
**解决**: 用 `cat -A` 检查实际字符（Tab 显示为 `^I`），替换时使用 `\t` 而非空格
**预防**: 写 Python 补丁脚本前先 `cat -A <file> | grep <pattern>` 确认缩进方式

## 快速查找索引

| 关键词 | 坑号 |
|---|---|
| heredoc / 文件写入 | #1, #20 |
| sed / 字符串替换 | #2 |
| TypeScript 类型错误 | #24, #38 |
| index.ts 导出 | #16, #23, #46, #47 |
| bot 模式 / bundle | #25, #17, #39 |
| YAML 配置 | #30, #31, #32, #48 |
| patch / deploy | #11, #22b, #29, #36, #37 |
| symlink | #29, #35 |
| 字段名猜测 | #26, #27 |
| 包名迁移 | #29, #33, #34, #35, #36 |
| system prompt 构建 | #39 |
| code mode | #39 |
| 版本号 / 一致性 | #43 |
| Tailscale 状态 | #44 |
| session 文件路径 | #45 |
| 工具注册遗漏 | #46, #47 |
| pnpm/npm 混用 | #49, #52 |
| 工具注册四层遗漏 | #51 |
| elysiaclaw 构建部署 | #53 |
| Bot/TUI 工具路径 | #54 |
| web_search API 密钥 | #55 |
| 新工具 ToolDefinition 接口 | #50 |
| pnpm/npm 混用 | #49, #52 |
| 工具注册四层遗漏 | #51 |
| elysiaclaw 构建部署 | #53 |
| Bot/TUI 工具路径 | #54 |
| web_search API 密钥 | #55 |
| OpenRouter 路由 | #40 |
| 配置文件损坏 | #41 |
| Telegram UI | #42 |

---


### #49 — Context Entropy in Dialog-based Coding
**Phenomenon**: Frequent "Modify-Generate" cycles lead to hidden state accumulation in the context window.
**Root Cause**: AI referencing outdated variable names or logic patterns from previous turns.
**Prevention**: Every 5-10 turns, perform a "Context Reset" by summarizing progress and starting a fresh session.

### #50 — The "Vibe" vs. "Environment" Discrepancy
**Phenomenon**: Code that works in Claude Artifacts/WebContainers fails in the real `elysiaserver`.
**Root Cause**: Permission gates, environment variables, or specific Python async loops (OpenClaw) not being simulated in the browser.
**Prevention**: Always treat Web-based output as "Prototype Only". Final validation must happen via `npm run build` and `deploy.sh`.

### #51 — elysiaclaw tool registration four-layer gap
**Phenomenon**: pi-coding-agent tools not available in Bot mode
**Root Cause**: Tool needs four layers correct: pi-coding-agent define, pi-tools.ts import, tool-catalog.ts define, tools.allow
**Missing**: grep, find, ls, plan_mode, todo_write, worktree, file_history, model_speed_probe
**Note**: code_mode (enter_code_mode/exit_code_mode) 已从缺失列表中移除 — 2026-06-05 Code Mode 已废弃，由 delegate_code_task 替代。
**Fix**: Check all four layers when adding tools

### #52 — pnpm/npm mix causes dependency pollution
**Phenomenon**: Running pnpm install in pi-mono root corrupts npm workspace
**Fix**: rm -rf node_modules && npm install
**Prevention**: pi-mono uses npm, elysiaclaw uses pnpm, never mix

### #53 — elysiaclaw build needs manual deploy
**Phenomenon**: pnpm build in elysiaclaw does not update global install
**Fix**: cp -r dist/* to ~/.nvm/.../elysiaclaw/dist/
**Prevention**: deploy.sh only handles pi-coding-agent

### #54 — Bot vs TUI tool path difference
**Phenomenon**: Tools available in TUI but not Bot (or vice versa)
**Root Cause**: TUI uses createPiCodingTools, Bot uses createElysiaClawCodingTools
**Fix**: Check both paths when adding tools

### #55 — web_search needs API key
**Phenomenon**: web_search registered but fails with missing API key
**Fix**: Add BRAVE_API_KEY to ~/.elysiaclaw/.env or use OPENROUTER_API_KEY

### #56 — Pure interface re-export breaks ESM runtime
**现象**: `export { LearningData, TaskPattern } from "./session-learner.js"` 在 tsx 运行时抛出 `SyntaxError: does not provide an export named 'LearningData'`
**根因**: `LearningData` 和 `TaskPattern` 是 `interface` (纯类型)，ESM 模块系统不支持值导出语法重新导出纯类型
**解决**: 用 `type` 修饰: `export { type LearningData, type TaskPattern } from "..."`
**影响文件**: `src/index.ts` 中所有 re-export 行都需要检查

### #57 — CLAUDE.md lazy-load breaks extension steering messages
**现象**: `sendUserMessage` with `deliverAs: "steer"` 测试失败，`getSteeringMessages()` 不包含预期文本
**根因**: `prompt()` 中的 CLAUDE.md 加载会 prepend `<project-memory>...</project-memory>` 到用户文本，导致 steering 消息文本与测试预期不匹配
**解决**: 对 `options.source === "extension"` 的消息跳过 CLAUDE.md 加载
**预防**: 扩展来源的消息应该保持原始文本不变

### #58 — ToolDefinition interface extension requires type cast for AgentTool compatibility
**现象**: 在 `wrapToolDefinition` 返回值上添加新字段 (如 `isEnabled`) 报 TS2353: `isEnabled does not exist in type 'AgentTool'`
**根因**: `wrapToolDefinition` 返回类型是 `AgentTool`，该类型不包含新字段
**解决**: 用 `as AgentTool & { 新字段... }` cast 返回值
**注意**: 这是一种 workaround，理想方案是让 AgentCore 的 AgentTool 类型也包含这些字段

---

### #60 — heredoc + Python 缩进在 bash 中失效
**现象**: 用 `cat > /tmp/x.py << 'EOF'` 创建 Python 脚本时，缩进被 bash 吃掉或截断
**根因**: heredoc 的 Tab 和空格处理与 Python 语法冲突
**解决**: 用 base64 编码写文件，或直接用 `sed -i` 按行号操作
**预防**: 涉及多行 Python 代码时，优先用 `sed` 行号操作，避免 heredoc

### #61 — sed 行号操作的陷阱：行号会变
**现象**: 用 `sed -i '311s/...'` 修复缩进后，后续行号全部偏移，继续用原行号操作会改错行
**根因**: 每次 `sed -i` 都可能改变行号（插入/删除行）
**解决**: 一次性完成所有行号操作；或用字符串替换而非行号
**预防**: 修改前先确认行号；批量操作用 `sed -i '311,316s/...'` 一次性处理

### #62 — GrepTool 修改过程中的低效循环
**现象**: 5 处修改花了大量时间，反复修复缩进，一个 block 改了 10+ 次
**根因**: 1) heredoc 截断 2) Tab/空格混用 3) sed 行号偏移 4) bash 转义冲突
**解决**: 最终用 `sed -i` 按行号一次性修复
**预防**:
- 写多行修改脚本时，先用 `sed -n 'X,Yp' file | cat -A` 确认缩进方式
- 一次性用 `sed -i 'X,Ys/pattern/replacement/'` 完成
- 避免在 bash 里写复杂 Python（heredoc + 缩进 = 灾难）

---

### #63 -- DTS 类型错误数量在增加而非减少
**现象**: `pnpm build` 在 `build:plugin-sdk:dts` 阶段报错。2026-04-07 记录为 4 个错误，2026-04-10 确认为 6 个错误（compaction.ts / attempt.ts / compaction-safeguard.ts / model-discovery.ts / skills/config.ts + 新增 1 个）
**根因**: elysiaclaw 与 pi-mono 0.64 API 的预存类型不匹配，每次新增代码可能引入新的类型冲突
**当前状态**: 绕过方式 `node scripts/tsdown-build.mjs` + 手动步骤（PITFALLS #38）
**风险**: 绕过方式不应成为常态。错误数量在增加说明类型系统正在漂移，继续绕过会导致最终无法修复
**建议**: 专项安排一个 Sprint 修复全部 6 个 DTS 错误，目标是 `pnpm build` 全流程通过

---

### #64 -- Code Mode Phase 0 假完成风险（已废弃）

**状态**: 2026-06-05 Code Mode 已废弃，此坑成为历史记录。

---

## 快速查找索引（续）

| 关键词 | 坑号 |
|---|---|
| DTS 类型错误恶化 | #63 |
| 假完成 / Definition of Done | #64 |
| pnpm build 阻塞 | #38, #63 |
| delegate_code_task / 子代理分发 | #64 |
| tsdown tree-shake | #68 |
| elysiaclaw dist 部署遗漏 | #69 |

---


### #65 — createDelegateCodeTaskTool 未注册到工具数组
**现象**: `delegate_code_task` 在 tool-catalog.ts 中有定义，elysiaclaw-tools.ts 有 import，但 Gateway 启动日志始终报 `tools.allow allowlist contains unknown entries (delegate_code_task)`
**根因**: `createElysiaClawTools()` 函数中 `tools` 数组从未调用 `createDelegateCodeTaskTool()`。import 了函数但没有使用它。
**解决**: 在 `elysiaclaw-tools.ts` 的 `tools` 数组中添加 `createDelegateCodeTaskTool({...})` 调用
**预防**: 新增工具后必须确认：(1) import 存在 (2) 在 `createElysiaClawTools` 的 `tools` 数组中有调用 (3) deploy 后 `grep "unknown entries"` 日志为空

### #66 — 子代理 label 重名冲突
**现象**: `sessions.patch` 返回 `errorCode=INVALID_REQUEST errorMessage=label already in use: code-analysis`
**根因**: 前一次子代理 spawn 失败但 label `code-analysis` 已被注册，后续 spawn 使用同一 label 时冲突
**解决**: 子代理 label 应加唯一后缀（如 UUID 前 8 位），或等待 Gateway 自动清理
**预防**: 考虑在 delegate-code-task.ts 中为 label 加随机后缀

### #67 — 子代理继承主 agent 模型（不可用时全部失败）
**现象**: 主 agent 切换到不可用模型后，子代理 LLM 调用全部返回 `400 Provider returned error`
**根因**: `spawnSubagentDirect` 默认继承主 agent 模型，没有独立 model 参数
**解决**: 在 delegate_code_task schema 中新增 `model` 可选参数，传递给 `spawnSubagentDirect`
**预防**: 当主模型不稳定时，用户可在调用时指定子代理模型

### #68 — tsdown tree-shake 误删未识别的动态导入函数
**现象**: `createDelegateCodeTaskTool` 在源码中存在 import + 调用，tool-catalog.ts 中有 `delegate_code_task` 定义，但 Gateway 启动日志始终报 `tools.allow allowlist contains unknown entries (delegate_code_task)`
**根因**: tsdown (esbuild) 在构建 elysiaclaw 时，将 `createDelegateCodeTaskTool` 函数声明 tree-shake 掉了——函数体未出现在任何 dist chunk 中，但 tool-catalog 的字符串元数据保留了下来。结果是 catalog 注册了名字，runtime 却找不到工具对象。
**排查过程**:
1. `grep -rl "delegate_code_task" dist/` → 找到 reply chunk（6 处）
2. `grep "createDelegateCodeTaskTool" dist/reply-*.js` → 空（函数体丢失）
3. 结论：tsdown tree-shake 误删
**解决**: 重新执行 `node scripts/tsdown-build.mjs` + `cp -r dist/*` 到全局 + `gateway restart`
**预防**: deploy.sh 中 elysiaclaw 构建步骤应验证关键工具函数是否被打包

---

### #69 — elysiaclaw dist 部署遗漏（deploy.sh 不覆盖 elysiaclaw 全局安装）
**现象**: elysiaclaw 源码已修改并本地构建成功，但全局安装的 dist 未更新，Gateway 运行的是旧产物
**根因**: `deploy.sh` 只负责 pi-mono 框架层的 4 个包部署到 `node_modules/@mariozechner/`，不负责 elysiaclaw dist 部署到全局（PITFALLS #53 已记录但容易遗忘）
**解决**: 构建后手动 `cp -r dist/* ~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/dist/`
**预防**: 高频警告中增加"elysiaclaw 构建后必须手动部署到全局"

*记录截至 2026-06-05，坑 #67。下次遇到新坑从 #68 开始追加。*


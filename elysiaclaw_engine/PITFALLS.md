# ElysiaClaw — 踩坑记录 (Pitfalls & Lessons)

> 本文档记录项目开发过程中遇到的所有坑点及解决方案。
> 每次遇到新坑必须追加记录。AI 协作者在执行相关操作前请先检索本文档。

---

## 高频警告（必读）

在执行任何操作前，先过这 11 条：

1. **写文件用 Python**，不要用 heredoc（坑 #1）；含花括号/反引号的代码走 Write→Bash 两段式（坑 #79）
2. **字符串替换用 Python `str.replace()`**，不要用 sed（坑 #2）
3. **新增工具必须检查 `src/index.ts` 导出**（坑 #16 / #23）
4. **deploy.sh 后验证 gateway 能正常响应**（坑 #22b）
5. **YAML 缩进错误会静默破坏 gateway**（坑 #30）
6. **功能完成必须 Definition of Done 全部勾选**（坑 #64）
7. **大文件（>2000 行 / >25K 字符）分段读取**，不要假设一次 read 能拿全部（坑 #78）
8. **工具调用失败 → 先报告错误再重试**，最多 2 次；不静默卡死（坑 #80）
9. **Telegram 超长回复（>3000 字符）写文件发路径**，不直接发送（坑 #81）
10. **wrapToolDefinition 必须逐字段传播**，不能只靠 `as` 类型断言——扩展字段会在运行时变成 `undefined`（坑 #82）
11. **测试 `describe()` 回调不准捕获 `beforeEach` 变量**——使用 `const t = foo` 在 `it()` 内会拿到 `undefined`（坑 #84）

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
| 大文件读取 / read 限制 | #78 |
| heredoc f-string / 花括号 | #79 |
| agent 卡死 / 重试循环 | #80 |
| Telegram 消息截断 / 超长 | #81 |
| session-rotation 孤儿段 | #87 |
| completeToolCall 同名匹配 | #88 |
| handoff-inject 轮换后查找失败 | #89 |
| rotate-session-tool 错误处理不一致 | #90 |
| executeRotation 死代码 + MacroIndex 永不产出 | #91 |
| buildAndStoreDualTrackIndex 覆盖抹掉 macro | #92 |
| rotate_session 违反 AgentTool 框架契约 | #93 |
| attempt.ts inputClassification 重复声明 | #94 |

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
| deploy.sh extensions 未同步 | #71 |
| plugin allowlist 时序误报 | #72 |
| Read 大文件截断 | #78 |
| heredoc + f-string 花括号冲突 | #79 |
| agent 工具失败静默卡死 | #80 |
| Telegram 超长回复截断 | #81 |

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

### #70 — Telegram tool lane 因 minInitialChars 防抖导致短标签无法显示
**现象**: 工具调用流式输出偶尔出现但不显著——工具标签（如 "📖 Read" 7字符）显示后立即消失，实际执行命令未输出
**根因**: `createDraftLane` 对所有 lane 统一使用 `DRAFT_MIN_INITIAL_CHARS = 30` 字符防抖阈值。tool lane 的短标签达不到阈值，`sendOrEditStreamMessage` 中 `renderedText.length < minInitialChars` 判定导致初始发送被跳过。后续 `onToolResult` 推送较长的工具摘要才触发发送，但此时 `onAssistantMessageStart` 即将清理 tool lane，造成"闪现然后消失"
**解决**: `createDraftLane` 中对 `laneName === "tool"` 设置 `minInitialChars: undefined`，禁用防抖，短标签即时发出
**预防**: Draft lane 的新消费者应检查 minInitialChars 是否适合其内容长度

### #71 — deploy.sh 未同步 extensions 导致 plugin 代码陈旧（根因级）
**现象**: 源码中 `extensions/memory-core/index.ts` 已更新为新 API（`ElysiaClawPluginApi`），但 Agent session 中 `memory_search` 工具不可用。Gateway API `/tools/invoke` 返回 `"Tool not available: memory_search"`
**诊断链**: 源码验证（T4-T6 代码正确）→ CLI 验证（memory status ✅）→ Gateway API（❌）→ 日志（group:memory unknown）→ session JSONL（"Tool not found"）→ plugin 加载链追踪 → **部署版本对比：全局 `node_modules/elysiaclaw/extensions/memory-core/index.ts` 仍是 4 月旧版（`OpenClawPluginApi` 类型）**
**根因**: `deploy.sh` 只负责 pi-mono 框架层 4 个包 + elysiaclaw dist 部署，**从未同步 `extensions/` 目录**。Plugin 源码通过 jiti 直接加载 `.ts` 文件，旧版 plugin factory 使用错误的 API 类型导致 `registerTool` 回调返回 null，工具静默缺失。
**解决**: deploy.sh 新增 Step 9 — 遍历 `elysiaclaw/extensions/*/` 下每个子目录，`rm -rf` 目标后 `cp -r` 同步到全局 `node_modules/elysiaclaw/extensions/`。同时新增 Guard 3（dist 完整性校验）和 Guard 5（E2E 验证）防止复发。
**预防**: 
1. 每次修改 `extensions/` 下的 plugin 源码后，必须执行 `./deploy.sh` 或手动同步 extensions
2. deploy.sh Guard 5 的 E2E 验证会在 Gateway 重启后实际调用 `memory_search`，确保 plugin 工具可用
3. 考虑在 Guard 3 中增加 extensions 文件 hash 对比（当前只检查 dist 内容模式）

### #72 — stripPluginOnlyAllowlist 时序导致 group:memory 误报 unknown
**现象**: Gateway 日志 `tools.allow allowlist contains unknown entries (group:memory). These entries won't match any tool unless the plugin is enabled.`
**根因**: `stripPluginOnlyAllowlist()` 在 plugin 工具尚未注册时运行，`group:memory` 展开依赖 plugin 成功注册工具。plugin 注册成功后工具确实可用。
**影响**: Cosmetic only — 不影响功能。`memory_search` 和 `memory_get` 工具正常注册并可用。
**状态**: 未修复，归类为 resolution order 问题。暂不处理。

### #73 — 用户画像 identity 空对象恒触发 changed（污染 + 无谓写库）
**现象**: 序 1-7 测试加固时，针对纯闲聊消息（如"嗯嗯好的"，无任何可提取信息）断言 `updateUserModel` 返回 `changed=false`，实际返回 `changed=true`。
**根因**: `heuristicExtract()` 初始化恒返回 `identity: {}`（空对象）。`updateUserModel` 的 identity 合并判定用 `JSON.stringify(newIdentity) !== JSON.stringify(model.identity)`——新用户 `model.identity` 为 `undefined`，`JSON.stringify({})` = `"{}"`，`JSON.stringify(undefined)` = `undefined`，`"{}" !== undefined` **恒为真** → 每条无信息消息都把 `identity` 从 `undefined` 写成 `{}` 并标记 `changed=true`。
**影响**: 运行时持续危害——① 每条闲聊触发 `saveModel` 无谓写 `user-model.db`；② `identity` 字段被污染成空对象 `{}`，破坏"未知身份"语义。
**解决**: identity 合并前加 `Object.keys(newIdentity).length > 0` 守卫（`user-model-updater.ts`），覆盖 heuristic 和 LLM 两条路径。空对象不再触发变更。
**预防**: 任何"读旧值 → 合并 → diff 判变更"逻辑，diff 前必须排除"语义为空但结构非空"的中间态（`{}`、`[]`、`{k:undefined}`）。`stringify` diff 对 `{}` vs `undefined` 不安全。
**测试**: `src/user-model/user-model.test.ts` 锁定 `changed=false` 闲聊路径。

### #74 — L0 工具结果驱逐摘要：非文本 block 第 3 个同类型重复计数
**现象**: `buildToolResultSummary` 对含 3 个同类型非文本 block（如 3 张 image）的工具结果，摘要产出 `+image×2,image` 而非 `+image×3`。
**根因**: 旧逻辑用数组 + `includes(tag)` 判存在：第 1 次 push `image`；第 2 次命中 else → `image×2`；第 3 次 `includes("image")` 因数组里是 `"image×2"` 返回 false → 错误地再次 push `image`，产生重复条目。
**影响**: 仅摘要标签不准（cosmetic），不影响驱逐功能与 token 释放。
**解决**: 改用 `Map<string,number>` 计数，最后 `n>1 ? tag×n : tag` 格式化（`multi-layer.ts`）。
**预防**: "去重 + 计数"场景直接用 `Map`，不要在同一数组里混存裸 tag 和 `tag×n` 两种形态。
**测试**: `packages/coding-agent/test/multi-layer.test.ts` 加回归断言 `+image×3` 且 `not.toContain("image×2,image")`。

### #75 — 输入分类器技术词检测误用字符集（`[词|词]`）
**现象**: 群聊短消息技术词检测 `/[代码|编译|配置|...|命令]/.test(text)`，对"任务完成"（含"务"）、"密码忘了"（含"码"）等闲聊误判为"含技术词"，压制了 chat 判定。
**根因**: `[...]` 是**字符集**不是分组——匹配方括号内任意单个字符，`|` 被当字面量。`[代码|编译]` 等价于"匹配 代/码/编/译/| 任一字符"，远比预期宽松。
**影响**: 群聊短闲聊被错误地排除出 chat 轨，落入 task（方向与"偏向 task"设计一致，故此前未暴露，危害低但语义错误）。
**解决**: 改为 alternation `/代码|编译|配置|...|命令/`（`input-classifier.ts:201`）。
**预防**: 正则里"任一词组"用 `(a|b|c)` 或裸 alternation `a|b|c`，绝不用 `[a|b|c]`。中文场景尤其隐蔽——字符集恰好能匹配单字，碰巧"半对"，掩盖 bug。
**测试**: `src/context-engine/input-classifier.test.ts` BUG #2 regression 块。

**未修待定**: `input-classifier.ts:224` 路径检测 `/[./]\w{2,}/` 中 `\w` 不匹配中文，且 `text.includes("/")` 让"和/或"误判 task。over-broad 但方向与设计一致，已写测试锁定当前行为，未改（收紧需产品决策）。

### #76 — deploy.sh Step 9 extensions 同步丢弃子目录，且旧版 manifest 名未适配
**现象**: deploy.sh 运行后 `elysiaclaw gateway restart` 失败：① `plugin manifest not found: extensions/acpx/elysiaclaw.plugin.json`（40 个 plugin 全部报错）；② telegram plugin 加载失败 `Cannot find module './src/channel.js'`
**根因 A — manifest 命名**: 各 extension 源目录中 manifest 文件名为 `openclaw.plugin.json`（继承自 OpenClaw 上游），但 gateway 校验器期望 `elysiaclaw.plugin.json`。deploy.sh Step 9 原样同步，旧名跟着来，gateway 找不到。
**根因 B — 子目录丢弃**: Step 9 用 `find "$ext_dir" -maxdepth 1 -type f` 只复制顶层文件，忽略子目录。telegram extension 的 `src/channel.ts` 在 `telegram/src/` 子目录下，未同步到全局，jiti 加载时找不到 `./src/channel.js`。
**影响**: 所有 plugin 加载失败，gateway 无法启动（config invalid）。
**解决**:
1. 源目录批量 `cp openclaw.plugin.json elysiaclaw.plugin.json`（40 个 extension）
2. 手动 `cp -r elysiaclaw/extensions/telegram/src $GLOBAL/extensions/telegram/src`
3. deploy.sh Step 9 修复：① 增加子目录递归复制（排除 node_modules/skills/dist）；② 自动检测并复制 `elysiaclaw.plugin.json`（当全局只有 `openclaw.plugin.json` 时）
**预防**: extension 子目录同步必须显式处理；manifest 命名不一致是 fork 遗留历史债，在 deploy.sh 中用自动适配而非手动修。

### #77 — deploy.sh Step 9 子目录递归在「无子目录 extension」上 glob 字面量 + set -e 中止
**现象**: 部署运行到 Step 9 报 `cp: cannot stat '.../extensions/copilot-proxy/*/': No such file or directory`，`set -e` 立即中止整个部署，gateway 未重启（停在 Step 11 之前，线上仍是旧版本）。
**根因**: #76 修复时新增的子目录递归 `for sub_dir in "$ext_dir"*/`，当某 extension **没有任何子目录**（纯文件插件，如 copilot-proxy）时，glob `"$ext_dir"*/` 无匹配；bash 默认（未开 nullglob）保留字面量 `*/`，`cp -r '.../copilot-proxy/*/' ...` 失败。脚本 `set -e` 把单个 cp 失败升级为整个部署中止。
**影响**: 部署在第一个无子目录的纯文件 extension 处硬中断。Steps 1-8（框架+应用 dist）已生效，但 extensions 未全同步、gateway 未重启——半完成状态，比干净失败更隐蔽。
**解决**: 子目录循环体首行加目录存在守卫 `[ -d "$sub_dir" ] || continue`，字面 `*/`（非真目录）被跳过。
**预防**: `set -e` 脚本里任何 `for x in <glob>*/` 必须配 `[ -d "$x" ] || continue` 守卫，或 `shopt -s nullglob`。教训：修一个坑（#76 子目录丢弃）引入的边界（零子目录）没被覆盖——子目录处理的修复必须同时考虑"零子目录"和"多子目录"两端。

### #78 — Read 工具大文件截断（单次 ~25K 字符限制）

**现象**: 单次 `read` 工具返回约 25,000 字符后截断。大文件（如 PITFALLS.md 自身 25,722 字符）末尾内容缺失，agent 基于不完整信息做决策。

**根因**: Read 工具有单次字符上限（~25K），超过部分不返回，无截断警告。

**解决**: 
1. 读文件前先 `bash wc -l <file>` 确认行数
2. 超过 1000 行的文件用 `offset` + `limit` 分两段读：`offset: 0, limit: 1000` → `offset: 1000`
3. 或在 Bash 中用 `head -n N` / `tail -n +N` 精准定位后再 Read

**预防**: 
- 处理引擎文档、大配置文件、长源码文件时默认分段读取
- 不要假设一次 read 能拿到全部内容——读完后确认最后几行是否与预期一致
- 关键文件用 `bash wc -c` 先看字节数，超过 20K 直接分段

---

### #79 — Bash heredoc 内 Python f-string / 模板字面量花括号冲突

**现象**: `cat > /tmp/x.py << 'EOF'` 中 Python f-string 的 `{variable}` 被 bash 解析为变量展开（即使加了单引号 EOF），或 TypeScript 模板字面量 `${expr}` 被 bash 吃掉。

**根因**: heredoc 的单引号 EOF (`<< 'EOF'`) 能阻止 `$` 展开，但花括号 `{}` 在某些 bash 版本/场景下仍被解析。且 heredoc 内的缩进、特殊字符交互极为脆弱（见坑 #1, #20, #60, #62）。

**解决**: 
1. **永远用 Write 工具先写入脚本文件**，再用 Bash 工具执行：`python3 /tmp/script.py`
2. 不在 Bash 工具的 inline 脚本中嵌入含 `{}` `$()` `` ` `` 的代码
3. 如果必须 inline，用 base64 编码：`echo "BASE64" | base64 -d > /tmp/x.py && python3 /tmp/x.py`

**两步式模板**：
```
Step 1: Write /tmp/fix.py (完整 Python 脚本，含 str.replace/f-string)
Step 2: Bash: python3 /tmp/fix.py
```

**预防**: 代码写入统一走 Write 工具 → Bash 执行两段式，彻底消除 heredoc。

---

### #80 — Agent 工具调用失败后静默卡死（重试循环 + 无错误报告）

**现象**: Write/Edit/Bash 调用失败时（权限不足、路径不存在、语法错误），agent 不向用户报告错误，陷入内部重试循环，用户端完全静默（"agent 消失了"）。

**根因**: 
1. 工具调用失败后 agent 没有立即向用户报告错误，而是尝试用不同参数重试
2. 多次重试失败后上下文压缩触发，压缩后丢失"正在执行中"的状态标记
3. 错误信息只在 agent 内部循环，不通过 reply/emit 暴露给用户

**解决**: 
1. **任何工具失败后第一步 → 向用户明确报告错误**（哪个工具、什么错误、打算怎么处理）
2. **最多重试 2 次**，第 3 次失败 → 放弃并向用户说明原因
3. **长操作前 emit 进度标记**："正在处理大文件..." 或 "正在修改 N 个文件..."
4. **上下文压缩边界处检查未完成任务**：如有未确认完成的写操作，先报告状态再继续

**预防**: 
- Golden Rule: "工具失败先报告，后重试，最多 2 次"
- 重试前确认失败原因已改变（路径修正、权限确认等），不要用相同参数盲目重试
- 上下文压缩前写入持久化状态标记（如 task metadata），防止压缩后失忆

---

### #81 — Telegram 回复超长截断（>4000 字符）

**现象**: 超过约 4000 字符的 Telegram 消息被 API 拒绝或截断，用户只看到不完整的回复。

**根因**: Telegram Bot API 有消息长度限制（MarkdownV2 模式下约 4096 字符），超长消息发送失败。

**解决**: 
1. 回复前估算字符数（`estimateTextTokens` 或手动估算：中文 ~1.5 字符/token，英文 ~4 字符/token）
2. 超过 3000 字符 → 写入 `/tmp/output.md`，Telegram 发送文件路径 + 摘要
3. 代码超过 30 行 → 一律发文件不直发（已有规则，需强制执行）

**预防**: 
- CLAUDE.md 已约定"代码超过 30 行 → 写入 /tmp/output.md 然后发文件路径"
- 扩展为"回复总字符数 >3000 → 写文件发路径"
- 在发送前做字符计数守卫，不要依赖 Telegram API 的错误反馈

---

### #82 — wrapToolDefinition 用 `as` 强制断言但不传播扩展字段

**现象**: bash/grep 工具的 `isConcurrencySafe()`、`isReadOnly()`、`isDestructive()` 在运行时返回 `undefined` 而非预期布尔值，`getToolUseSummary()`、`getActivityDescription()`、`toAutoClassifierInput()`、`preparePermissionMatcher()` 为 `undefined`。

**根因**: `wrapToolDefinition()` 将 `ToolDefinition` 包装为 `AgentTool` 时，只传递了核心字段（name/label/description/parameters/prepareArguments/execute），然后用 `as` 强制类型断言声明所有扩展字段——但从未从 `definition` 对象上读取并传播它们。TypeScript 编译器不检查运行时是否存在这些字段。

**解决**: 
```typescript
// ❌ 旧代码：as 断言，字段不传播
return {
  name: definition.name,
  label: definition.label,
  // ...
} as AgentTool<any, TDetails> & {
  isConcurrencySafe: (input: any) => boolean;  // ← 运行时 undefined
  // ...
};

// ✅ 新代码：逐字段检测并传播
const tool = {
  name: definition.name,
  label: definition.label,
  // ...
};
if (definition.isConcurrencySafe !== undefined) tool.isConcurrencySafe = definition.isConcurrencySafe;
if (definition.isReadOnly !== undefined) tool.isReadOnly = definition.isReadOnly;
// ... 共 14 个扩展字段
```

**影响范围**: `createBashTool()`、`createGrepTool()` 及所有通过 `wrapToolDefinition` 包装的 ToolDefinition。能力声明测试（bash ×11, grep ×1）全部失败。

**预防**: 
- 禁止在包装函数中用 `as` 谎报字段存在
- 新增 ToolDefinition 可选字段时，必须同步更新 `wrapToolDefinition` 的传播逻辑
- 编写能力声明测试时，`it()` 内直接引用 `beforeEach` 变量而非在 `describe()` 回调捕获（见坑 #84）

**关联**: 坑 #84（测试变量捕获时序问题：`const t = bash as any` 在 `describe()` 执行时 `bash` 为 `undefined`）

---

### #83 — registerProvider 命令时更新 ModelRegistry 但不刷新活跃 session 模型

**现象**: 在 slash command handler 中调用 `pi.registerProvider("anthropic", { baseUrl: "..." })` 后，`session.model?.baseUrl` 保持旧值不变。测试超时（30000ms）因为 `/use-proxy` slash command 处理后 agent loop 尝试用旧模型发起真实 API 调用。

**根因**: `registerProvider` 确实更新了 `ModelRegistry`（见 `agent-session.ts:2652-2653`），但未触发 session 模型的重新解析。`session.model` 仍指向旧引用。该功能为部分实现——command handler 能修改 registry，但 session 不会感知变化。

**当前状态**: 测试标为 `test.skip` + TODO 注释。功能未完整实现。

**预防**: 
- 实现 command-time provider registration 时，需在 `registerProvider` 后调用 `session.setModel()` 或整个 refresh 链路
- 涉及 session 模型切换的测试必须 mock `streamFn`，否则会发起真实 API 调用导致超时

---

### #84 — `describe()` 回调中捕获 `beforeEach` 变量导致 `undefined`

**现象**: 
```typescript
describe("UI helpers", () => {
  const t = bash as any;  // ← 在这里捕获时 bash 为 undefined（beforeEach 尚未执行）
  it("returns summary", () => {
    expect(t.getToolUseSummary?.({ command: "ls" })).toBe("ls -la");  // TypeError: Cannot read properties of undefined
  });
});
```
而 `capability declarations` 测试组内直接使用 `bash.isConcurrencySafe?.()` 却正常通过，因为它在 `it()` 回调内执行（此时 `beforeEach` 已运行）。

**根因**: `describe()` 回调在测试定义阶段（文件加载时）执行，此时 `bash` 还未被 `beforeEach` 初始化。`it()` 回调在测试执行阶段运行，此时 `beforeEach` 已完成。

**解决**: 要么在 `it()` 内访问 `bash`（`expect((bash as any).getToolUseSummary?.()).toBe(...)`），要么用 `let t; beforeEach(() => { t = bash; })` 晚绑定。

**预防**: 
- 代码审查时标记 `describe()` 回调内的 `const x = someBeforeEachVar` 模式
- 能力声明/helper 方法测试建议统一在 `it()` 内用 `(bash as any).xxx` 直接访问

---

### #85 — models.generated.ts 模型迁移导致测试 provider 断裂

**现象**: 多个测试报 `getModel("anthropic", "claude-sonnet-4-5")` 返回 `undefined`，进而 `No API key found for unknown`。modelOverrides 测试中 `getModelsForProvider(registry, "openrouter")` 找不到 `anthropic/claude-sonnet-4`。

**根因**: `models.generated.ts` 重新生成后模型在 provider 之间迁移：
- `claude-sonnet-4-5` / `claude-sonnet-4-5-thinking` → 从 `anthropic` 迁移到 `google-antigravity`
- `anthropic/claude-sonnet-4` / `anthropic/claude-opus-4` 等前缀模型 → 从 `openrouter` 迁移到 `vercel-ai-gateway`
- anthropic provider 仅剩 `claude-opus-4-6` 和 `claude-sonnet-4-6` 两个模型

测试中硬编码的 provider + modelId 对全部失效。

**解决**: 
- 替换 `getModel("anthropic", "claude-sonnet-4-5")` → `getModel("anthropic", "claude-sonnet-4-6")`（5 个文件）
- 替换 `getModelsForProvider(registry, "openrouter")` → `getModelsForProvider(registry, "vercel-ai-gateway")`（model-registry 测试）
- `model-switch-thinking` 测试中 anthropic 已无非 reasoning 模型，改为 openai 的 `gpt-5.1-codex` + `gpt-5-chat-latest`
- JSON key `vercel-ai-gateway` 含连字符 → 必须引号包裹：`"vercel-ai-gateway"`

**预防**: 
- 测试中的模型引用尽量用动态查找（`registry.find(provider, id)`）而非硬编码 provider 假设
- `models.generated.ts` 重新生成后，运行全量测试确认断裂
- 将模型 ID 写为常量/枚举，统一在测试 helper 中定义

---

---

### #86 — tsgo 全量类型检查 53 错误（非 DTS 生成，是全仓 noEmit）

**现象**: `npx tsgo --noEmit` 在 elysiaclaw 全仓报 53 个类型错误（12 个文件），但 `build:plugin-sdk:dts` 步骤（DTS 生成）单独运行通过。`npm run check` 中的 tsgo 步骤因此阻塞。

**根因**: 7 类不相关错误同时存在：
1. `Skill.source` 缺失（7 文件）— pi-coding-agent@0.58.0 dist 的 `Skill` 接口无 `source` 字段，但 elysiaclaw 运行时设置此字段。`source` 是 elysiaclaw 级扩展（区分 bundled/workspace skill），pi-coding-agent 框架层未定义
2. `redact-snapshot.test.ts`（41 错误）— `ElysiaClawConfig` 字段全部可选（`gateway?`/`channels?`/`models?`），测试直接深层访问 `cfg.gateway.auth.token` 无空值守卫
3. `ModelRegistry` 私有构造函数（1 错误）— `test-helpers.mocks.ts` 的 `MockModelRegistry extends ModelRegistry` 无法继承私有构造函数
4. `compaction` 测试参数序号错误（2 错误）— `generateSummary` 签名加了 `headers` 参数（index 4）后，测试仍用旧序号访问 `call[5]`（现为 `signal` 而非 `customInstructions`）；retry 测试传 `signal` 到 `headers` 位
5. `configure-plan.ts` 变量名拼写错误（1 错误）— `elysiaclawCandidates` → `__elysiaclawCandidates`
6. `skills-status.ts` 类型收缩（1 错误）— `entry.skill.source` 可选但赋值给 `string` 类型字段
7. `Skill` 测试对象缺 `sourceInfo`（4 文件）— 测试创建 fake Skill 对象时未包含必填的 `sourceInfo`

**解决**:
1. pi-coding-agent `skills.ts` 添加 `source?: string` 到 `Skill` 接口 + elysiaclaw `src/types/pi-coding-agent-augment.d.ts` 模块声明合并（框架层源头 + 应用层补丁双保险）
2. `redact-snapshot.test.ts` 4 个调用点改 `const cfg = result.config as typeof snapshot.config`（保留具体类型）
3. `test-helpers.mocks.ts` 加 `as any` 绕过私有构造函数
4. `compaction.identifier-preservation.test.ts` 的 `call[5]` → `call[6]`（`customInstructions` 位置）；`compaction.retry.test.ts` 补充 `undefined` 占 `headers` 位
5. `elysiaclawCandidates` → `__elysiaclawCandidates`
6. `entry.skill.source ?? "unknown"`
7. 4 个测试文件添加 `as unknown as Skill` 类型断言 + `import type { Skill }` 导入

**结果**: `npx tsgo --noEmit` 零错误退出。`npm run check` 不再阻塞。`npm run build` 干净通过。907/955 测试零回归。

**预防**:
- elysiaclaw 扩展框架类型时走模块声明合并（`src/types/`），不要强改 node_modules
- 框架层接口变更后检查调用方参数序号是否失效
- 测试中深层访问可选 config 字段使用 `as typeof snapshot.xxx` 保留具体类型

---

*记录截至 2026-06-07，坑 #86。下次遇到新坑从 #87 开始追加。*

---

### #87 — task-segment-tracker startSegment 不封印旧活跃段致孤儿段
**现象**: `startSegment()` 在已有活跃段时直接覆盖 `activeSegmentId`，旧段永远停留在 `running` 状态但不可访问
**根因**: 缺少对旧活跃段的自动封印逻辑
**解决**: `startSegment` 开头检测旧活跃段，自动封印为 `incomplete` + 写入 `outcome: "auto-sealed: superseded by new segment"`
**预防**: 任何"替换当前活跃引用"的操作都必须处理旧引用的生命周期

### #88 — completeToolCall 按工具名匹配在同名多次调用时只完成第一个
**现象**: `completeToolCall(segmentId, tool, result)` 用 `find(tc => tc.tool === tool && tc.status === "running")` 匹配，同一工具调用两次只完成第一个
**根因**: 按名称匹配而非按索引匹配，无法区分同一工具的多次调用
**解决**: 接口改为 `completeToolCall(segmentId, callIndex, result)`，按数组索引精确定位
**预防**: 当集合中存在重复 key 时，用索引而非 key 查找

### #89 — handoff-inject 轮换后新 sessionKey 无法找到 handoff
**现象**: `resolveHandoffBlockForSession(newSessionKey)` 返回 null，因为 `getByChatId(newSessionKey)` 找不到——轮换后 `activeSessionKey` 已更新但 `chatId` 不变
**根因**: 只用 `getByChatId` 查找，轮换后新 sessionKey 不是 chatId
**解决**: 新增 `listByStatus("active")` 回退查找路径，按 `activeSessionKey` 匹配
**预防**: 轮换场景下 chatId ≠ sessionKey，查找逻辑必须覆盖两种映射

### #90 — rotate-session-tool 错误处理不一致
**现象**: `goal` 缺失时抛 `ToolInputError` 异常，但 `nextStep` 缺失时返回警告文本——两种完整性问题处理方式不同
**根因**: `goal` 校验在 `validateHandoffCompleteness` 之前单独检查，绕过了统一校验
**解决**: 移除单独的 goal 检查，所有完整性问题统一走 `validateHandoffCompleteness` + `ToolInputError`
**预防**: 校验逻辑只保留一个入口，不要在入口前后各加一层检查

### #91 — executeRotation 死代码 + MacroIndex 永不产出（双轨退化单轨）
**现象**: 序8 设计为"双轨延续"（Macro=压缩会话摘要 + Micro=任务段），但真实运行下 `macroIndex` 恒为 `[]`，只有 Micro 轨工作
**根因**: `rotation-controller.ts` 的 `executeRotation`（含 CompactionSummary 生成 + `appendMacroIndexEntry`）是死代码——仅被 `index.ts` 导出和 23 个测试覆盖，**无任何运行时调用者**。真实轮换工具 `rotate-session-tool.ts` 自己手搓 `store.updateActiveSession`，绕过整个编排器。`buildCompactionSummaryFromHandoff` 唯一调用点在死的 `executeRotation` 内
**解决**: 提取共享纯函数 `buildMacroEntryFromHandoff()`（dual-track-index.ts），让 `rotate_session` 工具在 `updateActiveSession` 后调 `appendMacroIndexEntry` 沉淀本会话 macro 摘要；`executeRotation` 也复用同一函数（消除重复逻辑）。`executeRotation` 全套接入（需 `RotationControllerDeps` 运行时句柄：spawnNewSession/archiveSession）保留为自动轮换的未来接入点
**预防**: 每个模块的 DoD 增加"运行时调用链 grep 验证"——`grep -rn funcName src | grep -v test`，零命中即死代码。测试覆盖 ≠ 接入运行时（与用户画像写路径死代码、computeInjectionBudget 架空同构）

### #92 — buildAndStoreDualTrackIndex 全量覆盖抹掉轮换写入的 macro
**现象**: 修复 #91 后，轮换写入的 MacroIndex 会被运行结束时的索引重建静默清空
**根因**: `conversation-store.ts` 的 `updateDualTrackIndex` 是**全量替换**两列，而 `appendMacroIndexEntry` 是**增量追加**。运行结束 `buildAndStoreDualTrackIndex` 只传 `taskSegments` 不传 `compactionSummaries`，生成空 macro 全量覆盖，抹掉轮换路径 append 的 macro
**解决**: `buildAndStoreDualTrackIndex` 改为读既有 `macroIndex` 后保留，只刷新 micro 轨：`macroIndex = [...existing.macroIndex, ...(新 compaction 如有)]`。语义对齐——micro 轨由运行结束幂等重建，macro 轨由轮换 append 拥有
**预防**: 同一份数据有 append 和 replace 两种写入路径时，必须明确各路径的所有权边界，replace 路径要先合并既有数据

### #93 — rotate_session 工具违反 AgentTool 框架契约（工具从未能正确返回）
**现象**: rotate_session 工具即便注册并被调用，运行时返回的 `content` 为空，模型收不到工具结果；tsgo 报 4 类错误
**根因**: 序8 工具定义全面偏离 `AgentTool` 契约——① `execute: async (input) => {}` 单参签名，正确为 `(toolCallId, params, signal?, onUpdate?)`；② 返回 `{ text }`，`AgentToolResult` 实为 `{ content: (Text|Image)[], details }`，无 text 字段；③ schema 字段名 `inputSchema`，正确为 `parameters`；④ 缺必填 `label`。这些 tsgo 错误此前未暴露是因为序8 文件在"tsgo 53→0 清零"sprint 之后才创建，未被覆盖，且 SPRINT 用 `tsc` 而非更严格的 `tsgo`
**解决**: execute 改 `(_toolCallId, input)`；返回 `{ content: [{type:"text", text}], details }`；`inputSchema`→`parameters`；补 `label`。测试同步对齐（execute 加 toolCallId 参 + 读 `content[0].text`）。tsgo 全仓 19→0
**预防**: 新工具以现有工具（如 delegate-code-task.ts）为模板对齐契约；新文件创建后立即跑 `tsgo --noEmit`（不要只信 `tsc`，两者严格度不同）

### #94 — attempt.ts inputClassification 重复声明（运行时 SyntaxError 风险）
**现象**: tsgo 报 `TS2451: Cannot redeclare block-scoped variable 'inputClassification'`（1436 + 1450 行）
**根因**: 序8 TaskSegment 集成在函数上方新增 `const inputClassification = classifyInput(...)` 用于 log，但下方原有 L0 classifier 的同名 `const` 声明未删 → 同作用域重复 `const`
**解决**: 删除下方重复声明，复用上方变量（值相同）
**预防**: 集成新代码块时 grep 同名变量；重复 `const` 是 tsgo 能抓但 tsc/运行时打包可能放过的真 bug
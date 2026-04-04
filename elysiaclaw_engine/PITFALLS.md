# ElysiaClaw — 踩坑记录 (Pitfalls & Lessons)

> 本文档记录项目开发过程中遇到的所有坑点及解决方案。
> 每次遇到新坑必须追加记录。AI 协作者在执行相关操作前请先检索本文档。

---

## 高频警告（必读）

在执行任何操作前，先过这 5 条：

1. **写文件用 Python**，不要用 heredoc（坑 #1）
2. **字符串替换用 Python `str.replace()`**，不要用 sed（坑 #2）
3. **新增工具必须检查 `src/index.ts` 导出**（坑 #16 / #23）
4. **deploy.sh 后验证 gateway 能正常响应**（坑 #22b）
5. **YAML 缩进错误会静默破坏 gateway**（坑 #30）

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
**现象**: 子脚本路径写成 `~/`，实际在 `~/pi-mono/`  
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

## 快速查找索引

| 关键词 | 坑号 |
|---|---|
| heredoc / 文件写入 | #1, #20 |
| sed / 字符串替换 | #2 |
| TypeScript 类型错误 | #24 |
| index.ts 导出 | #16, #23 |
| bot 模式 / bundle | #25, #17 |
| YAML 配置 | #30, #31, #32 |
| patch / deploy | #11, #22b, #29, #36 |
| symlink | #29, #35 |
| 字段名猜测 | #26, #27 |
| 包名迁移 | #29, #33, #34, #35, #36 |

---

*记录截至 2026-04-07，坑 #36。下次遇到新坑从 #37 开始追加。*


### #37 — pi-coding-agent package.json 版本号未同步
**现象**: deploy.sh 替换了 dist 目录但未更新 package.json，导致 package.json 仍显示 0.58.0
**解决**: 2026-04-07 手动更新 package.json 版本号为 0.64.0
**预防**: 考虑在 deploy.sh 中增加同步 package.json 版本号的步骤

### #38 — elysiaclaw status 显示 Tailscale off 但实际运行中
**现象**: `elysiaclaw status` 显示 "Tailscale off"，但 `tailscale status` 确认 Tailscale active (IP 100.111.4.5)
**原因**: elysiaclaw status 的 Tailscale 检测逻辑可能未正确识别运行状态
**影响**: 文档记录需以 `tailscale status` 实际输出为准
**解决**: 更新 SYSTEM.md 记录 Tailscale 为 active 状态

### #39 — Session 文件存储在 tmp-pi-runtime-events 子目录
**现象**: `~/.pi/agent/sessions/` 下的 .jsonl 文件位于 `--tmp-pi-runtime-events-*` 子目录中
**说明**: 这是 pi-mono 的正常行为，session 文件按运行时事件目录组织
**影响**: 查找 session 文件时需要递归搜索 `find ~/.pi/agent/sessions/ -name "*.jsonl"`

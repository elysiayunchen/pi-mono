# PITFALLS — ElysiaClaw
> 101 条记录 | Last updated: 2026-06-09
> ⚠️ 修改代码库前必读。

## 严重程度说明
- 🔴 CRITICAL — 破坏构建或损坏数据。**现象**：应用直接崩溃或数据丢失。
- 🟠 HIGH — 难以调试的运行时错误。**现象**：功能不正常但无明显报错。
- 🟡 MEDIUM — 行为不正确或浪费精力。**现象**：代码能跑但不符合预期。
- 🔵 INFO — 造成困惑但不破坏。**现象**：开发时容易误解。

## 高频警告（必读）
在执行任何操作前，先过这 14 条：

1. **写文件用 Python**，不要用 heredoc（P001）；含花括号/反引号的代码走 Write→Bash 两段式（P079）
2. **字符串替换用 Python `str.replace()`**，不要用 sed（P002）
3. **新增工具必须检查 `src/index.ts` 导出**（P016 / P023）
4. **deploy.sh 后验证 gateway 能正常响应**（P022b）
5. **YAML 缩进错误会静默破坏 gateway**（P030）
6. **功能完成必须 Definition of Done 全部勾选**（P064）
7. **大文件（>2000 行 / >25K 字符）分段读取**（P078）
8. **工具调用失败 → 先报告错误再重试**，最多 2 次（P080）
9. **Telegram 超长回复（>3000 字符）写文件发路径**（P081）
10. **代码+测试存在 ≠ 完成**：必须有生产路径实跑 + 端到端验证（P085）
11. **信 ✅ 前先 grep 生产调用者**：`grep -rn funcName src | grep -v test`，零命中即死代码（P085）
12. **wrapToolDefinition 必须逐字段传播**，不能只靠 `as` 类型断言（P082）
13. **测试 `describe()` 回调不准捕获 `beforeEach` 变量**（P084）
14. **blockStreamingDefault='on' 会抑制流式草稿预览**（P095）

## 索引
| ID | 严重程度 | 标题 | 类别 | 状态 |
|----|---------|------|------|------|
| P001 | 🟡 | heredoc 截断 | tooling | Active |
| P002 | 🟡 | sed 转义地狱 | tooling | Active |
| P003 | 🟠 | pi-tui 版本不兼容 | deps | Resolved |
| P004 | 🟡 | pi-ai 覆盖风险 | deps | Resolved |
| P005 | 🟡 | biome lint 阻止 git commit | tooling | Active |
| P006 | 🟡 | tsgo 不在 PATH | tooling | Active |
| P007 | 🟡 | 包加载路径 | arch | Active |
| P008 | 🟡 | isContextOverflow 名称错误 | api | Resolved |
| P009 | 🟡 | AgentEvent 缺失重试事件 | api | Resolved |
| P010 | 🟡 | 0.64 与 0.58 导出差异 | api | Resolved |
| P011 | 🟠 | Agent 类方法缺失（monkey-patch） | arch | Mitigated |
| P012 | 🟡 | deploy 脚本粘贴中断 | tooling | Active |
| P013 | 🟡 | 模块导出重复 | tooling | Resolved |
| P014 | 🟡 | 自动注入点错位 | tooling | Resolved |
| P015 | 🟡 | s08 工具类型错误（三处） | api | Resolved |
| P016 | 🟠 | dist/index.js 手动维护 | arch | Active |
| P017 | 🔴 | 两个工具注册路径（Bot vs TUI） | arch | Active |
| P018 | 🟡 | team-create.ts 路径错误 | api | Resolved |
| P019 | 🟡 | teammate 工具权限缺失 | arch | Resolved |
| P020 | 🟡 | Python heredoc 写 TS 模板字符串三重转义 | tooling | Active |
| P021 | 🟡 | Python 脚本硬编码 /root/ 路径 | tooling | Resolved |
| P022 | 🟡 | TS2663 参数名冲突 | api | Resolved |
| P022b | 🔴 | patch-agent.cjs 非幂等导致 gateway 崩溃 | arch | Mitigated |
| P023 | 🔴 | src/index.ts 工具导出遗漏 | arch | Resolved |
| P024 | 🟡 | P1-C 类型错误三连 | api | Resolved |
| P025 | 🔴 | Bot 模式绕过 pi-coding-agent | arch | Active |
| P026 | 🟡 | ModelSpeedMetrics 字段名猜错 | api | Active |
| P027 | 🟡 | EfficiencyGuardConfig 是比例阈值 | api | Active |
| P028 | 🟡 | 四脚本部署路径硬编码错误 | tooling | Resolved |
| P029 | 🟠 | openclaw→elysiaclaw 包名迁移导致入口断裂 | arch | Resolved |
| P030 | 🔴 | config.yaml 缩进错误静默破坏 gateway | config | Active |
| P031 | 🟡 | 新版 schema 校验比旧版严格 | config | Active |
| P032 | 🟡 | Token 认证是两层的 | config | Active |
| P033 | 🟡 | Plugin manifest 文件名跟包名走 | config | Resolved |
| P034 | 🔵 | .bashrc 补全脚本路径残留 | config | Resolved |
| P035 | 🟡 | CLI 输出被吞（根因是 symlink） | arch | Resolved |
| P036 | 🟡 | systemd service ExecStart 路径旧包名 | config | Resolved |
| P037 | 🟡 | Python 补丁脚本重复应用 | tooling | Active |
| P038 | 🟠 | DTS 类型错误阻塞完整构建 | tooling | Resolved |
| P039 | 🟡 | elysiaclaw 自建 system prompt 不使用 agent-session | arch | Active |
| P040 | 🟠 | OpenRouter→阿里云路由劫持 | api | Mitigated |
| P041 | 🟡 | config.yaml 结构性损坏导致 gateway 启动报错 | config | Active |
| P042 | 🟡 | Telegram inline keyboard / 富文本渲染限制 | api | Active |
| P043 | 🔵 | pi-coding-agent package.json 版本号未同步 | deps | Resolved |
| P044 | 🔵 | elysiaclaw status 显示 Tailscale off 但实际运行中 | tooling | Active |
| P045 | 🔵 | Session 文件存储在 tmp-pi-runtime-events 子目录 | arch | Active |
| P046 | 🟠 | allTools/createAllTools 缺少 worktree 和 model_speed_probe 工具 | arch | Resolved |
| P047 | 🟠 | src/index.ts 缺少 undoAction/fileHistoryList/modelSpeedProbe re-export | arch | Resolved |
| P048 | 🟡 | config.yaml gateway.mode 仍为非法值 'lan' | config | Resolved |
| P049 | 🔴 | pnpm install 污染 npm workspace 依赖树 | deps | Active |
| P050 | 🟡 | 新工具 ToolDefinition 接口扩展 | api | Resolved |
| P051 | 🟠 | 工具注册四层遗漏 | arch | Active |
| P052 | 🔴 | pnpm/npm 混用导致依赖树损坏 | deps | Active |
| P053 | 🟡 | elysiaclaw 构建部署需要手动步骤 | tooling | Active |
| P054 | 🟠 | Bot/TUI 工具路径不同 | arch | Active |
| P055 | 🟡 | web_search API 密钥配置 | config | Active |
| P056 | 🟠 | 工具注册四层链修复 | arch | Resolved |
| P059 | 🟡 | Python str.replace Tab vs 空格不匹配 | tooling | Active |
| P060 | 🟡 | heredoc + Python 缩进 Tab/空格混用 | tooling | Active |
| P061 | 🟡 | sed 行号操作的陷阱：行号会变 | tooling | Active |
| P062 | 🟡 | GrepTool 修改过程中的低效循环 | tooling | Active |
| P063 | 🟠 | DTS 类型错误数量在增加而非减少 | tooling | Resolved |
| P064 | 🟡 | Code Mode Phase 0 假完成风险 | arch | Resolved |
| P065 | 🟠 | createDelegateCodeTaskTool 未注册到工具数组 | arch | Resolved |
| P066 | 🟡 | 子代理 label 重名冲突 | arch | Active |
| P067 | 🟡 | 子代理继承主 agent 模型（不可用时全部失败） | arch | Active |
| P068 | 🟠 | tsdown tree-shake 误删未识别的动态导入函数 | tooling | Active |
| P069 | 🟠 | elysiaclaw dist 部署遗漏 | tooling | Active |
| P070 | 🟡 | Telegram tool lane 因 minInitialChars 防抖导致短标签无法显示 | api | Resolved |
| P071 | 🔴 | deploy.sh 未同步 extensions 导致 plugin 代码陈旧 | tooling | Resolved |
| P072 | 🔵 | stripPluginOnlyAllowlist 时序导致 group:memory 误报 unknown | config | Active |
| P073 | 🟡 | 用户画像 identity 空对象恒触发 changed | data | Resolved |
| P074 | 🔵 | L0 工具结果驱逐摘要：非文本 block 第 3 个同类型重复计数 | api | Resolved |
| P075 | 🟡 | 输入分类器技术词检测误用字符集 | api | Resolved |
| P076 | 🟠 | deploy.sh Step 9 extensions 同步丢弃子目录 | tooling | Resolved |
| P077 | 🟠 | deploy.sh Step 9 子目录递归在「无子目录 extension」上 glob 字面量 + set -e 中止 | tooling | Resolved |
| P078 | 🟡 | Read 工具大文件截断（单次 ~25K 字符限制） | tooling | Active |
| P079 | 🟡 | Bash heredoc 内 Python f-string / 模板字面量花括号冲突 | tooling | Active |
| P080 | 🟠 | Agent 工具调用失败后静默卡死（重试循环 + 无错误报告） | arch | Active |
| P081 | 🟡 | Telegram 回复超长截断（>4000 字符） | api | Active |
| P082 | 🟠 | wrapToolDefinition 用 `as` 强制断言但不传播扩展字段 | arch | Active |
| P083 | 🟡 | 测试用例的 fake 对象缺少必要字段导致模块初始化失败 | testing | Active |
| P084 | 🟡 | 测试 `describe()` 回调不准捕获 `beforeEach` 变量 | testing | Active |
| P085 | 🔴 | 代码+测试存在 ≠ 完成：设计-实现鸿沟 | arch | Active |
| P086 | 🟠 | tsgo 类型检查 53 错误清零 | tooling | Resolved |
| P087 | 🟡 | session-rotation task-segment-tracker 孤儿段 | data | Resolved |
| P088 | 🟡 | task-segment-tracker completeToolCall 按工具名匹配 | data | Resolved |
| P089 | 🟡 | handoff-inject 轮换后查找失败 | data | Resolved |
| P090 | 🟡 | rotate-session-tool 错误处理不一致 | api | Resolved |
| P091 | 🔴 | executeRotation 死代码：仅定义+导出+测试，零生产调用 | arch | Resolved（PLAN-09 P0 删除轮换） |
| P092 | 🔴 | buildAndStoreDualTrackIndex 覆盖抹掉 macro | data | Resolved |
| P093 | 🔴 | rotate_session 违反 AgentTool 框架契约 | api | Resolved |
| P094 | 🟡 | attempt.ts inputClassification 重复声明 | api | Resolved |
| P095 | 🔴 | blockStreamingDefault='on' 抑制流式草稿预览 | config | Resolved |
| P096 | 🟡 | setToolCallPendingApproval 无生产调用者（M0 死代码） | arch | Active |
| P097 | 🟡 | taskTrackerRegistry Map 永不清理（内存泄漏风险） | arch | Active |
| P098 | 🟡 | activeSeg.body.finalReply 跨模块直接赋值（紧耦合） | arch | Active |
| P099 | 🔵 | dual-track index 双写（onSeal + attempt.ts 均调 buildAndStoreDualTrackIndex） | data | Active |
| P100 | 🟡 | tracker 创建时 conversationId 为空阻塞 onSeal → 输入到达密封路径无 index 写入兜底 | data | Active |
| P101 | 🟠 | Vitest vi.mock 只在测试文件中被 hoist，非测试文件中的 vi.mock 不生效 | testing | Active |

## 条目

### P001 — heredoc 截断
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** Shell heredoc 在某些终端/SSH 场景下内容被截断
- **根因：** heredoc 在 bash 中对特殊字符、缩进、长内容处理脆弱
- **错误做法：** 用 `cat > file << 'EOF'` 写文件
- **正确做法：** 用 `python3` 脚本写文件，逐行拼接字符串
- **发现时间：** 来自采访

### P002 — sed 转义地狱
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** `sed` 正则在 bash 里有三层转义，特殊字符极易出错
- **根因：** bash + sed 双层转义规则复杂
- **错误做法：** 用 `sed` 做字符串替换
- **正确做法：** 用 Python `str.replace()` 或 `re.sub()`
- **发现时间：** 来自采访

### P003 — pi-tui 版本不兼容
- **严重程度：** 🟠 HIGH
- **类别：** deps
- **状态：** Resolved
- **你能观察到的现象：** pi-mono 0.64 的 `pi-tui` API 与安装包里的 0.58 不兼容
- **根因：** 0.58 和 0.64 之间 API 签名变更
- **错误做法：** 直接替换 pi-tui 不加兼容层
- **正确做法：** 在全局安装的 0.58 上加兼容层；2026-04-07 升级到 0.64 后确认兼容层已原生包含
- **发现时间：** 来自采访

### P004 — pi-ai 覆盖风险
- **严重程度：** 🟡 MEDIUM
- **类别：** deps
- **状态：** Resolved
- **你能观察到的现象：** 第一次替换 pi 包时意外把 pi-ai 也覆盖了
- **根因：** deploy 脚本未明确限制替换范围
- **错误做法：** 全局替换所有 pi 包
- **正确做法：** deploy.sh 只替换 `pi-coding-agent`，明确不动其他包
- **发现时间：** 来自采访

### P005 — biome lint 阻止 git commit
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** biome 报错导致 commit 失败
- **根因：** 代码风格不符合 biome 规则
- **错误做法：** 忽略 lint 错误强制提交
- **正确做法：** 用 template literal 替代字符串拼接；删除未使用变量
- **发现时间：** 来自采访

### P006 — tsgo 不在 PATH
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** 直接执行 `tsgo` 报 command not found
- **根因：** tsgo 是 npm 包内工具，不在全局 PATH
- **错误做法：** 直接调 `tsgo`
- **正确做法：** 永远用 `npm run build`，不直接调 tsgo
- **发现时间：** 来自采访

### P007 — 包加载路径
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** ElysiaClaw 从 `node_modules/@mariozechner/` 加载 pi 包，不从系统全局
- **根因：** npm workspace 的包解析优先级
- **错误做法：** 替换系统全局的 pi 包
- **正确做法：** 替换 `~/.nvm/.../elysiaclaw/node_modules/@mariozechner/pi-coding-agent/` 目录
- **发现时间：** 来自采访

### P008 — isContextOverflow 名称错误
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** `isContextOverflowError` 不存在，实际导出名是 `isContextOverflow`
- **根因：** 猜测导出名而非 grep 核实
- **错误做法：** 猜字段名
- **正确做法：** 用 `grep` 核实实际导出名再写代码
- **发现时间：** 来自采访

### P009 — AgentEvent 缺失重试事件
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** `auto_retry_start`/`auto_retry_end` 在 `AgentEvent` 里不存在，只在 `AgentSessionEvent` 里
- **根因：** 事件类型定义分散在不同模块
- **错误做法：** 依赖 AgentEvent 处理重试事件
- **正确做法：** 在 `agent-loop.ts` 里直接处理，不依赖事件类型
- **发现时间：** 来自采访

### P010 — 0.64 与 0.58 导出差异
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** `getKeybindings` 等函数在 0.58 包里不存在
- **根因：** 0.58 和 0.64 之间 API 变更
- **错误做法：** 假设两个版本导出一致
- **正确做法：** 在兼容层加别名导出；0.64 已原生包含这些导出
- **发现时间：** 来自采访

### P011 — Agent 类方法缺失（monkey-patch）
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Mitigated
- **你能观察到的现象：** 0.64 源码调用了 0.58 缺少的 `setSystemPrompt()` 和 `replaceMessages()`
- **根因：** 0.64 编译产物缺少这两个方法
- **错误做法：** 不做 patch 直接运行
- **正确做法：** 手动 monkey-patch，由 `scripts/patch-agent.cjs` 管理；锚点从 `setAfterToolCall` 改为 `subscribe`
- **发现时间：** 来自采访

### P012 — deploy 脚本粘贴中断
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** 通过 SSH 粘贴长脚本时中断
- **根因：** SSH 终端缓冲区限制
- **错误做法：** 直接在 SSH 终端粘贴长脚本
- **正确做法：** 通过 VS Code SSH 扩展直接写文件，再 `bash` 执行
- **发现时间：** 来自采访

### P013 — 模块导出重复
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** Python 脚本多次运行导致 `index.ts` 中有三重重复导出
- **根因：** Python 脚本未做去重检查
- **错误做法：** 多次运行同一补丁脚本
- **正确做法：** 写去重脚本，先读取→去重→写回
- **发现时间：** 来自采访

### P014 — 自动注入点错位
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** sed 注入代码到错误位置
- **根因：** sed 定位标记匹配到错误位置
- **错误做法：** 用 sed 做代码注入
- **正确做法：** 手动定位正确注入点，用 Python 写入
- **发现时间：** 来自采访

### P015 — s08 工具类型错误（三处）
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** `details` 必填字段缺失、`execute` 签名缺参数、`status` 值非法
- **根因：** 工具定义与 AgentTool 接口不匹配
- **错误做法：** 猜测接口签名
- **正确做法：** 逐一补全，用 `npm run check` 验证
- **发现时间：** 来自采访

### P016 — dist/index.js 手动维护
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** 新增工具若不在 `src/index.ts` 显式导出，构建后 bot 无法使用
- **根因：** dist 构建依赖 src/index.ts 的显式导出
- **错误做法：** 新增工具后不检查导出
- **正确做法：** 每次新增工具后必须检查并更新 `packages/coding-agent/src/index.ts`
- **发现时间：** 来自采访

### P017 — 两个工具注册路径（Bot vs TUI）
- **严重程度：** 🔴 CRITICAL
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** TUI 走 `createPiCodingTools`，Bot 走 `createElysiaClawCodingTools`，是完全独立的路径
- **根因：** 双轨架构设计——TUI 加载自定义 pi-coding-agent dist，Bot 使用 elysiaclaw 自包含 bundle
- **错误做法：** 新增工具只注册一个路径
- **正确做法：** 新增工具时，两个路径都需要注册并验证
- **发现时间：** 来自采访

### P018 — team-create.ts 路径错误
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** 引用了不存在的路径和占位变量名
- **根因：** 硬编码路径
- **错误做法：** 硬编码路径
- **正确做法：** 改用 `node:os` + `path.join` 拼路径
- **发现时间：** 来自采访

### P019 — teammate 工具权限缺失
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** teammate 没有操作文件的权限
- **根因：** 工具权限未正确配置
- **错误做法：** 直接给 teammate 全局权限
- **正确做法：** s12 Worktree 通过 `createBashTool(worktreePath)` 注入，天然沙箱
- **发现时间：** 来自采访

### P020 — Python heredoc 写 TS 模板字符串三重转义
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** Python heredoc 内含 TypeScript 模板字符串时产生三重转义混乱
- **根因：** Python f-string + bash heredoc + TS 模板字面量三层转义冲突
- **错误做法：** 在 heredoc 内写含 `${}` 的代码
- **正确做法：** 逐行拼接字符串，彻底消除 heredoc
- **发现时间：** 来自采访

### P021 — Python 脚本硬编码 /root/ 路径
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** 在 elysia 用户下运行时路径不正确
- **根因：** 脚本硬编码了 /root/ 路径
- **错误做法：** 硬编码用户路径
- **正确做法：** 改用 `os.path.expanduser('~/...')`
- **发现时间：** 来自采访

### P022 — TS2663 参数名冲突
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** 函数参数 `prompt` 与方法名 `prompt()` 冲突，TypeScript 报 TS2663
- **根因：** 参数名与方法名重名
- **错误做法：** 使用保留方法名作参数名
- **正确做法：** 检测实际参数名并替换为非冲突名
- **发现时间：** 来自采访

### P022b — patch-agent.cjs 非幂等导致 gateway 崩溃
- **严重程度：** 🔴 CRITICAL
- **类别：** arch
- **状态：** Mitigated
- **你能观察到的现象：** 多次运行 patch 脚本后，注入代码被 `// REMOVED_` 前缀包裹，`SyntaxError` 导致 gateway 崩溃
- **根因：** patch 脚本非幂等，多次运行累积损坏代码
- **错误做法：** 不检查直接重复运行 patch
- **正确做法：** 重写脚本，加 Step 0 清理损坏代码，逐方法严格检测，按需注入（幂等）；每次 deploy.sh 前检查 agent.js 语法
- **发现时间：** 来自采访

### P023 — src/index.ts 工具导出遗漏
- **严重程度：** 🔴 CRITICAL
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** s07-s12 工具存在于 dist 但未在 `src/index.ts` 导出，bot 环境全部无法使用
- **根因：** 手动维护导出列表遗漏
- **错误做法：** 新增工具后不检查 src/index.ts 导出
- **正确做法：** 补全 14 行导出声明
- **发现时间：** 来自采访

### P024 — P1-C 类型错误三连
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** `msg as Record<string, unknown>` 报 TS2352；`timestamp` 参数类型不匹配；`auth.apiKey` 是 `string | undefined`
- **根因：** 类型断言不安全、参数类型不匹配
- **错误做法：** 猜测类型签名
- **正确做法：** 逐一修正：`as unknown as Record`；`new Date().toISOString()`；加 `!` 非空断言
- **发现时间：** 来自采访

### P025 — Bot 模式绕过 pi-coding-agent
- **严重程度：** 🔴 CRITICAL
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** `elysiaclaw` 是完全自包含 bundle，bot 请求不经过替换的 `pi-coding-agent`，`wrapStreamForCost()` 对 bot 无效
- **根因：** 双轨架构——TUI 和 Bot 走完全不同的代码路径
- **错误做法：** 假设 Bot 和 TUI 行为一致
- **正确做法：** TUI 走 `wrapStreamForCost()` 拦截 done 事件；Bot 走读取 `sessions.json` 的 Python 报告脚本
- **发现时间：** 来自采访

### P026 — ModelSpeedMetrics 字段名猜错
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Active
- **你能观察到的现象：** 猜测字段名为 `ttft`/`tokensPerSecond`，实际是 `ttftMs`/`tps`/`latencyMs`
- **根因：** 未 grep 核实实际接口定义
- **错误做法：** 猜字段名
- **正确做法：** `grep` 实际接口定义后再写代码，永远不猜字段名
- **发现时间：** 来自采访

### P027 — EfficiencyGuardConfig 是比例阈值
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Active
- **你能观察到的现象：** `warnThreshold=0.7` 是相对比例，不是绝对 RPM 调用次数
- **根因：** 配置语义理解错误
- **错误做法：** 把比例阈值当绝对值使用
- **正确做法：** 将 P95 RPM 映射为比例调整量，而非直接赋值
- **发现时间：** 来自采访

### P028 — 四脚本部署路径硬编码错误
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** 子脚本路径写成 `~/`，实际在 `~/projects/pi-mono/`
- **根因：** 部署脚本硬编码路径
- **错误做法：** 硬编码部署路径
- **正确做法：** 所有部署统一单文件，路径用 `__file__` 所在目录推导
- **发现时间：** 来自采访

### P029 — openclaw→elysiaclaw 包名迁移导致入口断裂
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** `elysiaclaw.mjs` 里的 `import('./dist/entry.js')` 是相对路径，通过 symlink 运行时 CWD 不对，CLI 静默失败无输出
- **根因：** symlink 指向目录而非文件，CWD 解析错误
- **错误做法：** symlink 指向 `dist/` 目录
- **正确做法：** symlink 直接指向 `dist/entry.js`
- **发现时间：** 来自采访

### P030 — config.yaml 缩进错误静默破坏 gateway
- **严重程度：** 🔴 CRITICAL
- **类别：** config
- **状态：** Active
- **你能观察到的现象：** `gateway:` 段被嵌套在 `workspace:` 下，YAML 解析后 `gateway.mode` 不存在，启动报 `mode=unset`
- **根因：** YAML 缩进错误导致层级结构变化，但解析不报错
- **错误做法：** 手动编辑 YAML 后不验证
- **正确做法：** 修正 YAML 缩进；修改 config.yaml 后用 `python3 -c "import yaml; yaml.safe_load(open('config.yaml'))"` 验证
- **发现时间：** 来自采访

### P031 — 新版 schema 校验比旧版严格
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Active
- **你能观察到的现象：** `gateway.mode: 'lan'` → 只允许 `local`/`remote`；`agents.defaults.defaultModel` → 不再支持
- **根因：** 新版 elysiaclaw schema 校验更严格
- **错误做法：** 照搬旧配置
- **正确做法：** 按新版 schema 修正字段值
- **发现时间：** 来自采访

### P032 — Token 认证是两层的
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Active
- **你能观察到的现象：** config 里写了 token 还不够，systemd service 的环境变量里也要有 `OPENCLAW_GATEWAY_TOKEN`
- **根因：** Gateway 认证检查两个来源
- **错误做法：** 只配置一处 token
- **正确做法：** systemd service 文件添加 `Environment=OPENCLAW_GATEWAY_TOKEN=xxx`
- **发现时间：** 来自采访

### P033 — Plugin manifest 文件名跟包名走
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Resolved
- **你能观察到的现象：** extensions 目录里的 `openclaw.plugin.json` 需要复制为 `elysiaclaw.plugin.json`，否则 34 个插件全部报 manifest not found
- **根因：** fork 后包名变更但 manifest 未同步
- **错误做法：** 只保留旧名 manifest
- **正确做法：** 批量 rename `openclaw.plugin.json` → `elysiaclaw.plugin.json`
- **发现时间：** 来自采访

### P034 — .bashrc 补全脚本路径残留
- **严重程度：** 🔵 INFO
- **类别：** config
- **状态：** Resolved
- **你能观察到的现象：** 每次开终端报 No such file or directory
- **根因：** `.bashrc` 中 source 路径仍指向旧包名
- **错误做法：** 忽略终端报错
- **正确做法：** 修改 `.bashrc` 中的 source 路径或直接删除
- **发现时间：** 来自采访

### P035 — CLI 输出被吞（根因是 symlink）
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** `elysiaclaw status` exit 0 但无输出
- **根因：** 入口 symlink 问题（同 P029），不是 stdout 被劫持
- **错误做法：** 排查 stdout 重定向
- **正确做法：** 修复入口 symlink
- **发现时间：** 来自采访

### P036 — systemd service ExecStart 路径旧包名
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Resolved
- **你能观察到的现象：** service 文件 ExecStart 指向旧目录，重装后包移位，路径不匹配
- **根因：** 包名迁移后 service 文件未更新
- **错误做法：** 只更新包不更新 service 文件
- **正确做法：** 更新 service 文件 ExecStart 为正确的包安装路径
- **发现时间：** 来自采访

### P037 — Python 补丁脚本重复应用
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** Python 脚本的 `str.replace()` marker 匹配了两次，导致代码块重复出现
- **根因：** 旧补丁没有完全清理干净，marker 仍然存在于文件中
- **错误做法：** 不检查直接运行补丁脚本
- **正确做法：** 补丁脚本应该在替换前检查目标是否已经被替换过
- **发现时间：** 来自采访

### P038 — DTS 类型错误阻塞完整构建
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** `pnpm build` 在 `build:plugin-sdk:dts` 阶段报 4 个 TS 错误，导致整个构建失败
- **根因：** elysiaclaw 与 pi-mono 0.64 API 的预存类型不匹配
- **错误做法：** 用 `pnpm build` 构建
- **正确做法：** 绕过 `pnpm build`，直接运行 `node scripts/tsdown-build.mjs` + 手动跑剩余构建步骤
- **发现时间：** 来自采访

### P039 — elysiaclaw 自建 system prompt 不使用 agent-session
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** Bot 模式下 LLM 仍然以普通模式回复，尽管在 agent-session.ts 注入了 CODE MODE ACTIVE 段
- **根因：** elysiaclaw 的 `attempt.ts` 自己构建 system prompt 并覆盖 agent session 的
- **错误做法：** 在 agent-session 的 `_buildSystemPrompt` 里注入
- **正确做法：** 在 `attempt.ts` 里直接检测并注入，理解 Bot 和 TUI 的 system prompt 构建路径不同
- **发现时间：** 来自采访

### P040 — OpenRouter→阿里云路由劫持
- **严重程度：** 🟠 HIGH
- **类别：** api
- **状态：** Mitigated
- **你能观察到的现象：** OpenRouter 免费模型请求被静默路由到阿里云 Bailian 端点，部分工具调用格式不兼容
- **根因：** OpenRouter 对某些免费模型启用了透明代理
- **错误做法：** 假设 OpenRouter 返回的模型与请求一致
- **正确做法：** 在 `elysiaclaw.json` 中对受影响模型添加 `baseUrl` 直连
- **发现时间：** 来自采访

### P041 — config.yaml 结构性损坏导致 gateway 启动报错
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Active
- **你能观察到的现象：** gateway 启动时报 schema 校验错误，字段缺失或类型不匹配
- **根因：** 手动编辑 config.yaml 时引入了结构错误
- **错误做法：** 手动编辑 YAML 后不验证
- **正确做法：** 用 `python3 -c "import yaml; yaml.safe_load(open('config.yaml'))"` 验证
- **发现时间：** 来自采访

### P042 — Telegram inline keyboard / 富文本渲染限制
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Active
- **你能观察到的现象：** 某些 Markdown 格式在 Telegram 消息中渲染异常或被截断
- **根因：** Telegram Bot API 的 MarkdownV2 模式对特殊字符要求严格转义
- **错误做法：** 使用 MarkdownV2 不转义特殊字符
- **正确做法：** 使用 HTML 模式替代 MarkdownV2，或在发送前对特殊字符做完整转义
- **发现时间：** 来自采访

### P043 — pi-coding-agent package.json 版本号未同步
- **严重程度：** 🔵 INFO
- **类别：** deps
- **状态：** Resolved
- **你能观察到的现象：** deploy.sh 替换了 dist 目录但未更新 package.json，版本号仍显示 0.58.0
- **根因：** deploy.sh 未同步版本号
- **错误做法：** 只替换 dist 不更新 package.json
- **正确做法：** 手动更新 package.json 版本号；考虑在 deploy.sh 中增加同步步骤
- **发现时间：** 来自采访

### P044 — elysiaclaw status 显示 Tailscale off 但实际运行中
- **严重程度：** 🔵 INFO
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** `elysiaclaw status` 显示 'Tailscale off'，但 `tailscale status` 确认 Tailscale active
- **根因：** elysiaclaw status 的 Tailscale 检测逻辑可能未正确识别运行状态
- **错误做法：** 以 elysiaclaw status 为准
- **正确做法：** 以 `tailscale status` 实际输出为准
- **发现时间：** 来自采访

### P045 — Session 文件存储在 tmp-pi-runtime-events 子目录
- **严重程度：** 🔵 INFO
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** `~/.pi/agent/sessions/` 下的 .jsonl 文件位于 `--tmp-pi-runtime-events-*` 子目录中
- **根因：** pi-mono 的正常行为，session 文件按运行时事件目录组织
- **错误做法：** 只在顶层目录查找 session 文件
- **正确做法：** 递归搜索 `find ~/.pi/agent/sessions/ -name '*.jsonl'`
- **发现时间：** 来自采访

### P046 — allTools/createAllTools 缺少 worktree 和 model_speed_probe 工具
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** `enterWorktreeTool`、`exitWorktreeTool`、`modelSpeedProbeTool` 有 re-export 但从未加入 `allTools` 对象和 `createAllTools()` 返回值
- **根因：** 手动维护工具注册列表遗漏（P016/P023 的翻版）
- **错误做法：** 只在 tools/index.ts 导出不同步 allTools
- **正确做法：** allTools +3、createAllTools +5；deploy.sh 已加装 Guard 3
- **发现时间：** 来自采访

### P047 — src/index.ts 缺少 undoAction/fileHistoryList/modelSpeedProbe re-export
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** `tools/index.ts` 已导出但 `src/index.ts`（Master tool export）未 re-export，外部消费者无法导入
- **根因：** 手动维护导出列表遗漏
- **错误做法：** 只在 tools/index.ts 导出不同步 src/index.ts
- **正确做法：** 在 src/index.ts 追加 6 个 re-export
- **发现时间：** 来自采访

### P048 — config.yaml gateway.mode 仍为非法值 'lan'
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Resolved
- **你能观察到的现象：** `gateway.mode` 只允许 `local` 或 `remote`，但 config.yaml 实际仍为 `lan`
- **根因：** P031 已记录但未及时修正
- **错误做法：** 保留非法值
- **正确做法：** 修正为 `local`；deploy.sh Guard 1 已加入 mode 值校验
- **发现时间：** 来自采访

### P049 — pnpm install 污染 npm workspace 依赖树
- **严重程度：** 🔴 CRITICAL
- **类别：** deps
- **状态：** Active
- **你能观察到的现象：** 在 pi-mono 根目录运行 `pnpm install` 后，`npm run build` 报大量类型错误
- **根因：** pnpm 从 registry 拉取了旧版本放进 `node_modules/.pnpm/`，覆盖了 npm workspace 的正确版本
- **错误做法：** 在根目录运行 pnpm install
- **正确做法：** `rm -rf node_modules && npm install` 清掉 pnpm 引入的垃圾；永远不要在根目录运行 pnpm install
- **发现时间：** 来自采访

### P050 — 新工具 ToolDefinition 接口扩展
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** 新增工具时 ToolDefinition 接口需要扩展 11 个字段
- **根因：** 接口演进需要同步更新
- **错误做法：** 只更新工具实现不更新接口
- **正确做法：** 同步更新 ToolDefinition 接口和所有工具实现
- **发现时间：** 来自采访

### P051 — 工具注册四层遗漏
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** 新增工具后忘记在四层注册（L1 allTools → L2 pi-tools.ts → L3 tool-catalog.ts → L4 elysiaclaw.json）
- **根因：** 四层注册机制复杂，容易遗漏某一层
- **错误做法：** 只注册一两层就认为完成
- **正确做法：** 每层逐一检查并注册
- **发现时间：** 来自采访

### P052 — pnpm/npm 混用导致依赖树损坏
- **严重程度：** 🔴 CRITICAL
- **类别：** deps
- **状态：** Active
- **你能观察到的现象：** pnpm 和 npm 混用后依赖树损坏，构建失败
- **根因：** pi-mono 框架层用 npm workspaces，elysiaclaw 应用层用 pnpm，两者不能在根目录混用
- **错误做法：** 在根目录运行 pnpm install
- **正确做法：** pi-mono 根目录只用 npm；elysiaclaw 子目录用 pnpm
- **发现时间：** 来自采访

### P053 — elysiaclaw 构建部署需要手动步骤
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** elysiaclaw 构建后 dist 未自动部署到全局安装目录
- **根因：** deploy.sh 只负责 pi-mono 框架层，不负责 elysiaclaw dist 部署到全局
- **错误做法：** 构建后忘记手动部署
- **正确做法：** 构建后手动 `cp -r dist/* ~/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw/dist/`
- **发现时间：** 来自采访

### P054 — Bot/TUI 工具路径不同
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** TUI 走 `createPiCodingTools`，Bot 走 `createElysiaClawCodingTools`，工具注册路径完全独立
- **根因：** 双轨架构（同 P017 的延伸）
- **错误做法：** 只验证一个路径
- **正确做法：** 新增工具必须两边验证
- **发现时间：** 来自采访

### P055 — web_search API 密钥配置
- **严重程度：** 🟡 MEDIUM
- **类别：** config
- **状态：** Active
- **你能观察到的现象：** web_search 工具需要 API 密钥，配置不当导致搜索失败
- **根因：** API 密钥配置位置和格式不明确
- **错误做法：** 硬编码 API 密钥
- **正确做法：** 在 `~/.elysiaclaw/.env` 中配置
- **发现时间：** 来自采访

### P056 — 工具注册四层链修复
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** 四层注册链中存在多处遗漏和不一致
- **根因：** 历史累积的注册遗漏
- **错误做法：** 逐个修复不检查全局一致性
- **正确做法：** 架构优化 Sprint 中统一修复
- **发现时间：** 来自采访

### P059 — Python str.replace Tab vs 空格不匹配
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** Python 脚本用空格字符串做 `str.replace()`，但目标 TypeScript 文件用 Tab 缩进，导致匹配失败
- **根因：** Python 字面量 `'    model_speed_probe'` 无法匹配文件中的 `'\tmodel_speed_probe'`
- **错误做法：** 假设缩进方式
- **正确做法：** 用 `cat -A` 检查实际字符（Tab 显示为 `^I`），替换时使用 `\t` 而非空格
- **发现时间：** 来自采访

### P060 — heredoc + Python 缩进 Tab/空格混用
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** heredoc 内 Python 代码缩进 Tab 和空格混用导致 Python 报 IndentationError
- **根因：** heredoc 保留原始缩进，与 Python 缩进要求冲突
- **错误做法：** 在 heredoc 内写 Python 代码
- **正确做法：** 用 base64 编码写文件，或直接用 Write 工具写入脚本文件
- **发现时间：** 来自采访

### P061 — sed 行号操作的陷阱：行号会变
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** 用 `sed -i '311s/...'` 修复缩进后，后续行号全部偏移，继续用原行号操作会改错行
- **根因：** 每次 `sed -i` 都可能改变行号（插入/删除行）
- **错误做法：** 多次用行号操作同一文件
- **正确做法：** 一次性完成所有行号操作；或用字符串替换而非行号
- **发现时间：** 来自采访

### P062 — GrepTool 修改过程中的低效循环
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** 5 处修改花了大量时间，反复修复缩进，一个 block 改了 10+ 次
- **根因：** heredoc 截断 + Tab/空格混用 + sed 行号偏移 + bash 转义冲突
- **错误做法：** 在 bash 里写复杂 Python
- **正确做法：** 先用 `sed -n 'X,Yp' file | cat -A` 确认缩进；一次性用 `sed -i` 完成；避免在 bash 里写复杂 Python
- **发现时间：** 来自采访

### P063 — DTS 类型错误数量在增加而非减少
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** `pnpm build` 在 DTS 阶段报错数量从 4 增加到 6
- **根因：** elysiaclaw 与 pi-mono 0.64 API 的预存类型不匹配，每次新增代码可能引入新的类型冲突
- **错误做法：** 继续绕过不修复
- **正确做法：** 专项 Sprint 修复全部 DTS 错误（已通过 tsgo 53→0 清零解决）
- **发现时间：** 来自采访

### P064 — Code Mode Phase 0 假完成风险
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** Code Mode 标记完成但实际功能不完整
- **根因：** 缺乏 Definition of Done 硬性标准
- **错误做法：** 代码存在就标记完成
- **正确做法：** 2026-06-05 Code Mode 已废弃，由 delegate_code_task 取代
- **发现时间：** 来自采访

### P065 — createDelegateCodeTaskTool 未注册到工具数组
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Resolved
- **你能观察到的现象：** `delegate_code_task` 在 tool-catalog.ts 中有定义，elysiaclaw-tools.ts 有 import，但 Gateway 启动报 `unknown entries`
- **根因：** `createElysiaClawTools()` 函数中 `tools` 数组从未调用 `createDelegateCodeTaskTool()`
- **错误做法：** import 了函数但没有使用
- **正确做法：** 在 `elysiaclaw-tools.ts` 的 `tools` 数组中添加调用
- **发现时间：** 来自采访

### P066 — 子代理 label 重名冲突
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** `sessions.patch` 返回 `errorCode=INVALID_REQUEST errorMessage=label already in use: code-analysis`
- **根因：** 前一次子代理 spawn 失败但 label 已被注册
- **错误做法：** 使用固定 label
- **正确做法：** 子代理 label 应加唯一后缀（如 UUID 前 8 位）
- **发现时间：** 来自采访

### P067 — 子代理继承主 agent 模型（不可用时全部失败）
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** 主 agent 切换到不可用模型后，子代理 LLM 调用全部返回 `400 Provider returned error`
- **根因：** `spawnSubagentDirect` 默认继承主 agent 模型，没有独立 model 参数
- **错误做法：** 假设子代理模型独立
- **正确做法：** 在 delegate_code_task schema 中新增 `model` 可选参数
- **发现时间：** 来自采访

### P068 — tsdown tree-shake 误删未识别的动态导入函数
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** `createDelegateCodeTaskTool` 函数声明被 tree-shake 掉，但 tool-catalog 的字符串元数据保留
- **根因：** tsdown (esbuild) 误判函数为未使用
- **错误做法：** 不验证 dist 产物完整性
- **正确做法：** deploy.sh 中 elysiaclaw 构建步骤应验证关键工具函数是否被打包
- **发现时间：** 来自采访

### P069 — elysiaclaw dist 部署遗漏
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** elysiaclaw 源码已修改并本地构建成功，但全局安装的 dist 未更新
- **根因：** deploy.sh 只负责 pi-mono 框架层，不负责 elysiaclaw dist 部署到全局
- **错误做法：** 构建后忘记手动部署
- **正确做法：** 构建后手动 `cp -r dist/*` 到全局 node_modules
- **发现时间：** 来自采访

### P070 — Telegram tool lane 因 minInitialChars 防抖导致短标签无法显示
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** 工具标签（如 '📖 Read' 7字符）显示后立即消失
- **根因：** `createDraftLane` 对所有 lane 统一使用 30 字符防抖阈值，短标签达不到阈值
- **错误做法：** 对 tool lane 使用默认防抖阈值
- **正确做法：** 对 `laneName === 'tool'` 设置 `minInitialChars: undefined`
- **发现时间：** 来自采访

### P071 — deploy.sh 未同步 extensions 导致 plugin 代码陈旧
- **严重程度：** 🔴 CRITICAL
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** 源码中 `extensions/memory-core/index.ts` 已更新，但 Agent session 中 `memory_search` 工具不可用
- **根因：** deploy.sh 从未同步 `extensions/` 目录，全局安装的 plugin 源码是旧版
- **错误做法：** 只部署 dist 不同步 extensions
- **正确做法：** deploy.sh 新增 Step 9 遍历同步 extensions 目录
- **发现时间：** 来自采访

### P072 — stripPluginOnlyAllowlist 时序导致 group:memory 误报 unknown
- **严重程度：** 🔵 INFO
- **类别：** config
- **状态：** Active
- **你能观察到的现象：** Gateway 日志 `tools.allow allowlist contains unknown entries (group:memory)`
- **根因：** `stripPluginOnlyAllowlist()` 在 plugin 工具尚未注册时运行
- **错误做法：** 忽略日志警告
- **正确做法：** Cosmetic only — 不影响功能，`memory_search` 工具正常注册并可用
- **发现时间：** 来自采访

### P073 — 用户画像 identity 空对象恒触发 changed
- **严重程度：** 🟡 MEDIUM
- **类别：** data
- **状态：** Resolved
- **你能观察到的现象：** 纯闲聊消息（无任何可提取信息）断言 `changed=false`，实际返回 `changed=true`
- **根因：** `JSON.stringify({})` ≠ `JSON.stringify(undefined)`，空对象恒触发变更
- **错误做法：** 用 stringify diff 判定 `{}` vs `undefined`
- **正确做法：** identity 合并前加 `Object.keys(newIdentity).length > 0` 守卫
- **发现时间：** 来自采访

### P074 — L0 工具结果驱逐摘要：非文本 block 第 3 个同类型重复计数
- **严重程度：** 🔵 INFO
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** 摘要产出 `+image×2,image` 而非 `+image×3`
- **根因：** 旧逻辑用数组 + `includes(tag)` 判存在，第 3 次同类型匹配失败
- **错误做法：** 在同一数组里混存裸 tag 和 `tag×n` 两种形态
- **正确做法：** 改用 `Map<string,number>` 计数
- **发现时间：** 来自采访

### P075 — 输入分类器技术词检测误用字符集
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** 群聊短消息技术词检测对'任务完成''密码忘了'等闲聊误判为'含技术词'
- **根因：** `[代码|编译]` 是字符集不是分组，匹配方括号内任意单个字符
- **错误做法：** 用 `[词|词]` 匹配多词
- **正确做法：** 改为 alternation `/代码|编译|配置|...|命令/`
- **发现时间：** 来自采访

### P076 — deploy.sh Step 9 extensions 同步丢弃子目录
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** deploy.sh 运行后 40 个 plugin 全部报 manifest not found；telegram plugin 加载失败
- **根因：** Step 9 只复制顶层文件忽略子目录；manifest 文件名不一致
- **错误做法：** 用 `find -maxdepth 1 -type f` 只复制顶层文件
- **正确做法：** 增加子目录递归复制（排除 node_modules/skills/dist）；自动检测并复制 manifest
- **发现时间：** 来自采访

### P077 — deploy.sh Step 9 子目录递归在「无子目录 extension」上 glob 字面量 + set -e 中止
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** 部署运行到 Step 9 报 `cp: cannot stat`，`set -e` 立即中止整个部署
- **根因：** glob 无匹配时 bash 保留字面量，`cp -r` 失败，`set -e` 升级为中止
- **错误做法：** 不处理零匹配 glob
- **正确做法：** 子目录循环体首行加 `[ -d '$sub_dir' ] || continue` 守卫
- **发现时间：** 来自采访

### P078 — Read 工具大文件截断（单次 ~25K 字符限制）
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** 单次 `read` 工具返回约 25,000 字符后截断，大文件末尾内容缺失
- **根因：** Read 工具有单次字符上限
- **错误做法：** 假设一次 read 能拿到全部内容
- **正确做法：** 读文件前先 `bash wc -l <file>` 确认行数；超过 1000 行的文件用 `offset` + `limit` 分段读
- **发现时间：** 来自采访

### P079 — Bash heredoc 内 Python f-string / 模板字面量花括号冲突
- **严重程度：** 🟡 MEDIUM
- **类别：** tooling
- **状态：** Active
- **你能观察到的现象：** heredoc 内 Python f-string 的 `{variable}` 被 bash 解析为变量展开
- **根因：** heredoc 对花括号和特殊字符处理脆弱
- **错误做法：** 在 Bash 工具的 inline 脚本中嵌入含 `{}` `$()` 的代码
- **正确做法：** 永远用 Write 工具先写入脚本文件，再用 Bash 工具执行（Write→Bash 两段式）
- **发现时间：** 来自采访

### P080 — Agent 工具调用失败后静默卡死（重试循环 + 无错误报告）
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** Write/Edit/Bash 调用失败时，agent 不向用户报告错误，陷入内部重试循环，用户端完全静默
- **根因：** 工具失败后不报告错误直接重试；多次重试后上下文压缩丢失状态
- **错误做法：** 静默重试不报告
- **正确做法：** 任何工具失败后第一步向用户报告错误；最多重试 2 次；长操作前 emit 进度标记
- **发现时间：** 来自采访

### P081 — Telegram 回复超长截断（>4000 字符）
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Active
- **你能观察到的现象：** 超过约 4000 字符的 Telegram 消息被 API 拒绝或截断
- **根因：** Telegram Bot API 有消息长度限制
- **错误做法：** 直接发送超长消息
- **正确做法：** 超过 3000 字符 → 写入文件发路径 + 摘要；代码超过 30 行 → 一律发文件
- **发现时间：** 来自采访

### P082 — wrapToolDefinition 用 `as` 强制断言但不传播扩展字段
- **严重程度：** 🟠 HIGH
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** bash/grep 工具的 `isConcurrencySafe()`、`isReadOnly()`、`isDestructive()` 在运行时返回 `undefined`
- **根因：** `wrapToolDefinition()` 只传递核心字段，然后用 `as` 强制类型断言声明所有扩展字段——但从未从 `definition` 对象上读取并传播
- **错误做法：** 用 `as` 类型断言偷懒传播工具定义字段
- **正确做法：** 逐字段从 definition 读取并传播
- **发现时间：** 来自采访

### P083 — 测试用例的 fake 对象缺少必要字段导致模块初始化失败
- **严重程度：** 🟡 MEDIUM
- **类别：** testing
- **状态：** Active
- **你能观察到的现象：** 测试中 fake 对象缺少必要字段，模块初始化时访问 undefined 属性报错
- **根因：** fake 对象只填充了测试直接用到的字段，未覆盖模块初始化所需字段
- **错误做法：** 只填充测试断言用到的字段
- **正确做法：** fake 对象必须覆盖模块初始化路径所需的所有字段
- **发现时间：** 来自采访

### P084 — 测试 `describe()` 回调不准捕获 `beforeEach` 变量
- **严重程度：** 🟡 MEDIUM
- **类别：** testing
- **状态：** Active
- **你能观察到的现象：** 使用 `const t = foo` 在 `it()` 内会拿到 `undefined`
- **根因：** `describe()` 回调在 `beforeEach()` 之前执行，此时变量尚未初始化
- **错误做法：** 在 `describe()` 回调中捕获 `beforeEach` 初始化的变量
- **正确做法：** 在 `it()` 内部直接访问变量，不在 `describe()` 回调中捕获
- **发现时间：** 来自采访

### P085 — 代码+测试存在 ≠ 完成：设计-实现鸿沟
- **严重程度：** 🔴 CRITICAL
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** 多个模块标记 '✅ IMPLEMENTED' 但实际是死代码——测试覆盖但无生产调用者
- **根因：** 项目缺乏'代码存在 ≠ 完成'的 Definition of Done
- **错误做法：** 代码+测试存在就标记完成
- **正确做法：** 信 ✅ 前先 `grep -rn funcName src | grep -v test`，零命中即死代码；DoD 增加：生产路径有调用者 + 端到端实跑验证 + 部署后验证
- **发现时间：** 来自采访

### P086 — tsgo 类型检查 53 错误清零
- **严重程度：** 🟠 HIGH
- **类别：** tooling
- **状态：** Resolved
- **你能观察到的现象：** tsgo 全仓类型检查从 53 个错误清零
- **根因：** 7 类错误类型逐一修复
- **错误做法：** 只用 `tsc` 不用 `tsgo` 检查
- **正确做法：** 新文件创建后立即跑 `tsgo --noEmit`（两者严格度不同）
- **发现时间：** 来自采访

### P087 — session-rotation task-segment-tracker 孤儿段
- **严重程度：** 🟡 MEDIUM
- **类别：** data
- **状态：** Resolved
- **你能观察到的现象：** `startSegment()` 在已有活跃段时直接覆盖 `activeSegmentId`，旧段永远停留在 `running` 状态
- **根因：** 缺少对旧活跃段的自动封印逻辑
- **错误做法：** 直接覆盖活跃段引用
- **正确做法：** `startSegment` 开头检测旧活跃段，自动封印为 `incomplete`
- **发现时间：** 来自采访

### P088 — task-segment-tracker completeToolCall 按工具名匹配
- **严重程度：** 🟡 MEDIUM
- **类别：** data
- **状态：** Resolved
- **你能观察到的现象：** 同一工具调用两次只完成第一个
- **根因：** 按名称匹配而非按索引匹配，无法区分同一工具的多次调用
- **错误做法：** 用 `find(tc => tc.tool === tool)` 匹配
- **正确做法：** 接口改为 `completeToolCall(segmentId, callIndex, result)`，按数组索引精确定位
- **发现时间：** 来自采访

### P089 — handoff-inject 轮换后查找失败
- **严重程度：** 🟡 MEDIUM
- **类别：** data
- **状态：** Resolved
- **你能观察到的现象：** `resolveHandoffBlockForSession(newSessionKey)` 返回 null
- **根因：** 只用 `getByChatId` 查找，轮换后新 sessionKey 不是 chatId
- **错误做法：** 只用 chatId 查找
- **正确做法：** 新增 `listByStatus('active')` 回退查找路径
- **发现时间：** 来自采访

### P090 — rotate-session-tool 错误处理不一致
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** `goal` 缺失时抛 `ToolInputError` 异常，但 `nextStep` 缺失时返回警告文本——两种完整性问题处理方式不同
- **根因：** `goal` 校验在 `validateHandoffCompleteness` 之前单独检查，绕过了统一校验
- **错误做法：** 在统一校验前后各加一层检查
- **正确做法：** 移除单独的 goal 检查，所有完整性问题统一走 `validateHandoffCompleteness` + `ToolInputError`
- **发现时间：** 来自采访

### P091 — executeRotation 死代码：仅定义+导出+测试，零生产调用
- **严重程度：** 🔴 CRITICAL
- **类别：** arch
- **状态：** Resolved（PLAN-09 P0 已删除轮换机制）
- **你能观察到的现象：** 序8 设计为'双轨延续'（Macro=压缩会话摘要 + Micro=任务段），但真实运行下 `macroIndex` 恒为 `[]`，只有 Micro 轨工作
- **根因：** `rotation-controller.ts` 的 `executeRotation` 是死代码——仅被 `index.ts` 导出和 23 个测试覆盖，无任何运行时调用者
- **错误做法：** 测试覆盖即认为已接入
- **正确做法：** PLAN-09 P0 已执行——删除 rotation-controller.ts / auto-trigger.ts / rotate-session-tool.ts，HandoffPacket 标注废弃，handoff-inject.ts 改造为索引头注入器，attempt.ts auto-rotation 逻辑移除。延续改走"事件流+认知图谱索引"
- **发现时间：** 来自采访

### P092 — buildAndStoreDualTrackIndex 覆盖抹掉 macro
- **严重程度：** 🔴 CRITICAL
- **类别：** data
- **状态：** Resolved
- **你能观察到的现象：** 修复 P091 后，轮换写入的 MacroIndex 会被运行结束时的索引重建静默清空
- **根因：** `conversation-store.ts` 的 `updateDualTrackIndex` 是全量替换两列，而 `appendMacroIndexEntry` 是增量追加
- **错误做法：** 同一份数据有 append 和 replace 两种写入路径时不明确所有权
- **正确做法：** `buildAndStoreDualTrackIndex` 改为读既有 `macroIndex` 后保留，只刷新 micro 轨
- **发现时间：** 来自采访

### P093 — rotate_session 违反 AgentTool 框架契约
- **严重程度：** 🔴 CRITICAL
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** rotate_session 工具即便注册并被调用，运行时返回的 `content` 为空，模型收不到工具结果
- **根因：** 序8 工具定义全面偏离 `AgentTool` 契约——execute 单参签名、返回 `{ text }` 而非 `{ content }`、schema 字段名 `inputSchema` 而非 `parameters`、缺必填 `label`
- **错误做法：** 凭直觉写工具定义
- **正确做法：** execute 改 `(_toolCallId, input)`；返回 `{ content: [{type:'text', text}], details }`；`inputSchema`→`parameters`；补 `label`
- **发现时间：** 来自采访

### P094 — attempt.ts inputClassification 重复声明
- **严重程度：** 🟡 MEDIUM
- **类别：** api
- **状态：** Resolved
- **你能观察到的现象：** tsgo 报 `TS2451: Cannot redeclare block-scoped variable 'inputClassification'`
- **根因：** 序8 TaskSegment 集成在函数上方新增 `const inputClassification`，但下方原有同名 `const` 声明未删
- **错误做法：** 集成新代码块时不 grep 同名变量
- **正确做法：** 删除下方重复声明，复用上方变量
- **发现时间：** 来自采访

### P095 — blockStreamingDefault='on' 抑制流式草稿预览
- **严重程度：** 🔴 CRITICAL
- **类别：** config
- **状态：** Resolved
- **你能观察到的现象：** agent 在 Telegram 中没有流式输出（token-by-token 逐字显示），消息在生成完成后才一次性出现
- **根因：** `elysiaclaw.json:357` `blockStreamingDefault` 默认为 `'on'`，块流式传输与流式草稿预览互斥
- **错误做法：** 保留默认 blockStreamingDefault='on'
- **正确做法：** `elysiaclaw.json` L357 `blockStreamingDefault` 从 `'on'` 改为 `'off'`。需重启服务生效
- **发现时间：** 来自采访

### P096 — setToolCallPendingApproval 无生产调用者（M0 死代码）
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** `setToolCallPendingApproval` 仅在测试中调用（`task-segment-tracker.test.ts:787`），整个 `src/` 目录下无任何生产代码调用它
- **根因：** M0 是基础铺设阶段，`pending_approval` 状态是 API 预留但尚未在审批流程中接线。`isQuiescent` 中的 `hasPendingApprovals` 检查在 M0 中始终为 false
- **错误做法：** 依赖生产环境中 `pending_approval` 阻止 seal（当前无效）
- **正确做法：** M1/M2 审批流程接入时，需要在 `attempt.ts` 工具调用流中检测需审批的工具并调用 `setToolCallPendingApproval`。M0 阶段可接受，因 API 设计和测试覆盖已完整
- **发现时间：** 2026-06-09（TASK-12 M0 审查）

### P097 — taskTrackerRegistry Map 永不清理（内存泄漏风险）
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** 长期运行后内存占用持续增长，废弃 session 的 tracker 及内部 segments Map 永不释放
- **根因：** `attempt.ts:L175` `taskTrackerRegistry` 是 `Map<string, TaskSegmentTracker>`，只有 `set` 没有 `delete`。`startTimeoutSealLoop` 的 `setInterval` 在 `finally` 块中通过 `stopTimeoutSeal` 正确清理，但 segments 数据本身不会释放
- **错误做法：** 依赖该 Map 自行清理
- **正确做法：** M3 阶段考虑添加 LRU 淘汰或基于 session TTL 的清理机制。当前风险较低（Node.js 单线程 + 实际 session 数量有限）
- **发现时间：** 2026-06-09（TASK-12 M0 审查）

### P098 — activeSeg.body.finalReply 跨模块直接赋值（紧耦合）
- **严重程度：** 🟡 MEDIUM
- **类别：** arch
- **状态：** Active
- **你能观察到的现象：** `attempt.ts:L3109` 直接修改 tracker 返回的 segment 内部对象 `activeSeg.body.finalReply = lastAssistantText.slice(0, 500)`
- **根因：** `getActiveSegment()` 返回的是 tracker 内部的同一内存引用，attempt.ts 利用这一点直接写入 finalReply。如果 TaskSegment body 结构变更，attempt.ts 和 task-segment-tracker.ts 两处都需同步修改
- **错误做法：** 在 tracker 不暴露写入方法的情况下持续跨模块直接操作内部状态
- **正确做法：** 后续可在 tracker 上暴露 `setFinalReply(segmentId, text)` 方法封装此操作。当前 TypeScript 类型系统可捕获结构漂移，风险较低
- **发现时间：** 2026-06-09（TASK-12 M0 审查）

### P099 — dual-track index 双写（onSeal + attempt.ts 均调 buildAndStoreDualTrackIndex）
- **严重程度：** 🔵 INFO
- **类别：** data
- **状态：** Active
- **你能观察到的现象：** force-seal 路径上 `buildAndStoreDualTrackIndex` 被调用两次：一次在 `sealSegment` → `onSeal` 回调中，一次在 `attempt.ts` seal 路径之后
- **根因：** `onSeal` 回调是 tracker 创建时注入的通用回调，而 attempt.ts 的 force-seal 路径额外调用了 `buildAndStoreDualTrackIndex` 作为兜底（处理 conversationId 创建时序问题）。两次写入同一份数据，后者覆盖前者
- **错误做法：** 依赖双写行为（M2/M3 删 dual-track 后会自然消除此问题）
- **正确做法：** M3 删除 dual-track 时一并清理此冗余。当前无害（幂等覆盖），仅浪费一次 I/O
- **发现时间：** 2026-06-09（TASK-12 M0 审查）

### P100 — tracker 创建时 conversationId 为空阻塞 onSeal → 输入到达密封路径无 index 写入兜底
- **严重程度：** 🟡 MEDIUM
- **类别：** data
- **状态：** Active
- **你能观察到的现象：** 用户发新消息且旧段休止时 `sealSegment` 成功封口，但 dual-track index 未写入（`onSeal` 回调因 `conversationId` 为空被跳过）
- **根因：** `onSeal` 中的 `conversationId` 在 tracker 创建时闭包捕获（`attempt.ts:L1462`），若 `resolveSessionKeyViaConversation` 首次返回空 `conversationId`，则此后所有密封的 `onSeal` 都不会写 index。force-seal 路径（error/abort/compaction）有兜底 `buildAndStoreDualTrackIndex` 调用，但**输入到达密封路径（休止→封旧开新）没有兜底**
- **错误做法：** 假设 `resolveSessionKeyViaConversation` 永远返回有效 conversationId
- **正确做法：** 在输入到达密封路径（`attempt.ts:L1486` `sealSegment` 之后）也加上兜底 `buildAndStoreDualTrackIndex` 调用，与 force-seal 路径对齐。或改为在 `startSegment` 时惰性创建 conversationId
- **发现时间：** 2026-06-09（TASK-12 M0 审查）

### P101 — Vitest vi.mock 只在测试文件中被 hoist，非测试文件中的 vi.mock 不生效
- **严重程度：** 🟠 HIGH
- **类别：** testing
- **状态：** Active
- **你能观察到的现象：** 在 harness 文件（非 `*.test.ts`）中调用 `vi.mock("grammy")`，测试文件导入该 harness 后 grammy mock 不生效——Bot 构造函数仍是原始 grammy.Bot，spy 未被调用
- **根因：** Vitest 4.x 只 hoist **测试文件中**的 `vi.mock()` 调用。非测试文件中的 `vi.mock()` 不会被提升到模块解析之前执行，导致 mock 注册晚于被 mock 模块的导入
- **错误做法：** 在 harness/helper 文件中调用 `vi.mock()`，期望测试文件导入 harness 后 mock 自动生效
- **正确做法：** (1) 在测试文件中直接调用 `vi.mock()`，使用异步工厂函数动态导入 harness 获取 spy 变量；(2) harness 中的 spy 变量必须用 `vi.hoisted()` 包裹，确保在 `vi.mock` 工厂执行时已初始化
- **发现时间：** 2026-06-09（TASK-07 PLAN-11 Bot 测试修复）

### 新条目模板
```markdown
### P[NNN] — [标题]
- **严重程度：** [🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🔵 INFO]
- **类别：** [tooling / deps / arch / api / config / data / testing / security]
- **状态：** [Active]
- **你能观察到的现象：** [描述]
- **根因：** [描述]
- **错误做法：** [描述]
- **正确做法：** [描述]
- **发现时间：** [date]
```

## 反模式（通用）
- 用 `as` 类型断言偷懒传播工具定义字段
- 新增工具后忘记四层注册（L1→L2→L3→L4）
- Bot 和 TUI 只验证一个路径
- 修改 YAML 配置后不验证
- 代码+测试存在就标记完成（必须生产路径实跑）
- 字段名猜测（先 grep 实际接口定义）

## 绝对禁止
- [ ] NEVER 在 pi-mono 根目录运行 pnpm install（P049/P052）
- [ ] NEVER 用 heredoc 写文件（P001）
- [ ] NEVER 用 sed 做字符串替换（P002）
- [ ] NEVER 直接调 tsgo（P006）
- [ ] NEVER 覆盖 `~/.elysiaclaw/.env` 中的密钥
- [ ] NEVER 提交密钥到 git
- [ ] NEVER 在 bot 和 TUI 模式只验证一个路径（P017/P054）
- [ ] NEVER 用 `as` 类型断言偷懒传播工具定义字段（P082）
- [ ] NEVER 相信代码+测试存在就代表功能完成（P085）

## 更新协议
发现新陷阱时：
1. 分配下一个顺序 ID（当前最大 + 1，补零三位）
2. 在「索引」表追加新行
3. 在「条目」区追加完整条目（使用新条目模板）
4. 更新文件头部的条目计数与日期

**非技术用户自然语言记录方式**：用户可直接说"记住，改头像功能时千万别动密码文件"，AI 自动转化为一个 Pitfall 条目并插入。
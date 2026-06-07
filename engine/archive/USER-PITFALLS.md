# ElysiaClaw — 完整踩坑记录 (Complete Pitfalls)
> 合并自 5 个源文件 | 生成: 2026-06-07 06:33:02
> 源: LEARNINGS.md + openclaw-bugs.md + ERRORS.md + PITFALLS.md + RESOLVED.md

---


## PART 1: LEARNINGS.md (学习记录)

### LRN-20260329-002  [?] pri=?
— cron任务故障：配置矛盾与超时问题
[CONFIG] | High | config
多个cron任务因配置矛盾、指令不清晰、超时设置不合理而失败。OpenRouter任务使用agentTurn但指令说"不使用子代理"，新闻任务太复杂导致队列堆积。
**硬化建议**：复杂任务脚本化（创建openrouter-free-models.sh、daily-news-tavily.sh），指令明确具体，超时根据任务复杂度合理设置（300秒）。
✅ HARDENED → scripts/guards/cron_config_validator.py

### LRN-20260327-001  [?] pri=?
— Windows 命令执行：严格遵守 winops.py 封装
[GUARD] | Critical | windows-ops
Use winops.py wrapper only, never manual PowerShell.
**Hardening proposal**: windows_ops_guard.py blocks direct ssh/powershell commands.
✅ HARDENED → scripts/guards/windows_ops_guard.py

### LRN-20260327-009  [?] pri=?
— Cron jobs.json 修改必须原子操作
[GUARD] | Critical | config
jobs.json must be read-modify-atomic write. Never overwrite directly.
**Hardening proposal**: atomic_cron_guard.py validates cron modifications use atomic ops.
✅ HARDENED → scripts/guards/atomic_cron_guard.py

### LRN-20260327-010  [?] pri=?
— Proxy config: 动态读取端口
[GUARD] | Critical | network
Must read from env HTTP_PROXY/HTTPS_PROXY/ALL_PROXY.
**Hardening proposal**: proxy_startup_validator.py checks proxy config uses env vars.
✅ HARDENED → scripts/guards/proxy_startup_validator.py

---

## [GUARD] — Needs gate script

### LRN-20260325-009  [?] pri=?
— Do not fabricate observations
[GUARD] | Critical | honesty
Only state verified facts. "I'm not sure" is valid.
**Hardening proposal**: Extended output_validator.py with hallucination detection patterns.
✅ HARDENED → scripts/guards/output_validator.py

### LRN-20260326-006  [?] pri=?
— Subagent task complexity ceiling
[GUARD] | High | workflow
Do not spawn multi-step, multi-file, multi-tool tasks.
**Hardening proposal**: subagent_preflight.py estimates steps, exit 1 if > 4.
✅ HARDENED → scripts/guards/subagent_preflight.py

### LRN-20260327-013  [?] pri=?
— Command success ≠ actual state change
[GUARD] | Critical | verification
Always verify state via separate query after commands.
**Hardening proposal**: verify_state.py template accepts expected state and queries actual state.
✅ HARDENED → scripts/guards/verify_state.py

### LRN-20260328-001  [?] pri=?
— Heartbeat script pipefail compatibility
[GUARD] | High | infra
Heartbeat scripts must handle pipefail gracefully.
✅ HARDENED → scripts/guards/heartbeat_pipefail_compat.py

### LRN-20260328-002  [?] pri=?
— JSON config must be validated before write
[GUARD] | High | config
Validate JSON structure completeness (especially subagents position) before writing.
✅ HARDENED → scripts/guards/json_config_validator.py

### LRN-20260328-003  [?] pri=?
— Cron jobs require explicit timeout
[GUARD] | Critical | config
All cron jobs must have timeoutSeconds set to avoid infinite runs.
✅ HARDENED → scripts/guards/cron_job_timeout_validator.py

### LRN-20260328-005  [?] pri=?
— Cron job timeout must match task complexity
[GUARD] | Critical | config
Timeouts too short for payload (subagents, parallel searches) cause repeated failures.
**Hardening proposal**: Validate timeout sufficiency based on payload complexity (subagent count, message length, parallel ops).
✅ HARDENED → scripts/guards/cron_job_timeout_sufficiency.py

### LRN-20260328-006  [?] pri=?
— Specific known problematic jobs require minimum timeout
[GUARD] | Critical | config
From heartbeat failures: Daily News needs ≥600s, OpenRouter ranking needs ≥600s.
**Hardening proposal**: Extend cron_job_timeout_sufficiency.py with known-job minimums override.
✅ HARDENED → scripts/guards/cron_job_timeout_sufficiency.py

---

## [BEHAVIOR] — Text-only

### LRN-20260329-001  [?] pri=?
— 新闻推送逻辑优化：用户纠正时间安排
[BEHAVIOR] | High | config
用户纠正新闻推送逻辑：22:00应获取当天时效性新闻，6:00应获取昨天全面总结。原方案（22:00今日回顾+明日展望，8:00昨夜动态+今日日程）不符合实际使用习惯。
**调整方案**：完全按用户建议调整，22:00任务改为"今日实时热点"（时效性优先），6:00任务改为"昨日全面总结"（全面性优先）。

### LRN-20260329-003  [?] pri=?
— Tavily搜索集成：提升新闻质量
[BEHAVIOR] | Medium | config
成功集成Tavily搜索到新闻任务中，提供更实时、更相关的新闻内容。原方案只抓取BBC RSS新闻有限，新方案结合BBC RSS和Tavily搜索，新闻全面、实时、质量高。
**硬化建议**：在所有新闻相关任务中使用Tavily搜索增强，根据不同时间点优化搜索关键词，添加备用方案（BBC RSS）提高可靠性。

### LRN-20260324-006  [?] pri=?
— PUA ≠ skip confirmation
[BEHAVIOR] | Critical | discipline
PUA/PUI mode does NOT skip user confirmation for destructive ops.

### LRN-20260325-011  [?] pri=?
— Game automation: follow memory file exactly
[BEHAVIOR] | Critical | automation
MiHoYo automation must follow mihoyo-automation.md exactly.

### LRN-20260327-012  [?] pri=?
— Telegram delivery failure: check proxy first
[BEHAVIOR] | High | debugging
Check proxy config first when Telegram fails.

### LRN-20260328-004  [?] pri=?
— 并行搜索引擎数应 ≤3
[BEHAVIOR] | Medium | search
Avoid exceeding concurrent limits by keeping parallel engines ≤ 3.

### LRN-20260403-002  [?] pri=?
— Daily note 必须写入 daily-notes/ 子目录
[GUARD] | High | infra
Cron 任务 `c087e8a5`（每日记忆维护）曾硬编码 `memory/$(date +%Y-%m-%d).md` 导致文件出现在 memory/ 根目录。
**修复**：路径更正为 `memory/daily-notes/$(date +%Y-%m-%d).md`。
**预防**：infra-guard 架构扫描检测 misplaced files。
✅ HARDENED → cron job c087e8a5 path fixed, infra-guard scan detects (infra-guard skill: ~/.openclaw/skills/infra-guard/SKILL.md)

### LRN-20260403-001  [?] pri=?
— 多步骤查询任务用 task/plan 组织
[BEHAVIOR] | High | workflow
系统体检、进程分析、多组件检查等多步骤查询任务，不应串行发一堆 exec 干等结果。应该：
(1) 用 task_create 为各独立检查项创建并行任务
(2) 用 task_output 统一收集结果
(3) 复杂组合任务（体检+修复）先走 enter_plan_mode 列出计划再执行
**教训**："记住了"不够，写进文件才算数。

**补充**：不仅限于体检，任何需要多次 exec 尝试/切换策略的任务都应该用 task 跟踪——包括网络诊断、RSS 抓取调试等。反复试错不用 task = 遗忘进度。

---

### LRN-20260607-B01  [?] pri=?
— RECALL signals must be read before answering
[BEHAVIOR] | High | memory
When RECALL injects memory snippets, MUST use `memory_get` to pull full content before answering. Never rely solely on current-session memory for cross-session questions.
**Trigger**: Any question about "之前" / "previous" / "did we discuss" — check RECALL first.
✅ HARDENED → behavior rule

## Pending

### LRN-20260327-P05  [?] pri=?
— OneDragon process detection ambiguity
[GUARD] | Medium | automation
Process name "Python" is too generic. Need window title matching.
**Hardening proposal**: process_detection_guard.py blocks generic process names without window title disambiguation.
✅ HARDENED → scripts/guards/process_detection_guard.py

---

## PART 2: openclaw-bugs.md (Bug 记录)

### 坑1
- **症状**: `gateway.host` 报 Unrecognized key
- **原因**: 该字段不存在
- **解决**: 改用 `gateway.bind: "lan"` 或启动参数 `--bind lan`

### 坑4
- **症状**: gateway 只监听 loopback，Windows 连不上
- **原因**: 默认 bind=local
- **解决**: `gateway.bind: "lan"`，重启后监听 `0.0.0.0:18789`

### 坑9
- **症状**: `gateway.mode: "node"` 报 Invalid input
- **原因**: 没有 node 这个 mode
- **解决**: Windows 端连 Ubuntu 用 `mode: "remote"` + `remote.url/token`

### 坑13
- **症状**: 单个 agent 写 `imageModel` 报 Unrecognized key
- **原因**: 该字段只能放 `agents.defaults`
- **解决**: 从 `agents.list` 每个 agent 里删掉，统一放 defaults

### 坑19
- **症状**: 顶层 `"security": {}` 报 Unrecognized key
- **原因**: 该顶层字段不存在
- **解决**: exec 权限用 `tools.exec` + `channels.telegram.execApprovals` + `approvals allowlist` 组合控制

### 坑3
- **症状**: 所有模型 401，systemctl show 里找不到 key
- **原因**: openclaw.json 的 env 块只有进程运行后才读，systemd 启动时进程还不存在
- **解决**: 所有 API key 必须写入 proxy.conf drop-in（~/.config/systemd/user/openclaw-gateway.service.d/proxy.conf），改后 daemon-reload + restart

### 坑2
- **症状**: getUpdates 409 冲突
- **原因**: 多个实例共用同一 bot token
- **解决**: 停掉旧实例；不同平台用不同 token；curl .../deleteWebhook 清除旧 webhook

### 坑5
- **症状**: 本机 CLI 报 SECURITY ERROR: plaintext
- **原因**: bind=lan/tailnet 后本机 CLI 也需要显式允许
- **解决**: 每次 Ubuntu CLI 操作加前缀：OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1 OPENCLAW_GATEWAY_URL=ws://100.111.4.5:18789 openclaw <cmd> --token [REDACTED]

### 坑10
- **症状**: Windows 端口被 VS Code 占用
- **原因**: VS Code Node.js 随机占用端口
- **解决**: Windows node host 改用其他端口（如 19000），或启动加 --force

### 坑16
- **症状**: Start-Process "openclaw" 报"不是有效 Win32 应用程序"
- **原因**: openclaw 是 .ps1 shim，不是 .exe
- **解决**: 改用 & "E:\nodejs\openclaw.ps1" node run ...；$LASTEXITCODE 可正常获取

### 坑6
- **症状**: nodes run 在 Windows headless node 永久卡住
- **原因**: Windows 端缺少 `exec-approvals.json`，approval socket 从未建立；**不是** Bug #22176，之前误判
- **解决**: 在 Windows 上创建 `C:\Users\19645\.openclaw\exec-approvals.json`（见下方说明），重启 node host 后 system.run 立即正常

### 坑18
- **症状**: execApprovals.enabled: false 后 exec 完全失权
- **原因**: false = 禁用 exec 功能，不是跳过审批
- **解决**: 保持 enabled: true，用 allowlist 跳过：approvals allowlist add "*" + approvals allowlist add --agent main "*"（必须两条都加，只加 "*" Telegram 的 main agent 仍会弹审批）

### 坑8
- **症状**: Windows node 反复报 token_mismatch
- **原因**: node run 读的是环境变量 OPENCLAW_GATEWAY_TOKEN，不是 config 里的 gateway.remote.token
- **解决**: start-node.ps1 必须包含 $env:OPENCLAW_GATEWAY_TOKEN="[REDACTED]" 和 $env:OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1

### 坑11
- **症状**: 隔几天 Windows 节点需要重新配对
- **原因**: openclaw doctor --fix 重新生成 gateway token
- **解决**: 固定 token：openclaw config set gateway.auth.token "***"; 每次 doctor 后检查 token 并同步 Windows 两处配置

### 坑7
- **症状**: SSH 启动 GUI 程序黑屏
- **原因**: 无桌面会话（Desktop Session）
- **解决**: 用任务计划程序 /ru 用户名 /it 参数在用户桌面会话启动：schtasks /run /tn "BetterGI-Auto"

### 坑12
- **症状**: screen.capture / mouse.click 在 Windows node 不可用
- **原因**: 官方无 Windows companion app
- **解决**: 通过任务计划程序 / AHK / pyautogui 实现，均需桌面会话

### 坑14
- **症状**: heredoc 里的反引号被 bash 解析
- **原因**: 反引号在 bash heredoc 中有特殊含义
- **解决**: 改用 Python 写入：python3 -c "with open('/path','w') as f: f.write('内容')"

### 坑15
- **症状**: 手动改了 openclaw.json，doctor --fix 后被覆盖
- **原因**: doctor 会重新生成标准配置
- **解决**: 避免用 doctor --fix；只用 openclaw config set 或直接编辑 JSON

### 坑17
- **症状**: 任务计划程序中 node 日志停止更新
- **原因**: while 循环卡在 openclaw 调用（进程运行中），只有退出重试时才写日志
- **解决**: 日志不动 = 连接稳定，属正常现象

### 坑20
- **症状**: allowlist 已配置 `"*"` + `main`，exec 仍卡死；Telegram 点批准后报 `unknown or expired approval id`，每次超时约 2 分钟
- **原因**: `exec-approvals.json` 里 socket 路径硬编码为错误用户名（`/home/claw/...`），实际用户是 `elysia`；gateway 启动时找不到路径，socket 创建失败；你在 Telegram 点批准，gateway 根本接收不到信号
- **解决**: 用 python3 把 socket path 改为正确路径，重启 gateway：`python3 -c "import json; f=open('/home/elysia/.openclaw/exec-approvals.json','r+'); d=json.load(f); d['socket']['path']='/home/elysia/.openclaw/exec-approvals.sock'; f.seek(0); json.dump(d,f,indent=2); f.truncate()"` 然后 `systemctl --user restart openclaw-gateway.service`

---

## PART 3: ERRORS.md (错误日志)

### ERR-20260329-001
- **时间**: 2026-03-29T00:12:00+08:00
- **优先级**: high
- **状态**: resolved
**Area**: config
cron任务超时

**Logged**: 2026-03-29T00:12:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
多个cron任务因超时、配置问题而失败，包括OpenRouter免费模型排行和每日新闻任务。

### Error
```
cron: job execution timed out
⚠️ 🧑🔧 Sub-agent: `label Search Orchestrator, task OpenRouter free models 2026 ranking, timeout 600, cleanup delete` failed
Provider returned error
```

### Context
- **OpenRouter免费模型排行任务** (`8aa1422b-0823-4d4b-8707-6b9f225c109d`)：
  - 多次失败：超时、子代理失败、Provider错误
  - 超时时间：120秒、600秒
  - 使用模型：MiniMax M2.5, Llama 3.3 70B

- **每日新闻任务** (`768aae95-ddb5-451b-a346-da0fa35a1c90`)：
  - 今天6:00任务没有运行
  - 日志显示：`lane wait exceeded: waitedMs=127996`
  - 任务在队列中等待128秒后可能失败

### Suggested Fix
1. **复杂任务脚本化**：创建专用脚本，直接执行
2. **指令清晰化**：明确具体命令，避免代理误解
3. **超时合理化**：根据任务复杂度设置合理超时
4. **重试机制**：添加重试策略，提高可靠性

### Re

### ERR-20260329-002
- **时间**: 2026-03-29T00:12:00+08:00
- **优先级**: medium
- **状态**: resolved
**Area**: config
cron调度器错过

**Logged**: 2026-03-29T00:12:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: config

### Summary
每日新闻任务今天6:00没有运行，虽然被触发但在队列中等待过久。

### Error
```
Mar 28 06:04:37 elysiaserver node[3828216]: 2026-03-28T06:04:37.993+08:00 [diagnostic] lane wait exceeded: lane=session:agent:main:cron:768aae95-ddb5-451b-a346-da0fa35a1c90 waitedMs=127996 queueAhead=0
```

### Context
- 任务ID：`768aae95-ddb5-451b-a346-da0fa35a1c90`（每日新闻）
- 计划时间：每天6:00
- 状态：任务被触发，但在队列中等待128秒
- 可能原因：任务太复杂、系统资源不足、与其他任务冲突

### Suggested Fix
1. 简化任务复杂度
2. 调整任务时间避免冲突
3. 增加系统资源监控
4. 添加任务失败警报

### Resolution
- **Resolved**: 2026-03-28T23:40:00+08:00
- **Actions Taken**:
  1. 创建简化脚本：`scripts/daily-news.sh`
  2. 优化任务配置：明确指令，合理超时
  3. 调整任务逻辑：改为模型驱动 + Tavily搜索
- **Notes**：任务已修复并优化，明天应该能正常运行

### Metadata
- Reproducible:

### ERR-20260324-001
- **时间**: 2026-03-24T23:35:00+08:00
- **优先级**: medium
- **状态**: in_progress
**Area**: infra
ssh_encoding

**Logged**: 2026-03-24T23:35:00+08:00
**Priority**: medium
**Status**: in_progress
**Area**: infra

### Summary
SSH 到 Windows 时中文路径编码导致程序无法启动

### Details
Clash for Windows 路径含中文字符，SSH 传输时编码损坏导致 Start-Process 和 cmd start 均失败

### Suggested Fix
用 PowerShell 脚本文件代替内联命令，或使用通配符路径匹配

### Resolution
- **Resolved**: (partial)
- **Notes**: 已有 PowerShell 脚本绕过中文编码问题（见 permanent.md SSH 中文路径条目），长期方案待定

### Metadata
- Reproducible: yes
- Tags: ssh, encoding, windows

---

### ERR-20260325-001
- **时间**: 2026-03-25T08:05:00+08:00
- **优先级**: high
- **状态**: resolved
**Area**: infra
cron_delivery

**Logged**: 2026-03-25T08:05:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
每日新闻 cron job 状态显示 ok 但实际未成功投递

### Details
每日新闻 cron job 在 06:00 运行，state 显示 lastStatus: ok，但：
- news/ 目录为空（文件未保留）
- Telegram 未收到推送消息
- gateway 日志无相关记录
- Windows 节点离线，文件可能被删除后无法恢复

### Context
- Cron job announce delivery 模式可能在 agent 提前结束时静默失败
- 文件同步到 Windows 后本地删除，Windows 离线则文件丢失

### Suggested Fix
1. 增加 local 保留逻辑：即使同步成功也在本地保留副本
2. 检查 announce delivery 的可靠性
3. 考虑用 best-effort-deliver 选项

### Resolution
- **Resolved**: 2026-03-25T08:35:00+08:00
- **Notes**: cron job 显示 delivery=delivered，消息实际已发出。文件问题已修复：本地保留备份不再删除

### Metadata
- Reproducible: unknown
- Tags: cron, delivery, announce, windows-sync

---

### ERR-20260325-002
- **时间**: 2026-03-25T04:35:00+08:00
- **优先级**: high
- **状态**: resolved
**Area**: config
sonar_usage

**Logged**: 2026-03-25T04:35:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
Cron agent 使用付费 web_search (Perplexity Sonar) 导致 OpenRouter 扣费

### Details
2026-03-24 22:00 的前沿新闻 cron job 执行时使用了 web_search（Sonar）而非指定的 web_search-free，OpenRouter 产生了付费请求

### Suggested Fix
从 tools.allow 中移除 web_search，彻底禁止使用

### Resolution
- **Resolved**: 2026-03-25T04:35:00+08:00
- **Notes**: 已从 openclaw.json tools.allow 中移除 web_search，gateway 重启生效

### Metadata
- Reproducible: no (已禁用)
- Tags: cron, sonar, paid, web_search

---

### ERR-20260326-001
- **时间**: 2026-03-26T08:53:00+08:00
- **优先级**: medium
- **状态**: pending
**Area**: infra
sessions_spawn_agentId_forbidden

**Logged**: 2026-03-26T08:53:00+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
sessions_spawn 调用被拒绝：agentId not allowed

### Error
"agentId is not allowed for sessions_spawn (allowed: none)"

### Context
- Command: `sessions_spawn(mode="run", agentId="coder", task="...", timeout=600)`
- Purpose: 创建运维子代理修复 cron 任务
- System: OpenClaw agent routing
- Root cause: 调用时指定了 agentId="coder"，但 OpenClaw 当前不允许显式指定 agentId（可能是 agentId="none" 或未配置容许列表）

### Suggested Fix
移除 agentId 参数，让系统自动路由到 appropriate 模型。如需强制特定模型，使用 `model` 参数（如 model="openrouter/minimax/minimax-m2.5:free"）而不是 agentId。

### Metadata
- Reproducible: yes
- Related Files: openclaw.json (agents defaults)
- See Also: LRN-20260324-006 (PUA ≠ skip confirmation)
- Recurrence-Cou

### ERR-20260325-005
- **时间**: 2026-03-25T12:11:00+08:00
runtime_error

**Logged**: 2026-03-25T12:11:00+08:00
**Resolved**: partial
**Command**: `python3 windows_proxy.py "query" --json`
**Area**: automation

### Error
Chrome launch via SSH `start` command fails — process never appears

### Context
SSH Session 0 不支持 GUI 程序启动。Companion Service 只有 mouse/keyboard/screenshot/process，没有 app launch 能力。schtasks /run 能起 GUI 程序（需要 InteractiveToken 任务），但直接 `start` 不行。

### Suggested Fix
GUI 程序必须通过 schtasks（InteractiveToken + HighestAvailable）启动，不能用 SSH `start` 命令

### Resolution
- **Resolved**: 2026-03-25T12:12:00+08:00
- **Notes**: 星铁一条龙用 schtasks 成功启动；Chrome 搜索改用 DDG HTML 模式

### Metadata
- Tags: windows, ssh, session0, chrome, launch

---

### ERR-20260327-001
- **时间**: 2026-03-27T17:35:00+08:00
- **优先级**: high
- **状态**: in_progress
**Area**: windows-ops
click_verification_failure

**Logged**: 2026-03-27T17:35:00+08:00
**Priority**: high
**Status**: in_progress
**Area**: windows-ops

### Summary
OneDragon click command returned success but user observed no mouse movement occurred

### Details
- Command: `winops.py click 1406 837`
- Output: "OK: mouse click at (1406, 837)"
- User report: "没有点击 甚至鼠标都没有移动" (no click, mouse didn't even move)
- Follow-up: Companion Service ping successful, Python processes present, task scheduled successfully

### Context
The winops.py click operation uses Companion Service HTTP API. The API returned success but the actual mouse action either:
1. Did not execute (Companion bug)
2. Executed on wrong window/screen (coordinate mismatch)
3. Was too quick to observe (timing)

### Root cause analysis
The agent relied

### ERR-20260327-002
- **时间**: 2026-03-27T17:35:00+08:00
- **优先级**: high
- **状态**: in_progress
**Area**: windows-ops
screenshot_base64_encoding

**Logged**: 2026-03-27T17:35:00+08:00
**Priority**: high
**Status**: in_progress
**Area**: windows-ops

### Summary
Telegram screenshot failed with base64 decode error containing non-ASCII characters

### Error
```
ValueError: string argument should contain only ASCII characters
UnicodeEncodeError: 'ascii' codec can't encode characters in position 10-12
```

### Details
- Command: `winops.py screenshot --telegram`
- Failure location: `tools/save_screenshot.py` line 3
- The script expects clean ASCII base64 but receives string with non-ASCII characters
- Root cause: Companion Service response may contain encoding artifacts (likely UTF-8 with BOM or mixed encoding)

### Context
The winops.py screenshot flow:
1. SSH curl.exe to Companion /screenshot endpoint
2. Rec

---

## PART 4: PITFALLS.md (开发踩坑)

### 高频警告（必读）



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
| deploy.sh extensions 未同步 | #71 |
| plugin allowlist 时序误报 | #72 |

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

*记录截至 2026-06-07，坑 #77。下次遇到新坑从 #78 开始追加。*

---

## PART 5: RESOLVED.md (已解决记录)

LRN-20260326-007 — Parallel search timeout and rate-limit guard
**Priority**: high | **Area**: performance
When using `parallel-search-aggregator`:
- Timeout: 900s for >3 engines or complex domains
- Exponential backoff on 429: 60s → 120s → 240s
**Tags**: search, rate-limit, timeout, parallel



## 2026-03-27

- **LRN-20260327-011**: All test assets rule completed; moved to test-assets dir and cleaned.

---

## 统计摘要

| 来源 | 条目数 |
|------|--------|
| LEARNINGS.md | 22 |
| openclaw-bugs.md | 20 |
| ERRORS.md | 9 |
| PITFALLS.md | 76 |
| RESOLVED.md | 1 |
| **总计** | **128** |
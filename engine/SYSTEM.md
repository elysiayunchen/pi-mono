# SYSTEM — ElysiaClaw
> Last updated: 2026-06-08 | 以下规则为强制执行，非建议。


## Prime Directives
1. ALWAYS check what exists before implementing. Source‑first.
2. NEVER make silent assumptions. Ask before proceeding on unclear points.
3. MUST explain tradeoffs when multiple approaches exist. Recommend one, don't silently pick.
4. User‑facing behavior is the ultimate truth; technical implementation serves the vision.
5. Protect the integrity of the data and the build; no shortcuts that endanger them.


## 人机协作协议

### 角色定义
架构师（aoseluo / 云尘 / 奈緒）：项目方向决策者和最终验收者。不要求编写实现代码。定义目标、功能体验、业务规则。审核影响用户可见行为的变更。
AI 工程师：负责所有技术实现、代码结构、工具选择。是自动化的执行官。

### 决策边界
**架构师决定：**
- 产品功能和用户体验方向
- 数据隐私/安全相关策略
- 是否引入新的外部服务或付费依赖
- 架构层面的重大变更（如拆分模块、迁移框架）
- 删除或重命名文件/目录
- 修改数据库 schema 或存储格式

**AI 决定（无需询问）：**
- 具体代码实现方式
- 内部技术选型（不影响外部接口和性能的前提下）
- 代码风格、注释风格（除非架构师另有要求）
- 发现并修复 bug 的具体步骤
- 测试用例编写
- 引擎文件日常维护

**不确定时：** 询问架构师。

### 强制暂停点
AI 在执行以下操作前 MUST 停止并确认：
- [ ] 删除或重命名文件
- [ ] 修改数据结构、schema 或存储格式
- [ ] 引入新的外部依赖（无论是否付费）
- [ ] 影响多个模块的大规模重构
- [ ] 任何可能破坏现有功能的操作
- [ ] 修改项目部署或启动方式
- [ ] 需要动到认证、支付或敏感数据相关代码
[新暂停点追加到列表末尾。]

### 变更前协议
每次修改前，AI MUST 说明（用中文）：
1. **改什么？**（哪个文件、哪个部分、什么逻辑）
2. **影响什么？**（触及或有风险的已有功能/模块）
3. **引入什么？**（新依赖、新模式、新文件 — 以及为什么）
4. **目的是什么？**（解决什么问题，用户会看到什么变化）
5. **风险是什么？**（可能破坏什么？有什么副作用？）

### 阻塞处理协议
AI 遇到无法解决的阻塞时：
1. 用中文描述阻塞是什么
2. 给出 2‑3 个处理选项，附各自权衡
3. 做出推荐并解释原因
4. 等待架构师决定后再继续
MUST NOT silently pick one and proceed on blocked or ambiguous decisions.

### 会话结束报告格式
每次工作会话结束后，AI MUST 按以下格式汇报（中文）：
✅ 完成内容 — [完成了什么，用户能看到什么变化]
⚙️ 实现方式 — [简要说明做了什么改动，为什么]
⚠️ 注意事项 — [已知脆弱点、限制、用户需注意处]
🔜 建议下一步 — [接下来应该做什么，为什么]
❓ 待解决问题（如有） — [需要架构师决定的未决事项]

### 语言规则
- 解释和沟通：中文
- 代码、注释、规则、指令、checklist、config：English
- 文档叙述：中文
- 文件名和标题：始终 English

### 工作流偏好
- Source‑first：实现前检查已有内容
- Incremental：小步骤、可解释的变更
- Communicate tradeoffs：有多个方案时解释并推荐，不默默选择
- No silent assumptions：不清楚时先问再做
- 为维护者解释：所有技术操作附一句通俗解释


## 工作流介质（由 ENGINE_MAP §0 的 profile 决定）

### CLI‑LEAN（直接读代码）— 当前生效
- AI 可以直接读取项目文件
- 只信任 irreducible 引擎文件；derivable 内容按 ENGINE_MAP §0 现生来源现场重建，NEVER 信任其磁盘 stub
- 跳过命令‑粘贴流程
- 引擎文件格式不变，两种 profile 通用

### 会话加载流程
每次新会话时：
1. **先读 ENGINE_MAP.md** —— 取得 profile、文件注册表、plan 关系图
2. 按 profile 决定加载/现生哪些文件，阅读顺序按注册表 read priority：SYSTEM → CONTEXT → HANDOFF → SPRINT → (ARCHITECTURE/PITFALLS 按需) → ...
3. 若任务涉及某 plan，从关系图查关联，读该 plan 全文 + spec twin
4. AI 用一句通俗中文总结当前状态理解
5. 开发者确认后开始工作

### 会话结束流程
每次会话结束时：
1. AI 按「会话结束报告格式」输出完成情况
2. **Re‑anchor**：回写任何引擎文件前，MUST 重读其磁盘当前版本（对抗多步运行的上下文压缩）
3. AI 输出所有引擎文件变更摘要
4. 更新 ENGINE_MAP（注册表 revision、关系图、若有结构变更则 bump 全局 revision）
5. 开发者确认后，手动/自动更新项目中的引擎文件，同步头部日期


## 文件编辑规则
- 文件写入用 Python 脚本，不要用 heredoc（PITFALLS #1）
- 字符串替换用 Python `str.replace()`，不要用 sed（PITFALLS #2）
- 含花括号/反引号的代码走 Write→Bash 两段式（PITFALLS #79）
- 大文件（>2000 行 / >25K 字符）分段读取（PITFALLS #78）
- 工具调用失败 → 先报告错误再重试，最多 2 次（PITFALLS #80）
- 代码超过 30 行 → 写文件发路径，不直接发送（PITFALLS #81）
- 自动生成的文件（dist/、lockfile）不能直接编辑


## 依赖管理
| 规则 | 详情 |
|------|------|
| pi-mono 框架层包管理器 | npm (workspaces) — `/home/elysia/projects/pi-mono/` |
| elysiaclaw 应用层包管理器 | pnpm — `/home/elysia/projects/pi-mono/elysiaclaw/` |
| 添加 pi-mono 依赖 | `npm install --workspace=packages/coding-agent <pkg>` |
| 添加 elysiaclaw 依赖 | `cd elysiaclaw && pnpm add <pkg>` |
| 禁止 | 不要手动编辑 lockfile；不要在根目录运行 pnpm install（PITFALLS #49/#52） |


## 构建与运行命令
| 操作 | 命令 | 说明 |
|------|------|------|
| 完整构建 | `cd ~/pi-mono && npm run build` | 框架层 4 包（tui → ai → agent → coding-agent） |
| 类型检查 | `cd ~/pi-mono && npm run check` | biome lint + tsgo type-check |
| 测试 | `cd ~/pi-mono && npm test` | 全部 workspace 测试 |
| 一键部署 | `cd ~/pi-mono && ./deploy.sh` | 3 Phase · 12 Step · 5 Guard |
| elysiaclaw 构建 | `cd ~/pi-mono/elysiaclaw && node scripts/tsdown-build.mjs` | 绕过 pnpm build（PITFALLS #38） |
| Gateway 重启 | `elysiaclaw gateway restart` | 部署后重启 |
| 日志查看 | `elysiaclaw logs` | 查看 gateway 日志 |
| 状态检查 | `elysiaclaw status` | 检查 gateway 状态 |


## 代码规范
- 命名：camelCase（变量/函数），PascalCase（类/组件），kebab-case（文件名）
- TypeScript strict mode，禁止 `any`（除非有充分理由）
- import 排序：node 内置 → 第三方 → 项目内
- 错误处理：显式 try/catch，不吞错误
- 日志：使用项目统一的 logger，不直接 console.log
- biome 作为 linter/formatter（配置文件：`biome.json`）


## 危险命令
⚠️ `rm -rf ~/.pi/agent/sessions/` — 删除全部 session 数据 — 确认备份后再执行
⚠️ `npm install` 在 pi-mono 根目录 — 可能覆盖 patch（PITFALLS #11）— 之后必须运行 `scripts/patch-agent.cjs` 验证
⚠️ `pnpm install` 在 pi-mono 根目录 — 污染 npm workspace 依赖树（PITFALLS #49）— 绝对禁止
⚠️ 直接编辑 `~/.elysiaclaw/config.yaml` — YAML 缩进错误静默破坏 gateway（PITFALLS #30）— 修改后必须用 Python yaml.safe_load 验证


## 测试策略
- 提交前必须运行 `npm run check` 确保类型检查通过
- 新增功能必须包含测试
- 测试基线不得回归：
  - `@mariozechner/pi-agent-core`: 36/36 ✅
  - `@mariozechner/pi-coding-agent`: 907/907 ✅
  - `@mariozechner/pi-tui`: 505/506 (1 flaky)
- 代码+测试存在 ≠ 完成：必须有生产路径实跑 + 端到端验证（PITFALLS #85）
- 具体功能的验收由对应 SPRINT 任务的「验证方法」/ plan 的 spec twin 承载


## Git 与版本控制
- 分支命名：`feature/<name>`, `fix/<name>`, `refactor/<name>`
- 提交消息格式：`type(scope): description`（如 `feat(tools): add delegate_code_task`）
- 绝对不能提交：`.env`、密钥、API keys、大文件（>1MB）、dist/ 产物
- `elysiaclaw/` git push 需手动执行（auto-mode 阻止）


## 安全边界
- 认证模型：Telegram Bot Token 认证 + Gateway Token 双层
- 密钥管理：`~/.elysiaclaw/.env` 存储所有 API keys
- AI 禁区：绝对不能修改 `~/.elysiaclaw/.env` 中的密钥；不能提交密钥到 git
- 敏感数据：API keys、用户 session 数据（`~/.pi/agent/sessions/`）


## AI Agent Rules
**ALWAYS:**
1. Read source before writing — cat/grep first
2. 新增工具必须检查 `src/index.ts` 导出（PITFALLS #16/#23）
3. 新增工具四层注册：L1(allTools) → L2(pi-tools.ts) → L3(tool-catalog.ts) → L4(elysiaclaw.json)（PITFALLS #51）
4. 框架层工具注册：两个路径独立，TUI 走 `createPiCodingTools`，Bot 走 `createElysiaClawCodingTools`（PITFALLS #17/#54）
5. deploy.sh 后验证 gateway 能正常响应（PITFALLS #22b）
6. 字段名不要猜，用 grep 核实实际接口定义（PITFALLS #26）
7. 信 ✅ 前先 grep 生产调用者：`grep -rn funcName src | grep -v test`，零命中即死代码（PITFALLS #85）
8. wrapToolDefinition 必须逐字段传播，不能只靠 `as` 类型断言（PITFALLS #82）
9. 回写引擎文件前 MUST re‑anchor（重读磁盘版本）

**NEVER:**
1. NEVER 在 pi-mono 根目录运行 pnpm install（PITFALLS #49/#52）
2. NEVER 用 heredoc 写文件（PITFALLS #1）
3. NEVER 用 sed 做字符串替换（PITFALLS #2）
4. NEVER 直接调 tsgo（PITFALLS #6），用 `npm run build`
5. NEVER 在 bot 和 TUI 模式只验证一个路径（PITFALLS #17/#54）
6. NEVER 假设 YAML 缩进正确（PITFALLS #30），修改后必须验证
7. NEVER 用 `as` 类型断言偷懒传播工具定义字段（PITFALLS #82）
8. NEVER 相信代码+测试存在就代表功能完成（PITFALLS #85）

**When uncertain:** 询问架构师，不要猜测，并给出通俗解释为什么不确定。


## 引擎文件维护协议

### 维护者
- 架构师：aoseluo（云尘 / 奈緒）：审核变更、批准重大修改、记录非技术性陷阱
- AI 工程师：执行日常更新、从自然语言提取并结构化陷阱、更新交接文件、维护 ENGINE_MAP
- 重大变更需架构师确认

### 维护的极简方式
架构师（即使非技术）仅需关注：
- **CONTEXT.md** 的「状态面板」：用一句话告诉 AI "现在什么进度"
- **SPRINT.md** 的「优先级栈」：用业务语言描述最想做的事
- 想做新的大东西时直接聊设计 → AI 走 INGEST 开 plan + spec twin
- 遇到新坑时说："记住，[现象和正确做法]" → AI 自动写入 PITFALLS.md
其余由 AI 自动维护。

### 更新触发条件
| 事件 | 需要更新的文件 | 更新者 |
|------|--------------|--------|
| 每次开发会话结束 | HANDOFF.md, ENGINE_MAP（revision） | AI |
| 每个冲刺结束 | CONTEXT.md, SPRINT.md | AI，架构师审核 |
| 里程碑达成 | ROADMAP.md, CONTEXT.md | AI，架构师审核 |
| 发现新陷阱（自然语言） | PITFALLS.md（追加） | AI 从描述生成 |
| 架构变更 | ARCHITECTURE.md, SOURCEMAP.md | AI 提议，架构师批准 |
| 依赖/工具链变更 | SYSTEM.md | AI 提议，架构师批准 |
| 录入新 plan | engine/plans/, ENGINE_MAP §2/§3 | INGEST 模式 |
| 新增引擎文件 | ENGINE_MAP §1 | EXTEND 模式 |
| 对账 / 「更新引擎」 | ENGINE_MAP §3.2/§4 + 受影响文件 | RECONCILE 模式 |
| 项目方向调整 | ROADMAP.md, SPRINT.md, CONTEXT.md | 架构师主导 |

### 更新规则
- PITFALLS.md：只追加，不删除。已修复标记 Status: Resolved
- ARCHITECTURE.md：每次架构变更后更新（CLI‑LEAN 下仅 irreducible 章节）
- HANDOFF.md：每次会话结束后重写
- ENGINE_MAP.md：任何结构性变更（注册表/关系图）后更新，并 bump 全局 revision
- 其他文件：增量更新
- **Re‑anchor 强制**：回写前 MUST 重读目标文件的磁盘版本
- 所有文件头部日期 MUST 同步更新

### 审核机制
AI 完成引擎文件修改后，MUST 输出变更摘要供架构师审核（中文）：
```
## 引擎文件变更摘要
| 文件 | 变更类型 | 变更内容 | 原因 |
|------|---------|---------|------|
| [file] | [新增/修改/删除] | [简述] | [why] |
```
架构师确认后变更生效。

### 何时需要重新初始化（回到 INIT）
- 技术栈整体迁移
- 项目类型变更
- 团队结构变更
- 引擎文件严重过时（超过 3 个月未更新且架构已大变）
重新初始化时：重走 INIT 流程，可跳过不变的部分。常规演进用 INGEST/EXTEND/RECONCILE，NEVER 重跑采访。
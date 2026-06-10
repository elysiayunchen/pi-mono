# Elynyx 记忆系统激活 — 执行手册(Runbook)

> **状态: ✅ 全部完成 (2026-06-06)** — T1-T6 所有任务已执行完毕，质量门通过。
> 本文档保留为**历史参考**。后续阶段（World Model Phase 2）见 `SUPERADMIN-AGENT-DESIGN.md`。
>
> **面向:执行 agent**(无需本项目历史上下文,照此即可落地)。
> **配套:`SUPERADMIN-AGENT-DESIGN.md`**(总架构,讲"为什么")。本手册只讲"怎么做"。
> **范围:阶段 1 —「激活记忆引擎」**。后续阶段(World Model、状态机)见设计文档,Runbook 后补。
> 起草:2026-06-06 · 现状基线实测于同日 · 维护:架构 agent(云尘指导)

---

## 0. 你的角色与红线

**你负责**:按下方任务执行配置 / 代码 / 验证,每步给出证据(命令输出、read-back)。
**你不负责**:改架构方向。执行中若发现架构假设不成立 → **停下回报**,不私自改方向。

**红线(违反即停,等用户裁决)**:
1. **Sacred File 改动需用户确认**:`~/.elynx/config.yaml`、`SOUL.md`、`AGENTS.md`、`CLAUDE.md`。改 config 必须 **snapshot → 修改 → validate** 三段式,不可跳步。
2. **验证通过前(T4 完成前)绝不删 Python `session_search`**——它是当前**唯一有数据**的会话检索,误删=记忆能力归零。
3. 禁止 `git push --force` / `reset --hard` / `rm -rf` / 暴露密钥。
4. **任务次序不可颠倒**(见依赖图)。
5. **验证状态,不信命令成功**:每次写后 read-back,每次操作后核对实际状态(Golden Rule 7)。

---

## 1. 现状基线(2026-06-06 实测 — 执行前先复测确认未漂移)

**执行 T2 前,先跑 `elynx memory status` 与下表比对;若已不同,停下回报,不要照旧执行。**

| 维度 | 基线实况 | 来源 |
|---|---|---|
| memory 索引 | **0 chunks · Dirty:yes** | `elynx memory status` |
| Provider | none(requested: openai) | 同上 |
| Sources | **仅 memory(无 sessions)** | 同上 |
| FTS | **ready** ✅ | 同上 |
| Vector | unknown(无 provider) | 同上 |
| 待索引 memory 文件 | 0/54 | 同上 |
| TS 引擎 DB | `~/.elynx/memory/main.sqlite` | 同上 |
| memory workspace | `~/.elynx/workspace` | 同上 |
| 历史 session | **68 个 .jsonl** @ `~/.elynx/agents/main/sessions/` | `find` |
| Python 旁路 DB | `~/.elynx/session-index.db`(1.3MB,68 会话) | `ls` |
| 回填 CLI | `elynx memory index --force`(全量重建) | `memory --help` |
| 自动同步默认 | onSessionStart/onSearch/watch = true;postCompactionForce = true | `memory-search.ts` |

`memory status` 原始输出(基线)：
```
Provider: none (requested: openai)
Model: none
Sources: memory
Indexed: 0/54 files · 0 chunks
Dirty: yes
Store: ~/.elynx/memory/main.sqlite
Vector: unknown
FTS: ready
```

---

## 2. 核心事实链(三句话理解为什么这么做)

1. `src/memory/` 是**生产级 TS 语义记忆引擎**(embeddings 多 provider + sqlite-vec + hybrid + mmr + temporal-decay + FTS),但**线上 0 chunks 空置**,等于没通电。
2. sessions 作为检索源受**双开关 gate**:`sources` 含 `sessions` **且** `experimental.sessionMemory=true`,二者默认都关 → 会话从未进索引。
3. 用户的 Python `session_search`(`session-indexer.py` + LIKE)是**当前唯一有数据的会话检索** → **验证(T4)通过前不可删**。

> 目标:用本栈 TS 引擎(FTS-only 即可离线工作,优于 LIKE)取代 Python 旁路,并接进 agent 认知。**先激活+验证,后切换+清理**,次序不可逆。

---

## 3. 任务分解(有序,带依赖)

```
T1 摸现状 ✅已完成(结果见 §1)
   ▼
T2 开 config(Sacred,需用户确认)──┐
   ▼                              │
T3 全量回填 ◄─────────────────────┘
   ▼
T4 并行验证(质量门,不过不准进 T5)
   ▼
T5 切换 + 清理(删 Python)
   ▼
T6 RECALL 注入(新代码,可与 T5 并行)
```

---

### T1 — 摸现状 ✅ 已完成

结果即 §1 基线。执行 agent 仅需**复测确认未漂移**(跑 `elynx memory status` + `find ~/.elynx/agents/main/sessions -name '*.jsonl' | wc -l`)。

---

### T2 — 开 config 启用 sessions 索引

**目标**:让 memory 引擎把 sessions 纳入索引源。
**前置**:T1 复测通过。**Sacred File,需用户确认。**
**依赖陷阱**:`normalizeSources`(`src/agents/memory-search.ts:114`)证实——只写 `sources:[...,sessions]` 但不开 `experimental.sessionMemory` 时,sessions 会被**静默过滤**。**两个开关都要开。**

**操作(三段式)**:
1. snapshot:`cp ~/.elynx/config.yaml ~/.elynx/config.yaml.bak.$(date +%s)`
2. 修改 `~/.elynx/config.yaml`,加入:
```yaml
agents:
  defaults:
    memorySearch:
      enabled: true
      sources: [memory, sessions]
      experimental:
        sessionMemory: true        # 默认 false;不开则 sessions 被过滤
      provider: auto               # 无 embedding key → 自动 FTS-only,零 API 成本
      fallback: none
      # sync.sessions.postCompactionForce 默认已 true,无需写
```
3. validate:`elynx config validate`(或项目等价校验命令);失败则回滚 snapshot。

**确切 config 键**(已核对 schema,`schema.labels.ts:323-333`):
`agents.defaults.memorySearch.enabled` / `.sources` / `.experimental.sessionMemory` / `.provider` / `.fallback`

**DoD**:`elynx memory status` 的 `Sources:` 行出现 `sessions`。
**回滚**:恢复 `.bak` snapshot + validate。

---

### T3 — 全量回填历史会话

**目标**:把 68 个历史 session JSONL 灌进 TS 索引(否则只有未来 compact 增量,历史召不回)。
**前置**:T2 完成(Sources 含 sessions)。
**操作**:
```bash
elynx memory index --force
```
**为什么够用**:不传 sessionFiles 时,引擎自动枚举 `listSessionFilesForAgent(agentId)`(`src/memory/session-files.ts:21` → `manager-sync-ops.ts:803`)做全量。无需写脚本。
**成本**:Provider=none → 纯本地 FTS chunking,**无 API 花费**;68 会话耗时需观察(给足 timeout)。
**DoD**:`elynx memory status` → `Indexed N/N`(N>0)· `chunks > 0` · `Dirty: no` · By source 出现 sessions 行且 chunks>0。
**回滚**:删 `~/.elynx/memory/main.sqlite` 重新 index;config 不变。

---

### T4 — 并行验证(质量门 · 不过不准进 T5)

**目标**:证明 TS FTS 召回**不差于** Python LIKE,才允许切换。
**前置**:T3 完成。此阶段 **Python session_search 与 TS memory 并存**。
**操作**:对至少 5 个代表性 query 双跑对比(覆盖中英文、运维词):
```bash
for q in "cron" "流式" "deploy" "telegram" "delegate_code_task"; do
  echo "=== $q ==="
  echo "[TS]";     elynx memory search "$q" --max-results 5
  echo "[Python]"; python3 scripts/session-indexer.py search "$q"   # 现有旁路
done
```
**DoD**:每个 query,TS 结果**覆盖** Python 命中的关键会话(允许排序不同、允许 TS 多召回)。若 TS 明显漏召 → 停,回报架构 agent(可能需调 chunking/hybrid 或补 embedding provider),**不要强行进 T5**。
**记录**:把对比结果写入 `elynx_engine/SPRINT.md` 当前 Sprint 段。

---

### T5 — 切换 + 清理(删 Python 旁路)

**目标**:agent 改用 memory_search,移除 Python 旁路。
**前置**:**T4 质量门通过**(硬性)。
**操作**:
1. 改系统提示指引:`src/agents/pi-embedded-runner/run/attempt.ts:1730-1749` 的 `MANDATORY: session_search` 段 → 改为引导 `memory_search`(source 已含 sessions)。
2. 删工具:`src/agents/tools/session-search-tool.ts`。
3. 删脚本:`scripts/session-indexer.py`(及其 DB `~/.elynx/session-index.db`,确认无其他引用后)。
4. 退四层注册(对照新增时的反向):
   - `elynx-tools.ts`:移除 session_search import + 注册
   - `tool-catalog.ts:157`:移除 session_search 条目
   - `elynx.json` tools.allow:移除 session_search
   - 检查 Bot/TUI 双路径均无残留(`rg -n session_search src`)
5. 构建部署:`cd ~/projects/pi-mono && ./deploy.sh`(过 6 道守卫;DTS 走 `tsdown-build.mjs` 绕过)。
**DoD**:`rg -n session_search src` 仅剩历史文档;Telegram 端发"上次我们聊过 X 吗"能经 memory_search 召回;gateway restart 后 `elynx status` reachable。
**回滚**:git 恢复 attempt.ts / 三处注册 + 恢复两个被删文件(删前先 `git stash` 或确认在版本控制内 —— 删除前确认 `git status` 跟踪状态)。

---

### T6 — RECALL 注入(新代码,可与 T5 并行)

**目标**:记忆从"被动工具"升级为"主动注入"——每轮构建 system prompt 时自动召回 top-k,不靠 prompt 求 agent 自己查。
**接入点**:`src/agents/pi-embedded-runner/run/attempt.ts` 构建 system prompt 处(参考现有 `memoryCitationsMode`/指引注入位置,约 1660-1749 区间)。
**实现要点**:
- 调 `getMemorySearchManager({cfg, agentId})`(`src/memory/index.ts`)→ `.search(query, {maxResults})`;
- query 用当前用户输入(或其精简);
- 注入量控制:top-k(建议 3-5)+ 受 mmr/temporal-decay 自然控量,与 s06 压缩协同,避免吃爆 context;
- 失败降级:manager 为 null / search 抛错 → 静默跳过,不阻断主循环。
**DoD**:system prompt 中出现召回片段;关闭注入(config 开关)前后对话连续性可观测对比;不引入明显延迟/token 暴涨。
**注意**:这是阶段 1 与 World Model(阶段 2-3)共用的注入位,实现时预留 World Model 摘要注入的相邻插槽(见设计文档 §6.7)。

---

## 4. 关键代码坐标速查

| 用途 | 坐标 |
|---|---|
| 记忆引擎入口 | `src/memory/index.ts` → `getMemorySearchManager` |
| manager 工厂 + 签名 | `src/memory/search-manager.ts:25` |
| builtin/qmd 分支(builtin 不带 sessions 配置) | `src/memory/backend-config.ts:303` |
| sessions 解锁逻辑(双开关) | `src/agents/memory-search.ts:114`(normalizeSources)/ `:150`(sessionMemory 默认 false) |
| memory 工具启用 gate | `src/agents/memory-search.ts:385`(`!enabled → null`) |
| memory_search/get 工具 | `src/agents/tools/memory-tool.ts` |
| compact 喂入 sessions(三重 gate) | `src/agents/pi-embedded-runner/compact.ts:302-318` |
| 待改的 session_search 指引 | `src/agents/pi-embedded-runner/run/attempt.ts:1730-1749` |
| 待删工具 | `src/agents/tools/session-search-tool.ts` |
| 待删脚本 | `scripts/session-indexer.py` |
| 工具 catalog(memory_search/get/session_search) | `src/agents/tool-catalog.ts:101 / :109 / :157` |
| 全量回填枚举 | `src/memory/session-files.ts:21` · `manager-sync-ops.ts:803` |
| CLI | `elynx memory index --force` / `search` / `status [--json] [--deep]` |
| config 键 | `agents.defaults.memorySearch.{enabled,sources,experimental.sessionMemory,provider,fallback}` |
| 两个 DB | TS:`~/.elynx/memory/main.sqlite` · Python:`~/.elynx/session-index.db` |

---

## 5. 交接(阶段 1 完成后)

- 阶段 1 DoD 全绿 → 更新 `SPRINT.md` / `ROADMAP.md` / `HANDOFF.md` 状态,回报架构 agent。
- 下一阶段 = **World Model 数字孪生**(设计文档 §六):新建 `src/world-model/`,T6 的注入位预留了 World Model 摘要插槽。
- 阶段 1 的产出(memory 引擎激活 + RECALL 注入)是 World Model「RECALL」与「CONSOLIDATE 回喂 src/memory」的前置。

---

*纪律:执行中任何"基线与实测不符 / 质量门不过 / 架构假设不成立",一律停下回报架构 agent,不私自改方向。*

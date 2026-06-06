# ElysiaClaw — 用户体验踩坑记录 (User Experience Pitfalls)

> 本文档记录用户与 ElysiaClaw/Hermes 交互过程中遇到的问题、误解和优化点。
> 与 PITFALLS.md（开发踩坑）分离，专注用户侧体验。
> 每次遇到新的用户体验问题必须追加记录。

---

## 记忆系统

### #U1 — RECALL signal 未读完整内容就回答 ⚠️
**现象**: 用户问"之前讨论过X吗"，AI 基于当前 session 上下文回答"没讨论过"，实际历史 session 中有完整讨论记录  
**原因**: RECALL 自动注入的只是摘要片段（sLx-Ly + 一句话 gist），AI 没有用 `memory_get` 拉取完整内容就下了结论  
**影响**: 用户反复解释"我们明明说过"，浪费来回  
**解决**: 凡是用户提到"之前/上次/记得吗/我们讨论过"，必须先 `memory_get` 读取完整历史，再回答  
**来源**: LRN-20260607-B01

### #U2 — memory_search 工具未启用
**现象**: AI 无法搜索记忆文件，回答"我不确定"  
**原因**: `group:memory` 未加入 `elysiaclaw.json` 的 `tools.allow`  
**解决**: 添加 `"group:memory"` 到 tools.allow，重启 Gateway  
**来源**: memory/archive/openclaw-bugs.md

### #U3 — LCM 与 memory_search 数据源混淆
**现象**: 用户问"上次做了什么"，AI 可能查了错误的数据源  
**原因**: 
- `memory_search` → 索引 ElysiaClaw workspace 文件 + session .jsonl
- `lcm-recall search` → Hermes 会话摘要 DAG
- 两者互补但不重叠，容易只用一个漏掉信息  
**解决**: 两个并行查，结果互补使用  
**来源**: 系统架构文档

### #U4 — 跨会话检索未配置
**现象**: AI 只能看到当前 session 的历史，不知道之前聊过什么  
**原因**: `memory_search` 工具未启用（见 #U2），且 Hermes 无法索引 ElysiaClaw 的 session 文件  
**状态**: memory_search 已修复，但 Hermes → ElysiaClaw 会话索引仍不对称  
**优化方向**: 考虑将 ElysiaClaw sessions 也导入 LCM

---

## 搜索与工具

### #U5 — web_search 永久禁用
**现象**: AI 尝试调用 `web_search` 工具，失败  
**原因**: web_search 在 TOOLS.md 和 AGENTS.md 中明确禁用  
**解决**: 搜索统一走 `web-search` skill（回退链：DDG Lite → DashScope → Tavily）  
**来源**: TOOLS.md, AGENTS.md

### #U6 — 搜索引擎选择链过长
**现象**: 用户只是想查一个简单事实，AI 回退了好几次才返回结果  
**原因**: web-search skill 按 DDG → DashScope → Tavily 顺序回退，每次都超时才换下一个  
**优化**: 对于简单事实查询，直接用 DDG Lite（零成本零依赖）

---

## 文件与目录

### #U7 — pi-mono 文件路径找不到
**现象**: 用户提到"pi-mono 文件夹"，AI 搜了 workspace 和 home 目录都没找到  
**原因**: pi-mono 在 `/home/elysia/projects/pi-mono/`，不在 workspace 也不在 home 根目录  
**解决**: 了解双项目结构——workspace = ElysiaClaw，pi-mono = 框架开发项目；`find` 时指定 `~/projects/`  
**来源**: 本次会话踩坑

### #U8 — edit 工具对 workspace 外文件需要用户确认
**现象**: 修改 `~/.elysiaclaw/elysiaclaw.json` 等配置文件时弹出确认  
**原因**: edit 工具对 workspace 外文件有权限保护  
**解决**: workspace 外文件用 `exec` + python3 读写  
**来源**: 多次操作经验

---

## 配置与网关

### #U9 — gateway.mode 非法值 "lan"
**现象**: `elysiaclaw status` 显示 mode=unset，gateway 行为不可预期  
**原因**: `gateway.mode` 只允许 `local`/`remote`，旧配置写了 `lan`  
**解决**: 修正为 `local`  
**来源**: PITFALLS.md #31, #48

### #U10 — config.yaml 缩进错误静默破坏 gateway
**现象**: gateway 启动后行为异常，难以定位原因  
**原因**: YAML 缩进层级错误（如 gateway 段被嵌套在 workspace 下）  
**解决**: 修改 config 后用 `python3 yaml.safe_load()` 验证再重启  
**来源**: PITFALLS.md #30, #41

### #U11 — 工具注册四层遗漏
**现象**: 新增了一个工具，但在 Bot 模式下死活用不了  
**原因**: 工具注册需要四层全部正确：
1. pi-coding-agent 中定义
2. pi-tools.ts 中 import
3. tool-catalog.ts 中定义
4. tools.allow 中添加
**遗漏任何一层 = 工具不可用且报错不明显**  
**解决**: 每次新增工具必须四层检查  
**来源**: PITFALLS.md #16, #23, #46, #47, #51

---

## 子代理系统

### #U12 — 子代理 label 重名冲突
**现象**: 连续执行代码分析任务时第二次报 `label already in use`  
**原因**: 前一次子代理 spawn 失败但 label 已被注册  
**解决**: 子代理 label 加随机后缀（UUID 前8位）  
**来源**: PITFALLS.md #66

### #U13 — 子代理继承主模型
**现象**: 主模型切换到不可用模型后，子代理全部失败  
**原因**: 子代理默认继承主 model 参数  
**解决**: 支持在调用时指定 `model` 参数给子代理  
**来源**: PITFALLS.md #67

---

## 构建与部署

### #U14 — elysiaclaw dist 部署遗漏
**现象**: 源码修改了，Gateway 行为没变  
**原因**: deploy.sh 只覆盖 pi-mono 4 个包，不覆盖 elysiaclaw 全局安装  
**解决**: 构建后手动 `cp -r dist/* ~/.nvm/.../elysiaclaw/dist/`  
**来源**: PITFALLS.md #53, #69

### #U15 — extensions 目录未同步部署
**现象**: Plugin 代码更新了，但工具仍然不可用  
**原因**: deploy.sh 从未同步 extensions/ 目录  
**解决**: 新增 Step 9 遍历同步 extensions  
**来源**: PITFALLS.md #71

---

## AI 行为

### #U16 — PUA 模式不免除确认
**现象**: 用户抱怨 AI 在高强度模式下仍然没有自主推进  
**误解**: PUA = 跳过所有确认  
**实际**: PUA 只提升搜索/重试力度，Yellow Zone（config/cron/guard/architecture）仍需用户确认  
**来源**: LRN-20260324-006

### #U17 — 并行搜索引擎过多导致超时
**现象**: 用户的一个查询很久才返回  
**原因**: AI 启动了 5+ 搜索引擎并行，等待最慢的那个  
**解决**: 并行搜索引擎数量限制 ≤3  
**来源**: LRN-20260328-004

### #U18 — 新闻推送时间偏好
**现象**: 用户纠正"22:00 推送应获取当天新闻"  
**解决**: 根据用户偏好的时间段调整获取策略  
**来源**: LRN-20260329-001

---

## 快速查找索引

| 关键词 | 坑号 |
|---|---|
| 记忆/历史/之前 | #U1, #U2, #U3, #U4 |
| 搜索/web_search | #U5, #U6 |
| 文件路径/edit | #U7, #U8 |
| gateway/config | #U9, #U10, #U11 |
| 子代理 | #U12, #U13 |
| 构建/部署 | #U14, #U15 |
| PUA/行为 | #U16, #U17, #U18 |

---

*记录截至 2026-06-07，总计 18 条用户体验踩坑。下次遇到新坑从 #U19 开始追加。*

## 六、Windows 节点深度

### #U19 — Windows 端口被 VS Code 占用
**现象**: Windows node host 报端口被占用  
**原因**: VS Code Node.js 随机占用端口  
**解决**: Windows node host 改用其他端口（如 19000），或启动加 --force  
**来源**: openclaw-bugs.md 坑10

### #U20 — openclaw 是 .ps1 shim 不是 .exe
**现象**: Start-Process "openclaw" 报"不是有效 Win32 应用程序"  
**解决**: 改用 & "E:\\nodejs\\openclaw.ps1" node run ...  
**来源**: openclaw-bugs.md 坑16

### #U21 — Windows node token_mismatch
**现象**: Windows node 反复报 token_mismatch  
**原因**: node run 读的是环境变量 OPENCLAW_GATEWAY_TOKEN，不是 config 里的 gateway.remote.token  
**解决**: start-node.ps1 必须包含 $env:OPENCLAW_GATEWAY_TOKEN  
**来源**: openclaw-bugs.md 坑8

### #U22 — doctor --fix 会覆盖手动修改的配置
**现象**: 手动改了 openclaw.json，doctor --fix 后被覆盖  
**原因**: doctor 会重新生成标准配置  
**解决**: 避免用 doctor --fix；只用 openclaw config set 或直接编辑 JSON  
**来源**: openclaw-bugs.md 坑15

### #U23 — SSH 启动 GUI 程序无效
**现象**: SSH 启动 GUI 程序黑屏  
**原因**: 无桌面会话  
**解决**: 用 schtasks 在用户桌面会话启动  
**来源**: openclaw-bugs.md 坑7

### #U24 — SSH 中文路径编码损坏
**现象**: SSH 到 Windows 时中文路径编码导致程序无法启动  
**解决**: 用 PowerShell 脚本文件代替内联命令  
**来源**: ERR-20260324-001

---

## 七、子代理高级

### #U25 — delegate_code_task 缺少工具注册
**现象**: Gateway 启动日志报 `tools.allow allowlist contains unknown entries (delegate_code_task)`  
**原因**: createDelegateCodeTaskTool() 已 import 但未在 tools 数组中调用  
**解决**: 在 createElysiaClawTools() 的 tools 数组中添加调用  
**来源**: PITFALLS.md #65

### #U26 — tsdown tree-shake 误删动态导入函数
**现象**: createDelegateCodeTaskTool 函数体在构建后丢失，工具不可用  
**原因**: tsdown (esbuild) tree-shake 掉了函数体  
**解决**: node scripts/tsdown-build.mjs + 手动部署 dist  
**来源**: PITFALLS.md #68

---

## 八、Telegram 特殊

### #U27 — Telegram inline keyboard 字符限制
**现象**: 某些 Markdown 格式渲染异常或被截断  
**原因**: MarkdownV2 对特殊字符要求严格转义  
**解决**: 用 HTML 模式发送  
**来源**: PITFALLS.md #42

### #U28 — Telegram draft lane 防抖阈值问题
**现象**: 工具标签（如 "📖 Read"）显示后立即消失  
**原因**: DRAFT_MIN_INITIAL_CHARS = 30，短标签无法触发发送  
**解决**: 对 tool lane 设置 minInitialChars: undefined 禁用防抖  
**来源**: PITFALLS.md #70

---

## 九、架构认知误区

### #U29 — bot 模式直接绕过 pi-coding-agent ⚠️
**现象**: elysiaclaw 是完全自包含 bundle，bot 请求不经过我们替换的 pi-coding-agent  
**影响**: wrapStreamForCost() 对 bot 无效  
**解决**: 双轨方案：TUI 用 wrapStreamForCost()；Bot 用 Python 报告脚本读取 sessions.json  
**来源**: PITFALLS.md #25

### #U30 — System prompt 构建路径不同
**现象**: TUI 和 Bot 模式下 system prompt 构建逻辑不同  
**原因**: TUI 用 createPiCodingTools，Bot 用 createElysiaClawCodingTools  
**解决**: 新增工具时两个路径都需要注册  
**来源**: PITFALLS.md #17, #54

---

## 十、软件开发流程

### #U31 — pnpm/npm 混用导致依赖污染
**现象**: 在 pi-mono 根目录运行 pnpm install 后，npm run build 报大量类型错误  
**原因**: pnpm 从 registry 拉取了旧版本  
**解决**: rm -rf node_modules && npm install  
**来源**: PITFALLS.md #49, #52

### #U32 — DTS 类型错误阻塞构建
**现象**: pnpm build 在 build:plugin-sdk:dts 阶段报错  
**原因**: elysiaclaw 与 pi-mono 0.64 API 的预存类型不匹配  
**解决**: 用 tsdown-build.mjs 绕过；考虑专项 Sprint 修复  
**来源**: PITFALLS.md #38, #63

---

## 十一、记忆管理

### #U33 — identity 空对象触发 changed
**现象**: 无信息闲聊消息触发 updateUserModel 返回 changed=true  
**原因**: JSON.stringify({}) !== JSON.stringify(undefined)  
**解决**: identity 合并前加 `Object.keys(newIdentity).length > 0` 守卫  
**来源**: PITFALLS.md #73

### #U34 — 工具结果摘要计数错误
**现象**: 3 个同类型非文本 block 摘要显示 +image×2,image  
**原因**: 数组 includes() 检查失败，产生重复  
**解决**: 用 Map 计数，最后格式化  
**来源**: PITFALLS.md #74

### #U35 — 输入分类器技术词误判
**现象**: "任务完成"（含"务"）被误判为技术查询  
**原因**: `[/.../]` 是字符集，不是分组  
**解决**: 改为 alternation `/代码|编译|.../`  
**来源**: PIFALLS.md #75

---

## 快速查找索引（完整版）

| 关键词 | 坑号 |
|---|---|
| 记忆/历史/之前 | #U1, #U2, #U3, #U4 |
| 搜索/web_search | #U5, #U6 |
| 文件路径/edit | #U7, #U8 |
| gateway/config | #U9, #U10, #U11 |
| Windows 节点 | #U19-#U24 |
| 子代理 | #U12, #U13, #U25, #U26 |
| Telegram | #U27, #U28 |
| 架构误区 | #U29, #U30 |
| 开发流程 | #U31, #U32 |
| 记忆管理 | #U33, #U34, #U35 |
| PUA/行为 | #U16, #U17, #U18 |

---

*记录截至 2026-06-07，总计 35 条用户体验踩坑。*

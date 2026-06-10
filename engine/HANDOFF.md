# HANDOFF — Elynyx
> 初始化日期：2026-06-09 | 会话：35（PLAN-19 看门狗部署闭环 + fallback 链修复 + 可用性止血）
> 每次会话结束后重写此文件。

## ⚡ 立即恢复点
> "针对'agent 因网络/API 未响应'痛点完成 P0 止血：watchdog.mjs 修补+部署实测通过（挂死 90s 自动恢复+TG 告警经代理送达）、fallback 链重排（跨 provider 优先）、deploy.sh Guard 6 + watchdog-pause 契约。"
> 当前优先：**PLAN-18 F1.5 fast-ack 接线（"未响应"体验的下一最短路径）；P2 流式停滞超时调研（chunk 间 inactivity 检测是否存在）待启动。**

## 本次会话总结

### ✅ 完成内容（会话 35）

**P0-3 — 看门狗部署闭环（PLAN-19 H2 落地）**
1. `scripts/watchdog.mjs` 修补：
   - `ELYNYX_WATCHDOG_SYSTEMCTL_USER=1` → `systemctl --user`（生产 gateway 是用户级 unit `elysiaclaw-gateway.service`，原默认 `elynx-gateway` 系统级假设错误）
   - TG 告警走 curl + `--proxy`（**Node 22 全局 fetch 不读 HTTP_PROXY**，直连必死）
   - 重启风暴退避（AC-8/E10）：连续 3 次重启无效 → 停止自动重启 + 🚨 告警，恢复后自动重新启用
   - 告警 kind 维度 flap 抑制（同分钟恢复告警不被吞）
   - deploy pause 标记支持（`~/.elysiaclaw/watchdog-pause`，15min 陈旧保护）
2. 部署：`~/.config/systemd/user/elysiaclaw-watchdog.service`（EnvironmentFile=`~/.elysiaclaw/watchdog.env` 600 权限，Linger=yes 已确认）
3. **AC-2 等价实测通过**：SIGSTOP 监听进程（pid 1463）→ 3×30s 探活失败 → 01:48:48 TG 告警送达（经 7890 代理）→ systemctl --user restart → 01:48:59 恢复（端到端 ~106s）→ 恢复告警送达
4. deploy.sh：新增 Guard 6（看门狗存活检查）+ watchdog-pause 部署窗口标记（开头 touch + trap EXIT 清理）

**P0-2 — fallback 模型链修复**
1. 快照 `elysiaclaw.json.bak.20260611013916` 后修改 `agents.defaults.model.fallbacks`：
   - 旧链问题：fallbacks[0] 与 primary 重复（owl-alpha 挂了再试自己）；5 个里 4 个同走 openrouter（故障域不分离）
   - 新链：`deepseek/deepseek-v4-flash` → `zai/glm-4.6` → `openrouter/nvidia/nemotron-3-super-120b-a12b:free` → `openrouter/qwen/qwen3-next-80b-a3b-instruct:free`（跨 provider 优先，全部已在 models.providers 声明）
2. gateway 重启后已加载新配置（日志 `agent model: openrouter/openrouter/owl-alpha`）

### 🔑 关键事实（本会话实证）
- **gateway 是双进程结构**：MainPID（父）≠ 监听 18789 的子进程——测试/排障时 `ss -tlnp` 找真监听者，别信 MainPID
- **Telegram 代理（127.0.0.1:7890）实测可达**：CONTEXT 旧阻塞"代理不可达"疑为间歇性，看门狗双向告警均送达
- **生产配置真身**：`~/.elysiaclaw/elysiaclaw.json`（CONTEXT 翻译表已修正；`~/.elynx/` 不存在）
- **deploy.sh 整体漂移**：瞄准 `~/.elynx` + `elynx` 全局安装，生产实跑 `elysiaclaw`——需独立任务对齐

### ⏳ 未完成 / 待接续 / 待决策
- **【需用户拍板】process-guard.service 下线**：确认为僵尸（探活 18792 错端口 + 重启 `spawn elysiaclaw ENOENT` 空转），建议 `systemctl --user disable --now process-guard`；权限分类器要求用户显式授权
- **P2 流式停滞超时**：`timeoutMs` 是 run 级总超时，chunk 间 inactivity 检测是否存在未验证——网络半死最常见漏网点
- **P2 fast-ack**：PLAN-18 F1.5 接线
- **P2 surface_error 必达用户**：failover surface_error 路径接 notify-policy
- **fallback 链实战验证**：配置已生效，真实 failover 行为待下次 owl-alpha 故障时观察日志 `embedded_run_failover_decision`
- **deploy.sh elynx/elysiaclaw 路径对齐**（独立任务）

## 架构状态
| 维度 | 状态 |
|------|------|
| PLAN-19 | H1-H4 代码 ✅；H2 看门狗**已部署+实测**（AC-2 等价✅ AC-8 代码✅）；AC-1/3/5/6/7/10 待验证 |
| 看门狗 | `elysiaclaw-watchdog.service` active（user unit，30s 探活回环零外网） |
| fallback 链 | 跨 provider 重排已生效（deepseek→zai→openrouter×2） |
| 部署链 | deploy.sh +Guard 6 +watchdog-pause；⚠️ 整体仍指向 elynx 旧路径 |
| 风险点 | process-guard 僵尸未下线（待用户授权）；代理间歇性需持续观察 |

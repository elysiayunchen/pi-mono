#!/usr/bin/env python3
"""
s12 Worktree 自动清理补丁 v2（基于实际代码修正）
"""
import sys, shutil
from pathlib import Path
from datetime import datetime

DRY_RUN = "--dry-run" in sys.argv
BASE = Path.home() / "pi-mono" / "packages" / "coding-agent" / "src" / "core"
AUTONOMOUS = BASE / "autonomous-runner.ts"
TASK_ASSIGN = BASE / "tools" / "task-assign.ts"

OK = 0; SKIP = 0; FAIL = 0

def backup(p):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = p.with_suffix(f".ts.bak_{ts}")
    shutil.copy2(p, bak)
    print(f"  [backup] {bak.name}")

def patch(path, old, new, label):
    global OK, SKIP
    text = path.read_text(encoding="utf-8")
    if old not in text:
        print(f"  [SKIP] {label}")
        SKIP += 1
        return
    if DRY_RUN:
        print(f"  [dry-run OK] {label}")
    else:
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        print(f"  [OK] {label}")
    OK += 1

# ── autonomous-runner.ts ──────────────────────────────────────────────────
print(f"\n{'='*60}\nPatch: {AUTONOMOUS.name}\n{'='*60}")
if not DRY_RUN: backup(AUTONOMOUS)

# [A] 调用点：透传 keepOnSuccess（签名已改，调用未更新）
patch(
    AUTONOMOUS,
    "await _runInWorktree(sessionId, taskId, taskDescription);",
    "await _runInWorktree(sessionId, taskId, taskDescription, options?.keepWorktreeOnSuccess ?? false);",
    "[A] 调用点透传 keepOnSuccess"
)

# [B] 成功分支：加 removeWorktree
patch(
    AUTONOMOUS,
    '\t\t\tconst result = await sendToTeammate(ephemerTeammateId, taskDescription);\n'
    '\t\t\tupdateTask(sessionId, taskId, { status: "completed", output: result });\n'
    '\t\t\t_notifyHost?.(_buildWorktreeNotification(taskId, "completed", result, entry.worktreePath, entry.branch));',
    '\t\t\tconst result = await sendToTeammate(ephemerTeammateId, taskDescription);\n'
    '\t\t\tupdateTask(sessionId, taskId, { status: "completed", output: result });\n'
    '\t\t\tif (!keepOnSuccess) {\n'
    '\t\t\t\ttry { removeWorktree(worktreeId, true); } catch { /* best-effort */ }\n'
    '\t\t\t}\n'
    '\t\t\t_notifyHost?.(_buildWorktreeNotification(taskId, "completed", result, keepOnSuccess ? entry.worktreePath : "", entry.branch));',
    "[B] 成功分支加 removeWorktree()"
)

# ── task-assign.ts ────────────────────────────────────────────────────────
print(f"\n{'='*60}\nPatch: {TASK_ASSIGN.name}\n{'='*60}")
if not DRY_RUN: backup(TASK_ASSIGN)

# [C] schema：加 keepWorktreeOnSuccess 字段
patch(
    TASK_ASSIGN,
    '"teammate_id is ignored. Worktree is kept on disk after completion for inspection.",\n'
    '\t\t}),\n'
    '});',
    '"teammate_id is ignored. Worktree is cleaned up after completion by default.",\n'
    '\t\t}),\n'
    '\tkeepWorktreeOnSuccess: Type.Optional(\n'
    '\t\tType.Boolean({\n'
    '\t\t\tdescription: "Keep worktree on disk after success (default: false = auto-cleanup)."\n'
    '\t\t}),\n'
    '\t),\n'
    '});',
    "[C] schema 加 keepWorktreeOnSuccess"
)

# [D] claimAndRun 透传
patch(
    TASK_ASSIGN,
    'claimAndRun(sessionId, params.task_id, "", task.description, { useWorktree: true });',
    'claimAndRun(sessionId, params.task_id, "", task.description, { useWorktree: true, keepWorktreeOnSuccess: params.keepWorktreeOnSuccess });',
    "[D] claimAndRun 透传 keepWorktreeOnSuccess"
)

# [E] 返回文本更新
patch(
    TASK_ASSIGN,
    '`A <task-notification> will arrive when complete, including the worktree path.`',
    '`A <task-notification> will arrive when complete. Worktree auto-cleaned unless keepWorktreeOnSuccess: true.`',
    "[E] 返回文本更新"
)

# ── 结果 ──────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"结果: OK={OK}  SKIP={SKIP}  FAIL={FAIL}")
if DRY_RUN:
    print("dry-run 完成。去掉 --dry-run 正式执行。")
elif FAIL == 0:
    print("补丁完成！下一步：\n  cd ~/pi-mono && ./deploy.sh")
print('='*60)

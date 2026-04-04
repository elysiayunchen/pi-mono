import os

BASE = os.path.expanduser("~/pi-mono")
session_path = BASE + "/packages/coding-agent/src/core/agent-session.ts"
content = open(session_path).read()
lines = content.split("\n")

# Add import
import_line = 'import { checkPermission, checkDangerousCommand, type ToolPermissionContext as RuleEngineContext } from "../permissions/rule-engine.js";'
if "rule-engine" not in content:
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.startswith("import{") or line.startswith("import type"):
            last_import = i
    lines.insert(last_import + 1, import_line)

content = "\n "shell") {
    const command = String(args.command ||".join(lines)

# Find _checkToolPermission
marker = "private _checkToolPermission("
start_idx = content.find(marker)
if start_idx == -1:
    print("❌ _checkToolPermission not found")
    exit(1)

method_start = content.rfind("\n", 0, start_idx) + 1

# Find "return undefined; // Allow" then the next }
allow_marker = "return undefined; // Allow"
allow_idx = content.find(allow_marker, start_idx)
if allow_idx == -1:
    print("❌ allow marker not found")
    exit(1)

after_allow = content.index("\n", allow_idx)
close_idx = content.find("}", after_allow)
if close_idx == -1:
    print("❌ closing brace not found")
    exit(1)

method_end = content.index("\n", close_idx + 1) + 1

# Find _getToolPermissionContext end if it exists
gtpc = "private _getToolPermissionContext("
gtpc_start = content.find(gtpc, method_end)
if gtpc_start != -1:
    depth = 0
    found = False
    gtpc_end = gtpc_start
    for i in range(gtpc_start, len(content)):
        if content[i] == "{":
            depth += 1
            found = True
        elif content[i] == "}":
            depth -= 1
            if found and depth == 0:
                gtpc_end = content.index("\n", i) + 1
                break
else:
    gtpc_end = method_end

# Build replacement
nl = "\n"
t = "\t"
new_code = f"""{t}private _checkToolPermission(
{t}{t}toolt}session:Call: {{ name: string; id: string }},
{t}{t}args: unknown,
{t}): {{ block: true; reason: string }} | undefined {{
{t}{t}const argsRecord = (args || {{}}) as Record<string, unknown>;

{t}{t}const dangerousResult = checkDangerousCommand(toolCall.name, argsRecord);
{t}{t}if (dangerousResult?.behavior === "deny") {{
{t}{t}{t}console.warn(`\\n⚠️  ${{dangerousResult.message}}`);
{t reason: dangerousResult.message! }};
{t}{t}}}

{t}{t}const permissionContext = this._getToolPermissionContext();
{t}{t}const result = checkPermission(toolCall.name, argsRecord, permissionContext, "allow");

{t}{t}if (result.behavior === "deny") {{
{t}{t}{t}console.warn(`\\n⚠️  ${{result.message}}`);
{t}{t}{t}return {{ block: true, reason: result.message! }};
{t}{t}}}

{t}{t}if (result.behavior === [],
{t}{t}{t}}},
{t}{t}}};
{t}}}
"""

content = content[:method_start] + new_code + content[gtpc_end:]
open(session_path, "w").write(content)
print("✅ agent-session.ts fixed")

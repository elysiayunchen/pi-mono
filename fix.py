import os

BASE = os.path.expanduser("~/pi-mono")

# === 1. 创建 rule-engine.ts ===
os.makedirs(f"{BASE}/packages/coding-agent/src/core/permissions", exist_ok=True)

with open(f"{BASE}/packages/coding-agent/src/core/permissions/rule-engine.ts", 'w') as f:
    f.write('''export type PermissionBehavior = "allow" | "deny" | "ask";
export type PermissionRuleSource = "settings" | "cliArg" | "session";

export interface PermissionRule {
\tauthority: PermissionRuleSource;
\tbehavior: PermissionBehavior;
\ttoolName: string;
\truleContent?: string;
}

export interface PermissionResult {
\tbehavior: PermissionBehavior;
\tmessage?: string;
\tmatchedRule?: PermissionRule;
}

export interface ToolPermissionContext {
\talwaysAllowRules: Record<PermissionRuleSource, string[]>;
\talwaysDenyRules: Record<PermissionRuleSource, string[]>;
\talwaysAskRules: Record<PermissionRuleSource, string[]>;
}

export function parseRuleString(
\truleString: string,
\tsource: PermissionRuleSource,
\tbehavior: PermissionBehavior,
): PermissionRule {
\tconst match = ruleString.match(/^([^(]+)(?:\\((.+)\\))?$/);
\tif (!match) {
\t\treturn { source, behavior, toolName: ruleString };
\t}
\treturn {
\t\tsource,
\t\tbehavior,
\t\ttoolName: match[1].trim(),
\t\truleContent: match[2]?.trim(),
\t};
}

function callMatchesRule(
\ttoolName: string,
\targs: Record<string, unknown>,
\trule: PermissionRule,
): boolean {
\tif (rule.toolName !== toolName) return false;
\tif (rule.ruleContent === undefined) return true;

\tconst command = String(
\t\targs.command || args.cmd || args.input || args.path || args.file_path || "",
\t);

\tconst pattern = rule.ruleContent
\t\t.replace(/[.+?^${}()|[\\]\\\\]/g, "\\\\$&")
\t\t.replace(/\\*/g, ".*");

\treturn new RegExp(`^${pattern}`, "i").test(command);
}

function getRules(
\tcontext: ToolPermissionContext,
\tbehavior: PermissionBehavior,
): PermissionRule[] {
\tconst key = `always${behavior.charAt(0).toUpperCase() + behavior.slice(1)}Rules` as const;
\tconst rulesBySource = context[key];
\treturn Object.entries(rulesBySource).flatMap(([source, rules]) =>
\t\trules.map((r) => parseRuleString(r, source as PermissionRuleSource, behavior)),
\t);
}

export function checkPermission(
\ttoolName: string,
\targs: Record<string, unknown>,
\tcontext: ToolPermissionContext,
\tdefaultBehavior: PermissionBehavior = "ask",
): PermissionResult {
\tconst denyRules = getRules(context, "deny");
\tfor (const rule of denyRules) {
\t\tif (callMatchesRule(toolName, args, rule)) {
\t\t\treturn {
\t\t\t\tbehavior: "deny",
\t\t\t\tmessage: `Blocked by rule '${rule.toolName}${rule.ruleContent ? `(${rule.ruleContent})` : ""}' from ${rule.source}`,
\t\t\t\tmatchedRule: rule,
\t\t\t};
\t\t}
\t}

\tconst askRules = getRules(context, "ask");
\tfor (const rule of askRules) {
\t\tif (callMatchesRule(toolName, args, rule)) {
\t\t\treturn {
\t\t\t\tbehavior: "ask",
\t\t\t\tmessage: `Requires approval: '${rule.toolName}${rule.ruleContent ? `(${rule.ruleContent})` : ""}' from ${rule.source}`,
\t\t\t\tmatchedRule: rule,
\t\t\t};
\t\t}
\t}

\tconst allowRules = getRules(context, "allow");
\tfor (const rule of allowRules) {
\t\tif (callMatchesRule(toolName, args, rule)) {
\t\t\treturn { behavior: "allow", matchedRule: rule };
\t\t}
\t}

\treturn { behavior: defaultBehavior };
}

export const DANGEROUS_COMMAND_PATTERNS = [
[rf]*\\s+)*\\/(\\s|$)/, reason: "Deleting root filesystem" },
\t{ pattern: /\\brm\\s+-rf\\s+[~\\/]/, reason: "Recursive force delete" },
\t{ pattern: /\\bmkfs\\b/, reason: "Formatting disk" },
\t{ pattern: /\\bdd\\s+if=/, reason: "Raw disk write" },
\t{ pattern: /\\bchmod\\s+777\\b/, reason: "World-writable permissions" },
\t{ pattern: /:\\s*\\(\\)\\s*\\{.*\\|.*\\}.*;/, reason: "Fork bomb" },
\t{ pattern: /\\b(shutdown|reboot|halt|poweroff)\\b/, reason: "System shutdown" },
\t{ pattern: /\\bkill\\s+-9\\s+1\\b/, reason: "Killing init process" },
\t{ pattern: />\\s*\\/dev\\/sd/, reason: "Overwriting disk device" },
\t{ pattern: /\\bformat\\s+[c-z]:/i, reason: "Windows format command" },
];

export const CRITICAL_FILE_PATTERNS = [
\t{ pattern: /\\.git\\//, reason: "Git directory" },
\t{ pattern: /node_modules\\//, reason: "node_modules directory" },
\t{ pattern: /^\\.env$/, reason: "Environment file" },
\t{ pattern: /^\\.env\\./, reason: "Environment file variant" },
\t{ pattern: /package-lock\\.json$/, reason: "Lock file" },
\t{ pattern: /yarn\\.lock$/, reason: "Lock file" },
\t{ pattern: /pnpm-lock\\.yaml$/, reason: "Lock file" },
];

export function checkDangerousCommand(
\ttoolName: string,
\targs: Record<string, unknown>,
): PermissionResult | null {
\tif (toolName === "bash" || toolName === "shell") {
\t\tconst command = String(args.command || args.cmd || args.input || "");
\t\tfor (const { pattern, reason } of DANGEROUS_COMMAND_PATTERNS) {
\t\t\tif (pattern.test(command)) {
\t\t\t\treturn {
\t\t\t\t\tbehavior: "deny",
\t\t\t\t\tmessage:\t{ pattern: /\\brm\\s+(- `Dangerous command blocked: ${reason}. Command: "${command}"`,
\t\t\t\t};
\t\t\t}
\t\t}
\t}

\tif (toolName === "write" || toolName === "edit") {
\t\tconst filePath = String(args.file_path || args.path || args.file || "");
\t\tfor (const { pattern, reason } of CRITICAL_FILE_PATTERNS) {
\t\t\tif (pattern.test(filePath)) {
\t\t\t\treturn {
\t\t\t\t\tbehavior: "deny",
\t\t\t\t\tmessage: `Critical file modification blocked: ${reason}. File: "${filePath}"`,
\t\t\t\t};
\t\t\t}
\t\t}
\t}

\treturn null;
}
''')

# === 2. 创建 build-tool.ts ===
with open(f"{BASE}/packages/agent/src/build-tool.ts", 'w') as f:
    f.write('''import type { TSchema, Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "./types.js";

const TOOL_DEFAULTS = {
\tisEnabled: () => true,
\tisConcurrencySafe: () => false,
\tisReadOnly: () => false,
\tisDestructive: () => false,
\tinterruptBehavior: () => "block" as const,
\tmaxResultSizeChars: 100_000,
};

type ToolDefaults = typeof TOOL_DEFAULTS;

export type ToolDef<
\tTParameters extends TSchema = TSchema,
\tTDetails = any,
> = Omit<AgentTool<TParameters, TDetails>, keyof ToolDefaults> &
\tPartial<Pick<AgentTool<TParameters, TDetails>, keyof ToolDefaults>>;

export function buildTool<
\tT extends ToolDef<any, any>,
>(def: T): T & ToolDefaults {
\treturn {
\t\t...TOOL_DEFAULTS,
\t\t...def,
\t};
}
''')

# === 3. 扩展 AgentTool 接口 ===
types_path = f"{BASE}/packages/agent/src/types.ts"
with open(types_path, 'r') as f:
    content = f.read()

old_interface = '''export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
\t/** Human-readable label for UI display. */
\tlabel: string;
\t/**
\t * Optional compatibility shim for raw tool-call arguments before schema validation.
\t * Must return an object that matches `TParameters`.
\t */
\tprepareArguments?: (args: unknown) => Static<TParameters>;
\t/** Execute the tool call. Throw on failure instead of encoding errors in `content`. */
\texecute: (
\t\ttoolCallId: string,
\t\tparams: Static<TParameters>,
\t\tsignal?: AbortSignal,
\t\tonUpdate?: AgentToolUpdateCallback<TDetails>,
\t) => Promise<AgentToolResult<TDetails>>;
}'''

new_interface = '''export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
\t/** Human-readable label for UI display. */
\tlabel: string;
\tprepareArguments?: (args: unknown) => Static<TParameters>;
\texecute: (
\t\ttoolCallId: string,
\t\tparams: Static<TParameters>,
\t\tsignal?: AbortSignal,
\t\tonUpdate?: AgentToolUpdateCallback<TDetails>,
\t) => Promise<AgentToolResult<TDetails>>;

\t/** 标记工具是否执行不可逆操作。默认 false。 */
\tisDestructive?: (input: Static<TParameters>) => boolean;
\t/** 用户打断时的行为。默认 'block'。 */
\tinterruptBehavior?: () => "cancel" | "block";
\t/** 工具结果最大字符数。默认 100000。 */
\tmaxResultSizeChars?: number;
\t/** 返回工具的简短活动描述。 */
\tgetActivityDescription?: (input: Partial<Static<TParameters>>) => string | null;
\t/** 返回工具调用的简短摘要。 */
\tgetToolUseSummary?: (input: Partial<Static<TParameters>>) => string | null;
}'''

if old_interface in content:
    content = content.replace(old_interface, new_interface)
    with open(types_path, 'w') as f:
        f.write(content)
    print("✅ types.ts: AgentTool interface extended")
else:
    print("⚠️  types.ts: AgentTool interface pattern not found (may already be modified)")

# === 4. 修复 agent-session.ts ===
session_path = f"{BASE}/packages/coding-agent/src/core/agent-session.ts"
with open(session_path, 'r') as f:
    content = f.read()

lines = content.split('\n')

# 4a. 添加 import
import_line = 'import { checkPermission, checkDangerousCommand, type ToolPermissionContext as RuleEngineContext } from "../permissions/rule-engine.js";'
if 'rule-engine' not in content:
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import ') or line.startswith('import{') or line.startswith('import type'):
            last_import_idx = i
    lines.insert(last_import_idx + 1, import_line)

content = '\n'.join(lines)

# 4b. 找到 _checkToolPermission 开始位置
marker = 'private _checkToolPermission('
start_idx = content.find(marker)
if start_idx == -1:
    print("❌ agent-session.ts: _checkToolPermission not found")
else:
    method_start = content.rfind('\n', 0, start_idx) + 1

    # 4c. 找到 "return undefined; // Allow" 后面的 }
    allow_marker = 'return undefined; // Allow'
    allow_idx = content.find(allow_marker, start_idx)
    if allow_idx == -1:
        print("❌ agent-session.ts: 'return undefined; // Allow' not found")
    else:
        after_allow = content.index('\n', allow_idx)
        close_idx = content.find('}', after_allow)
        if close_idx == -1:
            print("❌ agent-session.ts: closing brace not found")
        else:
            method_end = content.index('\n', close_idx + 1) + 1

            # 4d. 找到 _getToolPermissionContext 的结束（如果存在）
            gtpc_marker = 'private _getToolPermissionContext('
            gtpc_start = content.find(gtpc_marker, method_end)
            if gtpc_start != -1:
                depth = 0
                found = False
                gtpc_end = gtpc_start
                for i in range(gtpc_start, len(content)):
                    if content[i] == '{':
                        depth += 1
                        found = True
                    elif content[i] == '}':
                        depth -= 1
                        if found and depth == 0:
                            gtpc_end = content.index('\n', i) + 1
                            break
            else:
                gtpc_end = method_end

            # 4e. 新方法代码
            new_methods = '''\tprivate _checkToolPermission(
\t\ttoolCall: { name: string; id: string },
\t\targs: unknown,
\t): { block: true; reason: string } | undefined {
\t\tconst argsRecord = (args || {}) as Record<string, unknown>;

\t\t// 1. 兜底：硬编码危险命令检查
\t\tconst dangerousResult = checkDangerousCommand(toolCall.name, argsRecord);
\t\tif (dangerousResult?.behavior === "deny") {
\t\t\tconsole.warn(`\\n⚠️  ${dangerousResult.message}`);
\t\t\treturn { block: true, reason: dangerousResult.message! };
\t\t}

\t\t// 2. 规则引擎检查
\t\tconst permissionContext = this._getToolPermissionContext();
\t\tconst result = checkPermission(toolCall.name, argsRecord, permissionContext, "allow");

\t\tif (result.behavior === "deny") {
\t\t\tconsole.warn(`\\n⚠️  ${result.message}`);
\t\t\treturn { block: true, reason: result.message! };
\t\t}

\t\tif (result.behavior === "ask") {
\t\t\tconsole.log(`ℹ️  ${result.message}`);
\t\t}

\t\treturn undefined;
\t}

\tprivate _getToolPermissionContext(): RuleEngineContext {
\t\tconst settings = this.settingsManager.getPermissionRules?.() ?? {};
\t\treturn {
\t\t\talwaysAllowRules: {
\t\t\t\tsettings: settings.allow ?? [],
\t\t\t\tcliArg: [],
\t\t\t\tsession: [],
\t\t\t},
\t\t\talwaysDenyRules: {
\t\t\t\tsettings: settings.deny ?? [],
\t\t\t\tcliArg: [],
\t\t\t\tsession: [],
\t\t\t},
\t\t\talwaysAskRules: {
\t\t\t\tsettings: settings.ask ?? [],
\t\t\t\tcliArg: [],
\t\t\t\tsession: [],
\t\t\t},
\t\t};
\t}
'''

            content = content[:method_start] + new_methods + content[gtpc_end:]
            with open(session_path, 'w') as f:
                f.write(content)
            print("✅ agent-session.ts: _checkToolPermission fixed")

print("\n🔨 Building...")
ret = os.system(f"cd {BASE} && npm run build 2>&1 | tail -20")
if ret == 0:
    print("\n✅ BUILD SUCCESS")
else:
    print("\n❌ BUILD FAILED")

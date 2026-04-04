export type PermissionBehavior = "allow" | "deny" | "ask";
export type PermissionRuleSource = "settings" | "cliArg" | "session";

export interface PermissionRule {
	source: PermissionRuleSource;
	behavior: PermissionBehavior;
	toolName: string;
	ruleContent?: string;
}

export interface PermissionResult {
	behavior: PermissionBehavior;
	message?: string;
	matchedRule?: PermissionRule;
}

export interface ToolPermissionContext {
	alwaysAllowRules: Record<PermissionRuleSource, string[]>;
	alwaysDenyRules: Record<PermissionRuleSource, string[]>;
	alwaysAskRules: Record<PermissionRuleSource, string[]>;
}

export function parseRuleString(
	ruleString: string,
	source: PermissionRuleSource,
	behavior: PermissionBehavior,
): PermissionRule {
	// Fixed: use $$ instead of $$ to match literal parentheses
	const match = ruleString.match(/^([^(]+)(?:\((.+)\)$$)?$/);
	if (!match) {
		return { source, behavior, toolName: ruleString };
	}
	return {
		source,
		behavior,
		toolName: match[1].trim(),
		ruleContent: match[2]?.trim(),
	};
}

function callMatchesRule(toolName: string, args: Record<string, unknown>, rule: PermissionRule): boolean {
	if (rule.toolName !== toolName) return false;
	if (rule.ruleContent === undefined) return true;
	const command = String(args.command || args.cmd || args.input || args.path || args.file_path || "");
	const pattern = rule.ruleContent.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${pattern}`, "i").test(command);
}

function getRules(context: ToolPermissionContext, behavior: PermissionBehavior): PermissionRule[] {
	const key = `always${behavior.charAt(0).toUpperCase() + behavior.slice(1)}Rules` as const;
	const rulesBySource: Record<PermissionRuleSource, string[]> = (context as any)[key];
	return Object.entries(rulesBySource).flatMap(([source, rules]) =>
		(rules as string[]).map((r) => parseRuleString(r, source as PermissionRuleSource, behavior)),
	);
}

export function checkPermission(
	toolName: string,
	args: Record<string, unknown>,
	context: ToolPermissionContext,
	defaultBehavior: PermissionBehavior = "ask",
): PermissionResult {
	const denyRules = getRules(context, "deny");
	for (const rule of denyRules) {
		if (callMatchesRule(toolName, args, rule)) {
			return {
				behavior: "deny",
				message: `Blocked: '${rule.toolName}${rule.ruleContent ? `(${rule.ruleContent})` : ""}' from ${rule.source}`,
				matchedRule: rule,
			};
		}
	}
	const askRules = getRules(context, "ask");
	for (const rule of askRules) {
		if (callMatchesRule(toolName, args, rule)) {
			return {
				behavior: "ask",
				message: `Requires approval: '${rule.toolName}${rule.ruleContent ? `(${rule.ruleContent})` : ""}' from ${rule.source}`,
				matchedRule: rule,
			};
		}
	}
	const allowRules = getRules(context, "allow");
	for (const rule of allowRules) {
		if (callMatchesRule(toolName, args, rule)) {
			return { behavior: "allow", matchedRule: rule };
		}
	}
	return { behavior: defaultBehavior };
}

export const DANGEROUS_COMMAND_PATTERNS = [
	{ pattern: /\brm\s+(-[rf]*\s+)*\/(\s|$)/, reason: "Deleting root filesystem" },
	{ pattern: /\brm\s+-rf\s+[~/]/, reason: "Recursive force delete" },
	{ pattern: /\bmkfs\b/, reason: "Formatting disk" },
	{ pattern: /\bdd\s+if=/, reason: "Raw disk write" },
	{ pattern: /\bchmod\s+777\b/, reason: "World-writable permissions" },
	{ pattern: /:\s*$$\s*\{.*\|.*\}.*;/, reason: "Fork bomb" },
	{ pattern: /\b(shutdown|reboot|halt|poweroff)\b/, reason: "System shutdown" },
	{ pattern: /\bkill\s+-9\s+1\b/, reason: "Killing init process" },
	{ pattern: />\s*\/dev\/sd/, reason: "Overwriting disk device" },
	{ pattern: /\bformat\s+[c-z]:/i, reason: "Windows format command" },
];

export const CRITICAL_FILE_PATTERNS = [
	{ pattern: /\.git\//, reason: "Git directory" },
	{ pattern: /node_modules\//, reason: "node_modules directory" },
	{ pattern: /^\.env$/, reason: "Environment file" },
	{ pattern: /^\.env\./, reason: "Environment file variant" },
	{ pattern: /package-lock\.json$/, reason: "Lock file" },
	{ pattern: /yarn\.lock$/, reason: "Lock file" },
	{ pattern: /pnpm-lock\.yaml$/, reason: "Lock file" },
];

export function checkDangerousCommand(toolName: string, args: Record<string, unknown>): PermissionResult | null {
	if (toolName === "bash" || toolName === "shell") {
		const command = String(args.command || args.cmd || args.input || "");
		for (const { pattern, reason } of DANGEROUS_COMMAND_PATTERNS) {
			if (pattern.test(command)) {
				return {
					behavior: "deny",
					message: `Dangerous command blocked: ${reason}. Command: "${command}"`,
				};
			}
		}
	}
	if (toolName === "write" || toolName === "edit") {
		const filePath = String(args.file_path || args.path || args.file || "");
		for (const { pattern, reason } of CRITICAL_FILE_PATTERNS) {
			if (pattern.test(filePath)) {
				return {
					behavior: "deny",
					message: `Critical file blocked: ${reason}. File: "${filePath}"`,
				};
			}
		}
	}
	return null;
}

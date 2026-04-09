/**
 * P3-A PreToolUse Shell Hooks
 *
 * Executes user-defined shell scripts before each tool call.
 *
 * Hook resolution order:
 *   1. ~/.pi/agent/hooks/pre-tool-use.d/<toolName>.sh  (tool-specific)
 *   2. ~/.pi/agent/hooks/pre-tool-use.sh               (global)
 *
 * Protocol (stdin → stdout):
 *   stdin : JSON { tool: string, input: unknown, sessionId: string }
 *   stdout: "APPROVE"            → allow (default if script exits 0 with no output)
 *           "DENY: <reason>"     → block with reason
 *           "MODIFY: <json>"     → replace input with <json> (reserved, future use)
 *   exit  : 0 = ok, non-0 = block with stderr as reason
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const HOOKS_DIR = path.join(os.homedir(), ".pi", "agent", "hooks");
const HOOK_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Session-level approval cache to prevent repeated confirmations
// Key: `${sessionId}:${toolName}:${filePath}`
const approvedCalls = new Map<string, number>();

function getApprovalKey(toolName: string, input: unknown, sessionId: string): string {
	// For edit/write tools, use file path as pattern
	let pattern = "";
	if (typeof input === "object" && input !== null) {
		const inputObj = input as Record<string, unknown>;
		if (inputObj.filePath && typeof inputObj.filePath === "string") {
			pattern = inputObj.filePath;
		} else if (inputObj.path && typeof inputObj.path === "string") {
			pattern = inputObj.path;
		} else {
			pattern = JSON.stringify(input).slice(0, 100);
		}
	} else {
		pattern = String(input).slice(0, 100);
	}
	return `${sessionId}:${toolName}:${pattern}`;
}

function isApproved(key: string): boolean {
	const timestamp = approvedCalls.get(key);
	if (!timestamp) return false;
	if (Date.now() - timestamp > CACHE_TTL_MS) {
		approvedCalls.delete(key);
		return false;
	}
	return true;
}

function markApproved(key: string): void {
	approvedCalls.set(key, Date.now());
}

export interface PreToolUseResult {
	block: boolean;
	reason?: string;
}

function resolveHookScripts(toolName: string): string[] {
	const scripts: string[] = [];

	// Tool-specific hook takes priority
	const specific = path.join(HOOKS_DIR, "pre-tool-use.d", `${toolName}.sh`);
	if (existsSync(specific)) scripts.push(specific);

	// Global hook runs for all tools
	const global_ = path.join(HOOKS_DIR, "pre-tool-use.sh");
	if (existsSync(global_)) scripts.push(global_);

	return scripts;
}

export async function runPreToolUseHooks(
	toolName: string,
	input: unknown,
	sessionId: string,
): Promise<PreToolUseResult> {
	// Check cache first
	const cacheKey = getApprovalKey(toolName, input, sessionId);
	if (isApproved(cacheKey)) {
		return { block: false };
	}

	const scripts = resolveHookScripts(toolName);
	if (scripts.length === 0) return { block: false };

	const payload = JSON.stringify({ tool: toolName, input, sessionId });

	for (const script of scripts) {
		const result = spawnSync("bash", [script], {
			input: payload,
			encoding: "utf8",
			timeout: HOOK_TIMEOUT_MS,
			env: { ...process.env },
		});

		// Timeout or spawn error
		if (result.error) {
			console.warn(`[PreToolUse] Hook error (${script}):`, result.error.message);
			continue;
		}

		const stdout = (result.stdout ?? "").trim();
		const stderr = (result.stderr ?? "").trim();

		// Non-zero exit → block
		if (result.status !== 0) {
			const reason = stderr || `Hook exited with code ${result.status}`;
			return { block: true, reason };
		}

		// Explicit DENY
		if (stdout.startsWith("DENY:")) {
			return { block: true, reason: stdout.slice(5).trim() };
		}

		// MODIFY (reserved for future input rewriting — currently treated as APPROVE)
		if (stdout.startsWith("MODIFY:")) {
			console.warn(`[PreToolUse] MODIFY not yet implemented, treating as APPROVE`);
		}

		// APPROVE or empty stdout → continue to next script
	}

	// Cache this approval for the session
	markApproved(cacheKey);

	return { block: false };
}

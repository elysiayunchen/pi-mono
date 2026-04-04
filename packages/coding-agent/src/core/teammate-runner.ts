/**
 * s09 In-Process Teammate Runner
 *
 * Manages in-process Agent instances as teammates.
 * Each teammate has isolated message history but shares host session credentials.
 * Module-level singleton, re-initialized from AgentSession.prompt() on every turn.
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { type Model, streamSimple } from "@mariozechner/pi-ai";
import { convertToLlm } from "./messages.js";
import type { ModelRegistry } from "./model-registry.js";
import {
	createBashTool,
	createEditTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadTool,
	createWriteTool,
} from "./tools/index.js";

// ── Types ─────────────────────────────────────────────────────

export interface TeammateInfo {
	id: string;
	name: string;
	role: string;
	systemPrompt: string;
	createdAt: string;
	messageCount: number;
}

interface TeammateEntry {
	agent: Agent;
	info: TeammateInfo;
}

// ── Module-level state ─────────────────────────────────────────

/** "{hostSessionId}:{teammateId}" -> entry */
const registry = new Map<string, TeammateEntry>();

let _hostSessionId = "";
let _modelRegistry: ModelRegistry | null = null;
let _getModel: (() => Model<any> | undefined) | null = null;

function rkey(teammateId: string): string {
	return `${_hostSessionId}:${teammateId}`;
}

// ── Init ───────────────────────────────────────────────────────

/**
 * Initialize (or re-initialize) the runner with host session context.
 * Called from AgentSession.prompt() on every turn so the model reference stays fresh.
 */
export function initTeammateRunner(
	hostSessionId: string,
	modelRegistry: ModelRegistry,
	getModel: () => Model<any> | undefined,
): void {
	_hostSessionId = hostSessionId;
	_modelRegistry = modelRegistry;
	_getModel = getModel;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Create a new in-process teammate.
 * Assigns the host session's current model; isolated context window.
 */
export function createTeammate(id: string, name: string, role: string, systemPrompt: string): TeammateInfo {
	if (!_modelRegistry || !_getModel) {
		throw new Error("TeammateRunner not initialized. Send at least one prompt first.");
	}
	const k = rkey(id);
	if (registry.has(k)) {
		throw new Error(`Teammate "${id}" already exists in this session.`);
	}
	const model = _getModel();
	if (!model) {
		throw new Error("No model available for teammate.");
	}
	const mr = _modelRegistry;
	const agent = new Agent({
		initialState: { systemPrompt, model, thinkingLevel: "off", tools: [] },
		convertToLlm,
		streamFn: async (m, context, options) => {
			const auth = await mr.getApiKeyAndHeaders(m);
			if (!auth.ok) throw new Error(auth.error);
			return streamSimple(m, context, {
				...options,
				apiKey: auth.apiKey,
				headers: auth.headers || options?.headers ? { ...auth.headers, ...options?.headers } : undefined,
			});
		},
	});
	const info: TeammateInfo = {
		id,
		name,
		role,
		systemPrompt,
		createdAt: new Date().toISOString(),
		messageCount: 0,
	};
	registry.set(k, { agent, info });
	return { ...info };
}

/**
 * Send a message to a teammate and await its full text response.
 * Maintains persistent conversation history within the teammate's Agent.
 */
export async function sendToTeammate(id: string, message: string): Promise<string> {
	const entry = registry.get(rkey(id));
	if (!entry) {
		throw new Error(`Teammate "${id}" not found. Use team_create first.`);
	}
	let response = "";
	const unsub = entry.agent.subscribe((event) => {
		if (event.type === "message_end" && event.message.role === "assistant") {
			const msg = event.message as AssistantMessage;
			for (const block of msg.content) {
				if (block.type === "text") response += block.text;
			}
		}
	});
	try {
		await entry.agent.prompt([
			{
				role: "user" as const,
				content: [{ type: "text" as const, text: message }],
				timestamp: Date.now(),
			},
		]);
	} finally {
		unsub();
	}
	entry.info.messageCount += 1;
	return response || "(no response)";
}

/**
 * Delete a teammate and abort any in-progress generation.
 * Returns true if the teammate existed and was removed.
 */
export async function deleteTeammate(id: string): Promise<boolean> {
	const k = rkey(id);
	const entry = registry.get(k);
	if (!entry) return false;
	entry.agent.abort();
	await entry.agent.waitForIdle();
	registry.delete(k);
	return true;
}

/**
 * List all teammates for the current host session.
 */
export function listTeammates(): TeammateInfo[] {
	const prefix = `${_hostSessionId}:`;
	const result: TeammateInfo[] = [];
	for (const [k, entry] of registry) {
		if (k.startsWith(prefix)) result.push({ ...entry.info });
	}
	return result;
}

/**
 * Get a specific teammate's info, or undefined if not found.
 */
export function getTeammate(id: string): TeammateInfo | undefined {
	const entry = registry.get(rkey(id));
	return entry ? { ...entry.info } : undefined;
}

/**
 * Gracefully shutdown a teammate: abort generation, remove from registry.
 * Used by send_message shutdown_request protocol.
 */
export async function shutdownTeammate(id: string): Promise<void> {
	const deleted = await deleteTeammate(id);
	if (!deleted) {
		throw new Error(`Teammate "${id}" not found or already shut down.`);
	}
}

// teammate-runner.ts 加一行导出
export function getHostSessionId(): string {
	return _hostSessionId;
}

// ── s12: Worktree-aware teammate creation ─────────────────────────────────

/**
 * Create an in-process teammate whose tools are bound to a specific worktree cwd.
 * Unlike createTeammate (which gets empty tools), this teammate gets full coding
 * tools (bash, read, write, edit, grep, find, ls) sandboxed to worktreePath.
 */
export function createWorktreeTeammate(
	id: string,
	name: string,
	role: string,
	systemPrompt: string,
	worktreePath: string,
): TeammateInfo {
	if (!_modelRegistry || !_getModel) {
		throw new Error("TeammateRunner not initialized. Send at least one prompt first.");
	}
	const k = rkey(id);
	if (registry.has(k)) {
		throw new Error(`Teammate "${id}" already exists in this session.`);
	}
	const model = _getModel();
	if (!model) {
		throw new Error("No model available for worktree teammate.");
	}
	const mr = _modelRegistry;

	const tools = [
		createBashTool(worktreePath),
		createReadTool(worktreePath),
		createEditTool(worktreePath),
		createWriteTool(worktreePath),
		createGrepTool(worktreePath),
		createFindTool(worktreePath),
		createLsTool(worktreePath),
	];

	const agent = new Agent({
		initialState: {
			systemPrompt,
			model,
			thinkingLevel: "off",
			tools,
		},
		convertToLlm,
		streamFn: async (m, context, options) => {
			const auth = await mr.getApiKeyAndHeaders(m);
			if (!auth.ok) throw new Error(auth.error);
			return streamSimple(m, context, {
				...options,
				apiKey: auth.apiKey,
				headers: auth.headers || options?.headers ? { ...auth.headers, ...options?.headers } : undefined,
			});
		},
	});

	const info: TeammateInfo = {
		id,
		name,
		role,
		systemPrompt,
		createdAt: new Date().toISOString(),
		messageCount: 0,
	};
	registry.set(k, { agent, info });
	return { ...info };
}

/**
 * Agent discovery and configuration.
 *
 * Discovers agents from:
 * - ~/.pi/agent/agents/ (user scope)
 * - .pi/agents/ (project scope, searched up from CWD)
 *
 * Each agent is a markdown file with YAML frontmatter defining:
 *   name: string           - Agent type name (required)
 *   description: string    - When to use this agent (required)
 *   tools: string          - Comma-separated tool names
 *   disallowedTools: string - Comma-separated tool names to disallow
 *   model: string          - Model to use (or "inherit")
 *   effort: number|string  - Effort level (1-5)
 *   permissionMode: string - Permission mode for agent operations
 *   skills: string         - Comma-separated skill names to preload
 *   memory: string         - Memory scope: user, project, or local
 *   background: boolean    - Whether to run as background task
 *   maxTurns: number       - Maximum agentic turns before stopping
 *   color: string          - Agent color for UI display
 *
 * Override resolution:
 * When project and user agents share the same name, the project agent
 * takes precedence. The overridden agent is marked with overriddenBy.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, parseFrontmatter } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Types
// ============================================================================

export type AgentScope = "user" | "project" | "both";

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

export type AgentMemoryScope = "user" | "project" | "local";

export type AgentSource = "user" | "project";

export interface AgentConfig {
	/** Agent type name (unique identifier) */
	name: string;
	/** When to use this agent */
	description: string;
	/** Comma-separated tool names the agent can use */
	tools?: string[];
	/** Comma-separated tool names the agent cannot use */
	disallowedTools?: string[];
	/** Model identifier or "inherit" */
	model?: string;
	/** Effort level (1-5) */
	effort?: number;
	/** Permission mode */
	permissionMode?: PermissionMode;
	/** Skill names to preload */
	skills?: string[];
	/** Memory scope for persistent memory */
	memory?: AgentMemoryScope;
	/** Whether to run as background task */
	background?: boolean;
	/** Maximum agentic turns before stopping */
	maxTurns?: number;
	/** Agent color for UI */
	color?: string;
	/** System prompt content (body after frontmatter) */
	systemPrompt: string;
	/** Source of the agent definition */
	source: AgentSource;
	/** File path of the agent definition */
	filePath: string;
	/** If this agent is overridden, the source that overrides it */
	overriddenBy?: AgentSource;
}

export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	projectAgentsDir: string | null;
	/** Files that failed to parse with error messages */
	failedFiles?: Array<{ path: string; error: string }>;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_PERMISSION_MODES: PermissionMode[] = ["default", "acceptEdits", "bypassPermissions", "plan"];

const VALID_MEMORY_SCOPES: AgentMemoryScope[] = ["user", "project", "local"];

// ============================================================================
// Agent loading
// ============================================================================

/**
 * Parse and validate agent fields from frontmatter.
 * Returns null if required fields are missing.
 */
function parseAgentFields(frontmatter: Record<string, string>): Record<string, unknown> | null {
	const name = frontmatter.name;
	const description = frontmatter.description;

	// Required fields
	if (!name || typeof name !== "string" || !name.trim()) {
		return null;
	}
	if (!description || typeof description !== "string" || !description.trim()) {
		return null;
	}

	const result: Record<string, unknown> = {
		name: name.trim(),
		description: description.trim(),
	};

	// Optional: tools
	if (frontmatter.tools) {
		result.tools = frontmatter.tools
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
	}

	// Optional: disallowedTools
	if (frontmatter.disallowedTools) {
		result.disallowedTools = frontmatter.disallowedTools
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
	}

	// Optional: model
	if (frontmatter.model && typeof frontmatter.model === "string") {
		const model = frontmatter.model.trim();
		if (model) {
			result.model = model.toLowerCase() === "inherit" ? "inherit" : model;
		}
	}

	// Optional: effort (level 1-5)
	if (frontmatter.effort !== undefined) {
		const parsed = Number(frontmatter.effort);
		if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) {
			result.effort = parsed;
		}
	}

	// Optional: permissionMode
	if (frontmatter.permissionMode) {
		const mode = frontmatter.permissionMode.trim();
		if ((VALID_PERMISSION_MODES as string[]).includes(mode)) {
			result.permissionMode = mode as PermissionMode;
		}
	}

	// Optional: skills
	if (frontmatter.skills) {
		result.skills = frontmatter.skills
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	// Optional: memory scope
	if (frontmatter.memory) {
		const memory = frontmatter.memory.trim();
		if ((VALID_MEMORY_SCOPES as string[]).includes(memory)) {
			result.memory = memory as AgentMemoryScope;
		}
	}

	// Optional: background
	if (frontmatter.background !== undefined) {
		const bg = String(frontmatter.background).trim();
		result.background = bg === "true" || bg === "1" || bg === "yes";
	}

	// Optional: maxTurns
	if (frontmatter.maxTurns !== undefined) {
		const parsed = Number(frontmatter.maxTurns);
		if (!Number.isNaN(parsed) && parsed > 0 && Number.isInteger(parsed)) {
			result.maxTurns = parsed;
		}
	}

	// Optional: color
	if (frontmatter.color && typeof frontmatter.color === "string") {
		result.color = frontmatter.color.trim();
	}

	return result;
}

function loadAgentsFromDir(
	dir: string,
	source: AgentSource,
): { agents: AgentConfig[]; failedFiles: Array<{ path: string; error: string }> } {
	const agents: AgentConfig[] = [];
	const failedFiles: Array<{ path: string; error: string }> = [];

	if (!fs.existsSync(dir)) {
		return { agents, failedFiles };
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return { agents, failedFiles };
	}

	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);

		// Check if this looks like an agent file (has name field)
		if (!frontmatter.name) {
			// Not an agent file — skip silently (could be reference docs co-located)
			continue;
		}

		const fields = parseAgentFields(frontmatter);

		if (!fields) {
			// Has "name" but failed validation — report error
			const reason = !frontmatter.description
				? 'Missing required "description" field'
				: "Failed to parse required fields";
			failedFiles.push({ path: filePath, error: reason });
			continue;
		}

		agents.push({
			name: fields.name as string,
			description: fields.description as string,
			tools: fields.tools as string[] | undefined,
			disallowedTools: fields.disallowedTools as string[] | undefined,
			model: fields.model as string | undefined,
			effort: fields.effort as number | undefined,
			permissionMode: fields.permissionMode as PermissionMode | undefined,
			skills: fields.skills as string[] | undefined,
			memory: fields.memory as AgentMemoryScope | undefined,
			background: fields.background as boolean | undefined,
			maxTurns: fields.maxTurns as number | undefined,
			color: fields.color as string | undefined,
			systemPrompt: body,
			source,
			filePath,
		});
	}

	return { agents, failedFiles };
}

// ============================================================================
// Directory discovery
// ============================================================================

function isDirectory(p: string): boolean {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function findNearestProjectAgentsDir(cwd: string): string | null {
	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, ".pi", "agents");
		if (isDirectory(candidate)) return candidate;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Discover agents from user and/or project directories.
 *
 * Override resolution: when both user and project have agents with the same
 * name, the project agent wins and the user agent is marked as overriddenBy.
 */
export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
	const userDir = path.join(getAgentDir(), "agents");
	const projectAgentsDir = findNearestProjectAgentsDir(cwd);

	const userResult = scope === "project" ? { agents: [], failedFiles: [] } : loadAgentsFromDir(userDir, "user");
	const projectResult =
		scope === "user" || !projectAgentsDir
			? { agents: [], failedFiles: [] }
			: loadAgentsFromDir(projectAgentsDir, "project");

	const allFailedFiles = [...userResult.failedFiles, ...projectResult.failedFiles];

	// Build agent map with override resolution
	const agentMap = new Map<string, AgentConfig>();

	if (scope === "both") {
		// User agents first (lower priority)
		for (const agent of userResult.agents) agentMap.set(agent.name, agent);
		// Project agents override (higher priority)
		for (const agent of projectResult.agents) {
			const existing = agentMap.get(agent.name);
			if (existing) {
				existing.overriddenBy = "project";
			}
			agentMap.set(agent.name, agent);
		}
	} else if (scope === "user") {
		for (const agent of userResult.agents) agentMap.set(agent.name, agent);
	} else {
		for (const agent of projectResult.agents) agentMap.set(agent.name, agent);
	}

	// Mark overridden agents
	const agents = Array.from(agentMap.values());
	for (const agent of agents) {
		if (agent.overriddenBy) continue;
		// Check if another agent with same name from different source exists
		const other = agents.find((a) => a.name === agent.name && a.source !== agent.source);
		if (other) {
			// The one loaded later (in the map) wins
			const winner = agentMap.get(agent.name);
			if (winner && winner.source !== agent.source) {
				agent.overriddenBy = winner.source;
			}
		}
	}

	return {
		agents,
		projectAgentsDir,
		failedFiles: allFailedFiles.length > 0 ? allFailedFiles : undefined,
	};
}

/**
 * Format an agent list for display in the system prompt.
 */
export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
	if (agents.length === 0) return { text: "none", remaining: 0 };

	const listed = agents.slice(0, maxItems);
	const remaining = agents.length - listed.length;

	const items = listed.map((a) => {
		const parts = [`${a.name} (${a.source})`];
		if (a.model && a.model !== "inherit") parts.push(`model: ${a.model}`);
		if (a.memory) parts.push(`memory: ${a.memory}`);
		if (a.background) parts.push("background");
		if (a.permissionMode) parts.push(a.permissionMode);
		return `${parts.join(", ")}: ${a.description}`;
	});

	return { text: items.join("; "), remaining };
}

/**
 * s12 enter_worktree tool
 *
 * Creates an isolated working directory (git worktree if in a git repo,
 * plain directory otherwise) and spawns a teammate agent with full coding
 * tools (bash, read, write, edit, grep, find, ls) bound to that directory.
 */

import { randomUUID } from "node:crypto";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { getCurrentSessionId } from "../tasks/task-store.js";
import { createWorktreeTeammate } from "../teammate-runner.js";
import { createWorktree, removeWorktree } from "../worktree-manager.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	name: Type.Optional(
		Type.String({
			description:
				"Short slug for the worktree (letters, digits, dashes; max 32 chars). " + "Defaults to a random name.",
		}),
	),
	role: Type.Optional(
		Type.String({
			description: "Role description injected into the worktree teammate's system prompt.",
		}),
	),
	task_id: Type.Optional(
		Type.String({
			description: "Optional task ID to associate with this worktree.",
		}),
	),
});

export const enterWorktreeToolDefinition: ToolDefinition<typeof schema> = {
	name: "enter_worktree",
	label: "Enter Worktree",
	description:
		"Creates an isolated worktree directory and a teammate agent with full coding " +
		"tools (bash, read, write, edit, grep, find, ls) bound to that directory. " +
		"Returns worktree_id and teammate_id for delegation via send_message.",
	promptSnippet: "Create isolated worktree with a capable coding teammate",
	promptGuidelines: [
		"Use enter_worktree when a task needs file system isolation from the main cwd.",
		"The returned teammate_id can be used with send_message to delegate coding work.",
		"The teammate has bash/read/write/edit tools restricted to the worktree directory.",
		"Always call exit_worktree when done to free resources and optionally clean up.",
	],
	parameters: schema,

	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		void getCurrentSessionId(); // ensure session is active
		const worktreeId = randomUUID().slice(0, 8);
		const name = (params.name ?? `wt-${worktreeId}`).slice(0, 32).replace(/[^a-zA-Z0-9-]/g, "-");
		const originalCwd = process.cwd();
		const role = params.role ?? "Isolated coding agent with full file access in the worktree directory.";
		const teammateId = `wt-${worktreeId}`;

		const entry = createWorktree(worktreeId, name, originalCwd, params.task_id, teammateId);

		const systemPrompt = [
			`You are a coding agent working in an isolated worktree directory.`,
			`Your working directory: ${entry.worktreePath}`,
			entry.branch
				? `Git branch: ${entry.branch}`
				: `Note: this is a plain directory (no git worktree — either not a git repo or git worktree creation failed).`,
			`Original project directory: ${entry.originalCwd}`,
			``,
			role,
			``,
			`All bash commands run with cwd=${entry.worktreePath} by default.`,
			`All file reads/writes are sandboxed to ${entry.worktreePath}.`,
		].join("\n");

		try {
			createWorktreeTeammate(teammateId, `worktree-${name}`, role, systemPrompt, entry.worktreePath);
		} catch (err) {
			removeWorktree(worktreeId, true);
			const msg = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text" as const, text: `Failed to create worktree teammate: ${msg}` }],
				details: { success: false, error: msg },
			};
		}

		const gitNote = entry.isGit
			? `Git worktree created on branch '${entry.branch}'.`
			: `Plain directory (no git worktree).`;

		return {
			content: [
				{
					type: "text" as const,
					text: [
						`Worktree created successfully.`,
						`worktree_id: ${worktreeId}`,
						`worktree_path: ${entry.worktreePath}`,
						`teammate_id: ${teammateId}`,
						gitNote,
						`Use send_message with teammate_id '${teammateId}' to delegate coding tasks.`,
						`Use exit_worktree with worktree_id '${worktreeId}' when done.`,
					].join("\n"),
				},
			],
			details: {
				worktreeId,
				worktreePath: entry.worktreePath,
				teammateId,
				branch: entry.branch,
				isGit: entry.isGit,
			},
		};
	},
};

export const enterWorktreeTool: AgentTool<typeof schema> = wrapToolDefinition(enterWorktreeToolDefinition);

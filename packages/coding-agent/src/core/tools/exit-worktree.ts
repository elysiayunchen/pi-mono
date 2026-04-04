/**
 * s12 exit_worktree tool
 *
 * Shuts down the worktree teammate and optionally removes the worktree directory.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { deleteTeammate } from "../teammate-runner.js";
import { getCurrentWorktree, keepWorktree, removeWorktree } from "../worktree-manager.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	worktree_id: Type.String({
		description: "The worktree_id returned by enter_worktree.",
	}),
	action: Type.Union([Type.Literal("keep"), Type.Literal("remove")], {
		description:
			'"keep" leaves the worktree directory on disk for later inspection. ' +
			'"remove" deletes the directory and the git branch.',
	}),
	discard_changes: Type.Optional(
		Type.Boolean({
			description:
				"Force removal even when the worktree has uncommitted changes. " +
				'Only meaningful when action is "remove". Defaults to false.',
		}),
	),
});

export const exitWorktreeToolDefinition: ToolDefinition<typeof schema> = {
	name: "exit_worktree",
	label: "Exit Worktree",
	description:
		"Exits a worktree session created by enter_worktree: shuts down the worktree " +
		"teammate and optionally removes the worktree directory and git branch.",
	promptSnippet: "Exit a worktree created by enter_worktree",
	promptGuidelines: [
		'Use action "keep" to preserve the worktree for manual inspection or future use.',
		'Use action "remove" to clean up the directory and git branch when work is done.',
		"Set discard_changes: true only after confirming with the user that changes can be lost.",
		"Always call exit_worktree when worktree work is complete.",
	],
	parameters: schema,

	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		const entry = getCurrentWorktree(params.worktree_id);
		if (!entry) {
			return {
				content: [
					{
						type: "text" as const,
						text: `No active worktree with id '${params.worktree_id}'. It may have already been exited.`,
					},
				],
				details: { found: false },
			};
		}

		// Shut down the associated teammate
		if (entry.teammateId) {
			try {
				await deleteTeammate(entry.teammateId);
			} catch {
				/* already gone */
			}
		}

		if (params.action === "remove") {
			const removed = removeWorktree(params.worktree_id, params.discard_changes ?? false);
			const msg = removed
				? [
						`Worktree '${params.worktree_id}' removed.`,
						`Directory ${entry.worktreePath} deleted.`,
						entry.branch ? `Git branch '${entry.branch}' deleted.` : "",
					]
						.filter(Boolean)
						.join(" ")
				: `Worktree '${params.worktree_id}' not found (already removed?).`;
			return {
				content: [{ type: "text" as const, text: msg }],
				details: { action: "remove", worktreePath: entry.worktreePath, removed },
			};
		} else {
			keepWorktree(params.worktree_id);
			return {
				content: [
					{
						type: "text" as const,
						text: [
							`Worktree '${params.worktree_id}' kept at ${entry.worktreePath}.`,
							entry.branch ? `Branch '${entry.branch}' preserved.` : "",
							`Teammate shut down.`,
						]
							.filter(Boolean)
							.join(" "),
					},
				],
				details: { action: "keep", worktreePath: entry.worktreePath, branch: entry.branch },
			};
		}
	},
};

export const exitWorktreeTool: AgentTool<typeof schema> = wrapToolDefinition(exitWorktreeToolDefinition);

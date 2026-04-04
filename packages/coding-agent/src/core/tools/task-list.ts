/**
 * task_list — List all tasks in the current session.
 * Mirrors Claude Code's TaskListTool.
 *
 * Completed task IDs are filtered from blockedBy lists to avoid
 * showing stale blocking relationships (same logic as Claude Code).
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { getCurrentSessionId, listTasks } from "../tasks/task-store.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({});

const STATUS_ICON: Record<string, string> = {
	pending: "[ ]",
	in_progress: "[~]",
	completed: "[x]",
	stopped: "[-]",
	failed: "[!]",
};

export const taskListToolDefinition: ToolDefinition<typeof schema> = {
	name: "task_list",
	label: "Task",
	description:
		"List all tasks in the current session with their statuses and blocking relationships. " +
		"Completed tasks' IDs are filtered from blockedBy lists automatically.",
	parameters: schema,

	async execute(_toolCallId, _params) {
		const sessionId = getCurrentSessionId();
		const allTasks = listTasks(sessionId);

		if (allTasks.length === 0) {
			return {
				content: [{ type: "text", text: "No tasks found in current session." }],
				details: { tasks: [] },
			};
		}

		// Filter completed IDs from blockedBy (mirrors Claude Code behavior)
		const completedIds = new Set(allTasks.filter((t) => t.status === "completed").map((t) => t.id));

		const lines = allTasks.map((task) => {
			const icon = STATUS_ICON[task.status] ?? "[?]";
			const owner = task.owner ? ` (${task.owner})` : "";
			const activeBlocks = task.blockedBy.filter((id) => !completedIds.has(id));
			const blocked =
				activeBlocks.length > 0 ? ` [blocked by ${activeBlocks.map((id) => `#${id}`).join(", ")}]` : "";
			return `${icon} #${task.id} ${task.subject}${owner}${blocked}`;
		});

		const summary = [`Tasks (${allTasks.length} total):`, ...lines].join("\n");

		return {
			content: [{ type: "text", text: summary }],
			details: {
				tasks: allTasks.map((t) => ({
					id: t.id,
					subject: t.subject,
					status: t.status,
					owner: t.owner,
					blockedBy: t.blockedBy.filter((id) => !completedIds.has(id)),
				})),
			},
		};
	},
};

export const taskListTool: AgentTool<typeof schema> = wrapToolDefinition(taskListToolDefinition);

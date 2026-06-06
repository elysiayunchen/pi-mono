/**
 * task_get — Retrieve a single task by ID.
 * Mirrors Claude Code's TaskGetTool.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { getCurrentSessionId, getTask } from "../tasks/task-store.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	taskId: Type.String({
		description: "The ID of the task to retrieve (e.g. 't3f9a12b')",
	}),
});

export const taskGetToolDefinition: ToolDefinition<typeof schema> = {
	name: "task_get",
	label: "Task",
	description:
		"Retrieve a single task by ID including its full description, status, " + "output, and blocking relationships.",
	parameters: schema,

	isConcurrencySafe: () => true,
	isReadOnly: () => true,
	isDestructive: () => false,
	getToolUseSummary(input: any) {
		return input.taskId ?? "Task get";
	},
	getActivityDescription() {
		return "Getting task details";
	},
	toAutoClassifierInput(input: any) {
		return { tool: "task_get", ...(input as Record<string, unknown>) };
	},
	async execute(_toolCallId, params) {
		const task = getTask(getCurrentSessionId(), params.taskId);

		if (!task) {
			return {
				content: [{ type: "text", text: `Task ${params.taskId} not found.` }],
				details: { task: null },
			};
		}

		const lines = [`Task #${task.id}: ${task.subject}`, `Status: ${task.status}`, `Description: ${task.description}`];
		if (task.activeForm) lines.push(`Active form: ${task.activeForm}`);
		if (task.owner) lines.push(`Owner: ${task.owner}`);
		if (task.blockedBy.length > 0) lines.push(`Blocked by: ${task.blockedBy.map((id) => `#${id}`).join(", ")}`);
		if (task.blocks.length > 0) lines.push(`Blocks: ${task.blocks.map((id) => `#${id}`).join(", ")}`);
		if (task.output) lines.push(`\nOutput:\n${task.output}`);

		return {
			content: [{ type: "text", text: lines.join("\n") }],
			details: { task },
		};
	},
};

export const taskGetTool: AgentTool<typeof schema> = wrapToolDefinition(taskGetToolDefinition);

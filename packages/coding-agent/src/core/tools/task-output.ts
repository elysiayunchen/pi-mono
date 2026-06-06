/**
 * task_output — Retrieve output of a background task.
 * s08: Background Tasks
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { isRunning } from "../background-runner.js";
import type { ToolDefinition } from "../extensions/types.js";
import { getCurrentSessionId, getTask } from "../tasks/task-store.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	task_id: Type.String({
		description: "ID of the task to retrieve output for",
	}),
	tail_lines: Type.Optional(
		Type.Number({
			description:
				"Return only the last N lines of output (default: all). " +
				"Useful for long-running commands to avoid flooding context.",
			minimum: 1,
			maximum: 500,
		}),
	),
});

export const taskOutputToolDefinition: ToolDefinition<typeof schema> = {
	name: "task_output",
	label: "Task Output",
	description:
		"Retrieve the stdout/stderr output of a background task. " +
		"Works for both still-running and already-completed tasks. " +
		"Use tail_lines to limit context usage for verbose commands.",
	promptSnippet: "Get output of a background task",
	promptGuidelines: [
		"Use task_output to poll a running background task for progress.",
		"Set tail_lines to 50–100 for long-running commands to avoid filling context.",
		"Check the running field: if true, poll again later for more output.",
	],
	parameters: schema,

	isConcurrencySafe: () => true,
	isReadOnly: () => true,
	isDestructive: () => false,
	getToolUseSummary(input: any) {
		return input.taskId ?? "Task output";
	},
	getActivityDescription(input: any) {
		return `Reading output: ${input.taskId ?? "..."}`;
	},
	toAutoClassifierInput(input: any) {
		return { tool: "task_output", ...(input as Record<string, unknown>) };
	},
	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		const sessionId = getCurrentSessionId();
		const task = getTask(sessionId, params.task_id);

		if (!task) {
			return {
				content: [{ type: "text", text: `Error: task ${params.task_id} not found` }],
				details: { taskId: params.task_id, found: false },
			};
		}

		let output = task.output ?? "";

		// Apply tail_lines truncation
		if (params.tail_lines !== undefined && output.length > 0) {
			const lines = output.split("\n");
			const kept = lines.slice(-params.tail_lines);
			const dropped = lines.length - kept.length;
			output = dropped > 0 ? `[... ${dropped} lines omitted ...]\n${kept.join("\n")}` : kept.join("\n");
		}

		const running = isRunning(params.task_id);
		const statusLine = running ? `Status: in_progress (still running)` : `Status: ${task.status}`;

		const text = [
			`Task: ${task.subject} (${params.task_id})`,
			statusLine,
			"",
			output.length > 0 ? output : "(no output yet)",
		].join("\n");

		return {
			content: [{ type: "text", text }],
			details: {
				taskId: params.task_id,
				status: task.status,
				running,
				outputLength: (task.output ?? "").length,
			},
		};
	},
};

export const taskOutputTool: AgentTool<typeof schema> = wrapToolDefinition(taskOutputToolDefinition);

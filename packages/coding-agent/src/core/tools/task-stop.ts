/**
 * task_stop — Stop a running background task.
 * s08: Background Tasks
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { stopBackground } from "../background-runner.js";
import type { ToolDefinition } from "../extensions/types.js";
import { getCurrentSessionId, getTask, updateTask } from "../tasks/task-store.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	task_id: Type.String({
		description: "ID of the background task to stop",
	}),
});

export const taskStopToolDefinition: ToolDefinition<typeof schema> = {
	name: "task_stop",
	label: "Stop Task",
	description:
		"Stop a running background task. Sends SIGTERM to the process, then SIGKILL " +
		"after 3 seconds if it has not exited. Has no effect on tasks that are already " +
		"completed or failed.",
	promptSnippet: "Stop a background task by ID",
	promptGuidelines: [
		"Use task_stop when you need to cancel a long-running background command.",
		"After stopping, use task_output to see how much output was captured before termination.",
	],
	parameters: schema,

	isConcurrencySafe: () => true,
	isReadOnly: () => false,
	isDestructive: () => false,
	getToolUseSummary(input: any) {
		return input.taskId ?? "Task stop";
	},
	getActivityDescription(input: any) {
		return `Stopping task: ${input.taskId ?? "..."}`;
	},
	toAutoClassifierInput(input: any) {
		return { tool: "task_stop", ...(input as Record<string, unknown>) };
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

		const terminalStatuses = new Set(["completed", "failed"]);
		if (terminalStatuses.has(task.status)) {
			return {
				content: [
					{
						type: "text",
						text: `Task ${params.task_id} is already in terminal state: ${task.status}`,
					},
				],
				details: { taskId: params.task_id, status: task.status, killed: false },
			};
		}

		const killed = await stopBackground(params.task_id);

		if (!killed) {
			// Process not in registry (e.g. server restart) — mark as failed
			updateTask(sessionId, params.task_id, { status: "failed" });
		}

		return {
			content: [
				{
					type: "text",
					text: killed
						? `Task ${params.task_id} stopped successfully`
						: `Task ${params.task_id} marked as failed (process not found in registry)`,
				},
			],
			details: { taskId: params.task_id, killed },
		};
	},
};

export const taskStopTool: AgentTool<typeof schema> = wrapToolDefinition(taskStopToolDefinition);

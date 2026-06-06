/**
 * task_create — Create a new persistent task.
 * s08 extension: adds optional `command` + `cwd` for immediate background execution.
 *
 * Mirrors Claude Code's TaskCreateTool, extended for background bash.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { spawnBackground } from "../background-runner.js";
import type { ToolDefinition } from "../extensions/types.js";
import { createTask, getCurrentSessionId } from "../tasks/task-store.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	subject: Type.String({
		description: "A brief title for the task (max 80 chars)",
	}),
	description: Type.String({
		description: "Full description of what needs to be done",
	}),
	activeForm: Type.Optional(
		Type.String({
			description: 'Present-continuous form shown in spinner when in_progress (e.g. "Running tests")',
		}),
	),
	metadata: Type.Optional(
		Type.Record(Type.String(), Type.Unknown(), {
			description: "Arbitrary metadata to attach to the task",
		}),
	),
	// ── s08 additions ──────────────────────────────────────────
	command: Type.Optional(
		Type.String({
			description:
				"Bash command to execute immediately in the background after creating the task. " +
				"Output streams into task.output in real time. " +
				"Use task_output to read results while it runs.",
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Working directory for the command (default: process cwd)",
		}),
	),
});

export const taskCreateToolDefinition: ToolDefinition<typeof schema> = {
	name: "task_create",
	label: "Task",
	description:
		"Create a new persistent task. Use this to break large goals into trackable " +
		"subtasks that survive across conversation turns. Tasks have statuses " +
		"(pending → in_progress → completed) and can block each other. " +
		"Optionally provide a `command` to run a bash command in the background immediately.",
	promptSnippet: "Create a persistent task to track multi-step work",
	promptGuidelines: [
		"Use task_create to decompose large goals before starting execution.",
		"Set activeForm to a present-continuous phrase so the user sees progress (e.g. 'Compiling project').",
		"After creating tasks, use task_update to mark them in_progress before you start, and completed when done.",
		// s08 guidelines
		"Provide `command` to run a shell command in the background without blocking the conversation.",
		"Use task_output to poll a background command's output while it runs.",
		"Use task_stop to cancel a running background command.",
	],
	parameters: schema,

	isConcurrencySafe: () => true,
	isReadOnly: () => false,
	isDestructive: () => false,
	getToolUseSummary(input: any) {
		return input.subject ?? "Task create";
	},
	getActivityDescription(input: any) {
		return `Creating task: ${input.subject ?? "..."}`;
	},
	toAutoClassifierInput(input: any) {
		return { tool: "task_create", ...(input as Record<string, unknown>) };
	},
	async execute(_toolCallId, params) {
		const sessionId = getCurrentSessionId();

		const task = createTask(sessionId, {
			subject: params.subject,
			description: params.description,
			activeForm: params.activeForm,
			metadata: params.metadata as Record<string, unknown> | undefined,
		});

		// s08: If a command is provided, spawn it in background immediately.
		// spawnBackground handles the pending → in_progress → completed/failed transitions.
		if (params.command) {
			// Fire-and-forget — errors are captured in task.output
			spawnBackground(sessionId, task.id, params.command, params.cwd).catch((err) => {
				console.error(`[background-runner] Unexpected spawn error for task ${task.id}:`, err);
			});

			return {
				content: [
					{
						type: "text",
						text:
							`Task #${task.id} created and background command started.\n` +
							`Subject: ${task.subject}\n` +
							`Use task_output("${task.id}") to retrieve output.`,
					},
				],
				details: { taskId: task.id, subject: task.subject, backgroundCommand: true },
			};
		}

		return {
			content: [
				{
					type: "text",
					text: `Task #${task.id} created: ${task.subject}`,
				},
			],
			details: { taskId: task.id, subject: task.subject },
		};
	},
};

export const taskCreateTool: AgentTool<typeof schema> = wrapToolDefinition(taskCreateToolDefinition);

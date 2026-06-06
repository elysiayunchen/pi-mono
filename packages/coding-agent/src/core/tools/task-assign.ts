/**
 * s11 task_assign — s12.1: worktree: true 支持
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { claimAndRun } from "../autonomous-runner.js";
import { getCurrentSessionId, getTask } from "../tasks/task-store.js";
import { getTeammate } from "../teammate-runner.js";

const schema = Type.Object({
	task_id: Type.String({ description: "ID of the pending task to assign (from task_create)." }),
	teammate_id: Type.Optional(
		Type.String({ description: "ID of an existing teammate. Required when worktree is false/omitted." }),
	),
	worktree: Type.Optional(
		Type.Boolean({
			description:
				"When true, auto-creates an isolated worktree directory and a dedicated coding " +
				"teammate (bash/read/write/edit/grep/find/ls) for this task. " +
				"teammate_id is ignored. Worktree is cleaned up after completion by default.",
		}),
	),
	keepWorktreeOnSuccess: Type.Optional(
		Type.Boolean({
			description: "Keep worktree on disk after success (default: false = auto-cleanup).",
		}),
	),
});

type Params = Static<typeof schema>;

async function execute(
	_toolCallId: string,
	params: Params,
	_signal?: AbortSignal,
	_onUpdate?: unknown,
	_ctx?: unknown,
): Promise<AgentToolResult<{ taskId: string; teammateId: string; worktreePath?: string }>> {
	const sessionId = getCurrentSessionId();

	const task = getTask(sessionId, params.task_id);
	if (!task) {
		return {
			content: [{ type: "text", text: `Task "${params.task_id}" not found.` }],
			details: { taskId: params.task_id, teammateId: params.teammate_id ?? "" },
		};
	}

	if (task.status !== "pending") {
		return {
			content: [
				{ type: "text", text: `Task "${params.task_id}" is already "${task.status}" and cannot be assigned.` },
			],
			details: { taskId: params.task_id, teammateId: params.teammate_id ?? "" },
		};
	}

	const useWorktree = params.worktree === true;

	if (!useWorktree) {
		if (!params.teammate_id) {
			return {
				content: [{ type: "text", text: "teammate_id is required when worktree is not set to true." }],
				details: { taskId: params.task_id, teammateId: "" },
			};
		}
		const teammate = getTeammate(params.teammate_id);
		if (!teammate) {
			return {
				content: [{ type: "text", text: `Teammate "${params.teammate_id}" not found. Use team_create first.` }],
				details: { taskId: params.task_id, teammateId: params.teammate_id },
			};
		}
		claimAndRun(sessionId, params.task_id, params.teammate_id, task.description);
		return {
			content: [
				{
					type: "text",
					text: `Task "${params.task_id}" assigned to teammate "${params.teammate_id}". Running in background — a <task-notification> will arrive when complete.`,
				},
			],
			details: { taskId: params.task_id, teammateId: params.teammate_id },
		};
	}

	claimAndRun(sessionId, params.task_id, "", task.description, { useWorktree: true });
	return {
		content: [
			{
				type: "text",
				text: [
					`Task "${params.task_id}" launched in an isolated worktree environment.`,
					`A dedicated coding teammate (bash/read/write/edit) will be auto-spawned.`,
					`A <task-notification> will arrive when complete, including the worktree path.`,
				].join("\n"),
			},
		],
		details: { taskId: params.task_id, teammateId: "(auto-worktree)" },
	};
}

export const taskAssignToolDefinition = {
	name: "task_assign",
	label: "Assign Task to Teammate",
	description:
		"Assign a pending task to a teammate for autonomous background execution. " +
		"Returns immediately. A <task-notification> arrives when complete. " +
		"Set worktree: true to auto-create an isolated coding environment instead of using an existing teammate.",
	parameters: schema,
	isConcurrencySafe: () => true,
	isReadOnly: () => false,
	isDestructive: () => false,
	getToolUseSummary(input: any) {
		return input.taskId ?? "Task assign";
	},
	getActivityDescription() {
		return "Assigning task";
	},
	toAutoClassifierInput(input: any) {
		return { tool: "task_assign", ...(input as Record<string, unknown>) };
	},
	execute,
};

export const taskAssignTool = taskAssignToolDefinition as any;

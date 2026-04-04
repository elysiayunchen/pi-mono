/**
 * task_update — Update a task's status, output, or blocking relationships.
 * Mirrors Claude Code's TaskUpdateTool.
 *
 * The special status "deleted" removes the task entirely from the session.
 * Blocking relationships (addBlocks / addBlockedBy) are maintained bidirectionally.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { blockTask, deleteTask, getCurrentSessionId, getTask, updateTask } from "../tasks/task-store.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	taskId: Type.String({
		description: "The ID of the task to update",
	}),
	subject: Type.Optional(Type.String({ description: "New subject/title for the task" })),
	description: Type.Optional(Type.String({ description: "New description for the task" })),
	activeForm: Type.Optional(Type.String({ description: "New present-continuous spinner label" })),
	status: Type.Optional(
		Type.Union(
			[
				Type.Literal("pending"),
				Type.Literal("in_progress"),
				Type.Literal("completed"),
				Type.Literal("stopped"),
				Type.Literal("failed"),
				Type.Literal("deleted"),
			],
			{
				description: 'New status. Use "deleted" to permanently remove the task.',
			},
		),
	),
	output: Type.Optional(Type.String({ description: "Replace the task output with this text" })),
	owner: Type.Optional(Type.String({ description: "New owner name for the task" })),
	addBlocks: Type.Optional(
		Type.Array(Type.String(), {
			description: "Task IDs that this task now blocks",
		}),
	),
	addBlockedBy: Type.Optional(
		Type.Array(Type.String(), {
			description: "Task IDs that now block this task",
		}),
	),
	metadata: Type.Optional(
		Type.Record(Type.String(), Type.Unknown(), {
			description: "Metadata keys to merge in. Set a key to null to delete it.",
		}),
	),
});

export const taskUpdateToolDefinition: ToolDefinition<typeof schema> = {
	name: "task_update",
	label: "Task",
	description:
		"Update a task's status, output, blocking relationships, or any other field. " +
		"Use status='in_progress' when you start working on a task, and 'completed' when done. " +
		"Use status='deleted' to permanently remove a task.",
	promptGuidelines: [
		"Always mark a task in_progress before working on it.",
		"Always mark a task completed or failed when you finish it.",
		"Use addBlockedBy to express dependency ordering between tasks.",
	],
	parameters: schema,

	async execute(_toolCallId, params) {
		const sessionId = getCurrentSessionId();
		const existing = getTask(sessionId, params.taskId);

		if (!existing) {
			return {
				content: [{ type: "text", text: `Task ${params.taskId} not found.` }],
				details: { success: false, taskId: params.taskId },
			};
		}

		const updatedFields: string[] = [];

		// Handle deletion separately
		if (params.status === "deleted") {
			deleteTask(sessionId, params.taskId);
			return {
				content: [{ type: "text", text: `Task #${params.taskId} deleted.` }],
				details: {
					success: true,
					taskId: params.taskId,
					updatedFields: ["deleted"],
					statusChange: { from: existing.status, to: "deleted" },
				},
			};
		}

		// Build update payload, only include changed fields
		const update: Record<string, unknown> = {};
		if (params.subject !== undefined && params.subject !== existing.subject) {
			update.subject = params.subject;
			updatedFields.push("subject");
		}
		if (params.description !== undefined && params.description !== existing.description) {
			update.description = params.description;
			updatedFields.push("description");
		}
		if (params.activeForm !== undefined && params.activeForm !== existing.activeForm) {
			update.activeForm = params.activeForm;
			updatedFields.push("activeForm");
		}
		if (params.owner !== undefined && params.owner !== existing.owner) {
			update.owner = params.owner;
			updatedFields.push("owner");
		}
		if (params.output !== undefined) {
			update.output = params.output;
			updatedFields.push("output");
		}
		if (params.metadata !== undefined) {
			update.metadata = params.metadata as Record<string, unknown>;
			updatedFields.push("metadata");
		}

		const prevStatus = existing.status;
		if (params.status !== undefined && params.status !== existing.status) {
			update.status = params.status;
			updatedFields.push("status");
		}

		if (Object.keys(update).length > 0) {
			updateTask(sessionId, params.taskId, update as any);
		}

		// Handle blocking relationships (bidirectional, like Claude Code's blockTask)
		if (params.addBlocks && params.addBlocks.length > 0) {
			const newBlocks = params.addBlocks.filter((id) => !existing.blocks.includes(id));
			for (const blockedId of newBlocks) {
				blockTask(sessionId, params.taskId, blockedId);
			}
			if (newBlocks.length > 0) updatedFields.push("blocks");
		}
		if (params.addBlockedBy && params.addBlockedBy.length > 0) {
			const newBlockedBy = params.addBlockedBy.filter((id) => !existing.blockedBy.includes(id));
			for (const blockerId of newBlockedBy) {
				blockTask(sessionId, blockerId, params.taskId);
			}
			if (newBlockedBy.length > 0) updatedFields.push("blockedBy");
		}

		const statusChange =
			params.status !== undefined && params.status !== prevStatus
				? { from: prevStatus, to: params.status }
				: undefined;

		// Nudge: when completing the last task, remind to verify
		let resultText = `Updated task #${params.taskId}: ${updatedFields.join(", ")}`;
		if (statusChange?.to === "completed") {
			resultText +=
				"\n\nTask completed. Call task_list to check remaining tasks or see if your work unblocked others.";
		}

		return {
			content: [{ type: "text", text: resultText }],
			details: {
				success: true,
				taskId: params.taskId,
				updatedFields,
				statusChange,
			},
		};
	},
};

export const taskUpdateTool: AgentTool<typeof schema> = wrapToolDefinition(taskUpdateToolDefinition);

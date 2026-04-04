/**
 * P3-B: undo_last_action tool
 */
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { getFileHistory } from "../file-history.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({});

export const undoActionToolDefinition: ToolDefinition<typeof schema> = {
	name: "undo_last_action",
	label: "Undo",
	description:
		"Undo the most recent file write or edit operation, restoring the affected file " +
		"to its previous state. Each call undoes exactly one step. Use file_history_list " +
		"first to see what will be restored.",
	parameters: schema,

	async execute(_toolCallId, _params, _signal) {
		const history = getFileHistory();
		const result = await history.undo();
		return {
			content: [{ type: "text" as const, text: result.message }],
			details: { restored: result.restored, snapshotsRemaining: history.size },
		};
	},
};

export const undoActionTool: AgentTool<typeof schema> = wrapToolDefinition(undoActionToolDefinition);

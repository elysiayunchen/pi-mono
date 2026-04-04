/**
 * P3-B: file_history_list tool
 */
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { getFileHistory } from "../file-history.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	limit: Type.Optional(Type.Number({ description: "Max number of snapshots to show (default: 10)" })),
});

export const fileHistoryListToolDefinition: ToolDefinition<typeof schema> = {
	name: "file_history_list",
	label: "File History",
	description:
		"List recent file snapshots available for undo. Shows timestamps, tool names, " +
		"and affected file paths. Use before undo_last_action to understand what will be restored.",
	parameters: schema,

	async execute(_toolCallId, params, _signal) {
		const history = getFileHistory();
		const snapshots = history.list(params.limit ?? 10);

		if (snapshots.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: "No file history snapshots available. Snapshots are created automatically when write or edit tools are used.",
					},
				],
				details: { snapshots: [] },
			};
		}

		const lines = snapshots.map((s, i) => {
			const files = s.backups.map((b) => b.path).join(", ");
			const time = new Date(s.timestamp).toISOString();
			const hasNew = s.backups.some((b) => b.backupName === null);
			const note = hasNew ? " [new file — undo will delete]" : "";
			return `#${i + 1} id=${s.id} [${s.toolName}] ${time}${note}\n    ${files}`;
		});

		return {
			content: [
				{
					type: "text" as const,
					text: `File history — ${snapshots.length} snapshot(s):\n\n${lines.join("\n")}`,
				},
			],
			details: { snapshots, total: history.size },
		};
	},
};

export const fileHistoryListTool: AgentTool<typeof schema> = wrapToolDefinition(fileHistoryListToolDefinition);

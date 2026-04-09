import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({});

export const exitCodeModeToolDefinition: ToolDefinition<typeof schema> = {
	name: "exit_code_mode",
	label: "Exit Code Mode",
	description:
		"Exit Code Mode and return to normal assistant mode. " +
		"Restores the full system prompt with user memory and global skills.",
	promptSnippet: "Exit Code Mode, return to normal assistant",
	promptGuidelines: [
		"Use exit_code_mode when finished with coding work.",
		"This restores normal assistant behavior with user memory and context.",
	],
	parameters: schema,

	async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
		return {
			content: [
				{
					type: "text" as const,
					text:
						"Exited Code Mode. Returned to normal assistant mode. " +
						"User memory, global skills, and full context are restored.",
				},
			],
			details: { action: "exit_code_mode" },
		};
	},
};

export const exitCodeModeTool: AgentTool<typeof schema> = wrapToolDefinition(exitCodeModeToolDefinition);

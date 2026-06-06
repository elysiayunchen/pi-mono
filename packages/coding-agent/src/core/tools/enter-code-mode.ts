import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	reason: Type.Optional(
		Type.String({
			description: "What coding task you plan to work on in code mode",
		}),
	),
});

export const enterCodeModeToolDefinition: ToolDefinition<typeof schema> = {
	name: "enter_code_mode",
	label: "Code Mode",
	description:
		"Enter Code Mode for focused coding work. In code mode:\n" +
		"- Isolated session (no user memory or chat history loaded)\n" +
		"- Full coding tools available (read, write, edit, bash, grep, find, ls)\n" +
		"- Project-level skills and CLAUDE.md still loaded\n" +
		"- Clean, focused coding system prompt\n\n" +
		"Use this when switching from conversation to dedicated coding tasks. " +
		"Call exit_code_mode to return to normal assistant mode.",
	promptSnippet: "Enter Code Mode for focused coding work",
	promptGuidelines: [
		"Use enter_code_mode when starting a dedicated coding session.",
		"Code mode isolates the session from chat history and user memory.",
		"All coding tools remain available in code mode.",
		"Call exit_code_mode when done to return to normal assistant mode.",
	],
	parameters: schema,

	isConcurrencySafe: () => false,
	isReadOnly: () => true,
	isDestructive: () => false,
	getToolUseSummary() {
		return "Enter code mode";
	},
	getActivityDescription() {
		return "Entering code mode";
	},
	toAutoClassifierInput() {
		return { tool: "enter_code_mode" };
	},
	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		return {
			content: [
				{
					type: "text" as const,
					text:
						"Code Mode activated.\n\n" +
						"You are now a focused coding assistant. Your session is isolated from " +
						"chat history and user memory. Project-level skills and CLAUDE.md are " +
						"still available.\n\n" +
						"All coding tools (read, write, edit, bash, grep, find, ls) are available. " +
						"Focus on writing clean, well-tested code.\n\n" +
						"Use exit_code_mode to return to normal assistant mode.",
				},
			],
			details: { action: "enter_code_mode", reason: params.reason },
		};
	},
};

export const enterCodeModeTool: AgentTool<typeof schema> = wrapToolDefinition(enterCodeModeToolDefinition);

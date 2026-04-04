import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	confirmed_plan: Type.String({ description: "The approved plan summary that will be executed" }),
});

export const exitPlanModeToolDefinition: ToolDefinition<typeof schema> = {
	name: "exit_plan_mode",
	label: "Exit Plan",
	description: "Exit plan mode and return to normal execution. " + "Call this after the user has approved your plan.",
	promptSnippet: "Exit plan mode — begin executing approved plan",
	parameters: schema,

	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		return {
			content: [
				{
					type: "text",
					text:
						`Plan mode deactivated. Executing approved plan:\n\n` +
						`${params.confirmed_plan}\n\n` +
						`You may now use all tools freely. Track progress with todo_write.`,
				},
			],
			details: { action: "exit_plan_mode", confirmedPlan: params.confirmed_plan },
		};
	},
};

export const exitPlanModeTool: AgentTool<typeof schema> = wrapToolDefinition(exitPlanModeToolDefinition);

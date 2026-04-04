import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { analyzeTask, formatAnalysisForPrompt } from "../task-analyzer.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const schema = Type.Object({
	reason: Type.String({ description: "Why you are entering plan mode — what you plan to figure out" }),
});

export const enterPlanModeToolDefinition: ToolDefinition<typeof schema> = {
	name: "enter_plan_mode",
	label: "Plan",
	description:
		"Enter plan mode for complex tasks. Use this tool PROACTIVELY when:\n" +
		"1. Adding meaningful new functionality (e.g. 'Add user authentication')\n" +
		"2. Multiple valid approaches exist (e.g. 'Add caching' — Redis vs in-memory vs file-based)\n" +
		"3. Changes affect existing behavior or structure (e.g. 'Update the login flow')\n" +
		"4. Architectural decisions are needed (e.g. 'Add real-time updates' — WebSocket vs SSE vs polling)\n" +
		"5. Task will touch more than 2-3 files (e.g. 'Refactor the auth system')\n" +
		"6. Requirements are unclear and need exploration (e.g. 'Make the app faster')\n" +
		"7. User preferences matter for the implementation\n\n" +
		"Do NOT use for simple tasks: typos, obvious bugs, small tweaks, single-function additions, " +
		"or tasks with very specific instructions.\n\n" +
		"In plan mode you MUST create a detailed plan with todo_write before making any changes. " +
		"Read-only tools (read, grep, find, ls) are available. " +
		"Present your plan to the user, then call exit_plan_mode after approval.",
	promptSnippet: "Enter plan mode — plan before executing",
	parameters: schema,

	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		// Phase 2: Pre-analyze task complexity
		const analysis = analyzeTask(params.reason);
		const analysisBlock = formatAnalysisForPrompt(analysis);
		return {
			content: [
				{
					type: "text",
					text:
						"Plan mode activated. Reason: " +
						params.reason +
						"\n\n" +
						analysisBlock +
						"\n\n" +
						"In plan mode, you should:\n" +
						"1. Thoroughly explore the codebase using read, grep, and find tools\n" +
						"2. Understand existing patterns and architecture\n" +
						"3. Consider multiple approaches and their trade-offs\n" +
						"4. Design a concrete implementation strategy\n" +
						"5. Use todo_write to create a step-by-step plan\n" +
						"6. Present your plan to the user for approval\n" +
						"7. Use exit_plan_mode when ready to implement\n\n" +
						"Remember: DO NOT write or edit any files yet. " +
						"This is a read-only exploration and planning phase.",
				},
			],
			details: { action: "enter_plan_mode", reason: params.reason },
		};
	},
};

export const enterPlanModeTool: AgentTool<typeof schema> = wrapToolDefinition(enterPlanModeToolDefinition);

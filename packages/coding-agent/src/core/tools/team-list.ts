import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { TeammateInfo } from "../teammate-runner.js";
import { listTeammates } from "../teammate-runner.js";

const schema = Type.Object({});

async function execute(
	_toolCallId: string,
	_params: Record<string, never>,
	_signal?: AbortSignal,
	_onUpdate?: unknown,
	_ctx?: unknown,
): Promise<AgentToolResult<TeammateInfo[]>> {
	const teammates = listTeammates();
	if (teammates.length === 0) {
		return {
			content: [{ type: "text", text: "No teammates exist in this session. Use team_create to add one." }],
			details: [],
		};
	}
	const lines = teammates.map(
		(t) => `- ${t.name} (id: ${t.id})  role: ${t.role}  messages: ${String(t.messageCount)}`,
	);
	const text = `Active teammates (${String(teammates.length)}):\n${lines.join("\n")}`;
	return {
		content: [{ type: "text", text }],
		details: teammates,
	};
}

export const teamListToolDefinition = {
	name: "team_list",
	label: "List Teammates",
	description: "List all active in-process teammates for this session, including their id, role, and message count.",
	parameters: schema,
	execute,
};

export const teamListTool = teamListToolDefinition as any;

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import type { TeammateInfo } from "../teammate-runner.js";
import { createTeammate, getHostSessionId } from "../teammate-runner.js";

const schema = Type.Object({
	id: Type.String({
		description: "Short unique ID for this teammate, e.g. reviewer or tester. Used in send_message and team_delete.",
	}),
	name: Type.String({
		description: "Display name, e.g. Code Reviewer or Security Analyst.",
	}),
	role: Type.String({
		description: "One-line role description shown in team_list output.",
	}),
	system_prompt: Type.String({
		description: "Full system prompt defining the teammate persona, expertise, and behavior rules.",
	}),
});

type Params = Static<typeof schema>;

async function execute(
	_toolCallId: string,
	params: Params,
	_signal?: AbortSignal,
	_onUpdate?: unknown,
	_ctx?: unknown,
): Promise<AgentToolResult<TeammateInfo>> {
	const info = createTeammate(params.id, params.name, params.role, params.system_prompt);
	const teamsDir = join(homedir(), ".pi", "agent", "teams", params.id);
	await mkdir(teamsDir, { recursive: true });
	await writeFile(
		join(teamsDir, "config.json"),
		JSON.stringify({ ...info, hostSessionId: getHostSessionId() }, null, 2),
	);
	return {
		content: [
			{
				type: "text",
				text: `Teammate ${params.name} (id: ${params.id}) created. Use send_message to communicate with it.`,
			},
		],
		details: info,
	};
}

export const teamCreateToolDefinition = {
	name: "team_create",
	label: "Create Teammate",
	description:
		"Create a new in-process AI teammate with a custom system prompt. " +
		"The teammate runs the same model as the host session and maintains its own conversation history. " +
		"Use team_list to see existing teammates, send_message to talk to one, team_delete to remove one.",
	parameters: schema,
	execute,
};

export const teamCreateTool = teamCreateToolDefinition as any;

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { deleteTeammate } from "../teammate-runner.js";

const schema = Type.Object({
	id: Type.String({ description: "ID of the teammate to delete (same id used in team_create)." }),
});

type Params = Static<typeof schema>;

async function execute(
	_toolCallId: string,
	params: Params,
	_signal?: AbortSignal,
	_onUpdate?: unknown,
	_ctx?: unknown,
): Promise<AgentToolResult<{ deleted: boolean; id: string }>> {
	const deleted = await deleteTeammate(params.id);
	const text = deleted
		? `Teammate "${params.id}" deleted.`
		: `Teammate "${params.id}" not found (already deleted or never created).`;
	return {
		content: [{ type: "text", text }],
		details: { deleted, id: params.id },
	};
}

export const teamDeleteToolDefinition = {
	name: "team_delete",
	label: "Delete Teammate",
	description: "Delete an in-process teammate and free its resources. Any in-progress generation is aborted.",
	parameters: schema,
	execute,
};

export const teamDeleteTool = teamDeleteToolDefinition as any;

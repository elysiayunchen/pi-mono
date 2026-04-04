import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { getTeammate, listTeammates, sendToTeammate, shutdownTeammate } from "../teammate-runner.js";

// Structured message discriminated union
const StructuredMessage = Type.Union([
	Type.Object({
		type: Type.Literal("shutdown_request"),
		reason: Type.Optional(Type.String()),
	}),
	Type.Object({
		type: Type.Literal("shutdown_response"),
		request_id: Type.String(),
		approve: Type.Boolean(),
		reason: Type.Optional(Type.String()),
	}),
]);

const schema = Type.Object({
	to: Type.String({
		description: 'Recipient: teammate id, or "*" to broadcast to all teammates.',
	}),
	summary: Type.Optional(
		Type.String({
			description: "5-10 word preview shown in UI. Required when message is a plain string.",
		}),
	),
	message: Type.Union([Type.String({ description: "Plain text message content." }), StructuredMessage]),
});

type Params = Static<typeof schema>;

type MessageOutput = { success: boolean; message: string; to: string };
type BroadcastOutput = { success: boolean; message: string; recipients: string[] };

async function execute(
	_toolCallId: string,
	params: Params,
	_signal?: AbortSignal,
	_onUpdate?: unknown,
	_ctx?: unknown,
): Promise<AgentToolResult<MessageOutput | BroadcastOutput>> {
	// ── Structured messages ────────────────────────────────────
	if (typeof params.message === "object") {
		if (params.message.type === "shutdown_request") {
			const info = getTeammate(params.to);
			if (!info) {
				throw new Error(`Teammate "${params.to}" not found.`);
			}
			await shutdownTeammate(params.to);
			return {
				content: [{ type: "text", text: `Shutdown request sent to "${params.to}". Teammate terminated.` }],
				details: { success: true, message: "shutdown complete", to: params.to },
			};
		}
		if (params.message.type === "shutdown_response") {
			// We are a teammate responding to shutdown — just ACK
			return {
				content: [{ type: "text", text: `Shutdown ${params.message.approve ? "approved" : "rejected"}.` }],
				details: { success: true, message: "shutdown_response sent", to: params.to },
			};
		}
	}

	// ── Broadcast ──────────────────────────────────────────────
	if (params.to === "*") {
		if (typeof params.message !== "string") {
			throw new Error("Structured messages cannot be broadcast.");
		}
		const teammates = listTeammates();
		if (teammates.length === 0) {
			return {
				content: [{ type: "text", text: "No teammates to broadcast to." }],
				details: { success: true, message: "no recipients", recipients: [] },
			};
		}
		const results: string[] = [];
		for (const t of teammates) {
			const resp = await sendToTeammate(t.id, params.message);
			results.push(`**${t.name}**: ${resp}`);
		}
		return {
			content: [{ type: "text", text: results.join("\n\n") }],
			details: { success: true, message: "broadcast complete", recipients: teammates.map((t) => t.id) },
		};
	}

	// ── Direct message ─────────────────────────────────────────
	const info = getTeammate(params.to);
	if (!info) {
		throw new Error(
			`Teammate "${params.to}" not found. Use team_create first, or team_list to see available teammates.`,
		);
	}
	const response = await sendToTeammate(
		params.to,
		typeof params.message === "string" ? params.message : JSON.stringify(params.message),
	);
	return {
		content: [{ type: "text", text: `**${info.name}**: ${response}` }],
		details: { success: true, message: response, to: params.to },
	};
}

export const sendMessageToolDefinition = {
	name: "send_message",
	label: "Send Message to Teammate",
	description:
		"Send a message to an in-process AI teammate and receive its response. " +
		'Use to: "*" to broadcast to all teammates. ' +
		"Supports structured shutdown_request to gracefully terminate a teammate. " +
		"Use team_list to see available teammates, team_create to add new ones.",
	parameters: schema,
	execute,
};

export const sendMessageTool = sendMessageToolDefinition as any;

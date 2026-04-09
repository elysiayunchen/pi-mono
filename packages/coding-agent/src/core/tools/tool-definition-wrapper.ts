import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ExtensionContext, ToolDefinition } from "../extensions/types.js";

/** Wrap a ToolDefinition into an AgentTool for the core runtime. */
export function wrapToolDefinition<TDetails = unknown>(
	definition: ToolDefinition<any, TDetails>,
	ctxFactory?: () => ExtensionContext,
): AgentTool<any, TDetails> {
	return {
		name: definition.name,
		label: definition.label,
		description: definition.description,
		parameters: definition.parameters,
		prepareArguments: definition.prepareArguments,
		execute: (toolCallId, params, signal, onUpdate) =>
			definition.execute(toolCallId, params, signal, onUpdate, ctxFactory?.() as ExtensionContext),
	} as AgentTool<any, TDetails> & {
		isEnabled: () => boolean;
		isConcurrencySafe: (input: any) => boolean;
		isReadOnly: (input: any) => boolean;
		isDestructive: (input: any) => boolean;
		checkPermissions: (input: any, ctx: any) => Promise<any>;
		validateInput: (input: any, ctx: any) => Promise<any>;
		getPath: (input: any) => string | undefined;
		preparePermissionMatcher: (input: any) => Promise<(pattern: string) => boolean>;
		getToolUseSummary: (input: any) => string | null;
		getActivityDescription: (input: any) => string | null;
		toAutoClassifierInput: (input: any) => unknown;
	};
}

/** Wrap multiple ToolDefinitions into AgentTools for the core runtime. */
export function wrapToolDefinitions(
	definitions: ToolDefinition<any, any>[],
	ctxFactory?: () => ExtensionContext,
): AgentTool<any>[] {
	return definitions.map((definition) => wrapToolDefinition(definition, ctxFactory));
}

/**
 * Synthesize a minimal ToolDefinition from an AgentTool.
 *
 * This keeps AgentSession's internal registry definition-first even when a caller
 * provides plain AgentTool overrides that do not include prompt metadata or renderers.
 */
export function createToolDefinitionFromAgentTool(tool: AgentTool<any>): ToolDefinition<any, unknown> {
	return {
		name: tool.name,
		label: tool.label,
		description: tool.description,
		parameters: tool.parameters as any,
		prepareArguments: tool.prepareArguments,
		execute: async (toolCallId, params, signal, onUpdate) => tool.execute(toolCallId, params, signal, onUpdate),
	};
}

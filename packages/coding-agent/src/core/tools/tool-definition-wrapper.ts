import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ExtensionContext, ToolDefinition } from "../extensions/types.js";

/** Wrap a ToolDefinition into an AgentTool for the core runtime. */
export function wrapToolDefinition<TDetails = unknown>(
	definition: ToolDefinition<any, TDetails>,
	ctxFactory?: () => ExtensionContext,
): AgentTool<any, TDetails> {
	const tool: AgentTool<any, TDetails> & {
		isEnabled?: () => boolean;
		isConcurrencySafe?: (input: any) => boolean;
		isReadOnly?: (input: any) => boolean;
		isDestructive?: (input: any) => boolean;
		checkPermissions?: (input: any, ctx: any) => Promise<any>;
		validateInput?: (input: any, ctx: any) => Promise<any>;
		getPath?: (input: any) => string | undefined;
		preparePermissionMatcher?: (input: any) => Promise<(pattern: string) => boolean>;
		getToolUseSummary?: (input: any) => string | null;
		getActivityDescription?: (input: any) => string | null;
		toAutoClassifierInput?: (input: any) => unknown;
		promptSnippet?: string;
		promptGuidelines?: string[];
		renderCall?: (args: any, theme: any, context: any) => any;
		renderResult?: (result: any, options: any, theme: any, context: any) => any;
	} = {
		name: definition.name,
		label: definition.label,
		description: definition.description,
		parameters: definition.parameters,
		prepareArguments: definition.prepareArguments,
		execute: (toolCallId, params, signal, onUpdate) =>
			definition.execute(toolCallId, params, signal, onUpdate, ctxFactory?.() as ExtensionContext),
	};

	// Propagate optional extension fields from ToolDefinition (Pitfall #82: wrapToolDefinition
	// was dropping capability declarations and UI helpers, causing runtime undefined for
	// isConcurrencySafe/isReadOnly/isDestructive/getToolUseSummary etc.)
	if (definition.isEnabled !== undefined) tool.isEnabled = definition.isEnabled;
	if (definition.isConcurrencySafe !== undefined) tool.isConcurrencySafe = definition.isConcurrencySafe;
	if (definition.isReadOnly !== undefined) tool.isReadOnly = definition.isReadOnly;
	if (definition.isDestructive !== undefined) tool.isDestructive = definition.isDestructive;
	if (definition.checkPermissions !== undefined) tool.checkPermissions = definition.checkPermissions;
	if (definition.validateInput !== undefined) tool.validateInput = definition.validateInput;
	if (definition.getPath !== undefined) tool.getPath = definition.getPath;
	if (definition.preparePermissionMatcher !== undefined)
		tool.preparePermissionMatcher = definition.preparePermissionMatcher;
	if (definition.getToolUseSummary !== undefined) tool.getToolUseSummary = definition.getToolUseSummary;
	if (definition.getActivityDescription !== undefined) tool.getActivityDescription = definition.getActivityDescription;
	if (definition.toAutoClassifierInput !== undefined) tool.toAutoClassifierInput = definition.toAutoClassifierInput;
	if (definition.promptSnippet !== undefined) tool.promptSnippet = definition.promptSnippet;
	if (definition.promptGuidelines !== undefined) tool.promptGuidelines = definition.promptGuidelines;
	if (definition.renderCall !== undefined) tool.renderCall = definition.renderCall;
	if (definition.renderResult !== undefined) tool.renderResult = definition.renderResult;

	return tool;
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

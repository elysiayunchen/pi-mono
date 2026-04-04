/**
 * Agent loop that works with AgentMessage throughout.
 * Transforms to Message[] only at the LLM call boundary.
 */

import {
	type AssistantMessage,
	type Context,
	EventStream,
	isContextOverflow,
	streamSimple,
	type ToolResultMessage,
	validateToolArguments,
} from "@mariozechner/pi-ai";

import type {
	AgentContext,
	AgentEvent,
	AgentLoopConfig,
	AgentMessage,
	AgentTool,
	AgentToolCall,
	AgentToolResult,
	StreamFn,
} from "./types.js";

// ============================================================================
// Tool Classification (for smart execution)
// ============================================================================

/** Tools that only read data and have no side effects */
const READ_ONLY_TOOLS = new Set(["read", "grep", "find", "ls", "glob", "search", "list"]);

/** Tools that modify files or execute commands */
const MUTATING_TOOLS = new Set([
	"write",
	"edit",
	"bash",
	"shell",
	"exec",
	"command",
	"delete",
	"remove",
	"move",
	"rename",
]);

function isReadOnlyTool(toolCall: AgentToolCall): boolean {
	if (READ_ONLY_TOOLS.has(toolCall.name)) return true;
	if (MUTATING_TOOLS.has(toolCall.name)) return false;
	// Unknown tools: treat as mutating for safety
	return false;
}

function isMutatingTool(toolCall: AgentToolCall): boolean {
	return !isReadOnlyTool(toolCall);
}

export type AgentEventSink = (event: AgentEvent) => Promise<void> | void;

/**
 * Start an agent loop with a new prompt message.
 * The prompt is added to the context and events are emitted for it.
 */
export function agentLoop(
	prompts: AgentMessage[],
	context: AgentContext,
	config: AgentLoopConfig,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): EventStream<AgentEvent, AgentMessage[]> {
	const stream = createAgentStream();

	void runAgentLoop(
		prompts,
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	).then((messages) => {
		stream.end(messages);
	});

	return stream;
}

/**
 * Continue an agent loop from the current context without adding a new message.
 * Used for retries - context already has user message or tool results.
 *
 * **Important:** The last message in context must convert to a `user` or `toolResult` message
 * via `convertToLlm`. If it doesn't, the LLM provider will reject the request.
 * This cannot be validated here since `convertToLlm` is only called once per turn.
 */
export function agentLoopContinue(
	context: AgentContext,
	config: AgentLoopConfig,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): EventStream<AgentEvent, AgentMessage[]> {
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}

	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	const stream = createAgentStream();

	void runAgentLoopContinue(
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	).then((messages) => {
		stream.end(messages);
	});

	return stream;
}

export async function runAgentLoop(
	prompts: AgentMessage[],
	context: AgentContext,
	config: AgentLoopConfig,
	emit: AgentEventSink,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): Promise<AgentMessage[]> {
	const newMessages: AgentMessage[] = [...prompts];
	const currentContext: AgentContext = {
		...context,
		messages: [...context.messages, ...prompts],
	};

	await emit({ type: "agent_start" });
	await emit({ type: "turn_start" });
	for (const prompt of prompts) {
		await emit({ type: "message_start", message: prompt });
		await emit({ type: "message_end", message: prompt });
	}

	await runLoop(currentContext, newMessages, config, signal, emit, streamFn);
	return newMessages;
}

export async function runAgentLoopContinue(
	context: AgentContext,
	config: AgentLoopConfig,
	emit: AgentEventSink,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): Promise<AgentMessage[]> {
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}

	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	const newMessages: AgentMessage[] = [];
	const currentContext: AgentContext = { ...context };

	await emit({ type: "agent_start" });
	await emit({ type: "turn_start" });

	await runLoop(currentContext, newMessages, config, signal, emit, streamFn);
	return newMessages;
}

// ── P1-C: Lightweight token estimation (chars/4 heuristic, no cross-package dep) ──

function estimateAgentMessages(messages: AgentMessage[]): number {
	let chars = 0;
	for (const msg of messages) {
		const m = msg as unknown as Record<string, unknown>;
		const content = m.content;
		if (typeof content === "string") {
			chars += content.length;
		} else if (Array.isArray(content)) {
			for (const block of content as Array<Record<string, unknown>>) {
				if (block.type === "text" && typeof block.text === "string") {
					chars += block.text.length;
				}
			}
		}
		if (typeof m.command === "string") chars += m.command.length;
		if (typeof m.output === "string") chars += m.output.length;
		if (typeof m.summary === "string") chars += m.summary.length;
	}
	return Math.ceil(chars / 4);
}

// ── P2: Token Budget Tracker ─────────────────────────────────────────────────

type BudgetTracker = {
	continuationCount: number;
	lastDeltaTokens: number;
	lastTotalTokens: number;
	startedAt: number;
};

function createBudgetTracker(): BudgetTracker {
	return {
		continuationCount: 0,
		lastDeltaTokens: 0,
		lastTotalTokens: 0,
		startedAt: Date.now(),
	};
}

type BudgetDecision =
	| { action: "continue"; nudgeMessage: string; continuationCount: number }
	| { action: "stop"; diminishingReturns: boolean };

const BUDGET_COMPLETION_THRESHOLD = 0.9;
const BUDGET_DIMINISHING_THRESHOLD = 500;
const BUDGET_MAX_CONTINUATIONS = 50;

function checkTokenBudget(tracker: BudgetTracker, totalBudget: number, currentTokens: number): BudgetDecision {
	const pct = Math.round((currentTokens / totalBudget) * 100);
	const deltaSinceLastCheck = currentTokens - tracker.lastTotalTokens;

	const isDiminishing =
		tracker.continuationCount >= 3 &&
		deltaSinceLastCheck < BUDGET_DIMINISHING_THRESHOLD &&
		tracker.lastDeltaTokens < BUDGET_DIMINISHING_THRESHOLD;

	if (
		!isDiminishing &&
		currentTokens < totalBudget * BUDGET_COMPLETION_THRESHOLD &&
		tracker.continuationCount < BUDGET_MAX_CONTINUATIONS
	) {
		tracker.continuationCount++;
		tracker.lastDeltaTokens = deltaSinceLastCheck;
		tracker.lastTotalTokens = currentTokens;
		return {
			action: "continue",
			nudgeMessage:
				`Token budget: ${pct}% used (${currentTokens.toLocaleString()} / ${totalBudget.toLocaleString()}). ` +
				`Continue working productively — plan your remaining work to fill the budget. ` +
				`The target is a hard minimum, not a suggestion.`,
			continuationCount: tracker.continuationCount,
		};
	}

	return { action: "stop", diminishingReturns: isDiminishing };
}

function createAgentStream(): EventStream<AgentEvent, AgentMessage[]> {
	return new EventStream<AgentEvent, AgentMessage[]>(
		(event: AgentEvent) => event.type === "agent_end",
		(event: AgentEvent) => (event.type === "agent_end" ? event.messages : []),
	);
}

/**
 * Main loop logic shared by agentLoop and agentLoopContinue.
 */
async function runLoop(
	currentContext: AgentContext,
	newMessages: AgentMessage[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
	streamFn?: StreamFn,
): Promise<void> {
	let firstTurn = true;
	const budgetTracker = config.tokenBudget ? createBudgetTracker() : null;
	// Check for steering messages at start (user may have typed while waiting)
	let pendingMessages: AgentMessage[] = (await config.getSteeringMessages?.()) || [];

	// Outer loop: continues when queued follow-up messages arrive after agent would stop
	while (true) {
		let hasMoreToolCalls = true;

		// Inner loop: process tool calls and steering messages
		while (hasMoreToolCalls || pendingMessages.length > 0) {
			if (!firstTurn) {
				await emit({ type: "turn_start" });
			} else {
				firstTurn = false;
			}

			// Process pending messages (inject before next assistant response)
			if (pendingMessages.length > 0) {
				for (const message of pendingMessages) {
					await emit({ type: "message_start", message });
					await emit({ type: "message_end", message });
					currentContext.messages.push(message);
					newMessages.push(message);
				}
				pendingMessages = [];
			}

			// ── P1-C: Proactive token pressure check ────────────────────────────
			if (config.contextPressureThreshold !== undefined) {
				const estimatedTokens = estimateAgentMessages(currentContext.messages);
				if (estimatedTokens > config.contextPressureThreshold) {
					await emit({
						type: "context_pressure",
						tokens: estimatedTokens,
						threshold: config.contextPressureThreshold,
					});
				}
			}

			// Stream assistant response
			const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn);
			newMessages.push(message);

			// Error recovery: try to fix automatically before giving up
			if (message.stopReason === "error") {
				const recovered = await tryErrorRecovery(message, currentContext, config, signal, emit);
				if (recovered) {
					pendingMessages = [];
					continue; // Recovery succeeded, retry
				}
				// Recovery failed
				await emit({ type: "turn_end", message, toolResults: [] });
				await emit({ type: "agent_end", messages: newMessages });
				return;
			}

			if (message.stopReason === "aborted") {
				await emit({ type: "turn_end", message, toolResults: [] });
				await emit({ type: "agent_end", messages: newMessages });
				return;
			}

			// Check for tool calls
			const toolCalls = message.content.filter((c) => c.type === "toolCall");
			hasMoreToolCalls = toolCalls.length > 0;

			const toolResults: ToolResultMessage[] = [];
			if (hasMoreToolCalls) {
				toolResults.push(...(await executeToolCalls(currentContext, message, config, signal, emit)));

				for (const result of toolResults) {
					currentContext.messages.push(result);
					newMessages.push(result);
				}
			}

			await emit({ type: "turn_end", message, toolResults });

			pendingMessages = (await config.getSteeringMessages?.()) || [];
		}

		// Agent would stop here. Check for follow-up messages.
		const followUpMessages = (await config.getFollowUpMessages?.()) || [];
		if (followUpMessages.length > 0) {
			// Set as pending so inner loop processes them
			pendingMessages = followUpMessages;
			continue;
		}

		// P2: Token budget auto-continuation
		if (budgetTracker && config.tokenBudget) {
			const estimatedTokens = estimateAgentMessages(currentContext.messages);
			const decision = checkTokenBudget(budgetTracker, config.tokenBudget.total, estimatedTokens);
			if (decision.action === "continue") {
				await emit({
					type: "context_pressure",
					tokens: estimatedTokens,
					threshold: Math.floor(config.tokenBudget.total * 0.9),
				});
				const nudgeMessage = {
					role: "user" as const,
					content: [{ type: "text" as const, text: decision.nudgeMessage }],
					timestamp: Date.now(),
				} as AgentMessage;
				currentContext.messages.push(nudgeMessage);
				newMessages.push(nudgeMessage);
				pendingMessages = [];
				continue;
			}
		}

		// No more messages, exit
		break;
	}

	await emit({ type: "agent_end", messages: newMessages });
}

/**
 * Stream an assistant response from the LLM.
 * This is where AgentMessage[] gets transformed to Message[] for the LLM.
 */
async function streamAssistantResponse(
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
	streamFn?: StreamFn,
): Promise<AssistantMessage> {
	// Apply context transform if configured (AgentMessage[] → AgentMessage[])
	let messages = context.messages;
	if (config.transformContext) {
		messages = await config.transformContext(messages, signal);
	}

	// Convert to LLM-compatible messages (AgentMessage[] → Message[])
	const llmMessages = await config.convertToLlm(messages);

	// Build LLM context
	const llmContext: Context = {
		systemPrompt: context.systemPrompt,
		messages: llmMessages,
		tools: context.tools,
	};

	const streamFunction = streamFn || streamSimple;

	// Resolve API key (important for expiring tokens)
	const resolvedApiKey =
		(config.getApiKey ? await config.getApiKey(config.model.provider) : undefined) || config.apiKey;

	const response = await streamFunction(config.model, llmContext, {
		...config,
		apiKey: resolvedApiKey,
		signal,
	});

	let partialMessage: AssistantMessage | null = null;
	let addedPartial = false;

	for await (const event of response) {
		switch (event.type) {
			case "start":
				partialMessage = event.partial;
				context.messages.push(partialMessage);
				addedPartial = true;
				await emit({ type: "message_start", message: { ...partialMessage } });
				break;

			case "text_start":
			case "text_delta":
			case "text_end":
			case "thinking_start":
			case "thinking_delta":
			case "thinking_end":
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				if (partialMessage) {
					partialMessage = event.partial;
					context.messages[context.messages.length - 1] = partialMessage;
					await emit({
						type: "message_update",
						assistantMessageEvent: event,
						message: { ...partialMessage },
					});
				}
				break;

			case "done":
			case "error": {
				const finalMessage = await response.result();
				if (addedPartial) {
					context.messages[context.messages.length - 1] = finalMessage;
				} else {
					context.messages.push(finalMessage);
				}
				if (!addedPartial) {
					await emit({ type: "message_start", message: { ...finalMessage } });
				}
				await emit({ type: "message_end", message: finalMessage });
				return finalMessage;
			}
		}
	}

	const finalMessage = await response.result();
	if (addedPartial) {
		context.messages[context.messages.length - 1] = finalMessage;
	} else {
		context.messages.push(finalMessage);
		await emit({ type: "message_start", message: { ...finalMessage } });
	}
	await emit({ type: "message_end", message: finalMessage });
	return finalMessage;
}

/**
 * Execute tool calls from an assistant message.
 */
async function executeToolCalls(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ToolResultMessage[]> {
	const toolCalls = assistantMessage.content.filter((c): c is AgentToolCall => c.type === "toolCall");

	switch (config.toolExecution) {
		case "sequential":
			return executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
		case "smart":
			return executeToolCallsSmart(currentContext, assistantMessage, toolCalls, config, signal, emit);
		default:
			return executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
	}
}

async function executeToolCallsSequential(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: AgentToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ToolResultMessage[]> {
	const results: ToolResultMessage[] = [];

	for (const toolCall of toolCalls) {
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const preparation = await prepareToolCall(currentContext, assistantMessage, toolCall, config, signal);
		if (preparation.kind === "immediate") {
			results.push(await emitToolCallOutcome(toolCall, preparation.result, preparation.isError, emit));
		} else {
			const executed = await executePreparedToolCall(preparation, signal, emit);
			results.push(
				await finalizeExecutedToolCall(
					currentContext,
					assistantMessage,
					preparation,
					executed,
					config,
					signal,
					emit,
				),
			);
		}
	}

	return results;
}

async function executeToolCallsParallel(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: AgentToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ToolResultMessage[]> {
	const results: ToolResultMessage[] = [];
	const runnableCalls: PreparedToolCall[] = [];

	for (const toolCall of toolCalls) {
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const preparation = await prepareToolCall(currentContext, assistantMessage, toolCall, config, signal);
		if (preparation.kind === "immediate") {
			results.push(await emitToolCallOutcome(toolCall, preparation.result, preparation.isError, emit));
		} else {
			runnableCalls.push(preparation);
		}
	}

	const runningCalls = runnableCalls.map((prepared) => ({
		prepared,
		execution: executePreparedToolCall(prepared, signal, emit),
	}));

	for (const running of runningCalls) {
		const executed = await running.execution;
		results.push(
			await finalizeExecutedToolCall(
				currentContext,
				assistantMessage,
				running.prepared,
				executed,
				config,
				signal,
				emit,
			),
		);
	}

	return results;
}

type PreparedToolCall = {
	kind: "prepared";
	toolCall: AgentToolCall;
	tool: AgentTool<any>;
	args: unknown;
};

type ImmediateToolCallOutcome = {
	kind: "immediate";
	result: AgentToolResult<any>;
	isError: boolean;
};

type ExecutedToolCallOutcome = {
	result: AgentToolResult<any>;
	isError: boolean;
};

function prepareToolCallArguments(tool: AgentTool<any>, toolCall: AgentToolCall): AgentToolCall {
	if (!tool.prepareArguments) {
		return toolCall;
	}
	const preparedArguments = tool.prepareArguments(toolCall.arguments);
	if (preparedArguments === toolCall.arguments) {
		return toolCall;
	}
	return {
		...toolCall,
		arguments: preparedArguments as Record<string, any>,
	};
}

async function prepareToolCall(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCall: AgentToolCall,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
): Promise<PreparedToolCall | ImmediateToolCallOutcome> {
	const tool = currentContext.tools?.find((t) => t.name === toolCall.name);
	if (!tool) {
		return {
			kind: "immediate",
			result: createErrorToolResult(`Tool ${toolCall.name} not found`),
			isError: true,
		};
	}

	try {
		const preparedToolCall = prepareToolCallArguments(tool, toolCall);
		const validatedArgs = validateToolArguments(tool, preparedToolCall);
		if (config.beforeToolCall) {
			const beforeResult = await config.beforeToolCall(
				{
					assistantMessage,
					toolCall,
					args: validatedArgs,
					context: currentContext,
				},
				signal,
			);
			if (beforeResult?.block) {
				return {
					kind: "immediate",
					result: createErrorToolResult(beforeResult.reason || "Tool execution was blocked"),
					isError: true,
				};
			}
		}
		return {
			kind: "prepared",
			toolCall,
			tool,
			args: validatedArgs,
		};
	} catch (error) {
		return {
			kind: "immediate",
			result: createErrorToolResult(error instanceof Error ? error.message : String(error)),
			isError: true,
		};
	}
}

async function executePreparedToolCall(
	prepared: PreparedToolCall,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolCallOutcome> {
	const updateEvents: Promise<void>[] = [];

	try {
		const result = await prepared.tool.execute(
			prepared.toolCall.id,
			prepared.args as never,
			signal,
			(partialResult) => {
				updateEvents.push(
					Promise.resolve(
						emit({
							type: "tool_execution_update",
							toolCallId: prepared.toolCall.id,
							toolName: prepared.toolCall.name,
							args: prepared.toolCall.arguments,
							partialResult,
						}),
					),
				);
			},
		);
		await Promise.all(updateEvents);
		return { result, isError: false };
	} catch (error) {
		await Promise.all(updateEvents);
		return {
			result: createErrorToolResult(error instanceof Error ? error.message : String(error)),
			isError: true,
		};
	}
}

async function finalizeExecutedToolCall(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	prepared: PreparedToolCall,
	executed: ExecutedToolCallOutcome,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ToolResultMessage> {
	let result = executed.result;
	let isError = executed.isError;

	if (config.afterToolCall) {
		const afterResult = await config.afterToolCall(
			{
				assistantMessage,
				toolCall: prepared.toolCall,
				args: prepared.args,
				result,
				isError,
				context: currentContext,
			},
			signal,
		);
		if (afterResult) {
			result = {
				content: afterResult.content ?? result.content,
				details: afterResult.details ?? result.details,
			};
			isError = afterResult.isError ?? isError;
		}
	}

	return await emitToolCallOutcome(prepared.toolCall, result, isError, emit);
}

function createErrorToolResult(message: string): AgentToolResult<any> {
	return {
		content: [{ type: "text", text: message }],
		details: {},
	};
}

async function emitToolCallOutcome(
	toolCall: AgentToolCall,
	result: AgentToolResult<any>,
	isError: boolean,
	emit: AgentEventSink,
): Promise<ToolResultMessage> {
	await emit({
		type: "tool_execution_end",
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		result,
		isError,
	});

	const toolResultMessage: ToolResultMessage = {
		role: "toolResult",
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		content: result.content,
		details: result.details,
		isError,
		timestamp: Date.now(),
	};

	await emit({ type: "message_start", message: toolResultMessage });
	await emit({ type: "message_end", message: toolResultMessage });
	return toolResultMessage;
}

// ============================================================================
// Smart Tool Execution (inspired by Claude Code's StreamingToolExecutor)
// ============================================================================

/**
 * Smart execution: read-only tools run in parallel first, then mutating
 * tools run sequentially. This gives the best of both worlds:
 * - Fast reads (parallel)
 * - Safe writes (sequential)
 */
async function executeToolCallsSmart(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: AgentToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ToolResultMessage[]> {
	const readOnly = toolCalls.filter(isReadOnlyTool);
	const mutating = toolCalls.filter(isMutatingTool);

	const results: ToolResultMessage[] = [];

	// Phase 1: Execute all read-only tools in parallel
	if (readOnly.length > 0) {
		const readOnlyResults = await executeToolCallsParallel(
			currentContext,
			assistantMessage,
			readOnly,
			config,
			signal,
			emit,
		);
		results.push(...readOnlyResults);

		// Push results to context so mutating tools can see them
		for (const result of readOnlyResults) {
			currentContext.messages.push(result);
		}
	}

	// Phase 2: Execute mutating tools sequentially
	if (mutating.length > 0) {
		const mutatingResults = await executeToolCallsSequential(
			currentContext,
			assistantMessage,
			mutating,
			config,
			signal,
			emit,
		);
		results.push(...mutatingResults);
	}

	return results;
}

// ============================================================================
// Error Recovery (inspired by Claude Code's recovery mechanisms)
// ============================================================================

/**
 * Try to recover from an error automatically.
 *
 * Strategies:
 * 1. Context overflow → compress and retry
 * 2. Output too long → add "continue" prompt and retry
 * 3. Other errors → give up
 */

// ============================================================================
// Error Recovery (inspired by Claude Code's recovery mechanisms)
// ============================================================================

let recoveryAttemptCount = 0;
const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * Try to recover from an error automatically.
 *
 * Strategies:
 * 1. Context overflow → compress and retry
 * 2. Output too long → add "continue" prompt and retry
 * 3. Other errors → give up
 */
async function tryErrorRecovery(
	message: AssistantMessage,
	currentContext: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	_emit: AgentEventSink,
): Promise<boolean> {
	if (recoveryAttemptCount >= MAX_RECOVERY_ATTEMPTS) {
		recoveryAttemptCount = 0;
		return false;
	}

	const errorMessage = message.errorMessage || "";

	// Strategy 1: Context overflow
	if (isContextOverflow(message)) {
		recoveryAttemptCount++;

		// Remove the error message from context
		const errorIndex = currentContext.messages.indexOf(message);
		if (errorIndex >= 0) {
			currentContext.messages.splice(errorIndex, 1);
		}

		// Apply compression
		if (config.transformContext) {
			const compressed = await config.transformContext(currentContext.messages, signal);
			currentContext.messages = compressed;
		}

		return true;
	}

	// Strategy 2: Output too long
	if (
		errorMessage.includes("max_tokens") ||
		errorMessage.includes("output too long") ||
		errorMessage.includes("maximum context length")
	) {
		recoveryAttemptCount++;

		// Remove the error message from context
		const errorIndex = currentContext.messages.indexOf(message);
		if (errorIndex >= 0) {
			currentContext.messages.splice(errorIndex, 1);
		}

		// Add a "continue" message
		const continueMessage = {
			role: "user",
			content: [
				{
					type: "text",
					text:
						"Output was truncated. Resume directly — no apology, " +
						"no recap of what you were doing. Pick up mid-thought " +
						"if that is where the cut happened. Break remaining work " +
						"into smaller pieces.",
				},
			],
			timestamp: Date.now(),
		} as AgentMessage;
		currentContext.messages.push(continueMessage);

		return true;
	}

	// No recovery strategy available
	return false;
}

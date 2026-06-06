import { join } from "node:path";
import { Agent, type AgentMessage, type ThinkingLevel } from "@mariozechner/pi-agent-core";
import { type AssistantMessageEventStream, type Message, type Model, streamSimple } from "@mariozechner/pi-ai";
import { getAgentDir, getDocsPath } from "../config.js";
import { AgentSession } from "./agent-session.js";
import { AuthStorage } from "./auth-storage.js";
import { AUTO_COMPACT_THRESHOLD, autoCompactMessages } from "./compaction/auto-compact.js";
import {
	applyMultiLayerCompaction,
	DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD,
	evictConsumedToolResults,
} from "./compaction/multi-layer.js";
import { shutdownCostTracker, wrapStreamForCost } from "./cost-tracker.js";
import { DEFAULT_THINKING_LEVEL } from "./defaults.js";
import type { ExtensionRunner, LoadExtensionsResult, SessionStartEvent, ToolDefinition } from "./extensions/index.js";
import { convertToLlm } from "./messages.js";
import { ModelRegistry } from "./model-registry.js";
import { findInitialModel } from "./model-resolver.js";
import { rateLimitScheduler } from "./rate-limit-scheduler.js";
import type { ResourceLoader } from "./resource-loader.js";
import { DefaultResourceLoader } from "./resource-loader.js";
import { getDefaultSessionDir, SessionManager } from "./session-manager.js";
import { SettingsManager } from "./settings-manager.js";
import { time } from "./timings.js";

process.on("beforeExit", shutdownCostTracker);
process.on("SIGTERM", () => {
	shutdownCostTracker();
	process.exit(0);
});

import {
	allTools,
	bashTool,
	codingTools,
	createBashTool,
	createCodingTools,
	createEditTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadOnlyTools,
	createReadTool,
	createWriteTool,
	editTool,
	findTool,
	grepTool,
	lsTool,
	readOnlyTools,
	readTool,
	type Tool,
	type ToolName,
	withFileMutationQueue,
	writeTool,
} from "./tools/index.js";

export interface CreateAgentSessionOptions {
	/** Working directory for project-local discovery. Default: process.cwd() */
	cwd?: string;
	/** Global config directory. Default: ~/.pi/agent */
	agentDir?: string;

	/** Auth storage for credentials. Default: AuthStorage.create(agentDir/auth.json) */
	authStorage?: AuthStorage;
	/** Model registry. Default: ModelRegistry.create(authStorage, agentDir/models.json) */
	modelRegistry?: ModelRegistry;

	/** Model to use. Default: from settings, else first available */
	model?: Model<any>;
	/** Thinking level. Default: from settings, else 'medium' (clamped to model capabilities) */
	thinkingLevel?: ThinkingLevel;
	/** Models available for cycling (Ctrl+P in interactive mode) */
	scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;

	/** Built-in tools to use. Default: codingTools [read, bash, edit, write] */
	tools?: Tool[];
	/** Custom tools to register (in addition to built-in tools). */
	customTools?: ToolDefinition[];

	/** Resource loader. When omitted, DefaultResourceLoader is used. */
	resourceLoader?: ResourceLoader;

	/** Session manager. Default: SessionManager.create(cwd) */
	sessionManager?: SessionManager;

	/** Settings manager. Default: SettingsManager.create(cwd, agentDir) */
	settingsManager?: SettingsManager;
	/** Session start event metadata for extension runtime startup. */
	sessionStartEvent?: SessionStartEvent;
	/**
	 * Token budget for auto-continuation.
	 * When set, the agent will continue working until the budget is exhausted.
	 * Example: { total: 500_000 } for "+500k" token target.
	 */
	tokenBudget?: { total: number };
	/**
	 * Estimated token count consumed by system prompt / context injections
	 * that are NOT part of the message array.  Subtracted from compaction
	 * thresholds so the agent accounts for non-message context when deciding
	 * whether to trigger compaction.
	 *
	 * Default: 0 (thresholds unchanged).
	 */
	contextPressureBudget?: number;
	/**
	 * Continue the most recent session for this cwd instead of creating a new one.
	 * Equivalent to openclaw --continue.
	 */
	continueRecent?: boolean;
	/**
	 * Enter Code Mode: isolated session directory, no user memory loaded.
	 */
	codeMode?: boolean;
	/**
	 * Open a specific session file by path.
	 * Takes precedence over continueRecent.
	 */
	sessionPath?: string;
}

/** Result from createAgentSession */
export interface CreateAgentSessionResult {
	/** The created session */
	session: AgentSession;
	/** Extensions result (for UI context setup in interactive mode) */
	extensionsResult: LoadExtensionsResult;
	/** Warning if session was restored with a different model than saved */
	modelFallbackMessage?: string;
}

// Re-exports

export {
	type AgentSessionRuntimeBootstrap,
	AgentSessionRuntimeHost,
	type CreateAgentSessionRuntimeOptions,
	createAgentSessionRuntime,
} from "./agent-session-runtime.js";
export type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	ExtensionFactory,
	SlashCommandInfo,
	SlashCommandSource,
	ToolDefinition,
} from "./extensions/index.js";
export type { PromptTemplate } from "./prompt-templates.js";
export type { Skill } from "./skills.js";
export type { Tool } from "./tools/index.js";

export {
	// Pre-built tools (use process.cwd())
	readTool,
	bashTool,
	editTool,
	writeTool,
	grepTool,
	findTool,
	lsTool,
	codingTools,
	readOnlyTools,
	allTools as allBuiltInTools,
	withFileMutationQueue,
	// Tool factories (for custom cwd)
	createCodingTools,
	createReadOnlyTools,
	createReadTool,
	createBashTool,
	createEditTool,
	createWriteTool,
	createGrepTool,
	createFindTool,
	createLsTool,
};

// Helper Functions

function getDefaultAgentDir(): string {
	return getAgentDir();
}

/**
 * Create an AgentSession with the specified options.
 *
 * @example
 * ```typescript
 * // Minimal - uses defaults
 * const { session } = await createAgentSession();
 *
 * // With explicit model
 * import { getModel } from '@mariozechner/pi-ai';
 * const { session } = await createAgentSession({
 *   model: getModel('anthropic', 'claude-opus-4-5'),
 *   thinkingLevel: 'high',
 * });
 *
 * // Continue previous session
 * const { session, modelFallbackMessage } = await createAgentSession({
 *   continueSession: true,
 * });
 *
 * // Full control
 * const loader = new DefaultResourceLoader({
 *   cwd: process.cwd(),
 *   agentDir: getAgentDir(),
 *   settingsManager: SettingsManager.create(),
 * });
 * await loader.reload();
 * const { session } = await createAgentSession({
 *   model: myModel,
 *   tools: [readTool, bashTool],
 *   resourceLoader: loader,
 *   sessionManager: SessionManager.inMemory(),
 * });
 * ```
 */
export async function createAgentSession(options: CreateAgentSessionOptions = {}): Promise<CreateAgentSessionResult> {
	const cwd = options.cwd ?? process.cwd();
	const agentDir = options.agentDir ?? getDefaultAgentDir();
	let resourceLoader = options.resourceLoader;

	// Use provided or create AuthStorage and ModelRegistry
	const authPath = options.agentDir ? join(agentDir, "auth.json") : undefined;
	const modelsPath = options.agentDir ? join(agentDir, "models.json") : undefined;
	const authStorage = options.authStorage ?? AuthStorage.create(authPath);
	const modelRegistry = options.modelRegistry ?? ModelRegistry.create(authStorage, modelsPath);

	const settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir);
	let sessionManager = options.sessionManager;
	if (!sessionManager) {
		if (options.sessionPath) {
			// Resume specific session by file path
			sessionManager = SessionManager.open(options.sessionPath);
		} else if (options.continueRecent && !options.codeMode) {
			// Continue most recent session for this cwd (not in code mode)
			sessionManager = SessionManager.continueRecent(cwd, getDefaultSessionDir(cwd, agentDir));
		} else {
			// Default: new session
			sessionManager = SessionManager.create(cwd, getDefaultSessionDir(cwd, agentDir));
		}
	}

	if (!resourceLoader) {
		resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
		await resourceLoader.reload();
		time("resourceLoader.reload");
	}

	// Check if session has existing data to restore
	const existingSession = sessionManager.buildSessionContext();
	const hasExistingSession = existingSession.messages.length > 0;
	const hasThinkingEntry = sessionManager.getBranch().some((entry) => entry.type === "thinking_level_change");

	let model = options.model;
	let modelFallbackMessage: string | undefined;

	// If session has data, try to restore model from it
	if (!model && hasExistingSession && existingSession.model) {
		const restoredModel = modelRegistry.find(existingSession.model.provider, existingSession.model.modelId);
		if (restoredModel && modelRegistry.hasConfiguredAuth(restoredModel)) {
			model = restoredModel;
		}
		if (!model) {
			modelFallbackMessage = `Could not restore model ${existingSession.model.provider}/${existingSession.model.modelId}`;
		}
	}

	// If still no model, use findInitialModel (checks settings default, then provider defaults)
	if (!model) {
		const result = await findInitialModel({
			scopedModels: [],
			isContinuing: hasExistingSession,
			defaultProvider: settingsManager.getDefaultProvider(),
			defaultModelId: settingsManager.getDefaultModel(),
			defaultThinkingLevel: settingsManager.getDefaultThinkingLevel(),
			modelRegistry,
		});
		model = result.model;
		if (!model) {
			modelFallbackMessage = `No models available. Use /login or set an API key environment variable. See ${join(getDocsPath(), "providers.md")}. Then use /model to select a model.`;
		} else if (modelFallbackMessage) {
			modelFallbackMessage += `. Using ${model.provider}/${model.id}`;
		}
	}

	let thinkingLevel = options.thinkingLevel;

	// If session has data, restore thinking level from it
	if (thinkingLevel === undefined && hasExistingSession) {
		thinkingLevel = hasThinkingEntry
			? (existingSession.thinkingLevel as ThinkingLevel)
			: (settingsManager.getDefaultThinkingLevel() ?? DEFAULT_THINKING_LEVEL);
	}

	// Fall back to settings default
	if (thinkingLevel === undefined) {
		thinkingLevel = settingsManager.getDefaultThinkingLevel() ?? DEFAULT_THINKING_LEVEL;
	}

	// Clamp to model capabilities
	if (!model || !model.reasoning) {
		thinkingLevel = "off";
	}

	const defaultActiveToolNames: string[] = [
		"read",
		"bash",
		"edit",
		"write",
		"enter_plan_mode",
		"exit_plan_mode",
		"enter_code_mode",
		"exit_code_mode",
		"todo_write",
		"task_create",
		"task_get",
		"task_update",
		"task_list",
		"task_stop",
		"task_output",
		"team_create",
		"team_delete",
		"team_list",
		"send_message",
	];
	const initialActiveToolNames: string[] =
		options.tools && options.tools.length > 0
			? options.tools.map((t) => t.name).filter((n): n is ToolName => n in allTools)
			: defaultActiveToolNames;

	let agent: Agent;

	// Create convertToLlm wrapper that filters images if blockImages is enabled (defense-in-depth)
	const convertToLlmWithBlockImages = (messages: AgentMessage[]): Message[] => {
		const converted = convertToLlm(messages);
		// Check setting dynamically so mid-session changes take effect
		if (!settingsManager.getBlockImages()) {
			return converted;
		}
		// Filter out ImageContent from all messages, replacing with text placeholder
		return converted.map((msg) => {
			if (msg.role === "user" || msg.role === "toolResult") {
				const content = msg.content;
				if (Array.isArray(content)) {
					const hasImages = content.some((c) => c.type === "image");
					if (hasImages) {
						const filteredContent = content
							.map((c) =>
								c.type === "image" ? { type: "text" as const, text: "Image reading is disabled." } : c,
							)
							.filter(
								(c, i, arr) =>
									// Dedupe consecutive "Image reading is disabled." texts
									!(
										c.type === "text" &&
										c.text === "Image reading is disabled." &&
										i > 0 &&
										arr[i - 1].type === "text" &&
										(arr[i - 1] as { type: "text"; text: string }).text === "Image reading is disabled."
									),
							);
						return { ...msg, content: filteredContent };
					}
				}
			}
			return msg;
		});
	};

	const extensionRunnerRef: { current?: ExtensionRunner } = {};

	// Clamp injection budget to >= 0 — belt-and-suspenders for safety.
	const safeBudget = Math.max(0, options.contextPressureBudget ?? 0);

	agent = new Agent({
		initialState: {
			systemPrompt: "",
			model,
			thinkingLevel,
			tools: [],
		},
		convertToLlm: convertToLlmWithBlockImages,
		streamFn: async (model, context, options) => {
			const auth = await modelRegistry.getApiKeyAndHeaders(model);
			if (!auth.ok) {
				throw new Error(auth.error);
			}
			const release = await rateLimitScheduler.acquire(model.provider);
			let stream: AssistantMessageEventStream;
			try {
				stream = streamSimple(model, context, {
					...options,
					apiKey: auth.apiKey,
					headers: auth.headers || options?.headers ? { ...auth.headers, ...options?.headers } : undefined,
				});
			} finally {
				release();
			}
			return wrapStreamForCost(stream, sessionManager.getSessionId(), model.id, model.provider);
		},
		onPayload: async (payload, _model) => {
			const runner = extensionRunnerRef.current;
			if (!runner?.hasHandlers("before_provider_request")) {
				return payload;
			}
			return runner.emitBeforeProviderRequest(payload);
		},
		sessionId: sessionManager.getSessionId(),
		transformContext: async (messages, signal) => {
			// L0: Evict consumed tool results — replace full output with one-line
			// summaries once the model has responded (instant, no API call).
			const afterEviction = evictConsumedToolResults(messages);

			// Layer 1 + 2: Fast, free compression (snip + microcompact).
			// Default threshold is 90k.  Subtract injection budget so large system prompts
			// don't push us into reflexive compaction loops.
			// Floor: 30k — below this, snip would run almost every turn (false-positive cost).
			const multiLayerConfig = options.contextPressureBudget
				? { autoCompactThreshold: Math.max(DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD - safeBudget, 30_000) }
				: undefined;
			const { messages: compressed, needsAutocompact: needsCompact } = applyMultiLayerCompaction(
				afterEviction,
				multiLayerConfig,
			);

			let result = compressed;

			// Layer 3: LLM-based summarisation when layers 1+2 are not enough.
			// modelRegistry is available via closure (same pattern as streamFn above).
			if (needsCompact && model) {
				try {
					const auth = await modelRegistry.getApiKeyAndHeaders(model);
					if (auth.ok) {
						const release2 = await rateLimitScheduler.acquire(model.provider);
						let compactResult: any;
						try {
							compactResult = await autoCompactMessages(
								compressed,
								model,
								auth.apiKey!,
								auth.headers,
								signal ?? undefined,
							);
						} finally {
							release2();
						}
						result = compactResult.messages;
					}
				} catch {
					// Compaction failed — proceed with snip+microcompact output.
				}
			}

			// Run extension context transforms on the (possibly compacted) messages
			const runner = extensionRunnerRef.current;
			if (!runner) return result;
			return runner.emitContext(result);
		},

		// Agent-level context pressure threshold — when to emit pressure events.
		// Default: AUTO_COMPACT_THRESHOLD (80k).  Subtract injection budget to account
		// for system prompt overhead.
		// Floor: 20k — room for ~5k tokens of actual conversation before warning.
		contextPressureThreshold: options.contextPressureBudget
			? Math.max(AUTO_COMPACT_THRESHOLD - safeBudget, 20_000)
			: AUTO_COMPACT_THRESHOLD,
		tokenBudget: options.tokenBudget,
		steeringMode: settingsManager.getSteeringMode(),
		followUpMode: settingsManager.getFollowUpMode(),
		transport: settingsManager.getTransport(),
		thinkingBudgets: settingsManager.getThinkingBudgets(),
		maxRetryDelayMs: settingsManager.getRetrySettings().maxDelayMs,
	});

	// Restore messages if session has existing data
	if (hasExistingSession) {
		agent.state.messages = existingSession.messages;
		if (!hasThinkingEntry) {
			sessionManager.appendThinkingLevelChange(thinkingLevel);
		}
	} else {
		// Save initial model and thinking level for new sessions so they can be restored on resume
		if (model) {
			sessionManager.appendModelChange(model.provider, model.id);
		}
		sessionManager.appendThinkingLevelChange(thinkingLevel);
	}

	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd,
		scopedModels: options.scopedModels,
		resourceLoader,
		customTools: options.customTools,
		modelRegistry,
		initialActiveToolNames,
		extensionRunnerRef,
		sessionStartEvent: options.sessionStartEvent,
	});
	const extensionsResult = resourceLoader.getExtensions();

	return {
		session,
		extensionsResult,
		modelFallbackMessage,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// [P2-A] Session Discovery helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List sessions for a specific cwd, sorted by most-recent-first.
 * If cwd is omitted, lists ALL sessions across all project directories.
 */
export async function listSessions(cwd?: string): Promise<import("./session-manager.js").SessionInfo[]> {
	if (cwd) {
		return SessionManager.list(cwd);
	}
	return SessionManager.listAll();
}

/**
 * Get the most recent session path for a cwd, or undefined if none.
 */
export async function getMostRecentSessionPath(cwd?: string): Promise<string | undefined> {
	const sessions = await listSessions(cwd ?? process.cwd());
	return sessions[0]?.path;
}

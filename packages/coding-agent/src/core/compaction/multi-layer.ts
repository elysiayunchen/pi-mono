/**
 * Multi-layer context compression.
 *
 * Layer 0: Tool Result Eviction - replace consumed tool results with summaries (fast, no API call)
 * Layer 1: Snip - remove dead tool results (fast, no API call)
 * Layer 2: Microcompact - trim oversized results (fast, no API call)
 * Layer 3: Check - determine if autocompact is needed
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { estimateTokens } from "./compaction.js";

// Configuration
export interface MultiLayerCompactionConfig {
	/** @deprecated Reserved for future token-budget gating. Not currently used. */
	maxTokens: number;
	/** Threshold (tokens) above which snip + microcompact (L1+L2) run proactively. */
	autoCompactThreshold: number;
	maxToolResultChars: number;
	enableSnip: boolean;
	enableMicrocompact: boolean;
	enableToolResultEviction: boolean;
}

/** Default autoCompactThreshold — exported so sdk.ts can adjust for injection budget. */
export const DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD = 90_000;

const DEFAULT_CONFIG: MultiLayerCompactionConfig = {
	maxTokens: 100_000,
	autoCompactThreshold: DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD,
	maxToolResultChars: 50_000,
	enableSnip: true,
	enableMicrocompact: true,
	enableToolResultEviction: true,
};

// ── Shared helpers ──────────────────────────────────────────────────────────

function isWriteOrEdit(toolName: string): boolean {
	return toolName === "write" || toolName === "edit";
}

function extractFilePath(args: Record<string, unknown>): string | undefined {
	return (args.file_path || args.path || args.file || args.filePath) as string | undefined;
}

function findToolCallFor(
	toolCallId: string,
	messages: AgentMessage[],
	fromIndex: number,
): { name: string; filePath: string | undefined } | undefined {
	for (let i = fromIndex - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			const assistant = msg as AssistantMessage;
			for (const block of assistant.content) {
				if (block.type === "toolCall" && block.id === toolCallId) {
					return {
						name: block.name,
						filePath: extractFilePath(block.arguments as Record<string, unknown>),
					};
				}
			}
			break;
		}
	}
	return undefined;
}

// ── Layer 0: Tool Result Eviction ───────────────────────────────────────────

/** Sentinel prefix that marks evicted tool results. */
const EVICTED_MARKER = "[EVC] ";

/**
 * Escape newlines/tabs for a one-line summary.
 */
function collapseWhitespace(s: string): string {
	return s.replace(/[\n\r\t]+/g, "\\n").trim();
}

/**
 * Build a one-line summary for a tool result.
 *
 * Format: `[EVC] [toolName filePath] status (N chars): firstLine`
 */
function buildToolResultSummary(
	tr: { toolName?: string; toolCallId?: string; content?: unknown; isError?: boolean },
	toolCallFilePaths: Map<string, string>,
): string {
	const toolName = typeof tr.toolName === "string" ? tr.toolName : "unknown";
	const isError = tr.isError === true ? " ❌" : "";
	const filePath = toolCallFilePaths.get(tr.toolCallId ?? "") ?? "";

	let totalChars = 0;
	let firstLine = "";
	// Count non-text blocks by type (image, resource_link, resource, etc.).
	// A Map keeps insertion order and counts correctly regardless of how many
	// duplicates of the same type appear (the old array approach mis-counted the
	// 3rd+ duplicate, producing entries like `image×2, image`).
	const nonTextCounts = new Map<string, number>();

	if (Array.isArray(tr.content)) {
		for (const block of tr.content as Array<{ type?: string; text?: string; [key: string]: unknown }>) {
			if (block?.type === "text" && typeof block.text === "string") {
				totalChars += block.text.length;
				if (!firstLine) {
					firstLine = collapseWhitespace(block.text.slice(0, 120));
				}
			} else if (block?.type && block.type !== "text") {
				const tag = block.type.replace(/_/g, "-");
				nonTextCounts.set(tag, (nonTextCounts.get(tag) ?? 0) + 1);
			}
		}
	} else if (typeof tr.content === "string") {
		// Plain-text content (rare but used by some tool implementations)
		totalChars = tr.content.length;
		firstLine = collapseWhitespace(tr.content.slice(0, 120));
	} else if (tr.content != null) {
		// Unknown content shape — JSON-serialize a snippet.
		// Guard against circular references and other JSON.stringify failures.
		try {
			const json = JSON.stringify(tr.content);
			totalChars = json.length;
			firstLine = collapseWhitespace(json.slice(0, 120));
		} catch {
			// Circular reference or other serialisation failure — fall back to type tag.
			const typeTag =
				typeof tr.content === "object" ? (tr.content as object).constructor?.name || "object" : typeof tr.content;
			totalChars = 0;
			firstLine = `[${typeTag}]`;
		}
	}

	const chars = totalChars > 0 ? ` (${totalChars} chars)` : "";
	const path = filePath ? ` ${filePath}` : "";
	const line = firstLine ? `: ${firstLine}` : "";
	const nonTextBlocks = [...nonTextCounts.entries()].map(([tag, n]) => (n > 1 ? `${tag}×${n}` : tag));
	const nonText = nonTextBlocks.length > 0 ? ` +${nonTextBlocks.join(",")}` : "";

	return `${EVICTED_MARKER}[${toolName}${path}]${isError}${chars}${nonText}${line}`;
}

/**
 * Detect whether a tool result has already been evicted.
 *
 * Evicted results have exactly one text content block whose text starts with
 * the `[EVC] ` sentinel prefix.
 */
function isToolResultEvicted(msg: AgentMessage): boolean {
	const tr = msg as { content?: unknown };
	if (!Array.isArray(tr.content) || tr.content.length !== 1) return false;
	const block = tr.content[0] as { type?: string; text?: string };
	if (block?.type !== "text" || typeof block.text !== "string") return false;
	return block.text.startsWith(EVICTED_MARKER);
}

/**
 * L0: Evict consumed tool results.
 *
 * A tool result is "consumed" once an assistant message that sees it has been
 * produced (i.e. the model had a chance to read the result and act on it).
 * Eviction replaces the full output with a one-line summary so the LLM retains
 * a breadcrumb while freeing context tokens.
 *
 * **Idempotent** — already-evicted results are left unchanged.
 *
 * **Non-destructive** — the on-disk session transcript is not modified.  Only
 * the in-memory messages passed to the LLM are trimmed.
 */
export function evictConsumedToolResults(messages: AgentMessage[]): AgentMessage[] {
	// Phase 1: Pre-scan tool calls to enrich summaries with file paths
	const toolCallFilePaths = new Map<string, string>();
	for (const msg of messages) {
		if (msg.role === "assistant") {
			const assistant = msg as AssistantMessage;
			for (const block of assistant.content) {
				if (block.type === "toolCall") {
					const fp = extractFilePath(block.arguments as Record<string, unknown>);
					if (fp) toolCallFilePaths.set(block.id, fp);
				}
			}
		}
	}
	if (toolCallFilePaths.size === 0 && !messages.some((m) => m.role === "toolResult")) {
		return messages;
	}

	// Phase 2: Identify consumed tool results.
	// Walk messages forward.  Pending tool results are "consumed" when the next
	// assistant message appears.  User messages reset the pending set (turn boundary).
	const consumedIndices = new Set<number>();
	const pendingIndices: number[] = [];

	for (let i = 0; i < messages.length; i++) {
		const role = (messages[i] as { role: string }).role;
		if (role === "user") {
			pendingIndices.length = 0;
		} else if (role === "toolResult") {
			pendingIndices.push(i);
		} else if (role === "assistant") {
			for (const idx of pendingIndices) {
				consumedIndices.add(idx);
			}
			pendingIndices.length = 0;
		}
	}
	// Remaining pending tool results at end-of-array are NOT consumed —
	// the model hasn't responded to them yet.

	if (consumedIndices.size === 0) return messages;

	// Phase 3: Replace consumed tool results with summaries
	return messages.map((msg, i) => {
		if (!consumedIndices.has(i)) return msg;
		const tr = msg as { toolName?: string; toolCallId?: string; content?: unknown; isError?: boolean };
		if (isToolResultEvicted(msg)) return msg;
		const summary = buildToolResultSummary(tr, toolCallFilePaths);
		return {
			...msg,
			content: [{ type: "text" as const, text: summary }],
		} as AgentMessage;
	});
}

// Layer 1: Snip
export function snipDeadMessages(messages: AgentMessage[]): AgentMessage[] {
	const result: AgentMessage[] = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];

		// When we see a write/edit result, remove the most recent read result for the same file
		if (msg.role === "toolResult") {
			const toolResult = msg as any;
			const info = findToolCallFor(toolResult.toolCallId, messages, i);

			if (info && isWriteOrEdit(info.name) && info.filePath) {
				for (let r = result.length - 1; r >= 0; r--) {
					const prev = result[r];
					if (prev.role === "toolResult") {
						const prevResult = prev as any;
						if (["read", "grep", "find"].includes(prevResult.toolName)) {
							const prevInfo = findToolCallFor(prevResult.toolCallId, result, r);
							if (prevInfo?.filePath === info.filePath) {
								result.splice(r, 1);
								break;
							}
						}
					}
					if (prev.role === "user") break;
				}
			}
		}

		result.push(msg);
	}

	return result;
}

// Layer 2: Microcompact
function trimContent(content: string, maxChars: number): string {
	if (content.length <= maxChars) return content;
	return `${content.slice(0, maxChars)}\n\n[... truncated ${content.length - maxChars} characters ...]`;
}

export function microcompact(messages: AgentMessage[], maxToolResultChars: number = 50000): AgentMessage[] {
	return messages.map((msg) => {
		if (msg.role !== "toolResult") return msg;
		const toolResult = msg as any;
		if (!Array.isArray(toolResult.content)) return msg;

		let changed = false;
		const newContent = toolResult.content.map((block: any) => {
			if (block.type === "text" && typeof block.text === "string" && block.text.length > maxToolResultChars) {
				changed = true;
				return { ...block, text: trimContent(block.text, maxToolResultChars) };
			}
			return block;
		});

		if (changed) {
			return { ...toolResult, content: newContent } as AgentMessage;
		}
		return msg;
	});
}

// Layer 3: Check
export function needsAutocompact(messages: AgentMessage[], config: MultiLayerCompactionConfig): boolean {
	const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
	return totalTokens > config.autoCompactThreshold;
}

// Main entry point
export interface MultiLayerResult {
	messages: AgentMessage[];
	tokensFreed: number;
	layersApplied: string[];
	needsAutocompact: boolean;
}

export function applyMultiLayerCompaction(
	messages: AgentMessage[],
	userConfig?: Partial<MultiLayerCompactionConfig>,
): MultiLayerResult {
	const config = { ...DEFAULT_CONFIG, ...userConfig };
	const originalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);

	// Proactive: trigger snip+microcompact at autoCompactThreshold (90k), not maxTokens (100k)
	if (originalTokens <= config.autoCompactThreshold) {
		return { messages, tokensFreed: 0, layersApplied: [], needsAutocompact: false };
	}

	const layersApplied: string[] = [];
	let current = messages;

	if (config.enableSnip) {
		const snipped = snipDeadMessages(current);
		if (snipped.length < current.length) {
			layersApplied.push("snip");
			current = snipped;
		}
	}

	if (config.enableMicrocompact) {
		const before = current.reduce((sum, msg) => sum + estimateTokens(msg), 0);
		current = microcompact(current, config.maxToolResultChars);
		const after = current.reduce((sum, msg) => sum + estimateTokens(msg), 0);
		if (after < before) {
			layersApplied.push("microcompact");
		}
	}

	const finalTokens = current.reduce((sum, msg) => sum + estimateTokens(msg), 0);
	const needsCompact = finalTokens > config.autoCompactThreshold;

	return {
		messages: current,
		tokensFreed: originalTokens - finalTokens,
		layersApplied,
		needsAutocompact: needsCompact,
	};
}

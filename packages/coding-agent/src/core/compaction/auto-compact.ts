/**
 * Auto-compact: proactive token-threshold check + LLM-based summarization.
 *
 * Works directly on AgentMessage[] without requiring SessionManager/SessionEntry
 * infrastructure. Designed to be called from the transformContext closure in sdk.ts.
 *
 * Thresholds (aligned with Claude Code's autoCompact.ts):
 *   trigger  = 80 000 tokens  (proactive — before snip+microcompact exhausted)
 *   keep     = 20 000 tokens  (recent history preserved verbatim)
 *   reserve  = 16 384 tokens  (budget for the summary output)
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { createCompactionSummaryMessage } from "../messages.js";
import type { RateLimitScheduler } from "../rate-limit-scheduler.js";
import { estimateContextTokens, estimateTokens, generateSummary } from "./compaction.js";

// ── Constants ────────────────────────────────────────────────────────────────

/** Token count above which we request LLM summarization. */
export const AUTO_COMPACT_THRESHOLD = 80_000;

/** How many recent tokens to keep verbatim after compaction. */
export const AUTO_COMPACT_KEEP_RECENT = 20_000;

/** Reserve for the summary output itself (prevents the summary call overflowing). */
export const AUTO_COMPACT_RESERVE = 16_384;

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when the context is large enough to warrant LLM compaction.
 * Uses estimateContextTokens (last-usage + trailing estimate) for accuracy.
 */
export function shouldAutoCompact(messages: AgentMessage[], threshold = AUTO_COMPACT_THRESHOLD): boolean {
	const { tokens } = estimateContextTokens(messages);
	return tokens > threshold;
}

// ── Internal split logic ─────────────────────────────────────────────────────

/**
 * Split messages into the portion to summarise and the portion to keep verbatim.
 *
 * Rules:
 * - Walk backwards, accumulate until `keepRecentTokens` budget is exhausted.
 * - Never cut at a toolResult (it must follow its toolCall).
 * - Never cut at an assistant message whose tool calls haven't finished.
 */
function splitForCompaction(
	messages: AgentMessage[],
	keepRecentTokens: number,
): { toSummarize: AgentMessage[]; toKeep: AgentMessage[] } {
	if (messages.length === 0) {
		return { toSummarize: [], toKeep: [] };
	}

	let accumulated = 0;
	let splitIdx = 0; // default: keep everything (summarize nothing)

	for (let i = messages.length - 1; i >= 0; i--) {
		accumulated += estimateTokens(messages[i]);
		if (accumulated >= keepRecentTokens) {
			splitIdx = i;
			// Advance past any leading toolResult messages at the cut point
			// so we never start "toKeep" in the middle of a tool-call/result pair.
			while (splitIdx < messages.length && (messages[splitIdx] as { role: string }).role === "toolResult") {
				splitIdx++;
			}
			break;
		}
	}

	return {
		toSummarize: messages.slice(0, splitIdx),
		toKeep: messages.slice(splitIdx),
	};
}

// ── Main entry point ─────────────────────────────────────────────────────────

export interface AutoCompactResult {
	messages: AgentMessage[];
	tokensFreed: number;
	/** Number of messages that were summarised. */
	summarizedCount: number;
}

/**
 * Perform LLM-based compaction on an AgentMessage[].
 *
 * Steps:
 *  1. Split into toSummarize + toKeep
 *  2. Call generateSummary() on toSummarize
 *  3. Prepend a compactionSummary message to toKeep
 *  4. Return the compacted array + metrics
 *
 * Safe to call even if messages are below threshold — returns unchanged if
 * toSummarize is empty.
 */
export async function autoCompactMessages(
	messages: AgentMessage[],
	model: Model<any>,
	apiKey: string,
	headers?: Record<string, string>,
	signal?: AbortSignal,
	rateLimiter?: RateLimitScheduler,
): Promise<AutoCompactResult> {
	const tokensBefore = messages.reduce((s, m) => s + estimateTokens(m), 0);

	const { toSummarize, toKeep } = splitForCompaction(messages, AUTO_COMPACT_KEEP_RECENT);

	if (toSummarize.length === 0) {
		return { messages, tokensFreed: 0, summarizedCount: 0 };
	}

	const doGenerate = () => generateSummary(toSummarize, model, AUTO_COMPACT_RESERVE, apiKey, headers, signal);
	const summary = rateLimiter ? await rateLimiter.acquireAndStream(model.provider, doGenerate) : await doGenerate();

	const summaryMessage = createCompactionSummaryMessage(summary, tokensBefore, new Date().toISOString());
	const compacted = [summaryMessage, ...toKeep];

	const tokensAfter = compacted.reduce((s, m) => s + estimateTokens(m), 0);

	return {
		messages: compacted,
		tokensFreed: tokensBefore - tokensAfter,
		summarizedCount: toSummarize.length,
	};
}

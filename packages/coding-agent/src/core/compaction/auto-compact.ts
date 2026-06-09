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
 *
 * PLAN-13 M5: seal-aware compaction. Messages belonging to sealed tasks are
 * discarded directly (B3 index heads proxy their content). Only orphan messages
 * receive LLM summarization.
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

// ── Types ────────────────────────────────────────────────────────────────────

/** PLAN-13 M5: sealed task time range for seal-aware compaction. */
export interface SealedRange {
	/** Opaque task identifier for diagnostics. */
	taskId?: string;
	/** Start timestamp (ms since epoch) of the sealed segment. */
	startedAt: number;
	/** End timestamp (ms since epoch) of the sealed segment. */
	endedAt: number;
}

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when the context is large enough to warrant LLM compaction.
 * Uses estimateContextTokens (last-usage + trailing estimate) for accuracy.
 */
export function shouldAutoCompact(messages: AgentMessage[], threshold = AUTO_COMPACT_THRESHOLD): boolean {
	const { tokens } = estimateContextTokens(messages);
	return tokens > threshold;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function getMessageTimestamp(msg: AgentMessage): number | undefined {
	const raw = (msg as unknown as Record<string, unknown>).timestamp;
	return typeof raw === "number" ? raw : undefined;
}

/**
 * Check whether a message timestamp falls within any sealed range.
 */
function isInSealedRange(timestamp: number, ranges: SealedRange[]): boolean {
	for (const r of ranges) {
		if (timestamp >= r.startedAt && timestamp <= r.endedAt) {
			return true;
		}
	}
	return false;
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
	/** Number of messages that were LLM-summarised (excluding sealed discards). */
	summarizedCount: number;
	/** PLAN-13 M5: number of messages discarded via seal-aware pruning (zero LLM cost). */
	sealedDiscarded: number;
}

/**
 * Perform seal-aware compaction on an AgentMessage[].
 *
 * PLAN-13 M5: messages belonging to sealed tasks are discarded directly
 * (B3 index heads proxy their content). Only orphan messages receive
 * LLM summarization.
 *
 * Steps:
 *  1. Split into toSummarize + toKeep
 *  2. Filter out sealed messages from toSummarize → orphans
 *  3. If orphans remain, call generateSummary() on orphans
 *  4. Prepend a compactionSummary message to toKeep
 *  5. Return the compacted array + metrics
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
	/** PLAN-13 M5: sealed task time ranges. Messages in these ranges are discarded (zero LLM cost). */
	sealedRanges?: SealedRange[],
): Promise<AutoCompactResult> {
	const tokensBefore = messages.reduce((s, m) => s + estimateTokens(m), 0);

	const { toSummarize, toKeep } = splitForCompaction(messages, AUTO_COMPACT_KEEP_RECENT);

	if (toSummarize.length === 0) {
		return { messages, tokensFreed: 0, summarizedCount: 0, sealedDiscarded: 0 };
	}

	let sealedDiscarded = 0;
	let orphans = toSummarize;

	if (sealedRanges && sealedRanges.length > 0) {
		const kept: AgentMessage[] = [];
		for (const msg of toSummarize) {
			const ts = getMessageTimestamp(msg);
			if (ts !== undefined && isInSealedRange(ts, sealedRanges)) {
				sealedDiscarded++;
			} else {
				kept.push(msg);
			}
		}
		orphans = kept;
	}

	if (orphans.length === 0) {
		const compacted = toKeep;
		const tokensAfter = compacted.reduce((s, m) => s + estimateTokens(m), 0);
		return {
			messages: compacted,
			tokensFreed: tokensBefore - tokensAfter,
			summarizedCount: 0,
			sealedDiscarded,
		};
	}

	const doGenerate = () => generateSummary(orphans, model, AUTO_COMPACT_RESERVE, apiKey, headers, signal);
	const summary = rateLimiter ? await rateLimiter.acquireAndStream(model.provider, doGenerate) : await doGenerate();

	const summaryMessage = createCompactionSummaryMessage(summary, tokensBefore, new Date().toISOString());
	const compacted = [summaryMessage, ...toKeep];

	const tokensAfter = compacted.reduce((s, m) => s + estimateTokens(m), 0);

	return {
		messages: compacted,
		tokensFreed: tokensBefore - tokensAfter,
		summarizedCount: orphans.length,
		sealedDiscarded,
	};
}

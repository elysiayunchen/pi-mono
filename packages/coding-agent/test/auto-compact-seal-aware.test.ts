/**
 * Tests for PLAN-13 M5 seal-aware auto-compaction.
 *
 * Verifies the sealedRanges parameter path: messages belonging to sealed tasks
 * are discarded directly (zero LLM cost), orphans receive summarisation.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../src/core/compaction/compaction.js", () => ({
	generateSummary: vi.fn(),
	estimateTokens: vi.fn(() => 1000),
	estimateContextTokens: vi.fn(() => ({ tokens: 100_000, usageTokens: 0 })),
}));

vi.mock("../src/core/messages.js", () => ({
	createCompactionSummaryMessage: vi.fn(),
}));

import { autoCompactMessages, type SealedRange } from "../src/core/compaction/auto-compact.js";
import { generateSummary } from "../src/core/compaction/compaction.js";
import type { CompactionSummaryMessage } from "../src/core/messages.js";
import { createCompactionSummaryMessage } from "../src/core/messages.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function msg(role: "user" | "assistant", index: number): AgentMessage {
	const timestamp = index;
	if (role === "user") {
		return { role: "user", content: `msg-${index}`, timestamp };
	}
	return {
		role: "assistant",
		content: [{ type: "text", text: `msg-${index}` }],
		timestamp,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		stopReason: "stop",
	} as AgentMessage;
}

/**
 * 30 messages × 1000 tokens = 30 000 tokens.
 * Walking backwards: 29→28→...→10 (20 msgs = 20 000 tokens ≥ keepRecent).
 * splitIdx = 10 → toSummarize = [0..9] (10 msgs), toKeep = [10..29] (20 msgs).
 */
function createTestMessages(): AgentMessage[] {
	const messages: AgentMessage[] = [];
	for (let i = 0; i < 30; i++) {
		messages.push(msg(i % 2 === 0 ? "user" : "assistant", i));
	}
	return messages;
}

function makeRange(startedAt: number, endedAt: number): SealedRange {
	return { startedAt, endedAt, taskId: `task-${startedAt}` };
}

function makeSummaryMock(summary: string): CompactionSummaryMessage {
	return {
		role: "compactionSummary",
		summary,
		tokensBefore: 1000,
		timestamp: 999,
	};
}

const fakeModel = {} as Model<any>;
const fakeApiKey = "sk-test";

// ── Reset mocks before each test ─────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("autoCompactMessages - seal-aware (PLAN-13 M5)", () => {
	describe("all toSummarize messages are sealed → fast path", () => {
		it("discards all sealed messages and returns without calling LLM", async () => {
			const messages = createTestMessages();
			// toSummarize = messages[0..9] (timestamps 0..9), all covered
			const sealedRanges: SealedRange[] = [makeRange(0, 9)];

			const result = await autoCompactMessages(
				messages,
				fakeModel,
				fakeApiKey,
				undefined,
				undefined,
				undefined,
				sealedRanges,
			);

			expect(result.sealedDiscarded).toBe(10);
			expect(result.summarizedCount).toBe(0);
			expect(generateSummary).not.toHaveBeenCalled();
			expect(createCompactionSummaryMessage).not.toHaveBeenCalled();
			expect(result.tokensFreed).toBeGreaterThan(0);
			// compacted = toKeep only (messages 10..29 = 20 messages)
			expect(result.messages.length).toBe(20);
		});
	});

	describe("partial seal — some sealed, some orphans", () => {
		it("discards sealed messages and calls LLM for orphans", async () => {
			vi.mocked(generateSummary).mockResolvedValue("orphan-summary");
			vi.mocked(createCompactionSummaryMessage).mockReturnValue(makeSummaryMock("orphan-summary"));

			const messages = createTestMessages();
			// Seal messages 0..4, leave 5..9 as orphans
			const sealedRanges: SealedRange[] = [makeRange(0, 4)];

			const result = await autoCompactMessages(
				messages,
				fakeModel,
				fakeApiKey,
				undefined,
				undefined,
				undefined,
				sealedRanges,
			);

			expect(result.sealedDiscarded).toBe(5);
			expect(result.summarizedCount).toBe(5);
			expect(generateSummary).toHaveBeenCalledTimes(1);

			// 1 summary + 20 toKeep = 21 messages
			expect(result.messages.length).toBe(21);
			expect(createCompactionSummaryMessage).toHaveBeenCalledTimes(1);
		});
	});

	describe("multiple sealed ranges", () => {
		it("correctly identifies messages across disjoint ranges", async () => {
			vi.mocked(generateSummary).mockResolvedValue("multi-range-summary");
			vi.mocked(createCompactionSummaryMessage).mockReturnValue(makeSummaryMock("multi-range-summary"));

			const messages = createTestMessages();
			// Two disjoint ranges: 0..2 and 7..9
			const sealedRanges: SealedRange[] = [makeRange(0, 2), makeRange(7, 9)];

			const result = await autoCompactMessages(
				messages,
				fakeModel,
				fakeApiKey,
				undefined,
				undefined,
				undefined,
				sealedRanges,
			);

			expect(result.sealedDiscarded).toBe(6); // 0,1,2 + 7,8,9
			expect(result.summarizedCount).toBe(4); // 3,4,5,6
			expect(generateSummary).toHaveBeenCalledTimes(1);
		});
	});

	describe("no sealed ranges", () => {
		it("behaves like normal compaction (sealedDiscarded = 0)", async () => {
			vi.mocked(generateSummary).mockResolvedValue("normal-summary");
			vi.mocked(createCompactionSummaryMessage).mockReturnValue(makeSummaryMock("normal-summary"));

			const messages = createTestMessages();
			const result = await autoCompactMessages(messages, fakeModel, fakeApiKey);

			expect(result.sealedDiscarded).toBe(0);
			expect(result.summarizedCount).toBe(10);
			expect(generateSummary).toHaveBeenCalledTimes(1);
		});
	});

	describe("empty sealed ranges array", () => {
		it("behaves like normal compaction", async () => {
			vi.mocked(generateSummary).mockResolvedValue("empty-ranges");
			vi.mocked(createCompactionSummaryMessage).mockReturnValue(makeSummaryMock("empty-ranges"));

			const messages = createTestMessages();
			const result = await autoCompactMessages(messages, fakeModel, fakeApiKey, undefined, undefined, undefined, []);

			expect(result.sealedDiscarded).toBe(0);
			expect(result.summarizedCount).toBe(10);
		});
	});

	describe("messages without timestamp", () => {
		it("are treated as orphans (not matched against sealed ranges)", async () => {
			vi.mocked(generateSummary).mockResolvedValue("no-timestamp");
			vi.mocked(createCompactionSummaryMessage).mockReturnValue(makeSummaryMock("no-timestamp"));

			// All messages lack a timestamp → none match
			const messages: AgentMessage[] = [];
			for (let i = 0; i < 30; i++) {
				messages.push({ role: "user", content: `msg-${i}` } as AgentMessage);
			}
			const sealedRanges: SealedRange[] = [makeRange(0, 999)];

			const result = await autoCompactMessages(
				messages,
				fakeModel,
				fakeApiKey,
				undefined,
				undefined,
				undefined,
				sealedRanges,
			);

			expect(result.sealedDiscarded).toBe(0);
			expect(result.summarizedCount).toBe(10);
		});
	});
});

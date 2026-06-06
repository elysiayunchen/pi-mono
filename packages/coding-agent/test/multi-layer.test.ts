import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
	applyMultiLayerCompaction,
	DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD,
	evictConsumedToolResults,
	microcompact,
	needsAutocompact,
	snipDeadMessages,
} from "../src/core/compaction/multi-layer.js";

// ============================================================================
// Fixtures — minimal message shapes. evictConsumedToolResults / snip / etc.
// only read `role` + `content` (+ toolName/toolCallId/isError on tool results),
// so we cast through `as AgentMessage` to avoid restating full SDK message types.
// ============================================================================

function user(text: string): AgentMessage {
	return { role: "user", content: text, timestamp: Date.now() } as AgentMessage;
}

function assistantText(text: string): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		stopReason: "stop",
		timestamp: Date.now(),
	} as unknown as AgentMessage;
}

function assistantToolCall(id: string, name: string, args: Record<string, unknown> = {}): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id, name, arguments: args }],
		stopReason: "toolUse",
		timestamp: Date.now(),
	} as unknown as AgentMessage;
}

function toolResult(toolCallId: string, toolName: string, content: unknown, isError = false): AgentMessage {
	return {
		role: "toolResult",
		toolCallId,
		toolName,
		content,
		isError,
		timestamp: Date.now(),
	} as unknown as AgentMessage;
}

function textBlocks(...texts: string[]) {
	return texts.map((text) => ({ type: "text" as const, text }));
}

/** Extract the single evicted text from a tool result (or undefined if not evicted). */
function evictedText(msg: AgentMessage): string | undefined {
	const c = (msg as { content?: unknown }).content;
	if (!Array.isArray(c) || c.length !== 1) return undefined;
	const block = c[0] as { type?: string; text?: string };
	if (block.type !== "text" || typeof block.text !== "string") return undefined;
	return block.text.startsWith("[EVC] ") ? block.text : undefined;
}

// ============================================================================
// Layer 0 — evictConsumedToolResults
// ============================================================================

describe("evictConsumedToolResults", () => {
	it("evicts a tool result once an assistant message has consumed it", () => {
		const messages = [
			user("read the file"),
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("line1\nline2\nline3")),
			assistantText("done"),
		];
		const out = evictConsumedToolResults(messages);
		const summary = evictedText(out[2]);
		expect(summary).toBeDefined();
		expect(summary).toContain("[read /a.ts]");
		expect(summary).toContain("line1"); // firstLine preserved
		expect(summary).toContain("chars");
	});

	it("does NOT evict a trailing tool result the model has not yet responded to", () => {
		const messages = [
			user("read"),
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("contents")),
			// no assistant follow-up — result is still pending
		];
		const out = evictConsumedToolResults(messages);
		expect(evictedText(out[2])).toBeUndefined();
		expect(out[2]).toBe(messages[2]); // unchanged reference
	});

	it("resets pending results at a user-message turn boundary", () => {
		// toolResult followed by a user message (not an assistant) is NOT consumed
		const messages = [
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("x")),
			user("never mind"),
			assistantText("ok"),
		];
		const out = evictConsumedToolResults(messages);
		expect(evictedText(out[1])).toBeUndefined();
	});

	it("is idempotent — already-evicted results are left untouched", () => {
		const messages = [
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("huge output ".repeat(100))),
			assistantText("done"),
		];
		const once = evictConsumedToolResults(messages);
		const twice = evictConsumedToolResults(once);
		expect(twice[1]).toBe(once[1]); // same reference second time around
		expect(evictedText(twice[1])).toBe(evictedText(once[1]));
	});

	it("short-circuits (same reference) when there are no tool calls or results", () => {
		const messages = [user("hi"), assistantText("hello")];
		expect(evictConsumedToolResults(messages)).toBe(messages);
	});

	it("marks errored tool results with ❌", () => {
		const messages = [
			assistantToolCall("c1", "bash", { command: "ls" }),
			toolResult("c1", "bash", textBlocks("command failed"), true),
			assistantText("retrying"),
		];
		const out = evictConsumedToolResults(messages);
		expect(evictedText(out[1])).toContain("❌");
	});

	it("counts non-text blocks correctly — 3 images become image×3 (regression: BUG #1)", () => {
		const content = [
			{ type: "image", data: "..." },
			{ type: "image", data: "..." },
			{ type: "image", data: "..." },
		];
		const messages = [
			assistantToolCall("c1", "screenshot"),
			toolResult("c1", "screenshot", content),
			assistantText("seen"),
		];
		const out = evictConsumedToolResults(messages);
		const summary = evictedText(out[1]);
		expect(summary).toContain("+image×3");
		// The pre-fix bug produced "+image×2,image" — make sure that never recurs.
		expect(summary).not.toContain("image×2,image");
	});

	it("normalizes underscore in non-text block type tags (resource_link → resource-link)", () => {
		const content = [{ type: "resource_link", uri: "x" }];
		const messages = [assistantToolCall("c1", "fetch"), toolResult("c1", "fetch", content), assistantText("ok")];
		const out = evictConsumedToolResults(messages);
		expect(evictedText(out[1])).toContain("+resource-link");
	});

	it("handles plain string content", () => {
		const messages = [
			assistantToolCall("c1", "bash", { command: "echo hi" }),
			toolResult("c1", "bash", "stdout text here"),
			assistantText("done"),
		];
		const out = evictConsumedToolResults(messages);
		const summary = evictedText(out[1]);
		expect(summary).toContain("stdout text here");
		expect(summary).toContain("(16 chars)");
	});

	it("does not throw on circular-reference content (JSON.stringify guard)", () => {
		const circular: Record<string, unknown> = { a: 1 };
		circular.self = circular;
		const messages = [assistantToolCall("c1", "weird"), toolResult("c1", "weird", circular), assistantText("ok")];
		expect(() => evictConsumedToolResults(messages)).not.toThrow();
		const out = evictConsumedToolResults(messages);
		expect(evictedText(out[1])).toBeDefined();
	});

	it("sums chars across multiple text blocks", () => {
		const messages = [
			assistantToolCall("c1", "grep"),
			toolResult("c1", "grep", textBlocks("aaaa", "bbbb")), // 4 + 4 = 8
			assistantText("ok"),
		];
		const out = evictConsumedToolResults(messages);
		expect(evictedText(out[1])).toContain("(8 chars)");
	});
});

// ============================================================================
// Layer 1 — snipDeadMessages
// ============================================================================

describe("snipDeadMessages", () => {
	it("removes a prior read result for a file once it is written", () => {
		const messages = [
			user("edit /a.ts"),
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("old contents")),
			assistantToolCall("c2", "write", { file_path: "/a.ts" }),
			toolResult("c2", "write", textBlocks("written")),
		];
		const out = snipDeadMessages(messages);
		// The read result (index 2) should be gone; write result stays.
		expect(out).toHaveLength(4);
		expect(out.some((m) => evictedTextOrRaw(m)?.includes("old contents"))).toBe(false);
	});

	it("leaves messages untouched when no write/edit occurs", () => {
		const messages = [
			user("read /a.ts"),
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("contents")),
		];
		expect(snipDeadMessages(messages)).toHaveLength(3);
	});

	it("stops searching backwards at a user turn boundary", () => {
		const messages = [
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks("contents")),
			user("now write it"),
			assistantToolCall("c2", "write", { file_path: "/a.ts" }),
			toolResult("c2", "write", textBlocks("done")),
		];
		const out = snipDeadMessages(messages);
		// The read result is behind a user boundary → should NOT be snipped.
		expect(out).toHaveLength(5);
	});
});

function evictedTextOrRaw(msg: AgentMessage): string | undefined {
	const c = (msg as { content?: unknown }).content;
	if (typeof c === "string") return c;
	if (Array.isArray(c)) {
		return c.map((b) => (b as { text?: string }).text ?? "").join("");
	}
	return undefined;
}

// ============================================================================
// Layer 2 — microcompact
// ============================================================================

describe("microcompact", () => {
	it("truncates oversized tool result text blocks", () => {
		const big = "x".repeat(60_000);
		const messages = [toolResult("c1", "read", textBlocks(big))];
		const out = microcompact(messages, 50_000);
		const text = evictedTextOrRaw(out[0]) ?? "";
		expect(text.length).toBeLessThan(big.length);
		expect(text).toContain("truncated");
	});

	it("leaves under-limit results unchanged (same reference)", () => {
		const messages = [toolResult("c1", "read", textBlocks("small"))];
		const out = microcompact(messages, 50_000);
		expect(out[0]).toBe(messages[0]);
	});
});

// ============================================================================
// Layer 3 — needsAutocompact + applyMultiLayerCompaction
// ============================================================================

describe("needsAutocompact", () => {
	const cfg = {
		maxTokens: 100_000,
		autoCompactThreshold: 1000,
		maxToolResultChars: 50_000,
		enableSnip: true,
		enableMicrocompact: true,
		enableToolResultEviction: true,
	};

	it("is true when total tokens exceed the threshold", () => {
		const messages = [user("y".repeat(5000))]; // ~1250 tokens > 1000
		expect(needsAutocompact(messages, cfg)).toBe(true);
	});

	it("is false when under the threshold", () => {
		expect(needsAutocompact([user("short")], cfg)).toBe(false);
	});
});

describe("applyMultiLayerCompaction", () => {
	it("short-circuits below autoCompactThreshold (no layers applied)", () => {
		const result = applyMultiLayerCompaction([user("hi")]);
		expect(result.layersApplied).toEqual([]);
		expect(result.tokensFreed).toBe(0);
		expect(result.needsAutocompact).toBe(false);
	});

	it("runs snip + microcompact above the threshold and frees tokens", () => {
		// Build a transcript above DEFAULT threshold (90k tokens => ~360k chars).
		const huge = "z".repeat(400_000); // ~100k tokens in one read result
		const messages = [
			user("read /a.ts then write /a.ts"),
			assistantToolCall("c1", "read", { file_path: "/a.ts" }),
			toolResult("c1", "read", textBlocks(huge)),
			assistantToolCall("c2", "write", { file_path: "/a.ts" }),
			toolResult("c2", "write", textBlocks("written")),
		];
		const result = applyMultiLayerCompaction(messages);
		// snip should drop the dead read result for /a.ts (huge), freeing tokens.
		expect(result.tokensFreed).toBeGreaterThan(0);
		expect(result.layersApplied).toContain("snip");
	});

	it("does not list L0 eviction — L0 runs separately in sdk.ts transformContext", () => {
		const huge = "z".repeat(400_000);
		const messages = [
			user("hello"),
			assistantToolCall("c1", "bash", { command: "cat big" }),
			toolResult("c1", "bash", textBlocks(huge)),
			assistantText("ok"),
		];
		const result = applyMultiLayerCompaction(messages);
		expect(result.layersApplied).not.toContain("L0");
		expect(result.layersApplied).not.toContain("eviction");
	});

	it("exposes the default threshold constant (used by sdk.ts budget math)", () => {
		expect(DEFAULT_MULTI_LAYER_AUTO_COMPACT_THRESHOLD).toBe(90_000);
	});
});

/**
 * Multi-layer context compression.
 *
 * Layer 1: Snip - remove dead tool results (fast, no API call)
 * Layer 2: Microcompact - trim oversized results (fast, no API call)
 * Layer 3: Check - determine if autocompact is needed
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { estimateTokens } from "./compaction.js";

// Configuration
export interface MultiLayerCompactionConfig {
	maxTokens: number;
	autoCompactThreshold: number;
	maxToolResultChars: number;
	enableSnip: boolean;
	enableMicrocompact: boolean;
}

const DEFAULT_CONFIG: MultiLayerCompactionConfig = {
	maxTokens: 100000,
	autoCompactThreshold: 90000,
	maxToolResultChars: 50000,
	enableSnip: true,
	enableMicrocompact: true,
};

// Helpers
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
	return content.slice(0, maxChars) + "\n\n[... truncated " + (content.length - maxChars) + " characters ...]";
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

	if (originalTokens < config.maxTokens) {
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

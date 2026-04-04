import type { TSchema } from "@sinclair/typebox";
import type { AgentTool } from "./types.js";

export function buildTool<TParameters extends TSchema = TSchema, TDetails = any>(
	def: AgentTool<TParameters, TDetails>,
): AgentTool<TParameters, TDetails> {
	return {
		isReadOnly: () => false,
		isConcurrencySafe: () => false,
		isDestructive: () => false,
		interruptBehavior: () => "block" as const,
		maxResultSizeChars: 100_000,
		...def,
	};
}

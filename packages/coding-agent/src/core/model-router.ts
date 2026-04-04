// packages/coding-agent/src/core/model-router.ts
// Phase 3: ModelRouter — links task-analyzer + model-speed-cache
// into a single model-selection decision.

import type { ModelSpeedCache, ModelSpeedMetrics } from "./model-speed-cache.js";
import type { RateLimitScheduler } from "./rate-limit-scheduler.js";
import type { TaskAnalysis } from "./task-analyzer.js";

export interface ModelRoutingDecision {
	model: string;
	reason: string;
	strategy: "latency" | "throughput" | "cost" | "fallback";
	confidence: "high" | "medium" | "low";
	alternatives: Array<{ model: string; tradeoff: string }>;
}

export interface ModelCandidate {
	/** e.g. "openrouter" */
	provider: string;
	/** e.g. "google/gemini-flash-1.5" */
	modelId: string;
}

export interface ModelRouterOptions {
	candidates: ModelCandidate[];
	taskAnalysis: TaskAnalysis;
	rateLimiter: RateLimitScheduler;
	speedCache: ModelSpeedCache;
	costSensitive?: boolean;
	interactivePriority?: boolean;
}

export async function selectOptimalModel(opts: ModelRouterOptions): Promise<ModelRoutingDecision> {
	const { candidates, taskAnalysis, speedCache, costSensitive, interactivePriority } = opts;

	if (candidates.length === 0) {
		return mkFallback("", "No candidates provided");
	}
	if (candidates.length === 1) {
		return mkFallback(candidates[0].modelId, "Single candidate");
	}

	type Entry = { candidate: ModelCandidate; metrics: ModelSpeedMetrics | null };
	const entries: Entry[] = candidates.map((c) => ({
		candidate: c,
		metrics: speedCache.get(c.provider, c.modelId),
	}));

	const withData = entries.filter((e) => e.metrics !== null);

	// Determine strategy
	let strategy: ModelRoutingDecision["strategy"];
	if (costSensitive) {
		strategy = "cost";
	} else if (interactivePriority || taskAnalysis.complexity === "low") {
		strategy = "latency";
	} else if (taskAnalysis.complexity === "high") {
		strategy = "throughput";
	} else {
		strategy = "latency";
	}

	if (withData.length === 0) {
		return {
			model: candidates[0].modelId,
			reason: "No speed data — using first candidate",
			strategy: "fallback",
			confidence: "low",
			alternatives: candidates.slice(1).map((c) => ({
				model: c.modelId,
				tradeoff: "no perf data",
			})),
		};
	}

	let ranked: Entry[];
	let reason: string;

	switch (strategy) {
		case "latency":
			ranked = [...withData].sort((a, b) => (a.metrics!.ttftMs ?? Infinity) - (b.metrics!.ttftMs ?? Infinity));
			reason = `TTFT-first (complexity: ${taskAnalysis.complexity})`;
			break;
		case "throughput":
			ranked = [...withData].sort((a, b) => (b.metrics!.tps ?? 0) - (a.metrics!.tps ?? 0));
			reason = `TPS-first (high-complexity, est. ${taskAnalysis.estimatedTokens.max} tokens)`;
			break;
		case "cost":
			ranked = [...withData].sort((a, b) => (a.metrics!.ttftMs ?? Infinity) - (b.metrics!.ttftMs ?? Infinity));
			reason = "Cost-sensitive: cheapest model selected";
			break;
		default:
			ranked = withData;
			reason = "Fallback ordering";
	}

	const best = ranked[0];
	const alternatives = [
		...ranked.slice(1).map((e) => ({
			model: e.candidate.modelId,
			tradeoff: formatTradeoff(e.metrics!, best.metrics!, strategy),
		})),
		...entries
			.filter((e) => e.metrics === null)
			.map((e) => ({ model: e.candidate.modelId, tradeoff: "no speed data" })),
	];

	const confidence: ModelRoutingDecision["confidence"] =
		withData.length >= 3 ? "high" : withData.length === 2 ? "medium" : "low";

	return { model: best.candidate.modelId, reason, strategy, confidence, alternatives };
}

function mkFallback(model: string, reason: string): ModelRoutingDecision {
	return { model, reason, strategy: "fallback", confidence: "low", alternatives: [] };
}

function formatTradeoff(
	entry: ModelSpeedMetrics,
	best: ModelSpeedMetrics,
	strategy: ModelRoutingDecision["strategy"],
): string {
	switch (strategy) {
		case "latency": {
			const d = (entry.ttftMs ?? 0) - (best.ttftMs ?? 0);
			return `+${Math.round(d)}ms TTFT`;
		}
		case "throughput": {
			const d = (best.tps ?? 0) - (entry.tps ?? 0);
			return `-${Math.round(d)} TPS`;
		}
		case "cost": {
			const d = ((entry.ttftMs ?? 0) - (best.ttftMs ?? 0)) * 1000;
			return `+${Math.round(d)}ms TTFT`;
		}
		default:
			return "unknown";
	}
}

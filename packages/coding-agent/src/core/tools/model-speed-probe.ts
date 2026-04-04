/**
 * model_speed_probe — Benchmark LLM models for latency and throughput.
 *
 * Sends a minimal prompt ("Hi") to selected models via streamSimple,
 * measuring TTFT (time to first token) and TPS (tokens per second).
 * Results are cached to ~/.pi/agent/model-speed-cache.json (TTL 1h).
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type AssistantMessageEventStream, streamSimple } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { AuthStorage } from "../auth-storage.js";
import type { ToolDefinition } from "../extensions/types.js";
import { ModelRegistry } from "../model-registry.js";
import { ModelSpeedCache, type ModelSpeedMetrics } from "../model-speed-cache.js";
import { rateLimitScheduler } from "../rate-limit-scheduler.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = Type.Object({
	models: Type.Optional(
		Type.Array(Type.String(), {
			description:
				'Specific models to probe, e.g. ["anthropic:claude-sonnet-4-20250514", "openai:gpt-4o"]. ' +
				"If omitted, probes all configured models.",
		}),
	),
	force: Type.Optional(
		Type.Boolean({
			description: "If true, ignore cached results and re-probe (default: false).",
		}),
	),
});

// ── Probe Logic ──────────────────────────────────────────────────────────────

async function probeModel(modelId: string, provider: string, modelRegistry: ModelRegistry): Promise<ModelSpeedMetrics> {
	const model = modelRegistry.find(provider, modelId);
	if (!model) {
		throw new Error(`Model ${provider}/${modelId} not found. Check configuration.`);
	}

	const auth = await modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		throw new Error(`Auth failed for ${provider}/${modelId}: ${auth.error}`);
	}

	// Rate-limited minimal probe
	const release = await rateLimitScheduler.acquire(provider, "low");
	let stream: AssistantMessageEventStream;
	try {
		stream = streamSimple(
			model,
			{
				systemPrompt: "You are a helpful assistant. Reply with exactly: OK",
				messages: [{ role: "user", content: [{ type: "text", text: "Hi" }], timestamp: Date.now() }],
			},
			{ apiKey: auth.apiKey!, headers: auth.headers, maxTokens: 16 },
		);
	} finally {
		release();
	}

	const startMs = Date.now();
	let firstTokenMs = 0;
	let tokenCount = 0;

	for await (const event of stream) {
		if (event.type === "text_delta" && firstTokenMs === 0) {
			firstTokenMs = Date.now();
		}
		if (event.type === "text_delta") {
			tokenCount++;
		}
	}

	const result = await stream.result();
	const endMs = Date.now();

	// Use provider-reported token count if available
	const totalTokens = (result.usage?.output ?? tokenCount) || 1;
	const latencyMs = endMs - startMs;
	const ttftMs = firstTokenMs - startMs;
	const generationMs = endMs - (firstTokenMs || startMs);
	const tps = generationMs > 0 ? (totalTokens / generationMs) * 1000 : 0;

	return { modelId, provider, ttftMs, tps, totalTokens, latencyMs, timestamp: Date.now() };
}

// ── Tool Definition ──────────────────────────────────────────────────────────

export const modelSpeedProbeToolDefinition: ToolDefinition<typeof schema> = {
	name: "model_speed_probe",
	label: "Probe",
	description:
		"Benchmark configured LLM models for speed. Measures time-to-first-token (TTFT) and " +
		"throughput (tokens/sec). Results are cached for 1 hour. Use this to choose the fastest " +
		"model for interactive tasks or the highest-throughput model for long generation tasks.",
	promptSnippet: "Benchmark model speed (TTFT, throughput)",
	promptGuidelines: [
		"Run model_speed_probe to get latency data before choosing a model for a task.",
		"Low TTFT -> better for interactive conversations where user waits for response.",
		"High TPS -> better for long generations, summarization, or batch work.",
		"Results are cached for 1 hour. Use force=true to re-probe.",
	],
	parameters: schema,

	async execute(_toolCallId, params) {
		const authStorage = AuthStorage.create();
		const modelRegistry = ModelRegistry.create(authStorage);
		const cache = ModelSpeedCache.load();

		// Determine which models to probe
		let targets: Array<{ modelId: string; provider: string }>;

		if (params.models && params.models.length > 0) {
			targets = params.models.map((m: string) => {
				const parts = m.split(":");
				return parts.length === 2
					? { provider: parts[0], modelId: parts[1] }
					: { provider: "anthropic", modelId: m };
			});
		} else {
			const configured = modelRegistry.getAvailable();
			targets = configured.map((m) => ({ modelId: m.id, provider: m.provider }));
		}

		if (targets.length === 0) {
			return {
				content: [{ type: "text", text: "No models configured. Use /login to set up API keys first." }],
				details: { action: "model_speed_probe", error: "no_models" },
			};
		}

		const results: ModelSpeedMetrics[] = [];
		const errors: string[] = [];

		for (const target of targets) {
			// Check cache first
			if (!params.force) {
				const cached = cache.get(target.provider, target.modelId);
				if (cached) {
					results.push(cached);
					continue;
				}
			}

			try {
				const metrics = await probeModel(target.modelId, target.provider, modelRegistry);
				cache.set(metrics);
				results.push(metrics);
			} catch (err) {
				errors.push(`${target.provider}/${target.modelId}: ${(err as Error).message}`);
			}
		}

		// Format output
		const lines: string[] = ["## Model Speed Results\n"];

		if (results.length > 0) {
			lines.push("| Model | Provider | TTFT (ms) | TPS | Total Tokens | Latency (ms) |");
			lines.push("|-------|----------|-----------|-----|--------------|--------------|");

			for (const r of results.sort((a, b) => a.ttftMs - b.ttftMs)) {
				lines.push(
					`| ${r.modelId} | ${r.provider} | ${r.ttftMs} | ${r.tps.toFixed(1)} | ${r.totalTokens} | ${r.latencyMs} |`,
				);
			}

			// Recommendations
			const fastest = results.reduce((a, b) => (a.ttftMs < b.ttftMs ? a : b));
			const highest = results.reduce((a, b) => (a.tps > b.tps ? a : b));

			lines.push("");
			lines.push("**Recommendations:**");
			if (fastest.ttftMs > 0) {
				lines.push(
					`- Lowest TTFT: **${fastest.provider}/${fastest.modelId}** (${fastest.ttftMs}ms) -> best for interactive tasks`,
				);
			}
			if (highest.tps > 0) {
				lines.push(
					`- Highest TPS: **${highest.provider}/${highest.modelId}** (${highest.tps.toFixed(1)} tok/s) -> best for long generation`,
				);
			}
		}

		if (errors.length > 0) {
			lines.push("\n**Errors:**");
			errors.forEach((e) => {
				lines.push(`- ${e}`);
			});
		}

		return {
			content: [{ type: "text", text: lines.join("\n") }],
			details: { action: "model_speed_probe", results, errors },
		};
	},
};

export const modelSpeedProbeTool: AgentTool<typeof schema> = wrapToolDefinition(modelSpeedProbeToolDefinition);

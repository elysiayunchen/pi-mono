// =============================================================================
// STEP 1: 新建文件
// ~/pi-mono/packages/coding-agent/src/core/cost-tracker.ts
// =============================================================================

/**
 * OpenClaw Cost Tracker (P2-B)
 *
 * Claude Code 对应关系:
 *   addToTotalSessionCost()    → recordUsage()
 *   restoreCostStateForSession → loadCostState()  (lazy, 首次 record 时触发)
 *   saveCurrentSessionCosts()  → flushCostState() (debounce 5s + 进程退出)
 *   STATE.modelUsage[model]    → store.byModel[model]
 *   project config per-cwd     → ~/.pi/agent/costs.json (全局多 channel)
 *
 * Hook 点: streamFn 内部包装 AssistantMessageEventStream
 *   → 拦截 done 事件 → usage.cost.total 已由 provider 算好 → recordUsage()
 *   不需要触碰 emit sink，改动范围最小。
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Usage } from "@mariozechner/pi-ai";
import { type AssistantMessageEventStream, createAssistantMessageEventStream } from "@mariozechner/pi-ai";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface ModelCostEntry {
	costUSD: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	calls: number;
	provider: string;
}

interface DailyCostEntry {
	date: string; // YYYY-MM-DD
	costUSD: number;
	calls: number;
}

interface CostStore {
	version: 1;
	lastUpdated: string;
	totalCostUSD: number;
	totalCalls: number;
	byModel: Record<string, ModelCostEntry>;
	bySession: Record<string, { costUSD: number; calls: number; model: string; date: string }>;
	daily: DailyCostEntry[]; // rolling 90-day window
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _store: CostStore | null = null;
let _dirty = false;
let _timer: ReturnType<typeof setTimeout> | null = null;

const COSTS_PATH = path.join(os.homedir(), ".pi", "agent", "costs.json");
const DAILY_KEEP = 90;
const FLUSH_MS = 5_000;

// ---------------------------------------------------------------------------
// Persistence  (mirrors Claude Code: getStoredSessionCosts / saveCurrentSessionCosts)
// ---------------------------------------------------------------------------

function fresh(): CostStore {
	return { version: 1, lastUpdated: "", totalCostUSD: 0, totalCalls: 0, byModel: {}, bySession: {}, daily: [] };
}

export function loadCostState(): void {
	if (_store) return;
	try {
		if (fs.existsSync(COSTS_PATH)) {
			const parsed = JSON.parse(fs.readFileSync(COSTS_PATH, "utf8")) as CostStore;
			if (parsed.version === 1) {
				_store = parsed;
				return;
			}
		}
	} catch {
		/* corrupt → start fresh */
	}
	_store = fresh();
}

export function flushCostState(): void {
	if (!_store || !_dirty) return;
	const tmp = `${COSTS_PATH}.tmp`;
	try {
		fs.mkdirSync(path.dirname(COSTS_PATH), { recursive: true });
		_store.lastUpdated = new Date().toISOString();
		fs.writeFileSync(tmp, JSON.stringify(_store, null, 2), "utf8");
		fs.renameSync(tmp, COSTS_PATH);
		_dirty = false;
	} catch (e) {
		console.error("[cost-tracker] flush failed:", e);
	}
}

function scheduleFlush(): void {
	if (_timer) return;
	_timer = setTimeout(() => {
		_timer = null;
		flushCostState();
	}, FLUSH_MS);
}

// ---------------------------------------------------------------------------
// Core accumulation  (mirrors Claude Code: addToTotalSessionCost)
// ---------------------------------------------------------------------------

export function recordUsage(sessionId: string, modelId: string, provider: string, usage: Usage): void {
	loadCostState();
	const s = _store!;
	const cost = usage.cost?.total ?? 0;
	const today = new Date().toISOString().slice(0, 10);

	s.totalCostUSD += cost;
	s.totalCalls += 1;

	// per-model  (mirrors STATE.modelUsage)
	if (!s.byModel[modelId]) {
		s.byModel[modelId] = {
			costUSD: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			calls: 0,
			provider,
		};
	}
	const m = s.byModel[modelId];
	m.costUSD += cost;
	m.inputTokens += usage.input ?? 0;
	m.outputTokens += usage.output ?? 0;
	m.cacheReadTokens += usage.cacheRead ?? 0;
	m.cacheWriteTokens += usage.cacheWrite ?? 0;
	m.calls += 1;

	// per-session
	if (!s.bySession[sessionId]) {
		s.bySession[sessionId] = { costUSD: 0, calls: 0, model: modelId, date: today };
	}
	s.bySession[sessionId].costUSD += cost;
	s.bySession[sessionId].calls += 1;

	// daily rolling window
	let day = s.daily.find((d) => d.date === today);
	if (!day) {
		day = { date: today, costUSD: 0, calls: 0 };
		s.daily.push(day);
		if (s.daily.length > DAILY_KEEP) s.daily.splice(0, s.daily.length - DAILY_KEEP);
	}
	day.costUSD += cost;
	day.calls += 1;

	_dirty = true;
	scheduleFlush();
}

// ---------------------------------------------------------------------------
// Stream wrapper — the actual hook point in sdk.ts
// Wraps AssistantMessageEventStream, intercepts "done" to capture usage.
// This avoids needing to find/wrap the emit AgentEventSink entirely.
// ---------------------------------------------------------------------------

export function wrapStreamForCost(
	stream: AssistantMessageEventStream,
	sessionId: string,
	modelId: string,
	provider: string,
): AssistantMessageEventStream {
	const proxy = createAssistantMessageEventStream();
	(async () => {
		for await (const event of stream) {
			if (event.type === "done") {
				recordUsage(sessionId, modelId, provider, event.message.usage);
			}
			proxy.push(event);
		}
		proxy.end();
	})().catch((err) => {
		proxy.end();
		console.error("[cost-tracker] stream proxy error:", err);
	});
	return proxy;
}

// ---------------------------------------------------------------------------
// Read / display  (mirrors Claude Code: getTotalCostUSD / formatTotalCost)
// ---------------------------------------------------------------------------

export interface CostStats {
	totalCostUSD: number;
	totalCalls: number;
	hasUnknownCost: boolean;
	byModel: Record<string, ModelCostEntry>;
	recentDaily: DailyCostEntry[]; // last 7 days, newest-first
}

export function getCostStats(): CostStats {
	loadCostState();
	const s = _store!;
	return {
		totalCostUSD: s.totalCostUSD,
		totalCalls: s.totalCalls,
		hasUnknownCost: Object.values(s.byModel).some((m) => m.costUSD === 0 && m.calls > 0),
		byModel: s.byModel,
		recentDaily: [...s.daily].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7),
	};
}

export function getSessionCost(sessionId: string): number {
	loadCostState();
	return _store?.bySession[sessionId]?.costUSD ?? 0;
}

export function formatCost(usd: number): string {
	return usd >= 0.5 ? `$${(Math.round(usd * 100) / 100).toFixed(2)}` : `$${usd.toFixed(4)}`;
}

export function formatCostSummary(): string {
	const { totalCostUSD, totalCalls, hasUnknownCost, byModel, recentDaily } = getCostStats();
	const lines = [
		`Total cost:  ${formatCost(totalCostUSD)}${hasUnknownCost ? "  ⚠ some models unpriced" : ""}`,
		`Total calls: ${totalCalls}`,
		``,
		`By model:`,
		...Object.entries(byModel).map(
			([id, e]) =>
				`  ${id} [${e.provider}]  cost=${formatCost(e.costUSD)}` +
				`  in=${e.inputTokens} out=${e.outputTokens}` +
				`  cacheR=${e.cacheReadTokens} cacheW=${e.cacheWriteTokens}` +
				`  (${e.calls} calls)`,
		),
	];
	if (recentDaily.length > 0) {
		lines.push(``, `Last 7 days:`);
		recentDaily.forEach((d) => {
			lines.push(`  ${d.date}  ${formatCost(d.costUSD)}  (${d.calls} calls)`);
		});
	}
	return lines.join("\n");
}

export function shutdownCostTracker(): void {
	if (_timer) {
		clearTimeout(_timer);
		_timer = null;
	}
	flushCostState();
}

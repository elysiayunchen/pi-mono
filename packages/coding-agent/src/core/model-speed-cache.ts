/**
 * Model Speed Cache (P2-D Phase 1)
 *
 * Persists model performance measurements (TTFT, TPS) to disk.
 * TTL: 1 hour. Used by model-speed-probe tool and future smart model routing.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModelSpeedMetrics {
	modelId: string;
	provider: string;
	ttftMs: number; // Time to first token (ms)
	tps: number; // Tokens per second
	totalTokens: number;
	latencyMs: number; // Total round-trip (ms)
	timestamp: number; // Date.now()
}

export interface SpeedCacheEntry extends ModelSpeedMetrics {
	expiresAt: number;
}

interface SpeedCacheStore {
	version: 1;
	entries: Record<string, SpeedCacheEntry>; // key = "provider:modelId"
}

// ── Constants ────────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(os.homedir(), ".pi", "agent");
const CACHE_FILE = path.join(CACHE_DIR, "model-speed-cache.json");
const TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache Implementation ─────────────────────────────────────────────────────

export class ModelSpeedCache {
	private store: SpeedCacheStore;
	private dirty = false;

	private constructor(store: SpeedCacheStore) {
		this.store = store;
	}

	static load(): ModelSpeedCache {
		try {
			if (fs.existsSync(CACHE_FILE)) {
				const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
				if (raw.version === 1) {
					return new ModelSpeedCache(raw as SpeedCacheStore);
				}
			}
		} catch {
			/* corrupt → start fresh */
		}
		return new ModelSpeedCache({ version: 1, entries: {} });
	}

	get(provider: string, modelId: string): ModelSpeedMetrics | null {
		const key = `${provider}:${modelId}`;
		const entry = this.store.entries[key];
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			delete this.store.entries[key];
			this.dirty = true;
			return null;
		}
		return entry;
	}

	set(metrics: ModelSpeedMetrics): void {
		const key = `${metrics.provider}:${metrics.modelId}`;
		this.store.entries[key] = { ...metrics, expiresAt: Date.now() + TTL_MS };
		this.dirty = true;
		this.save();
	}

	getAll(): ModelSpeedMetrics[] {
		const now = Date.now();
		const results: ModelSpeedMetrics[] = [];
		for (const [key, entry] of Object.entries(this.store.entries)) {
			if (now > entry.expiresAt) {
				delete this.store.entries[key];
				this.dirty = true;
				continue;
			}
			results.push(entry);
		}
		if (this.dirty) this.save();
		return results.sort((a, b) => a.ttftMs - b.ttftMs);
	}

	private save(): void {
		try {
			fs.mkdirSync(CACHE_DIR, { recursive: true });
			const tmp = `${CACHE_FILE}.tmp`;
			fs.writeFileSync(tmp, JSON.stringify(this.store, null, 2), "utf8");
			fs.renameSync(tmp, CACHE_FILE);
			this.dirty = false;
		} catch (e) {
			console.error("[model-speed-cache] save failed:", e);
		}
	}
}

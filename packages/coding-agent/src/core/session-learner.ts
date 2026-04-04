// packages/coding-agent/src/core/session-learner.ts
// Phase 3: SessionLearner — reads historical session JSONL files,
// extracts actual token usage + RPM, computes bias-correction factors
// for task-analyzer predictions and adaptive efficiency thresholds.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TaskPattern {
	taskType: string;
	sampleCount: number;
	avgActualTokens: number;
	avgPredictedMin: number;
	avgPredictedMax: number;
	/** actualTokens / midpoint(predictedRange) — >1 means under-predicted */
	biasFactor: number;
	lastUpdated: string;
}

export interface LearningData {
	patterns: Record<string, TaskPattern>;
	/** 95th-percentile API calls-per-minute across scanned sessions */
	globalRpmP95: number;
	updatedAt: string;
}

const LEARNING_DIR = path.join(os.homedir(), ".pi", "agent", "learning");
const PATTERNS_FILE = path.join(LEARNING_DIR, "patterns.json");
const SESSIONS_DIR = path.join(os.homedir(), ".pi", "agent", "sessions");
const MAX_SESSIONS = 50;

export class SessionLearner {
	private data: LearningData = {
		patterns: {},
		globalRpmP95: 18,
		updatedAt: new Date().toISOString(),
	};

	load(): void {
		try {
			if (fs.existsSync(PATTERNS_FILE)) {
				this.data = JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8")) as LearningData;
			}
		} catch {
			/* ignore */
		}
	}

	save(): void {
		fs.mkdirSync(LEARNING_DIR, { recursive: true });
		fs.writeFileSync(PATTERNS_FILE, JSON.stringify(this.data, null, 2));
	}

	getPattern(taskType: string): TaskPattern | null {
		return this.data.patterns[taskType] ?? null;
	}

	getGlobalRpmP95(): number {
		return this.data.globalRpmP95;
	}

	getData(): LearningData {
		return this.data;
	}

	/** Scan recent session JSONL files and update learning data. */
	async updateFromSessions(): Promise<void> {
		if (!fs.existsSync(SESSIONS_DIR)) return;

		const files: string[] = [];
		try {
			for (const sub of fs.readdirSync(SESSIONS_DIR)) {
				const subDir = path.join(SESSIONS_DIR, sub);
				if (!fs.statSync(subDir).isDirectory()) continue;
				for (const f of fs.readdirSync(subDir)) {
					if (f.endsWith(".jsonl")) files.push(path.join(subDir, f));
				}
			}
		} catch {
			return;
		}

		files.sort((a, b) => {
			try {
				return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
			} catch {
				return 0;
			}
		});
		const toScan = files.slice(0, MAX_SESSIONS);

		const rpmSamples: number[] = [];
		type Sample = { type: string; actualTokens: number; predictedMin: number; predictedMax: number };
		const taskSamples: Sample[] = [];

		for (const file of toScan) {
			try {
				const lines = fs.readFileSync(file, "utf-8").split("\n").filter(Boolean);
				let totalTokens = 0;
				let taskType = "unknown";
				let predictedMin = 0;
				let predictedMax = 0;
				let apiCalls = 0;
				let firstTs = 0;
				let lastTs = 0;

				for (const line of lines) {
					try {
						const e = JSON.parse(line) as Record<string, unknown>;

						// task_analysis entries written by our enhanced enter-plan-mode
						if (e.type === "system" && e.subtype === "task_analysis") {
							const p = e.payload as Record<string, unknown>;
							taskType = (p.complexity as string) ?? "unknown";
							const est = p.estimatedTokens as [number, number] | undefined;
							if (est) {
								predictedMin = est[0];
								predictedMax = est[1];
							}
						}

						// usage entries written by P2-A session persistence
						if (e.type === "usage") {
							const inp = (e.input_tokens as number) ?? 0;
							const out = (e.output_tokens as number) ?? 0;
							totalTokens += inp + out;
							apiCalls++;
							const ts = new Date(e.timestamp as string).getTime();
							if (!firstTs) firstTs = ts;
							lastTs = ts;
						}
					} catch {
						/* skip malformed line */
					}
				}

				if (totalTokens > 0 && predictedMin > 0) {
					taskSamples.push({ type: taskType, actualTokens: totalTokens, predictedMin, predictedMax });
				}
				if (apiCalls > 1 && lastTs > firstTs) {
					const durationMin = (lastTs - firstTs) / 60_000;
					if (durationMin > 0) rpmSamples.push(apiCalls / durationMin);
				}
			} catch {
				/* skip unreadable file */
			}
		}

		// Update per-type patterns (EMA blend with existing)
		const grouped: Record<string, Sample[]> = {};
		for (const s of taskSamples) {
			if (!grouped[s.type]) grouped[s.type] = [];
			grouped[s.type].push(s);
		}
		for (const [type, samples] of Object.entries(grouped)) {
			const avgActual = mean(samples.map((s) => s.actualTokens));
			const avgMin = mean(samples.map((s) => s.predictedMin));
			const avgMax = mean(samples.map((s) => s.predictedMax));
			const mid = (avgMin + avgMax) / 2;
			const biasFactor = mid > 0 ? avgActual / mid : 1.0;
			const prev = this.data.patterns[type];
			const a = 0.3; // EMA alpha
			this.data.patterns[type] = {
				taskType: type,
				sampleCount: (prev?.sampleCount ?? 0) + samples.length,
				avgActualTokens: prev ? lerp(prev.avgActualTokens, avgActual, a) : avgActual,
				avgPredictedMin: avgMin,
				avgPredictedMax: avgMax,
				biasFactor: prev ? lerp(prev.biasFactor, biasFactor, a) : biasFactor,
				lastUpdated: new Date().toISOString(),
			};
		}

		// Update global RPM P95
		if (rpmSamples.length > 0) {
			rpmSamples.sort((a, b) => a - b);
			const idx = Math.floor(rpmSamples.length * 0.95);
			this.data.globalRpmP95 = rpmSamples[Math.min(idx, rpmSamples.length - 1)];
		}

		this.data.updatedAt = new Date().toISOString();
		this.save();
	}
}

function mean(nums: number[]): number {
	if (nums.length === 0) return 0;
	return nums.reduce((s, n) => s + n, 0) / nums.length;
}
function lerp(a: number, b: number, t: number): number {
	return a * (1 - t) + b * t;
}

// Module-level singleton
let _instance: SessionLearner | null = null;
export function getSessionLearner(): SessionLearner {
	if (!_instance) {
		_instance = new SessionLearner();
		_instance.load();
	}
	return _instance;
}

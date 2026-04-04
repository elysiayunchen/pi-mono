/**
 * Efficiency Guard (P2-D Phase 2)
 * Predictive resource monitoring that warns when API call rates
 * approach provider limits.
 */

import type { RateLimitScheduler } from "./rate-limit-scheduler.js";

export type EfficiencyWarningSeverity = "info" | "warn" | "critical";

export interface EfficiencyWarning {
	severity: EfficiencyWarningSeverity;
	message: string;
	suggestions: string[];
}

export interface EfficiencyGuardConfig {
	warnThreshold: number;
	criticalThreshold: number;
	minCallsForWarning: number;
}

const DEFAULT_CONFIG: EfficiencyGuardConfig = {
	warnThreshold: 0.7,
	criticalThreshold: 0.9,
	minCallsForWarning: 5,
};

interface CallRecord {
	timestamp: number;
	provider: string;
}

class CallTracker {
	private records: CallRecord[] = [];
	private windowMs = 60_000;

	record(provider: string): void {
		const now = Date.now();
		this.records.push({ timestamp: now, provider });
		this.records = this.records.filter((r) => now - r.timestamp < this.windowMs);
	}

	getRate(provider: string): number {
		const now = Date.now();
		this.records = this.records.filter((r) => now - r.timestamp < this.windowMs);
		return this.records.filter((r) => r.provider === provider).length;
	}

	getTotalRate(): number {
		const now = Date.now();
		this.records = this.records.filter((r) => now - r.timestamp < this.windowMs);
		return this.records.length;
	}

	clear(): void {
		this.records = [];
	}
}

export class EfficiencyGuard {
	private tracker = new CallTracker();
	private config: EfficiencyGuardConfig;
	private warningCooldownMs = 30_000;
	private lastWarningTime = 0;

	constructor(config?: Partial<EfficiencyGuardConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	recordCall(provider: string): void {
		this.tracker.record(provider);
	}

	check(provider: string, scheduler?: RateLimitScheduler): EfficiencyWarning | null {
		const now = Date.now();
		if (now - this.lastWarningTime < this.warningCooldownMs) {
			return null;
		}

		const currentRate = this.tracker.getRate(provider);
		if (currentRate < this.config.minCallsForWarning) {
			return null;
		}

		let providerRpm = 20;
		if (scheduler) {
			const status = scheduler.getStatus(provider);
			providerRpm = status.availableTokens + status.queueLength + currentRate;
		}

		const usage = currentRate / providerRpm;

		if (usage >= this.config.criticalThreshold) {
			this.lastWarningTime = now;
			return {
				severity: "critical",
				message: `API rate critical: ${currentRate}/${providerRpm} RPM for ${provider}`,
				suggestions: [
					"Simplify remaining steps - merge tool calls where possible.",
					"Use read-only tools instead of write/edit when exploring.",
					"Consider pausing and letting the user guide next steps.",
				],
			};
		}

		if (usage >= this.config.warnThreshold) {
			this.lastWarningTime = now;
			return {
				severity: "warn",
				message: `API rate elevated: ${currentRate}/${providerRpm} RPM for ${provider}`,
				suggestions: [
					"Batch related tool calls when possible.",
					"Avoid redundant reads - use grep to check multiple files at once.",
				],
			};
		}

		return null;
	}

	getStats(provider: string): { callsPerMinute: number; totalCallsPerMinute: number } {
		return {
			callsPerMinute: this.tracker.getRate(provider),
			totalCallsPerMinute: this.tracker.getTotalRate(),
		};
	}
}

export const efficiencyGuard = new EfficiencyGuard();

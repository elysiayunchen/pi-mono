// packages/coding-agent/src/core/adaptive-guard.ts
// Phase 3: AdaptiveGuard — wraps EfficiencyGuard with thresholds learned
// from SessionLearner. Thresholds are ratios (0-1) matching EfficiencyGuardConfig.

import { EfficiencyGuard } from "./efficiency-guard.js";
import type { RateLimitScheduler } from "./rate-limit-scheduler.js";
import { getSessionLearner } from "./session-learner.js";

const DEFAULT_WARN = 0.7;
const DEFAULT_CRITICAL = 0.9;

export class AdaptiveGuard {
	private inner: EfficiencyGuard;
	private warnThreshold: number;
	private criticalThreshold: number;
	private calibrated = false;

	constructor() {
		this.warnThreshold = DEFAULT_WARN;
		this.criticalThreshold = DEFAULT_CRITICAL;
		this.inner = new EfficiencyGuard({
			warnThreshold: this.warnThreshold,
			criticalThreshold: this.criticalThreshold,
		});
	}

	/**
	 * Calibrate thresholds from learned session history.
	 * If historical P95 RPM usage is high (>80% of limit),
	 * lower the warn threshold to trigger earlier.
	 */
	calibrate(): void {
		if (this.calibrated) return;
		this.calibrated = true;
		try {
			const learner = getSessionLearner();
			const p95 = learner.getGlobalRpmP95();
			if (p95 > 0) {
				// p95 here is calls/min observed historically.
				// Map to ratio adjustment: if p95 >= 16 (80% of typical 20 RPM), warn earlier.
				const usageRatio = Math.min(p95 / 20, 1.0);
				if (usageRatio > 0.8) {
					// Historical usage was high — lower thresholds to warn sooner
					this.warnThreshold = Math.max(0.5, DEFAULT_WARN - (usageRatio - 0.8) * 0.5);
					this.criticalThreshold = Math.max(0.7, DEFAULT_CRITICAL - (usageRatio - 0.8) * 0.3);
					this.inner = new EfficiencyGuard({
						warnThreshold: this.warnThreshold,
						criticalThreshold: this.criticalThreshold,
					});
				}
			}
		} catch {
			/* fall back to defaults */
		}
	}

	recordCall(provider = "unknown"): void {
		this.inner.recordCall(provider);
	}

	check(provider: string, scheduler?: RateLimitScheduler) {
		return this.inner.check(provider, scheduler);
	}

	getThresholds(): { warn: number; critical: number; learned: boolean } {
		return {
			warn: this.warnThreshold,
			critical: this.criticalThreshold,
			learned: this.calibrated && this.warnThreshold !== DEFAULT_WARN,
		};
	}

	triggerBackgroundLearning(): void {
		getSessionLearner()
			.updateFromSessions()
			.catch(() => {});
	}
}

let _instance: AdaptiveGuard | null = null;
export function getAdaptiveGuard(): AdaptiveGuard {
	if (!_instance) {
		_instance = new AdaptiveGuard();
		_instance.calibrate();
	}
	return _instance;
}

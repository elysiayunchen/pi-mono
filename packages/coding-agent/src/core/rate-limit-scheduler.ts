/**
 * Rate Limit Scheduler (P2-D Phase 1)
 *
 * Global token-bucket rate limiter for all external LLM API calls.
 * Prevents 429 errors from providers like OpenRouter (RPM limits).
 *
 * Usage:
 *   import { rateLimitScheduler } from "../rate-limit-scheduler.js";
 *   const release = await rateLimitScheduler.acquire(provider, priority);
 *   try { ... api call ... } finally { release(); }
 *
 *   // Or for streaming:
 *   const stream = await rateLimitScheduler.acquireAndStream(provider, () => streamSimple(...), priority);
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type RequestPriority = "high" | "normal" | "low";

interface QueuedRequest {
	resolve: (release: () => void) => void;
	priority: RequestPriority;
	enqueuedAt: number;
}

const PRIORITY_ORDER: Record<RequestPriority, number> = { high: 0, normal: 1, low: 2 };

// ── Token Bucket ─────────────────────────────────────────────────────────────

class TokenBucket {
	public tokens: number;
	private lastRefill: number;

	constructor(
		public capacity: number,
		public readonly refillRate: number, // tokens per ms
	) {
		this.tokens = capacity;
		this.lastRefill = Date.now();
	}

	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefill;
		this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
		this.lastRefill = now;
	}

	tryConsume(): boolean {
		this.refill();
		if (this.tokens >= 1) {
			this.tokens -= 1;
			return true;
		}
		return false;
	}

	msUntilAvailable(): number {
		this.refill();
		if (this.tokens >= 1) return 0;
		const deficit = 1 - this.tokens;
		return Math.ceil(deficit / this.refillRate);
	}
}

// ── Scheduler ────────────────────────────────────────────────────────────────

export class RateLimitScheduler {
	private providers = new Map<string, TokenBucket>();
	private queues = new Map<string, QueuedRequest[]>();
	private timers = new Map<string, ReturnType<typeof setTimeout>>();
	private defaultRpm: number;

	constructor(options?: { defaultRpm?: number }) {
		this.defaultRpm = options?.defaultRpm ?? 20;
	}

	configureProvider(provider: string, rpm: number): void {
		this.providers.set(provider, new TokenBucket(rpm, rpm / 60_000));
	}

	private getBucket(provider: string): TokenBucket {
		let bucket = this.providers.get(provider);
		if (!bucket) {
			bucket = new TokenBucket(this.defaultRpm, this.defaultRpm / 60_000);
			this.providers.set(provider, bucket);
		}
		return bucket;
	}

	/**
	 * Acquire a rate-limit token for the given provider.
	 * Returns a release function that MUST be called when the API call completes.
	 */
	async acquire(provider: string, priority: RequestPriority = "normal"): Promise<() => void> {
		const bucket = this.getBucket(provider);

		if (bucket.tryConsume()) {
			return () => {}; // immediate grant
		}

		// Must queue
		return new Promise<() => void>((resolve) => {
			const req: QueuedRequest = { resolve, priority, enqueuedAt: Date.now() };

			let queue = this.queues.get(provider);
			if (!queue) {
				queue = [];
				this.queues.set(provider, queue);
			}

			// Insert by priority (lower number = higher priority)
			const insertIdx = queue.findIndex((r) => PRIORITY_ORDER[r.priority] > PRIORITY_ORDER[priority]);
			if (insertIdx === -1) {
				queue.push(req);
			} else {
				queue.splice(insertIdx, 0, req);
			}

			this.scheduleProcessing(provider);
		});
	}

	/**
	 * Convenience: acquire token, execute async function, release token.
	 * For streaming calls — releases when the stream is consumed.
	 */
	async acquireAndStream<T>(provider: string, fn: () => Promise<T>, priority: RequestPriority = "normal"): Promise<T> {
		const release = await this.acquire(provider, priority);
		try {
			return await fn();
		} finally {
			release();
		}
	}

	private scheduleProcessing(provider: string): void {
		if (this.timers.has(provider)) return;

		const bucket = this.getBucket(provider);
		const delay = Math.max(50, bucket.msUntilAvailable());

		const timer = setTimeout(() => {
			this.timers.delete(provider);
			this.processQueue(provider);
		}, delay);

		this.timers.set(provider, timer);
	}

	private processQueue(provider: string): void {
		const queue = this.queues.get(provider);
		if (!queue || queue.length === 0) return;

		const bucket = this.getBucket(provider);

		while (queue.length > 0 && bucket.tryConsume()) {
			const req = queue.shift()!;
			req.resolve(() => {}); // grant with no-op release
		}

		if (queue.length > 0) {
			this.scheduleProcessing(provider);
		}
	}

	/** Get current status for diagnostics / efficiency-guard */
	getStatus(provider: string): { queueLength: number; availableTokens: number } {
		const bucket = this.getBucket(provider);
		const queue = this.queues.get(provider);
		return {
			queueLength: queue?.length ?? 0,
			availableTokens: Math.floor(bucket.tokens),
		};
	}
}

// ── Global singleton ─────────────────────────────────────────────────────────

export const rateLimitScheduler = new RateLimitScheduler({ defaultRpm: 20 });

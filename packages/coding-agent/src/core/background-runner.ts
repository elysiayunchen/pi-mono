/**
 * s08 Background Task Runner
 *
 * Manages child processes for async bash execution.
 * Output is streamed directly into task.output via appendTaskOutput().
 * No separate output files — task store is the single source of truth.
 */

import { type ChildProcess, spawn } from "child_process";
import { appendTaskOutput, updateTask } from "./tasks/task-store.js";

// ── Registry ──────────────────────────────────────────────────

interface ProcessEntry {
	pid: number | undefined;
	process: ChildProcess;
	startedAt: number;
}

/** taskId → running process. Cleared on process exit. */
const registry = new Map<string, ProcessEntry>();

// ── Public API ────────────────────────────────────────────────

/**
 * Spawn a bash command as a background task.
 * Returns immediately. Status transitions happen asynchronously:
 *   pending → in_progress → completed | failed
 *
 * stdout and stderr are both appended to task.output in real time.
 */
export async function spawnBackground(sessionId: string, taskId: string, command: string, cwd?: string): Promise<void> {
	const child = spawn("bash", ["-c", command], {
		cwd: cwd ?? process.cwd(),
		detached: false,
		stdio: ["ignore", "pipe", "pipe"],
	});

	registry.set(taskId, {
		pid: child.pid,
		process: child,
		startedAt: Date.now(),
	});

	// Mark task as in_progress immediately
	updateTask(sessionId, taskId, { status: "in_progress" });

	// Stream stdout → task.output
	child.stdout?.on("data", (chunk: Buffer) => {
		appendTaskOutput(sessionId, taskId, chunk.toString());
	});

	// Stream stderr → task.output (prefixed so it's distinguishable)
	child.stderr?.on("data", (chunk: Buffer) => {
		appendTaskOutput(sessionId, taskId, `[stderr] ${chunk.toString()}`);
	});

	// On exit: update final status
	child.on("close", (code) => {
		registry.delete(taskId);

		const status = code === 0 ? "completed" : "failed";
		updateTask(sessionId, taskId, {
			status,
			metadata: { exitCode: code ?? -1 },
		});
	});

	// Handle spawn errors (e.g. bash not found)
	child.on("error", (err) => {
		registry.delete(taskId);
		appendTaskOutput(sessionId, taskId, `[spawn error] ${err.message}\n`);
		updateTask(sessionId, taskId, {
			status: "failed",
			metadata: { error: err.message },
		});
	});
}

/**
 * Kill a running background task.
 * Sends SIGTERM first, SIGKILL after 3 seconds if still alive.
 * Returns true if a process was found and terminated.
 */
export async function stopBackground(taskId: string): Promise<boolean> {
	const entry = registry.get(taskId);
	if (!entry) return false;

	entry.process.kill("SIGTERM");

	// Wait for graceful exit, then force-kill
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			entry.process.kill("SIGKILL");
			resolve();
		}, 3000);

		entry.process.once("close", () => {
			clearTimeout(timer);
			resolve();
		});
	});

	registry.delete(taskId);
	return true;
}

/** Whether a task's process is currently running. */
export function isRunning(taskId: string): boolean {
	return registry.has(taskId);
}

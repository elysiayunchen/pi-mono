/**
 * s12 Worktree Manager
 *
 * Module-level singleton tracking active worktree sessions.
 * Each worktree has an isolated directory (git worktree if in a git repo,
 * plain directory otherwise) and an associated teammate agent.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ── Types ─────────────────────────────────────────────────────────────────

export interface WorktreeEntry {
	id: string;
	worktreePath: string;
	originalCwd: string;
	branch?: string;
	isGit: boolean;
	taskId?: string;
	teammateId?: string;
	createdAt: string;
}

// ── Module-level registry ─────────────────────────────────────────────────

const registry = new Map<string, WorktreeEntry>();

// ── Helpers ───────────────────────────────────────────────────────────────

function worktreesRoot(): string {
	return path.join(os.homedir(), ".pi", "agent", "worktrees");
}

function findGitRoot(dir: string): string | null {
	try {
		const result = execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
			stdio: "pipe",
		});
		return result.toString().trim();
	} catch {
		return null;
	}
}

// ── Public API ────────────────────────────────────────────────────────────

export function getCurrentWorktree(worktreeId: string): WorktreeEntry | undefined {
	return registry.get(worktreeId);
}

export function listWorktrees(): WorktreeEntry[] {
	return Array.from(registry.values());
}

/**
 * Create a new worktree directory (and git worktree branch if possible).
 * Registers the entry in the module-level registry.
 */
export function createWorktree(
	worktreeId: string,
	name: string,
	originalCwd: string,
	taskId?: string,
	teammateId?: string,
): WorktreeEntry {
	const worktreeBase = path.join(worktreesRoot(), worktreeId);
	fs.mkdirSync(worktreeBase, { recursive: true });
	const worktreePath = path.join(worktreeBase, name);

	let branch: string | undefined;
	let isGit = false;

	const gitRoot = findGitRoot(originalCwd);
	if (gitRoot) {
		branch = `worktree/${worktreeId}/${name}`;
		try {
			execFileSync("git", ["-C", gitRoot, "worktree", "add", "-b", branch, worktreePath], { stdio: "pipe" });
			isGit = true;
		} catch {
			// git worktree failed (e.g. detached HEAD, dirty state) — fall back to plain dir
			branch = undefined;
			fs.mkdirSync(worktreePath, { recursive: true });
		}
	} else {
		fs.mkdirSync(worktreePath, { recursive: true });
	}

	const entry: WorktreeEntry = {
		id: worktreeId,
		worktreePath,
		originalCwd,
		branch,
		isGit,
		taskId,
		teammateId,
		createdAt: new Date().toISOString(),
	};
	registry.set(worktreeId, entry);
	return entry;
}

/**
 * Remove a worktree directory (and git worktree + branch if applicable).
 * Deletes the entry from the registry.
 */
export function removeWorktree(worktreeId: string, force = false): boolean {
	const entry = registry.get(worktreeId);
	if (!entry) return false;

	if (entry.isGit) {
		try {
			const args = ["worktree", "remove", entry.worktreePath];
			if (force) args.push("--force");
			execFileSync("git", args, { stdio: "pipe" });
		} catch {
			fs.rmSync(entry.worktreePath, { recursive: true, force: true });
		}
		if (entry.branch) {
			try {
				execFileSync("git", ["branch", "-D", entry.branch], {
					stdio: "pipe",
					cwd: entry.originalCwd,
				});
			} catch {
				/* branch may already be gone */
			}
		}
	} else {
		fs.rmSync(entry.worktreePath, { recursive: true, force: true });
	}

	registry.delete(worktreeId);
	return true;
}

/**
 * Keep the worktree directory on disk but stop tracking it.
 */
export function keepWorktree(worktreeId: string): boolean {
	const entry = registry.get(worktreeId);
	if (!entry) return false;
	registry.delete(worktreeId);
	return true;
}

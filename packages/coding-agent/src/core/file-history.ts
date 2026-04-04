/**
 * P3-B File History — in-process snapshot manager.
 * Backs up files before write/edit tool calls, enabling step-by-step undo.
 * Backups stored under ~/.pi/agent/file-history/{sessionId}/{hash}@v{n}
 * (mirrors Claude Code's approach to avoid large-file OOM).
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, stat, unlink } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";

const MAX_SNAPSHOTS = 50;

export interface FileBackup {
	path: string;
	/** null = file did not exist before the tool call (will be deleted on undo) */
	backupName: string | null;
	version: number;
}

export interface FileSnapshot {
	id: number;
	timestamp: number;
	toolName: string;
	toolInput: Record<string, unknown>;
	backups: FileBackup[];
}

export class FileHistory {
	private snapshots: FileSnapshot[] = [];
	private sequence = 0;
	private backupDir: string;

	constructor(sessionId: string) {
		this.backupDir = join(os.homedir(), ".pi", "agent", "file-history", sessionId);
	}

	private getBackupName(filePath: string, version: number): string {
		const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 16);
		return `${hash}@v${version}`;
	}

	private resolveBackupPath(backupName: string): string {
		return join(this.backupDir, backupName);
	}

	/**
	 * Called in beforeToolCall for write/edit tools.
	 * Copies the current file content to a backup slot before the tool overwrites it.
	 */
	async trackBeforeToolCall(toolName: string, filePath: string, toolInput: Record<string, unknown>): Promise<void> {
		await mkdir(this.backupDir, { recursive: true });

		// Version = how many times we have snapshotted this path so far
		const existingCount = this.snapshots.flatMap((s) => s.backups).filter((b) => b.path === filePath).length;
		const version = existingCount + 1;

		const backupName = this.getBackupName(filePath, version);
		const backupPath = this.resolveBackupPath(backupName);

		let savedBackupName: string | null;
		try {
			await stat(filePath);
			// File exists — copy it (copyFile avoids reading into JS heap)
			await copyFile(filePath, backupPath);
			savedBackupName = backupName;
		} catch {
			// File does not exist yet (new file being created) — null marker
			savedBackupName = null;
		}

		this.snapshots.push({
			id: ++this.sequence,
			timestamp: Date.now(),
			toolName,
			toolInput,
			backups: [{ path: filePath, backupName: savedBackupName, version }],
		});

		// Evict oldest when over cap
		if (this.snapshots.length > MAX_SNAPSHOTS) {
			this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
		}
	}

	/** Pop the most recent snapshot and restore files. */
	async undo(): Promise<{ restored: string[]; message: string }> {
		if (this.snapshots.length === 0) {
			return { restored: [], message: "No snapshots to undo. Nothing has been tracked yet." };
		}

		const snapshot = this.snapshots.pop()!;
		const restored: string[] = [];

		for (const backup of snapshot.backups) {
			try {
				if (backup.backupName === null) {
					// File was created by this tool call — delete it
					try {
						await unlink(backup.path);
					} catch {
						/* already gone */
					}
					restored.push(`deleted ${backup.path}`);
				} else {
					const backupPath = this.resolveBackupPath(backup.backupName);
					await mkdir(dirname(backup.path), { recursive: true });
					await copyFile(backupPath, backup.path);
					restored.push(`restored ${backup.path}`);
				}
			} catch {
				// best-effort: never crash the undo operation
			}
		}

		const timeStr = new Date(snapshot.timestamp).toISOString();
		return {
			restored,
			message:
				"Undone: [" +
				snapshot.toolName +
				"] at " +
				timeStr +
				"\n" +
				(restored.length > 0 ? `Files: ${restored.join(", ")}` : "No files to restore (snapshot was empty)."),
		};
	}

	/** Return snapshots newest-first, up to limit. */
	list(limit = 10): FileSnapshot[] {
		return [...this.snapshots].reverse().slice(0, limit);
	}

	get size(): number {
		return this.snapshots.length;
	}
}

// ── Session-scoped singleton ──────────────────────────────────────────────────
let _instance: FileHistory | null = null;
let _currentSessionId: string | null = null;

export function getFileHistory(sessionId?: string): FileHistory {
	if (!_instance || (sessionId && sessionId !== _currentSessionId)) {
		_currentSessionId = sessionId ?? "default";
		_instance = new FileHistory(_currentSessionId);
	}
	return _instance;
}

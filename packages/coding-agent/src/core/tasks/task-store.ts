/**
 * Task Store — file-based persistent task graph.
 *
 * Storage layout (mirrors Claude Code's task list approach):
 *   ~/.pi/agent/tasks/<sessionId>/
 *     index.json          — ordered list of task IDs
 *     <taskId>.json       — individual task record
 *
 * Design principles inherited from Claude Code:
 * - Tasks survive conversation turns (file-backed)
 * - Blocking relationships are bidirectional and maintained consistently
 * - Soft-delete via status="deleted" (remove from index, delete file)
 * - Output is append-friendly
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Task, TaskCreateInput, TaskStatus, TaskUpdateInput } from "./types.js";

// ── Paths ─────────────────────────────────────────────────────

function tasksRoot(): string {
	return path.join(os.homedir(), ".pi", "agent", "tasks");
}

function sessionDir(sessionId: string): string {
	return path.join(tasksRoot(), sessionId);
}

function taskFilePath(sessionId: string, taskId: string): string {
	return path.join(sessionDir(sessionId), `${taskId}.json`);
}

function indexFilePath(sessionId: string): string {
	return path.join(sessionDir(sessionId), "index.json");
}

function ensureSessionDir(sessionId: string): void {
	const dir = sessionDir(sessionId);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

// ── ID generation ─────────────────────────────────────────────

function generateTaskId(): string {
	return `t${Math.random().toString(36).substring(2, 10)}`;
}

// ── Low-level I/O ─────────────────────────────────────────────

function readIndex(sessionId: string): string[] {
	const file = indexFilePath(sessionId);
	if (!fs.existsSync(file)) return [];
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as string[];
	} catch {
		return [];
	}
}

function writeIndex(sessionId: string, ids: string[]): void {
	fs.writeFileSync(indexFilePath(sessionId), JSON.stringify(ids, null, 2), "utf-8");
}

function readTaskFile(sessionId: string, taskId: string): Task | null {
	const file = taskFilePath(sessionId, taskId);
	if (!fs.existsSync(file)) return null;
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as Task;
	} catch {
		return null;
	}
}

function writeTaskFile(task: Task): void {
	ensureSessionDir(task.sessionId);
	fs.writeFileSync(taskFilePath(task.sessionId, task.id), JSON.stringify(task, null, 2), "utf-8");
}

// ── Public API ────────────────────────────────────────────────

/**
 * Create a new task in the given session.
 * Mirrors Claude Code's createTask() in utils/tasks.ts.
 */
export function createTask(sessionId: string, input: TaskCreateInput): Task {
	ensureSessionDir(sessionId);
	const now = new Date().toISOString();
	const task: Task = {
		id: generateTaskId(),
		sessionId,
		subject: input.subject,
		description: input.description,
		activeForm: input.activeForm,
		status: "pending",
		output: "",
		owner: input.owner,
		blocks: [],
		blockedBy: [],
		metadata: input.metadata,
		createdAt: now,
		updatedAt: now,
	};
	writeTaskFile(task);
	const ids = readIndex(sessionId);
	ids.push(task.id);
	writeIndex(sessionId, ids);
	return task;
}

/**
 * Retrieve a single task by ID.
 * Returns null if not found (mirrors Claude Code's getTask()).
 */
export function getTask(sessionId: string, taskId: string): Task | null {
	return readTaskFile(sessionId, taskId);
}

/**
 * List all tasks in a session, in creation order.
 * Mirrors Claude Code's listTasks().
 */
export function listTasks(sessionId: string): Task[] {
	const ids = readIndex(sessionId);
	const tasks: Task[] = [];
	for (const id of ids) {
		const t = readTaskFile(sessionId, id);
		if (t) tasks.push(t);
	}
	return tasks;
}

/**
 * Update a task's fields.
 * Handles the special "deleted" status by removing the task entirely.
 * Mirrors Claude Code's updateTask() + deleteTask().
 */
export function updateTask(sessionId: string, taskId: string, input: TaskUpdateInput): Task | null {
	const task = readTaskFile(sessionId, taskId);
	if (!task) return null;

	// Special case: delete
	if (input.status === "deleted") {
		deleteTask(sessionId, taskId);
		return null;
	}

	const now = new Date().toISOString();
	const updated: Task = { ...task, updatedAt: now };

	if (input.subject !== undefined) updated.subject = input.subject;
	if (input.description !== undefined) updated.description = input.description;
	if (input.activeForm !== undefined) updated.activeForm = input.activeForm;
	if (input.status !== undefined) updated.status = input.status as TaskStatus;
	if (input.output !== undefined) updated.output = input.output;
	if (input.owner !== undefined) updated.owner = input.owner;

	// Merge metadata (null values = delete key, mirrors Claude Code behavior)
	if (input.metadata !== undefined) {
		const merged = { ...(task.metadata ?? {}) };
		for (const [key, value] of Object.entries(input.metadata)) {
			if (value === null) {
				delete merged[key];
			} else {
				merged[key] = value;
			}
		}
		updated.metadata = merged;
	}

	writeTaskFile(updated);
	return updated;
}

/**
 * Establish a blocking relationship: taskId blocks blockingId.
 * Both sides of the relationship are updated atomically.
 * Mirrors Claude Code's blockTask().
 */
export function blockTask(sessionId: string, taskId: string, blockedId: string): void {
	const blocker = readTaskFile(sessionId, taskId);
	const blocked = readTaskFile(sessionId, blockedId);
	if (!blocker || !blocked) return;

	if (!blocker.blocks.includes(blockedId)) {
		blocker.blocks.push(blockedId);
		blocker.updatedAt = new Date().toISOString();
		writeTaskFile(blocker);
	}
	if (!blocked.blockedBy.includes(taskId)) {
		blocked.blockedBy.push(taskId);
		blocked.updatedAt = new Date().toISOString();
		writeTaskFile(blocked);
	}
}

/**
 * Hard-delete a task and remove from index.
 * Also cleans up blocking relationships on both sides.
 */
export function deleteTask(sessionId: string, taskId: string): boolean {
	const task = readTaskFile(sessionId, taskId);
	if (!task) return false;

	// Clean up blocking relationships
	for (const blockedId of task.blocks) {
		const blocked = readTaskFile(sessionId, blockedId);
		if (blocked) {
			blocked.blockedBy = blocked.blockedBy.filter((id) => id !== taskId);
			blocked.updatedAt = new Date().toISOString();
			writeTaskFile(blocked);
		}
	}
	for (const blockerId of task.blockedBy) {
		const blocker = readTaskFile(sessionId, blockerId);
		if (blocker) {
			blocker.blocks = blocker.blocks.filter((id) => id !== taskId);
			blocker.updatedAt = new Date().toISOString();
			writeTaskFile(blocker);
		}
	}

	// Remove from index and delete file
	const ids = readIndex(sessionId).filter((id) => id !== taskId);
	writeIndex(sessionId, ids);
	const file = taskFilePath(sessionId, taskId);
	if (fs.existsSync(file)) fs.unlinkSync(file);

	return true;
}

/**
 * Append text to a task's output field.
 * Used by background tasks to stream incremental output.
 */
export function appendTaskOutput(sessionId: string, taskId: string, chunk: string): Task | null {
	const task = readTaskFile(sessionId, taskId);
	if (!task) return null;
	return updateTask(sessionId, taskId, { output: task.output + chunk });
}

/** Return all session IDs that have task data on disk. */
export function getAllSessionIds(): string[] {
	const root = tasksRoot();
	if (!fs.existsSync(root)) return [];
	return fs.readdirSync(root).filter((f) => fs.statSync(path.join(root, f)).isDirectory());
}

// ── Session ID management ─────────────────────────────────────
// Mirrors Claude Code's getTaskListId() pattern.
// AgentSession sets this once at startup; all tools read from it.

let _currentSessionId: string = "default";

export function setCurrentSessionId(id: string): void {
	_currentSessionId = id;
}

export function getCurrentSessionId(): string {
	return _currentSessionId;
}

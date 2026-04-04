/**
 * Task type system — mirrors Claude Code's Task.ts architecture.
 *
 * Claude Code uses a rich task graph with status, blocking relationships,
 * ownership, and metadata. We inherit this design exactly.
 */

export type TaskStatus =
	| "pending" // created, not started
	| "in_progress" // actively being worked on
	| "completed" // finished successfully
	| "stopped" // explicitly cancelled
	| "failed"; // ended with error

export interface Task {
	/** Unique ID for this task (e.g. "t3f9a12b") */
	id: string;
	/** Session this task belongs to */
	sessionId: string;
	/** Short title shown in task list */
	subject: string;
	/** Full description of what needs to be done */
	description: string;
	/** Present-continuous form for spinner display (e.g. "Running tests") */
	activeForm?: string;
	/** Current execution status */
	status: TaskStatus;
	/** Accumulated output text */
	output: string;
	/** Agent/user who owns this task */
	owner?: string;
	/** IDs of tasks that this task blocks (this task must finish first) */
	blocks: string[];
	/** IDs of tasks that block this task (they must finish first) */
	blockedBy: string[];
	/** Arbitrary metadata bag */
	metadata?: Record<string, unknown>;
	/** ISO timestamp of creation */
	createdAt: string;
	/** ISO timestamp of last update */
	updatedAt: string;
}

export interface TaskCreateInput {
	subject: string;
	description: string;
	activeForm?: string;
	owner?: string;
	metadata?: Record<string, unknown>;
}

export interface TaskUpdateInput {
	subject?: string;
	description?: string;
	activeForm?: string;
	status?: TaskStatus | "deleted";
	output?: string;
	owner?: string;
	/** Task IDs that this task now blocks */
	addBlocks?: string[];
	/** Task IDs that now block this task */
	addBlockedBy?: string[];
	metadata?: Record<string, unknown>;
}

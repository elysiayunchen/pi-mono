import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

export interface TodoItem {
	id: string;
	content: string;
	status: "pending" | "in_progress" | "completed" | "cancelled";
	priority: "high" | "medium" | "low";
	createdAt: number;
	updatedAt: number;
}

const todoItemSchema = Type.Object({
	content: Type.String({ description: "Task description." }),
	status: Type.String({
		description: 'Task status: "pending", "in_progress", "completed", or "cancelled".',
	}),
	priority: Type.Optional(
		Type.String({
			description: 'Task priority: "high", "medium", or "low". Default: "medium".',
		}),
	),
});

const todoWriteSchema = Type.Object({
	todos: Type.Array(todoItemSchema, {
		description:
			"Full todo list. This REPLACES all existing todos — pass the complete desired state, " +
			"not an incremental diff. Each item requires content and status; priority is optional (defaults to medium).",
	}),
});

export type TodoWriteInput = { todos: Array<{ content: string; status: string; priority?: string }> };

// Shared state — set externally by AgentSession via setTodosRef()
let currentTodos: TodoItem[] = [];

export function setTodosRef(ref: TodoItem[]): void {
	currentTodos = ref;
}

export function getCurrentTodos(): TodoItem[] {
	return currentTodos.slice();
}

export function setCurrentTodos(todos: TodoItem[]): void {
	currentTodos.length = 0;
	currentTodos.push(...todos);
}

const DEFAULT_PRIORITY: TodoItem["priority"] = "medium";
const VALID_STATUSES = new Set<TodoItem["status"]>(["pending", "in_progress", "completed", "cancelled"]);
const VALID_PRIORITIES = new Set<TodoItem["priority"]>(["high", "medium", "low"]);

const STATUS_ICON: Record<TodoItem["status"], string> = {
	pending: "[ ]",
	in_progress: "[~]",
	completed: "[x]",
	cancelled: "[-]",
};

const PRIORITY_LABEL: Record<TodoItem["priority"], string> = {
	high: "🔴",
	medium: "🟡",
	low: "🟢",
};

function formatTodos(todos: TodoItem[]): string {
	if (todos.length === 0) {
		return "(empty)";
	}
	return todos
		.map((t) => {
			const icon = STATUS_ICON[t.status];
			const prio = t.priority !== "medium" ? ` ${PRIORITY_LABEL[t.priority]}` : "";
			return `${icon}${prio} ${t.id}. ${t.content}`;
		})
		.join("\n");
}

function normalizePriority(raw: string | undefined): TodoItem["priority"] {
	if (!raw) return DEFAULT_PRIORITY;
	const normalized = raw.trim().toLowerCase();
	return VALID_PRIORITIES.has(normalized as TodoItem["priority"])
		? (normalized as TodoItem["priority"])
		: DEFAULT_PRIORITY;
}

function normalizeStatus(raw: string): TodoItem["status"] {
	const normalized = raw.trim().toLowerCase();
	return VALID_STATUSES.has(normalized as TodoItem["status"]) ? (normalized as TodoItem["status"]) : "pending";
}

export const todoWriteToolDefinition: ToolDefinition<typeof todoWriteSchema> = {
	name: "todo_write",
	label: "Todo",
	description:
		"Create and manage a structured task list for your current coding session. " +
		"Use this tool PROACTIVELY in these scenarios:\n" +
		"1. Complex multi-step tasks (3 or more distinct steps)\n" +
		"2. Non-trivial tasks requiring careful planning or multiple operations\n" +
		"3. User provides multiple tasks (numbered or comma-separated)\n" +
		"4. After receiving new instructions — capture requirements as todos\n" +
		"5. When starting work on a task — mark it as in_progress BEFORE beginning\n" +
		"6. After completing a task — mark it as completed immediately\n\n" +
		"Do NOT use for trivial tasks (< 3 steps) or purely conversational exchanges.\n\n" +
		"IMPORTANT: The `todos` array IS the complete list — it replaces all existing todos. " +
		"Always include ALL tasks (old and new) in every call, not just the ones you want to change.",
	promptSnippet: "Manage a structured task list (create, update, track progress)",
	parameters: todoWriteSchema,

	isEnabled(): boolean {
		return true;
	},

	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		const now = Date.now();
		const oldTodos = currentTodos.slice();

		// Normalize and deduplicate incoming todos
		const incoming = (params.todos ?? []).map((raw, index) => {
			const status = normalizeStatus(raw.status);
			const priority = normalizePriority(raw.priority);
			return {
				id: String(index + 1),
				content: raw.content.trim(),
				status,
				priority,
				createdAt: now,
				updatedAt: now,
			} satisfies TodoItem;
		});

		// Preserve creation timestamps for items that carry over from old list.
		// Match by content (case-insensitive) since IDs always regenerate.
		const oldByContent = new Map<string, TodoItem>();
		for (const old of oldTodos) {
			const key = old.content.trim().toLowerCase();
			if (!oldByContent.has(key)) {
				oldByContent.set(key, old);
			}
		}
		for (const item of incoming) {
			const key = item.content.trim().toLowerCase();
			const preserved = oldByContent.get(key);
			if (preserved) {
				item.createdAt = preserved.createdAt;
			}
		}

		// Replace current todos
		currentTodos.length = 0;
		currentTodos.push(...incoming);

		const newTodos = currentTodos.slice();

		// Verification nudge: when all tasks are done with 3+ items and no verification step
		const allDone = newTodos.length > 0 && newTodos.every((t) => t.status === "completed");
		const hasVerification = newTodos.some((t) => /verif/i.test(t.content));
		const verificationNudgeNeeded = allDone && newTodos.length >= 3 && !hasVerification;

		let nudge = "";
		if (verificationNudgeNeeded) {
			nudge = `\n\nNOTE: You closed out ${newTodos.length} tasks. Before reporting completion, verify the work actually functions correctly — run the tests, execute the script, check the output.`;
		}

		const formatted = formatTodos(newTodos);

		return {
			content: [{ type: "text", text: `Current plan:\n\n${formatted}${nudge}` }],
			details: {
				action: "replace",
				todos: newTodos,
				oldTodos,
				newTodos,
				verificationNudgeNeeded,
			},
		};
	},
};

export const todoWriteTool: AgentTool<typeof todoWriteSchema> = wrapToolDefinition(todoWriteToolDefinition);

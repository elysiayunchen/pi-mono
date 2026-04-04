import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

interface TodoItem {
	id: string;
	description: string;
	status: "pending" | "in_progress" | "completed" | "cancelled";
	createdAt: number;
	updatedAt: number;
}

const schema = Type.Object({
	action: Type.String({
		description:
			'Operation: "create" (new list), "update" (change status), "add" (append items), "list" (show current)',
	}),
	items: Type.Optional(
		Type.Array(Type.String(), { description: 'For "create" and "add": list of step descriptions' }),
	),
	updates: Type.Optional(
		Type.Array(
			Type.Object({
				id: Type.String(),
				status: Type.String(),
			}),
			{ description: 'For "update": list of {id, status} changes' },
		),
	),
});

// Shared state — set externally by AgentSession via setTodosRef()
let currentTodos: TodoItem[] = [];

export function setTodosRef(ref: TodoItem[]): void {
	currentTodos = ref;
}

export function getCurrentTodos(): TodoItem[] {
	return currentTodos.slice();
}

export function setCurrentTodos(todos: TodoItem[]): void {
	currentTodos = todos.slice();
}

function formatTodos(todos: TodoItem[]): string {
	const statusIcon: Record<string, string> = {
		pending: "[ ]",
		in_progress: "[~]",
		completed: "[x]",
		cancelled: "[-]",
	};
	return todos.map((t) => `${statusIcon[t.status]} ${t.id}. ${t.description}`).join("\n");
}

export const todoWriteToolDefinition: ToolDefinition<typeof schema> = {
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
		"Do NOT use for trivial tasks (< 3 steps) or purely conversational exchanges.",
	promptSnippet: "Manage a task list (create, update, add, list)",
	parameters: schema,

	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		const now = Date.now();

		switch (params.action) {
			case "create": {
				const newTodos = (params.items ?? []).map((desc, i) => ({
					id: String(i + 1),
					description: desc,
					status: "pending" as const,
					createdAt: now,
					updatedAt: now,
				}));
				currentTodos.length = 0;
				currentTodos.push(...newTodos);
				break;
			}
			case "add": {
				const startId = currentTodos.length + 1;
				const newItems = (params.items ?? []).map((desc, i) => ({
					id: String(startId + i),
					description: desc,
					status: "pending" as const,
					createdAt: now,
					updatedAt: now,
				}));
				currentTodos.push(...newItems);
				break;
			}
			case "update": {
				for (const update of params.updates ?? []) {
					const item = currentTodos.find((t) => t.id === update.id);
					if (item) {
						item.status = update.status as TodoItem["status"];
						item.updatedAt = now;
					}
				}
				break;
			}
			case "list":
				break;
		}

		const formatted = formatTodos(currentTodos);

		// Verification nudge: when all tasks are done with 3+ items and no verification step
		const allDone = currentTodos.length > 0 && currentTodos.every((t) => t.status === "completed");
		const hasVerification = currentTodos.some((t) => /verif/i.test(t.description));
		let nudge = "";
		if (allDone && currentTodos.length >= 3 && !hasVerification) {
			nudge = `\n\nNOTE: You closed out ${currentTodos.length} tasks. Before reporting completion, verify the work actually functions correctly — run the tests, execute the script, check the output.`;
		}

		return {
			content: [{ type: "text", text: `Current plan:\n\n${formatted}${nudge}` }],
			details: { action: params.action, todos: currentTodos.slice() },
		};
	},
};

export const todoWriteTool: AgentTool<typeof schema> = wrapToolDefinition(todoWriteToolDefinition);

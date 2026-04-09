export {
	type BashOperations,
	type BashSpawnContext,
	type BashSpawnHook,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	bashTool,
	bashToolDefinition,
	createBashTool,
	createBashToolDefinition,
	createLocalBashOperations,
} from "./bash.js";
export {
	createEditTool,
	createEditToolDefinition,
	type EditOperations,
	type EditToolDetails,
	type EditToolInput,
	type EditToolOptions,
	editTool,
	editToolDefinition,
} from "./edit.js";
export {
	enterPlanModeTool,
	enterPlanModeToolDefinition,
} from "./enter-plan-mode.js";
export {
	exitPlanModeTool,
	exitPlanModeToolDefinition,
} from "./exit-plan-mode.js";
export {
	enterCodeModeTool,
	enterCodeModeToolDefinition,
} from "./enter-code-mode.js";
export {
	exitCodeModeTool,
	exitCodeModeToolDefinition,
} from "./exit-code-mode.js";
export { withFileMutationQueue } from "./file-mutation-queue.js";
export {
	createFindTool,
	createFindToolDefinition,
	type FindOperations,
	type FindToolDetails,
	type FindToolInput,
	type FindToolOptions,
	findTool,
	findToolDefinition,
} from "./find.js";
export {
	createGrepTool,
	createGrepToolDefinition,
	type GrepOperations,
	type GrepToolDetails,
	type GrepToolInput,
	type GrepToolOptions,
	grepTool,
	grepToolDefinition,
} from "./grep.js";
export {
	createLsTool,
	createLsToolDefinition,
	type LsOperations,
	type LsToolDetails,
	type LsToolInput,
	type LsToolOptions,
	lsTool,
	lsToolDefinition,
} from "./ls.js";
export {
	createReadTool,
	createReadToolDefinition,
	type ReadOperations,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
	readTool,
	readToolDefinition,
} from "./read.js";
export { taskCreateTool, taskCreateToolDefinition } from "./task-create.js";
export { taskGetTool, taskGetToolDefinition } from "./task-get.js";
export { taskListTool, taskListToolDefinition } from "./task-list.js";
export { taskUpdateTool, taskUpdateToolDefinition } from "./task-update.js";
export {
	todoWriteTool,
	todoWriteToolDefinition,
} from "./todo-write.js";
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationOptions,
	type TruncationResult,
	truncateHead,
	truncateLine,
	truncateTail,
} from "./truncate.js";
export {
	createWriteTool,
	createWriteToolDefinition,
	type WriteOperations,
	type WriteToolInput,
	type WriteToolOptions,
	writeTool,
	writeToolDefinition,
} from "./write.js";

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ToolDefinition } from "../extensions/types.js";
import {
	type BashToolOptions,
	bashTool,
	bashToolDefinition,
	createBashTool,
	createBashToolDefinition,
} from "./bash.js";
import { createEditTool, createEditToolDefinition, editTool, editToolDefinition } from "./edit.js";
import { enterPlanModeTool, enterPlanModeToolDefinition } from "./enter-plan-mode.js";
import { exitPlanModeTool, exitPlanModeToolDefinition } from "./exit-plan-mode.js";
import { enterCodeModeTool, enterCodeModeToolDefinition } from "./enter-code-mode.js";
import { exitCodeModeTool, exitCodeModeToolDefinition } from "./exit-code-mode.js";
import { createFindTool, createFindToolDefinition, findTool, findToolDefinition } from "./find.js";
import { createGrepTool, createGrepToolDefinition, grepTool, grepToolDefinition } from "./grep.js";
import { createLsTool, createLsToolDefinition, lsTool, lsToolDefinition } from "./ls.js";
import {
	createReadTool,
	createReadToolDefinition,
	type ReadToolOptions,
	readTool,
	readToolDefinition,
} from "./read.js";
import { taskCreateTool, taskCreateToolDefinition } from "./task-create.js";
import { taskGetTool, taskGetToolDefinition } from "./task-get.js";
import { taskUpdateTool, taskUpdateToolDefinition } from "./task-update.js";

export { enterWorktreeTool, enterWorktreeToolDefinition } from "./enter-worktree.js";
export { exitWorktreeTool, exitWorktreeToolDefinition } from "./exit-worktree.js";
export { fileHistoryListTool, fileHistoryListToolDefinition } from "./file-history-list.js";
export { modelSpeedProbeTool, modelSpeedProbeToolDefinition } from "./model-speed-probe.js";
export { sendMessageTool, sendMessageToolDefinition } from "./send-message.js";
export { taskAssignTool, taskAssignToolDefinition } from "./task-assign.js";
export { taskOutputTool, taskOutputToolDefinition } from "./task-output.js";
export { taskStopTool, taskStopToolDefinition } from "./task-stop.js";
export { teamCreateTool, teamCreateToolDefinition } from "./team-create.js";
export { teamDeleteTool, teamDeleteToolDefinition } from "./team-delete.js";
export { teamListTool, teamListToolDefinition } from "./team-list.js";
export { undoActionTool, undoActionToolDefinition } from "./undo-action.js";

import { fileHistoryListTool, fileHistoryListToolDefinition } from "./file-history-list.js";
import { sendMessageTool, sendMessageToolDefinition } from "./send-message.js";
import { taskAssignTool, taskAssignToolDefinition } from "./task-assign.js";
import { taskListTool, taskListToolDefinition } from "./task-list.js";
import { taskOutputTool, taskOutputToolDefinition } from "./task-output.js";
import { taskStopTool, taskStopToolDefinition } from "./task-stop.js";
import { teamCreateTool, teamCreateToolDefinition } from "./team-create.js";
import { teamDeleteTool, teamDeleteToolDefinition } from "./team-delete.js";
import { teamListTool, teamListToolDefinition } from "./team-list.js";
import { todoWriteTool, todoWriteToolDefinition } from "./todo-write.js";
import { undoActionTool, undoActionToolDefinition } from "./undo-action.js";
import { createWriteTool, createWriteToolDefinition, writeTool, writeToolDefinition } from "./write.js";
import { enterWorktreeTool, enterWorktreeToolDefinition } from "./enter-worktree.js";
import { exitWorktreeTool, exitWorktreeToolDefinition } from "./exit-worktree.js";
import { modelSpeedProbeTool, modelSpeedProbeToolDefinition } from "./model-speed-probe.js";
import { webFetchTool, webFetchToolDefinition } from "./web-fetch.js";

export type Tool = AgentTool<any>;
export type ToolDef = ToolDefinition<any, any>;

export const codingTools: Tool[] = [readTool, bashTool, editTool, writeTool];
export const readOnlyTools: Tool[] = [readTool, grepTool, findTool, lsTool];

export const allTools = {
	read: readTool,
	bash: bashTool,
	edit: editTool,
	write: writeTool,
	grep: grepTool,
	find: findTool,
	ls: lsTool,
	enter_plan_mode: enterPlanModeTool,
	exit_plan_mode: exitPlanModeTool,
	enter_code_mode: enterCodeModeTool,
	exit_code_mode: exitCodeModeTool,
	todo_write: todoWriteTool,
	task_create: taskCreateTool,
	task_get: taskGetTool,
	task_update: taskUpdateTool,
	task_list: taskListTool,
	task_stop: taskStopTool,
	task_output: taskOutputTool,
	team_create: teamCreateTool,
	team_delete: teamDeleteTool,
	team_list: teamListTool,
	send_message: sendMessageTool,
	task_assign: taskAssignTool,
	undo_last_action: undoActionTool,
	file_history_list: fileHistoryListTool,
	enter_worktree: enterWorktreeTool,
	exit_worktree: exitWorktreeTool,
	model_speed_probe: modelSpeedProbeTool,
};

export const allToolDefinitions = {
	read: readToolDefinition,
	bash: bashToolDefinition,
	edit: editToolDefinition,
	write: writeToolDefinition,
	grep: grepToolDefinition,
	find: findToolDefinition,
	ls: lsToolDefinition,
	enter_plan_mode: enterPlanModeToolDefinition,
	exit_plan_mode: exitPlanModeToolDefinition,
	enter_code_mode: enterCodeModeToolDefinition,
	exit_code_mode: exitCodeModeToolDefinition,
	todo_write: todoWriteToolDefinition,
	task_create: taskCreateToolDefinition,
	task_get: taskGetToolDefinition,
	task_update: taskUpdateToolDefinition,
	task_list: taskListToolDefinition,
	task_stop: taskStopToolDefinition,
	task_output: taskOutputToolDefinition,
	team_create: teamCreateToolDefinition,
	team_delete: teamDeleteToolDefinition,
	team_list: teamListToolDefinition,
	send_message: sendMessageToolDefinition,
	task_assign: taskAssignToolDefinition,
	undo_last_action: undoActionToolDefinition,
	file_history_list: fileHistoryListToolDefinition,
	enter_worktree: enterWorktreeToolDefinition,
	exit_worktree: exitWorktreeToolDefinition,
	model_speed_probe: modelSpeedProbeToolDefinition,
};

export type ToolName = keyof typeof allTools;

export interface ToolsOptions {
	read?: ReadToolOptions;
	bash?: BashToolOptions;
}

export function createCodingToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createBashToolDefinition(cwd, options?.bash),
		createEditToolDefinition(cwd),
		createWriteToolDefinition(cwd),
	];
}

export function createReadOnlyToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createGrepToolDefinition(cwd),
		createFindToolDefinition(cwd),
		createLsToolDefinition(cwd),
	];
}

export function createAllToolDefinitions(cwd: string, options?: ToolsOptions): Record<string, ToolDef> {
	return {
		read: createReadToolDefinition(cwd, options?.read),
		bash: createBashToolDefinition(cwd, options?.bash),
		edit: createEditToolDefinition(cwd),
		write: createWriteToolDefinition(cwd),
		grep: createGrepToolDefinition(cwd),
		find: createFindToolDefinition(cwd),
		ls: createLsToolDefinition(cwd),
		enter_plan_mode: enterPlanModeToolDefinition,
		exit_plan_mode: exitPlanModeToolDefinition,
		enter_code_mode: enterCodeModeToolDefinition,
		exit_code_mode: exitCodeModeToolDefinition,
		todo_write: todoWriteToolDefinition,
		task_create: taskCreateToolDefinition,
		task_get: taskGetToolDefinition,
		task_update: taskUpdateToolDefinition,
		task_list: taskListToolDefinition,
		task_stop: taskStopToolDefinition,
		task_output: taskOutputToolDefinition,
		team_create: teamCreateToolDefinition,
		team_delete: teamDeleteToolDefinition,
		team_list: teamListToolDefinition,
		send_message: sendMessageToolDefinition,
		task_assign: taskAssignToolDefinition,
		undo_last_action: undoActionToolDefinition,
		file_history_list: fileHistoryListToolDefinition,
		enter_worktree: enterWorktreeToolDefinition,
		exit_worktree: exitWorktreeToolDefinition,
		model_speed_probe: modelSpeedProbeToolDefinition,
	};
}

export function createCodingTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createBashTool(cwd, options?.bash),
		createEditTool(cwd),
		createWriteTool(cwd),
	];
}

export function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [createReadTool(cwd, options?.read), createGrepTool(cwd), createFindTool(cwd), createLsTool(cwd)];
}

export function createAllTools(cwd: string, options?: ToolsOptions): Record<string, Tool> {
	return {
		read: createReadTool(cwd, options?.read),
		bash: createBashTool(cwd, options?.bash),
		edit: createEditTool(cwd),
		write: createWriteTool(cwd),
		grep: createGrepTool(cwd),
		find: createFindTool(cwd),
		ls: createLsTool(cwd),
		enter_plan_mode: enterPlanModeTool,
		exit_plan_mode: exitPlanModeTool,
		enter_code_mode: enterCodeModeTool,
		exit_code_mode: exitCodeModeTool,
		todo_write: todoWriteTool,
		task_create: taskCreateTool,
		task_get: taskGetTool,
		task_update: taskUpdateTool,
		task_list: taskListTool,
		task_stop: taskStopTool,
		task_output: taskOutputTool,
		team_create: teamCreateTool,
		team_delete: teamDeleteTool,
		team_list: teamListTool,
		send_message: sendMessageTool,
		task_assign: taskAssignTool,
		undo_last_action: undoActionTool,
		file_history_list: fileHistoryListTool,
		enter_worktree: enterWorktreeTool,
		exit_worktree: exitWorktreeTool,
		model_speed_probe: modelSpeedProbeTool,
	};
}


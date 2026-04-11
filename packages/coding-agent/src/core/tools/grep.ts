import { createInterface } from "node:readline";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { spawn } from "child_process";
import { readFileSync, statSync } from "fs";
import path from "path";
import { keyHint } from "../../modes/interactive/components/keybinding-hints.js";
import { ensureTool } from "../../utils/tools-manager.js";
import type { ToolDefinition, ToolRenderResultOptions } from "../extensions/types.js";
import { resolveToCwd } from "./path-utils.js";
import { getTextOutput, invalidArgText, shortenPath, str } from "./render-utils.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";
import {
	DEFAULT_MAX_BYTES,
	formatSize,
	GREP_MAX_LINE_LENGTH,
	type TruncationResult,
	truncateHead,
	truncateLine,
} from "./truncate.js";

const grepSchema = Type.Object({
	pattern: Type.String({ description: "Search pattern (regex or literal string)" }),
	path: Type.Optional(Type.String({ description: "Directory or file to search (default: current directory)" })),
	glob: Type.Optional(Type.String({ description: "Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'" })),
	ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search (default: false)" })),
	literal: Type.Optional(
		Type.Boolean({ description: "Treat pattern as literal string instead of regex (default: false)" }),
	),
	context: Type.Optional(
		Type.Number({ description: "Number of lines to show before and after each match (default: 0)" }),
	),
	limit: Type.Optional(Type.Number({ description: "Maximum number of matches to return (default: 100)" })),
	"-A": Type.Optional(Type.Number({ description: "Lines after each match (rg -A). Requires output_mode: content" })),
	"-B": Type.Optional(Type.Number({ description: "Lines before each match (rg -B). Requires output_mode: content" })),
	output_mode: Type.Optional(
		Type.Union([Type.Literal("content"), Type.Literal("files_with_matches"), Type.Literal("count")], {
			description: "content: matching lines (default), files_with_matches: paths only, count: per-file counts",
		}),
	),
	type: Type.Optional(
		Type.String({ description: "File type filter (rg --type). Common: js, py, ts, rust, go, java" }),
	),
	head_limit: Type.Optional(Type.Number({ description: "Max matches (default: 250). 0 = unlimited" })),
	offset: Type.Optional(Type.Number({ description: "Skip first N matches (default: 0)" })),
	multiline: Type.Optional(Type.Boolean({ description: "Multiline mode (rg -U --multiline-dotall)" })),
});

export type GrepToolInput = Static<typeof grepSchema>;
const DEFAULT_HEAD_LIMIT = 250;

export interface GrepToolDetails {
	truncation?: TruncationResult;
	matchLimitReached?: number;
	linesTruncated?: boolean;
}

/**
 * Pluggable operations for the grep tool.
 * Override these to delegate search to remote systems (for example SSH).
 */
export interface GrepOperations {
	/** Check if path is a directory. Throws if path does not exist. */
	isDirectory: (absolutePath: string) => Promise<boolean> | boolean;
	/** Read file contents for context lines */
	readFile: (absolutePath: string) => Promise<string> | string;
}

const defaultGrepOperations: GrepOperations = {
	isDirectory: (p) => statSync(p).isDirectory(),
	readFile: (p) => readFileSync(p, "utf-8"),
};

export interface GrepToolOptions {
	/** Custom operations for grep. Default: local filesystem plus ripgrep */
	operations?: GrepOperations;
}

function formatGrepCall(
	args: { pattern: string; path?: string; glob?: string; limit?: number } | undefined,
	theme: typeof import("../../modes/interactive/theme/theme.js").theme,
): string {
	const pattern = str(args?.pattern);
	const rawPath = str(args?.path);
	const path = rawPath !== null ? shortenPath(rawPath || ".") : null;
	const glob = str(args?.glob);
	const limit = args?.limit;
	const invalidArg = invalidArgText(theme);
	let text =
		theme.fg("toolTitle", theme.bold("grep")) +
		" " +
		(pattern === null ? invalidArg : theme.fg("accent", `/${pattern || ""}/`)) +
		theme.fg("toolOutput", ` in ${path === null ? invalidArg : path}`);
	if (glob) text += theme.fg("toolOutput", ` (${glob})`);
	if (limit !== undefined) text += theme.fg("toolOutput", ` limit ${limit}`);
	return text;
}

function formatGrepResult(
	result: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		details?: GrepToolDetails;
	},
	options: ToolRenderResultOptions,
	theme: typeof import("../../modes/interactive/theme/theme.js").theme,
	showImages: boolean,
): string {
	const output = getTextOutput(result, showImages).trim();
	let text = "";
	if (output) {
		const lines = output.split("\n");
		const maxLines = options.expanded ? lines.length : 15;
		const displayLines = lines.slice(0, maxLines);
		const remaining = lines.length - maxLines;
		text += `\n${displayLines.map((line) => theme.fg("toolOutput", line)).join("\n")}`;
		if (remaining > 0) {
			text += `${theme.fg("muted", `\n... (${remaining} more lines,`)} ${keyHint("app.tools.expand", "to expand")})`;
		}
	}

	const matchLimit = result.details?.matchLimitReached;
	const truncation = result.details?.truncation;
	const linesTruncated = result.details?.linesTruncated;
	if (matchLimit || truncation?.truncated || linesTruncated) {
		const warnings: string[] = [];
		if (matchLimit) warnings.push(`${matchLimit} matches limit`);
		if (truncation?.truncated) warnings.push(`${formatSize(truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit`);
		if (linesTruncated) warnings.push("some lines truncated");
		text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
	}
	return text;
}

export function createGrepToolDefinition(
	cwd: string,
	options?: GrepToolOptions,
): ToolDefinition<typeof grepSchema, GrepToolDetails | undefined> {
	const customOps = options?.operations;
	return {
		name: "grep",
		label: "grep",
		description: `Search file contents using ripgrep. Modes: content (lines+context), files_with_matches (paths), count (per-file counts). Supports -A/-B, --type, multiline, offset/head_limit. Respects .gitignore. Truncated at ${DEFAULT_HEAD_LIMIT} matches or ${DEFAULT_MAX_BYTES / 1024}KB.`,
		isConcurrencySafe: () => true,
		isReadOnly: () => true,
		promptSnippet: "Search file contents for patterns (respects .gitignore)",
		parameters: grepSchema,
		async execute(
			_toolCallId,
			{
				pattern,
				path: searchDir,
				glob,
				ignoreCase,
				literal,
				context,
				"-A": afterContext,
				"-B": beforeContext,
				output_mode: outputMode,
				type: fileType,
				head_limit: headLimitParam,
				limit: limitCompat,
				offset,
				multiline,
			}: GrepToolInput,
			signal?: AbortSignal,
			_onUpdate?,
			_ctx?,
		) {
			return new Promise((resolve, reject) => {
				if (signal?.aborted) {
					reject(new Error("Operation aborted"));
					return;
				}
				let settled = false;
				const settle = (fn: () => void) => {
					if (!settled) {
						settled = true;
						fn();
					}
				};

				(async () => {
					try {
						const rgPath = await ensureTool("rg", true);
						if (!rgPath) {
							settle(() => reject(new Error("ripgrep (rg) is not available and could not be downloaded")));
							return;
						}

						const searchPath = resolveToCwd(searchDir || ".", cwd);
						const ops = customOps ?? defaultGrepOperations;
						let isDirectory: boolean;
						try {
							isDirectory = await ops.isDirectory(searchPath);
						} catch {
							settle(() => reject(new Error(`Path not found: ${searchPath}`)));
							return;
						}

						const contextValue = context && context > 0 ? context : 0;
						const formatPath = (filePath: string): string => {
							if (isDirectory) {
								const relative = path.relative(searchPath, filePath);
								if (relative && !relative.startsWith("..")) {
									return relative.replace(/\\/g, "/");
								}
							}
							return path.basename(filePath);
						};

						const fileCache = new Map<string, string[]>();
						const getFileLines = async (filePath: string): Promise<string[]> => {
							let lines = fileCache.get(filePath);
							if (!lines) {
								try {
									const content = await ops.readFile(filePath);
									lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
								} catch {
									lines = [];
								}
								fileCache.set(filePath, lines);
							}
							return lines;
						};

						const mode = outputMode ?? "content";
						const effectiveHeadLimit = headLimitParam ?? limitCompat ?? DEFAULT_HEAD_LIMIT;
						const effectiveOffset = offset ?? 0;

						const args: string[] = ["--color=never", "--hidden"];
						for (const vcsDir of [".git", ".svn", ".hg", ".bzr", ".jj", ".sl"]) args.push("--glob", `!${vcsDir}`);
						args.push("--max-columns", "500");
						if (multiline) args.push("-U", "--multiline-dotall");
						if (ignoreCase) args.push("--ignore-case");
						if (literal) args.push("--fixed-strings");
						if (fileType) args.push("--type", fileType);
						if (mode === "files_with_matches") {
							args.push("-l");
						} else if (mode === "count") {
							args.push("--count");
						} else {
							args.push("--json", "--line-number");
							if (context && context > 0) {
								args.push("-C", context.toString());
							} else {
								if (afterContext !== undefined) args.push("-A", afterContext.toString());
								if (beforeContext !== undefined) args.push("-B", beforeContext.toString());
							}
						}
						if (glob) args.push("--glob", glob);
						if (pattern.startsWith("-")) args.push("-e", pattern);
						else args.push(pattern);
						args.push(searchPath);

						const child = spawn(rgPath, args, { stdio: ["ignore", "pipe", "pipe"] });
						const rl = createInterface({ input: child.stdout });
						let stderr = "";
						let matchCount = 0;
						let matchLimitReached = false;
						let linesTruncated = false;
						let aborted = false;
						let killedDueToLimit = false;
						const outputLines: string[] = [];

						const cleanup = () => {
							rl.close();
							signal?.removeEventListener("abort", onAbort);
						};
						const stopChild = (dueToLimit = false) => {
							if (!child.killed) {
								killedDueToLimit = dueToLimit;
								child.kill();
							}
						};
						const onAbort = () => {
							aborted = true;
							stopChild();
						};
						signal?.addEventListener("abort", onAbort, { once: true });
						child.stderr?.on("data", (chunk) => {
							stderr += chunk.toString();
						});

						const formatBlock = async (filePath: string, lineNumber: number): Promise<string[]> => {
							const relativePath = formatPath(filePath);
							const lines = await getFileLines(filePath);
							if (!lines.length) return [`${relativePath}:${lineNumber}: (unable to read file)`];
							const block: string[] = [];
							const ctxBefore = beforeContext ?? contextValue;
							const ctxAfter = afterContext ?? contextValue;
							const start = ctxBefore > 0 ? Math.max(1, lineNumber - ctxBefore) : lineNumber;
							const end = ctxAfter > 0 ? Math.min(lines.length, lineNumber + ctxAfter) : lineNumber;
							for (let current = start; current <= end; current++) {
								const lineText = lines[current - 1] ?? "";
								const sanitized = lineText.replace(/\r/g, "");
								const isMatchLine = current === lineNumber;
								// Truncate long lines so grep output stays compact.
								const { text: truncatedText, wasTruncated } = truncateLine(sanitized);
								if (wasTruncated) linesTruncated = true;
								if (isMatchLine) block.push(`${relativePath}:${current}: ${truncatedText}`);
								else block.push(`${relativePath}-${current}- ${truncatedText}`);
							}
							return block;
						};

						// Collect matches during streaming, then format them after rg exits.
						const matches: Array<{ filePath: string; lineNumber: number }> = [];
						rl.on("line", (line) => {
							if (!line.trim() || (effectiveHeadLimit > 0 && matchCount >= effectiveHeadLimit)) return;
							if (mode === "files_with_matches" || mode === "count") {
								matchCount++;
								outputLines.push(line);
								if (effectiveHeadLimit > 0 && matchCount >= effectiveHeadLimit) {
									matchLimitReached = true;
									stopChild(true);
								}
								return;
							}
							let event: any;
							try {
								event = JSON.parse(line);
							} catch {
								return;
							}
							if (event.type === "match") {
								matchCount++;
								const filePath = event.data?.path?.text;
								const lineNumber = event.data?.line_number;
								if (filePath && typeof lineNumber === "number") matches.push({ filePath, lineNumber });
								if (effectiveHeadLimit > 0 && matchCount >= effectiveHeadLimit) {
									matchLimitReached = true;
									stopChild(true);
								}
							}
						});

						child.on("error", (error) => {
							cleanup();
							settle(() => reject(new Error(`Failed to run ripgrep: ${error.message}`)));
						});
						child.on("close", async (code) => {
							cleanup();
							if (aborted) {
								settle(() => reject(new Error("Operation aborted")));
								return;
							}
							if (!killedDueToLimit && code !== 0 && code !== 1) {
								const errorMsg = stderr.trim() || `ripgrep exited with code ${code}`;
								settle(() => reject(new Error(errorMsg)));
								return;
							}
							if (matchCount === 0) {
								settle(() =>
									resolve({ content: [{ type: "text", text: "No matches found" }], details: undefined }),
								);
								return;
							}

							if (mode === "files_with_matches" && outputLines.length > 0) {
								const fileStats = await Promise.allSettled(outputLines.map((filePath) => statSync(filePath)));
								outputLines.sort((a, b) => {
									const statA = fileStats[outputLines.indexOf(a)];
									const statB = fileStats[outputLines.indexOf(b)];
									const mtimeA = statA.status === "fulfilled" ? statA.value.mtimeMs : 0;
									const mtimeB = statB.status === "fulfilled" ? statB.value.mtimeMs : 0;
									return mtimeB - mtimeA;
								});
							}
							if (mode === "content") {
								for (const match of matches) {
									const block = await formatBlock(match.filePath, match.lineNumber);
									outputLines.push(...block);
								}
							}

							// Don't limit output lines by head_limit — matches are already limited in rl.on("line").
							// DEFAULT_MAX_BYTES (50KB) serves as the safety net for total output size.
							const slicedOutput = effectiveOffset > 0 ? outputLines.slice(effectiveOffset) : outputLines;
							let rawOutput = slicedOutput.join("\n");
							if (mode === "count" && slicedOutput.length > 0) {
								let totalMatches = 0;
								let fileCount = 0;
								for (const line of slicedOutput) {
									const lastColon = line.lastIndexOf(":");
									if (lastColon > 0) {
										const count = parseInt(line.substring(lastColon + 1), 10);
										if (!Number.isNaN(count)) {
											totalMatches += count;
											fileCount++;
										}
									}
								}
								rawOutput +=
									"\n\nFound " +
									totalMatches +
									" total " +
									(totalMatches === 1 ? "occurrence" : "occurrences") +
									" across " +
									fileCount +
									" " +
									(fileCount === 1 ? "file" : "files") +
									".\n";
							}
							const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
							let output = truncation.content;
							const details: GrepToolDetails = {};
							// Build actionable notices for truncation and match limits.
							const notices: string[] = [];
							if (matchLimitReached) {
								notices.push(
									`${effectiveHeadLimit} matches limit reached. Use limit=${effectiveHeadLimit * 2} for more, or refine pattern`,
								);
								details.matchLimitReached = effectiveHeadLimit;
							}
							if (truncation.truncated) {
								notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
								details.truncation = truncation;
							}
							if (linesTruncated) {
								notices.push(
									`Some lines truncated to ${GREP_MAX_LINE_LENGTH} chars. Use read tool to see full lines`,
								);
								details.linesTruncated = true;
							}
							if (notices.length > 0) output += `\n\n[${notices.join(". ")}]`;
							settle(() =>
								resolve({
									content: [{ type: "text", text: output }],
									details: Object.keys(details).length > 0 ? details : undefined,
								}),
							);
						});
					} catch (err) {
						settle(() => reject(err as Error));
					}
				})();
			});
		},
		renderCall(args, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(formatGrepCall(args, theme));
			return text;
		},
		renderResult(result, options, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(formatGrepResult(result as any, options, theme, context.showImages));
			return text;
		},
	};
}

export function createGrepTool(cwd: string, options?: GrepToolOptions): AgentTool<typeof grepSchema> {
	return wrapToolDefinition(createGrepToolDefinition(cwd, options));
}

/** Default grep tool using process.cwd() for backwards compatibility. */
export const grepToolDefinition = createGrepToolDefinition(process.cwd());
export const grepTool = createGrepTool(process.cwd());

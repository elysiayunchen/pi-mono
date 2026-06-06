/**
 * Tool Parity Task 1 — GrepTool 参数补全验证。
 *
 * 覆盖 Task 1 新增/补全的能力（此前 tools.test.ts 仅测了单文件名 + limit/context）：
 *   - output_mode: files_with_matches / count
 *   - -A / -B 上下文行
 *   - type 文件类型过滤
 *   - offset 分页
 *   - multiline 跨行匹配
 *   - head_limit 匹配上限 + matchLimitReached 通知
 *   - 能力声明 isConcurrencySafe / isReadOnly
 *
 * 用真实 ripgrep（与运行时一致），不 mock，验证端到端行为。
 */
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGrepTool } from "../src/core/tools/grep.js";

function getTextOutput(result: any): string {
	return (
		result.content
			?.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join("\n") || ""
	);
}

describe("GrepTool — Task 1 parity", () => {
	let testDir: string;
	let grep: ReturnType<typeof createGrepTool>;

	beforeEach(() => {
		testDir = join(tmpdir(), `grep-modes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(testDir, { recursive: true });
		grep = createGrepTool(testDir);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("output_mode", () => {
		it("files_with_matches returns paths only, no line content", async () => {
			writeFileSync(join(testDir, "a.ts"), "alpha\nbeta match\n");
			writeFileSync(join(testDir, "b.txt"), "delta match\n");

			const result = await grep.execute("g1", {
				pattern: "match",
				path: testDir,
				output_mode: "files_with_matches",
			});
			const output = getTextOutput(result);

			expect(output).toContain("a.ts");
			expect(output).toContain("b.txt");
			// 纯路径模式不应包含匹配行正文或 "path:N:" 行号标记
			expect(output).not.toContain("beta match");
			expect(output).not.toMatch(/a\.ts:\d+:/);
		});

		it("count returns per-file counts and a summary line", async () => {
			writeFileSync(join(testDir, "a.ts"), "match\nmatch\nnope\n");
			writeFileSync(join(testDir, "b.txt"), "match\n");

			const result = await grep.execute("g2", {
				pattern: "match",
				path: testDir,
				output_mode: "count",
			});
			const output = getTextOutput(result);

			// 每文件计数行（rg 输出 path:count）
			expect(output).toMatch(/a\.ts:2/);
			expect(output).toMatch(/b\.txt:1/);
			// 汇总：3 次 across 2 files
			expect(output).toContain("Found 3 total occurrences across 2 files");
		});

		it("content mode (default) still prints path:line: text", async () => {
			writeFileSync(join(testDir, "c.ts"), "first\nmatch here\nlast\n");

			const result = await grep.execute("g3", { pattern: "match", path: testDir });
			expect(getTextOutput(result)).toContain("c.ts:2: match here");
		});
	});

	describe("-A / -B context", () => {
		it("-A includes the line after the match", async () => {
			writeFileSync(join(testDir, "ctx.txt"), ["before", "the match", "after one", "after two"].join("\n"));

			const result = await grep.execute("g4", { pattern: "the match", path: testDir, "-A": 1 });
			const output = getTextOutput(result);

			expect(output).toContain("ctx.txt:2: the match");
			expect(output).toContain("ctx.txt-3- after one");
			expect(output).not.toContain("after two");
			// 未要求 before，不应包含前文
			expect(output).not.toContain("ctx.txt-1- before");
		});

		it("-B includes the line before the match", async () => {
			writeFileSync(join(testDir, "ctx.txt"), ["before two", "before one", "the match", "after"].join("\n"));

			const result = await grep.execute("g5", { pattern: "the match", path: testDir, "-B": 1 });
			const output = getTextOutput(result);

			expect(output).toContain("ctx.txt-2- before one");
			expect(output).toContain("ctx.txt:3: the match");
			expect(output).not.toContain("before two");
			expect(output).not.toContain("ctx.txt-4- after");
		});
	});

	describe("type filter", () => {
		it("--type ts only searches matching file types", async () => {
			writeFileSync(join(testDir, "code.ts"), "needle in ts\n");
			writeFileSync(join(testDir, "notes.txt"), "needle in txt\n");

			const result = await grep.execute("g6", {
				pattern: "needle",
				path: testDir,
				type: "ts",
				output_mode: "files_with_matches",
			});
			const output = getTextOutput(result);

			expect(output).toContain("code.ts");
			expect(output).not.toContain("notes.txt");
		});
	});

	describe("offset", () => {
		it("skips the first N output rows", async () => {
			// 单文件、无上下文 → 每个 match 一行，offset 近似跳过前 N 个 match
			writeFileSync(join(testDir, "many.txt"), ["m1 match", "m2 match", "m3 match"].join("\n"));

			const result = await grep.execute("g7", { pattern: "match", path: testDir, offset: 1 });
			const output = getTextOutput(result);

			expect(output).not.toContain("m1 match");
			expect(output).toContain("m2 match");
			expect(output).toContain("m3 match");
		});
	});

	describe("multiline", () => {
		it("matches across line boundaries when multiline is true", async () => {
			writeFileSync(join(testDir, "ml.txt"), "open\nfoo\nbar\nclose\n");

			const result = await grep.execute("g8", {
				pattern: "foo[\\s\\S]*bar",
				path: testDir,
				multiline: true,
				output_mode: "files_with_matches",
			});
			expect(getTextOutput(result)).toContain("ml.txt");
		});

		it("does NOT match across lines without multiline", async () => {
			writeFileSync(join(testDir, "ml2.txt"), "foo\nbar\n");

			const result = await grep.execute("g9", {
				pattern: "foo.bar",
				path: testDir,
				output_mode: "files_with_matches",
			});
			expect(getTextOutput(result)).toContain("No matches found");
		});
	});

	describe("head_limit", () => {
		it("caps matches and reports the limit", async () => {
			writeFileSync(join(testDir, "lim.txt"), ["match a", "match b", "match c"].join("\n"));

			const result = await grep.execute("g10", { pattern: "match", path: testDir, head_limit: 1 });
			const output = getTextOutput(result);

			expect(output).toContain("match a");
			expect(output).not.toContain("match c");
			expect(output).toContain("matches limit reached");
			expect((result as any).details?.matchLimitReached).toBe(1);
		});
	});

	describe("capability declarations (Task 0 + Task 1)", () => {
		it("is concurrency-safe and read-only", () => {
			const input = { pattern: "x" } as any;
			expect(grep.isConcurrencySafe?.(input)).toBe(true);
			expect(grep.isReadOnly?.(input)).toBe(true);
		});
	});

	describe("no matches", () => {
		it("returns a clear no-match message", async () => {
			writeFileSync(join(testDir, "empty.txt"), "nothing here\n");
			const result = await grep.execute("g11", { pattern: "zzz_absent", path: testDir });
			expect(getTextOutput(result)).toContain("No matches found");
		});
	});
});

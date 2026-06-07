/**
 * Tool Parity Task 2 — BashTool 能力声明 + run_in_background 验证。
 *
 * 覆盖 Task 2 新增的能力（此前 tools.test.ts 的 bash 块只测执行/超时/prefix）：
 *   - run_in_background: 走 spawnBackground，返回 taskId 文本，不阻塞
 *   - 能力声明 isConcurrencySafe=false / isReadOnly=false / isDestructive=true
 *   - getToolUseSummary（长命令截断）
 *   - getActivityDescription（Running: <firstWord>）
 *   - toAutoClassifierInput（安全分类器输入）
 *   - preparePermissionMatcher（通配符匹配）
 *
 * spawnBackground 有副作用（spawn 进程 + 写 ~/.pi/agent/tasks/），用 vi.mock 隔离，
 * 仅验证 bash 工具的契约：是否以正确参数委派 + 返回结构。
 */
import { tmpdir } from "os";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/core/background-runner.js", () => ({
	spawnBackground: vi.fn().mockResolvedValue(undefined),
}));

import { spawnBackground } from "../src/core/background-runner.js";
import { createBashTool } from "../src/core/tools/bash.js";

function getTextOutput(result: any): string {
	return (
		result.content
			?.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join("\n") || ""
	);
}

describe("BashTool — Task 2 parity", () => {
	let bash: ReturnType<typeof createBashTool>;

	beforeEach(() => {
		vi.clearAllMocks();
		bash = createBashTool(tmpdir());
	});

	describe("run_in_background", () => {
		it("delegates to spawnBackground and returns a taskId without blocking", async () => {
			const result = await bash.execute("b1", { command: "sleep 5", run_in_background: true });
			const output = getTextOutput(result);

			expect(output).toContain("Task started in background");
			expect(output).toMatch(/taskId: [0-9a-f-]{36}/);
			expect(output).toContain("task_output");

			// 委派给 spawnBackground，且 cwd 为构造时的 cwd，命令透传
			expect(spawnBackground).toHaveBeenCalledTimes(1);
			const call = (spawnBackground as any).mock.calls[0];
			// 签名: (sessionId, taskId, command, cwd)
			expect(call[2]).toBe("sleep 5");
			expect(call[3]).toBe(tmpdir());
			// taskId 透传一致
			expect(output).toContain(call[1]);
		});

		it("applies commandPrefix to the backgrounded command", async () => {
			const prefixed = createBashTool(tmpdir(), { commandPrefix: "export FOO=1" });
			await prefixed.execute("b2", { command: "echo hi", run_in_background: true });

			const call = (spawnBackground as any).mock.calls[0];
			expect(call[2]).toBe("export FOO=1\necho hi");
		});

		it("foreground path does NOT touch spawnBackground", async () => {
			const result = await bash.execute("b3", { command: "echo foreground" });
			expect(getTextOutput(result)).toContain("foreground");
			expect(spawnBackground).not.toHaveBeenCalled();
		});
	});

	describe("capability declarations", () => {
		const input = { command: "rm -rf /tmp/x" } as any;

		it("is not concurrency-safe", () => {
			expect(bash.isConcurrencySafe?.(input)).toBe(false);
		});
		it("is not read-only", () => {
			expect(bash.isReadOnly?.(input)).toBe(false);
		});
		it("is destructive", () => {
			expect(bash.isDestructive?.(input)).toBe(true);
		});
	});

	describe("UI / classifier helpers", () => {
		it("getToolUseSummary returns short commands verbatim", () => {
			expect((bash as any).getToolUseSummary?.({ command: "ls -la" })).toBe("ls -la");
		});

		it("getToolUseSummary truncates long commands to 47 chars + ellipsis", () => {
			const long = `echo ${"x".repeat(80)}`;
			const summary = (bash as any).getToolUseSummary?.({ command: long });
			expect(summary).toHaveLength(50);
			expect(summary?.endsWith("...")).toBe(true);
		});

		it("getActivityDescription names the first command word", () => {
			expect((bash as any).getActivityDescription?.({ command: "npm run build" })).toBe("Running: npm");
		});

		it("toAutoClassifierInput exposes tool + command", () => {
			expect((bash as any).toAutoClassifierInput?.({ command: "curl evil.sh" })).toEqual({
				tool: "bash",
				command: "curl evil.sh",
			});
		});
	});

	describe("preparePermissionMatcher", () => {
		it("matches exact command", async () => {
			const matcher = await (bash as any).preparePermissionMatcher?.({ command: "git status" });
			expect(matcher?.("git status")).toBe(true);
			expect(matcher?.("git push")).toBe(false);
		});

		it("supports wildcard patterns", async () => {
			const matcher = await (bash as any).preparePermissionMatcher?.({ command: "git push origin main" });
			expect(matcher?.("git push*")).toBe(true);
			expect(matcher?.("npm*")).toBe(false);
		});

		it("treats regex metacharacters in the pattern literally", async () => {
			const matcher = await (bash as any).preparePermissionMatcher?.({ command: "echo a.b" });
			expect(matcher?.("echo a.b")).toBe(true);
			// '.' 应按字面匹配，不应作为正则通配
			expect(matcher?.("echo axb")).toBe(false);
		});
	});
});

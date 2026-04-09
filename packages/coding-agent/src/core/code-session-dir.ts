/**
 * Code Mode session directory helper.
 *
 * Code mode sessions are stored in ~/.pi/agent/code-sessions/ (isolated
 * from normal sessions in ~/.pi/agent/sessions/).
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Get the session directory for code mode.
 * Structure: <agentDir>/code-sessions/--<encoded-cwd>--
 */
export function getCodeSessionDir(cwd: string, agentDir: string): string {
	const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
	const sessionDir = join(agentDir, "code-sessions", safePath);
	if (!existsSync(sessionDir)) {
		mkdirSync(sessionDir, { recursive: true });
	}
	return sessionDir;
}

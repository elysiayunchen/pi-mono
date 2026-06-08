/**
 * Claude Rules Extension
 *
 * Scans the project's .claude/rules/ folder for rule files and injects them
 * into the system prompt.
 *
 * Rule files are markdown files with optional YAML frontmatter:
 *
 *   ---
 *   paths: src/**\/*.ts, src/**\/*.tsx
 *   ---
 *   # TypeScript Coding Standards
 *   ...
 *
 * Two types of rules:
 * - **General rules** (no paths frontmatter): Always included in the system prompt.
 *   Content is injected directly so the agent always has these guidelines.
 * - **Conditional rules** (has paths frontmatter): Only listed by path. The agent
 *   should use the read tool to load them when working on matching files.
 *
 * Best practices:
 * - General rules: project-wide conventions (testing, commit style, API design)
 * - Conditional rules: file-type-specific rules (React patterns for .tsx, CSS for .css)
 * - Keep each file focused on one topic
 * - Use descriptive filenames
 * - Organize with subdirectories (e.g., frontend/, backend/)
 *
 * Usage:
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 * 2. Create .claude/rules/ folder in your project root
 * 3. Add .md files with your rules (optional paths: frontmatter for conditional rules)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Types
// ============================================================================

interface RuleFile {
	/** Relative path from .claude/rules/ */
	relativePath: string;
	/** Absolute path to the file */
	absolutePath: string;
	/** Path globs from frontmatter (undefined = always applied) */
	globs?: string[];
	/** Content of the rule file (only for general rules) */
	content?: string;
}

// ============================================================================
// Frontmatter parsing
// ============================================================================

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
	const match = content.match(FRONTMATTER_RE);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const yaml = match[1] ?? "";
	const body = content.slice(match[0].length).trim();
	const frontmatter: Record<string, string> = {};

	for (const line of yaml.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		if (key && value) {
			frontmatter[key] = value;
		}
	}

	return { frontmatter, body };
}

/**
 * Parse frontmatter "paths" field.
 * Returns glob patterns if present, undefined if always applies.
 * "**" is treated as always-applied.
 */
function parsePaths(frontmatter: Record<string, string>): string[] | undefined {
	if (!frontmatter.paths) return undefined;

	const patterns = frontmatter.paths
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => (p.endsWith("/**") ? p.slice(0, -3) : p))
		.filter((p) => p.length > 0);

	if (patterns.length === 0 || patterns.every((p) => p === "**")) {
		return undefined;
	}

	return patterns;
}

// ============================================================================
// Rule discovery
// ============================================================================

/**
 * Recursively find all .md files in a directory.
 * Handles symlinks.
 */
function findMarkdownFiles(dir: string, basePath: string = "", visited: Set<string> = new Set()): string[] {
	const results: string[] = [];

	if (!fs.existsSync(dir) || visited.has(dir)) {
		return results;
	}

	try {
		const stat = fs.statSync(dir);
		if (!stat.isDirectory()) return results;
	} catch {
		return results;
	}

	visited.add(dir);

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return results;
	}

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		const relative = basePath ? `${basePath}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			results.push(...findMarkdownFiles(entryPath, relative, visited));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(relative);
		} else if (entry.isSymbolicLink()) {
			try {
				const targetStat = fs.statSync(entryPath);
				if (targetStat.isDirectory()) {
					results.push(...findMarkdownFiles(entryPath, relative, visited));
				} else if (targetStat.isFile() && entry.name.endsWith(".md")) {
					results.push(relative);
				}
			} catch {
				// Broken symlink, skip
			}
		}
	}

	return results;
}

// ============================================================================
// Extension
// ============================================================================

export default function claudeRulesExtension(pi: ExtensionAPI) {
	/** All discovered rule files */
	let ruleFiles: RuleFile[] = [];
	let rulesDir: string = "";

	// Scan for rules on session start
	pi.on("session_start", async (_event, ctx) => {
		rulesDir = path.join(ctx.cwd, ".claude", "rules");
		const filePaths = findMarkdownFiles(rulesDir);

		ruleFiles = [];

		for (const relativePath of filePaths) {
			const absolutePath = path.join(rulesDir, relativePath);
			try {
				const rawContent = fs.readFileSync(absolutePath, "utf-8");
				const { frontmatter, body } = parseFrontmatter(rawContent);
				const globs = parsePaths(frontmatter);

				ruleFiles.push({
					relativePath,
					absolutePath,
					globs,
					// Only store content for general rules (no globs) to inject directly
					content: globs ? undefined : body,
				});
			} catch {
				// Skip unreadable files
			}
		}

		const generalCount = ruleFiles.filter((r) => !r.globs).length;
		const conditionalCount = ruleFiles.filter((r) => r.globs).length;

		if (ruleFiles.length > 0) {
			const parts: string[] = [`Found ${ruleFiles.length} rule(s) in .claude/rules/`];
			if (generalCount > 0) parts.push(`${generalCount} general`);
			if (conditionalCount > 0) parts.push(`${conditionalCount} conditional`);
			ctx.ui.notify(parts.join(", "), "info");
		}
	});

	// Inject rules into system prompt
	pi.on("before_agent_start", async (event) => {
		if (ruleFiles.length === 0) return;

		const generalRules = ruleFiles.filter((r) => !r.globs && r.content);
		const conditionalRules = ruleFiles.filter((r) => r.globs);

		const sections: string[] = [];

		// General rules: inject content directly
		if (generalRules.length > 0) {
			const parts = generalRules.map((r) => `## Rule: ${r.relativePath}\n\n${r.content}`);
			sections.push(`## Project Rules (Always Apply)\n\n${parts.join("\n\n---\n\n")}`);
		}

		// Conditional rules: list with their path patterns
		if (conditionalRules.length > 0) {
			const parts = conditionalRules.map((r) => {
				const patterns = r.globs!.join(", ");
				return `- .claude/rules/${r.relativePath} (matches: ${patterns})`;
			});
			sections.push(
				`## Project Rules (Conditional)\n\n` +
					`These rules only apply when working on files matching their patterns. ` +
					`Use the read tool to load relevant rule files when working on matching files.\n\n` +
					parts.join("\n"),
			);
		}

		if (sections.length === 0) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${sections.join("\n\n")}`,
		};
	});
}

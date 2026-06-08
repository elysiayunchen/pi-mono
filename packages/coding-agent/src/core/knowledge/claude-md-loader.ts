/**
 * CLAUDE.md & rules loader.
 *
 * File loading order (each layer overrides/reinforces the previous):
 *
 * 1. ~/.claude/CLAUDE.md — User-global instructions for all projects
 * 2. CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md in project roots (traversed up from CWD)
 * 3. CLAUDE.local.md — Private project-specific instructions (CWD only)
 *
 * Within each directory, priority is: CLAUDE.md > .claude/CLAUDE.md > .claude/rules/*.md
 * Files closer to CWD have higher priority (loaded later).
 *
 * @include directive:
 * - Memory files can include other files using @path notation
 * - Supports @path, @./relative/path, @~/home/path, or @/absolute/path
 * - Included files are added before the including file
 * - Circular references are prevented (MAX_INCLUDE_DEPTH = 5)
 * - Non-existent files are silently ignored
 * - Non-text files (binary, images, PDFs) are filtered out
 *
 * Frontmatter paths (conditional rules):
 * - Files with `paths:` in frontmatter are conditional — they only apply to matching file paths
 * - Files without `paths:` are always applied
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ============================================================================
// Constants
// ============================================================================

/** Maximum depth for @include recursion */
const MAX_INCLUDE_DEPTH = 5;

/** File extensions allowed for @include directives (prevents loading binary data) */
const TEXT_FILE_EXTENSIONS = new Set([
	// Markdown and text
	".md",
	".txt",
	".text",
	// Data formats
	".json",
	".yaml",
	".yml",
	".toml",
	".xml",
	".csv",
	// Web
	".html",
	".htm",
	".css",
	".scss",
	".sass",
	".less",
	// Source code
	".js",
	".ts",
	".tsx",
	".jsx",
	".mjs",
	".cjs",
	".mts",
	".cts",
	".py",
	".pyi",
	".pyw",
	".rb",
	".erb",
	".rake",
	".go",
	".rs",
	".java",
	".kt",
	".kts",
	".scala",
	".c",
	".cpp",
	".cc",
	".cxx",
	".h",
	".hpp",
	".hxx",
	".cs",
	".swift",
	".sh",
	".bash",
	".zsh",
	".fish",
	".ps1",
	".bat",
	".cmd",
	".sql",
	".graphql",
	".gql",
	".proto",
	".vue",
	".svelte",
	".astro",
	".ejs",
	".hbs",
	".pug",
	".jade",
	".php",
	".pl",
	".pm",
	".lua",
	".r",
	".R",
	".dart",
	".ex",
	".exs",
	".erl",
	".hrl",
	".clj",
	".cljs",
	".cljc",
	".edn",
	".hs",
	".lhs",
	".elm",
	".ml",
	".mli",
	".f",
	".f90",
	".f95",
	".for",
	// Build/config
	".cmake",
	".make",
	".makefile",
	".gradle",
	".sbt",
	".env",
	".ini",
	".cfg",
	".conf",
	".config",
	".properties",
	// Documentation
	".rst",
	".adoc",
	".asciidoc",
	".org",
	".tex",
	".latex",
	// Misc
	".lock",
	".log",
	".diff",
	".patch",
]);

// ============================================================================
// Types
// ============================================================================

export interface LoadClaudeMdOptions {
	/**
	 * Optional upper boundary for directory traversal.
	 * When provided, traversal stops BEFORE reaching this directory (exclusive).
	 * For example, setting stopDir=/home/user/projects/pi-mono means
	 * only CLAUDE.md files within that project tree are collected,
	 * excluding home directory CLAUDE.md.
	 */
	stopDir?: string;
}

export interface MemoryFileInfo {
	/** Absolute path to the file */
	path: string;
	/** Type of memory (User, Project, Local) */
	type: MemoryType;
	/** Processed content (frontmatter stripped, HTML comments stripped) */
	content: string;
	/** Path globs from frontmatter "paths" field (undefined = always applied) */
	globs?: string[];
	/** Path of the file that @included this one */
	parent?: string;
}

export type MemoryType = "User" | "Project" | "Local";

// ============================================================================
// Module-level cache
// ============================================================================

/** Cache: resolved dir -> concatenated CLAUDE.md/rules content (null if none found) */
const dirCache = new Map<string, string | null>();

/** Frontmatter extraction regex (matches leading ---\n...\n--- block) */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// ============================================================================
// Frontmatter parsing
// ============================================================================

interface ParsedFrontmatter {
	frontmatter: Record<string, string>;
	body: string;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
	const match = content.match(FRONTMATTER_RE);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const yaml = match[1] ?? "";
	const body = content.slice(match[0].length).trim();
	const frontmatter: Record<string, string> = {};

	// Simple YAML key: value parser (sufficient for paths field)
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
 * Parse frontmatter "paths" field from memory file content.
 * Returns glob patterns if present, undefined otherwise (always applied).
 * "**" patterns are treated as always-applied (returns undefined).
 */
function parseFrontmatterPaths(rawContent: string): {
	content: string;
	paths?: string[];
} {
	const { frontmatter, body } = parseFrontmatter(rawContent);

	if (!frontmatter.paths) {
		return { content: body };
	}

	const patterns = frontmatter.paths
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => (p.endsWith("/**") ? p.slice(0, -3) : p))
		.filter((p) => p.length > 0);

	// If all patterns are ** (match-all), treat as no globs
	if (patterns.length === 0 || patterns.every((p) => p === "**")) {
		return { content: body };
	}

	return { content: body, paths: patterns };
}

// ============================================================================
// HTML comment stripping
// ============================================================================

/**
 * Strip HTML block comments (<!-- ... -->) from content.
 * Only strips block-level comments to avoid affecting code blocks.
 */
function stripHtmlComments(content: string): string {
	if (!content.includes("<!--")) {
		return content;
	}

	// Match <!-- ... --> at start of lines (block comments)
	const lines = content.split("\n");
	const result: string[] = [];
	let inComment = false;

	for (const line of lines) {
		if (!inComment && line.trimStart().startsWith("<!--")) {
			inComment = true;
			// Check if comment ends on same line
			if (line.includes("-->")) {
				const afterComment = line.slice(line.indexOf("-->") + 3);
				if (afterComment.trim()) {
					result.push(afterComment);
				}
				inComment = false;
			}
		} else if (inComment) {
			if (line.includes("-->")) {
				const afterComment = line.slice(line.indexOf("-->") + 3);
				if (afterComment.trim()) {
					result.push(afterComment);
				}
				inComment = false;
			}
		} else {
			result.push(line);
		}
	}

	// Also strip inline multi-line comments <!-- ... --> that span lines
	let joined = result.join("\n");
	joined = joined.replace(/<!--[\s\S]*?-->/g, () => {
		// Only strip if it appears to be a block-level comment (not inside code)
		return "";
	});

	return joined.trim();
}

// ============================================================================
// Include directive processing
// ============================================================================

/**
 * Extract @include paths from content.
 * Matches @path, @./path, @~/path, @/absolute/path patterns.
 */
function extractIncludePaths(content: string, basePath: string): string[] {
	const result: string[] = [];
	const includeRegex = /(?:^|\s)@((?:[^\s\\]|\\ )+)/g;

	let match: RegExpExecArray | null = includeRegex.exec(content);
	while (match !== null) {
		let includePath = match[1];
		if (!includePath) {
			match = includeRegex.exec(content);
			continue;
		}

		// Strip fragment identifiers (#heading)
		const hashIndex = includePath.indexOf("#");
		if (hashIndex !== -1) {
			includePath = includePath.substring(0, hashIndex);
		}
		if (!includePath) {
			match = includeRegex.exec(content);
			continue;
		}

		// Unescape spaces
		includePath = includePath.replace(/\\ /g, " ");

		let resolved: string;
		if (includePath.startsWith("~/")) {
			resolved = path.resolve(os.homedir(), includePath.slice(2));
		} else if (includePath.startsWith("./")) {
			resolved = path.resolve(basePath, includePath);
		} else if (includePath.startsWith("/")) {
			resolved = includePath;
		} else {
			// Bare path: treat as relative
			resolved = path.resolve(basePath, includePath);
		}
		result.push(resolved);
		match = includeRegex.exec(content);
	}

	return result;
}

/**
 * Check if a file has a text extension (safe to include).
 */
function isTextFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	if (!ext) return true; // No extension, assume text
	return TEXT_FILE_EXTENSIONS.has(ext);
}

// ============================================================================
// Recursive include processing
// ============================================================================

/**
 * Process a memory file and all its @include references recursively.
 * Returns MemoryFileInfo objects with includes first, then the main file.
 */
function processMemoryFile(
	filePath: string,
	type: MemoryType,
	processedPaths: Set<string>,
	depth: number = 0,
	parent?: string,
): MemoryFileInfo[] {
	// Normalize path for comparison
	const normalized = path.resolve(filePath);

	if (processedPaths.has(normalized) || depth >= MAX_INCLUDE_DEPTH) {
		return [];
	}

	processedPaths.add(normalized);

	let rawContent: string;
	try {
		rawContent = fs.readFileSync(filePath, "utf-8");
	} catch {
		return [];
	}

	if (!rawContent.trim()) {
		return [];
	}

	const { content: withoutFrontmatter, paths } = parseFrontmatterPaths(rawContent);
	const strippedContent = stripHtmlComments(withoutFrontmatter);
	const includePaths = extractIncludePaths(strippedContent, path.dirname(filePath));

	const memoryFile: MemoryFileInfo = {
		path: normalized,
		type,
		content: strippedContent,
		globs: paths,
		parent,
	};

	const result: MemoryFileInfo[] = [];

	// Process includes first (included content appears before the including file)
	for (const includePath of includePaths) {
		if (!isTextFile(includePath)) continue;
		const includedFiles = processMemoryFile(includePath, type, processedPaths, depth + 1, filePath);
		result.push(...includedFiles);
	}

	// Then the main file
	result.push(memoryFile);
	return result;
}

// ============================================================================
// Directory rule scanning
// ============================================================================

/**
 * Recursively find all .md files in a rules directory.
 * Handles symlinks and directory cycles.
 */
function findRuleFiles(dir: string, visited: Set<string> = new Set()): string[] {
	const results: string[] = [];

	if (visited.has(dir)) return results;

	try {
		const stats = fs.statSync(dir);
		if (!stats.isDirectory()) return results;
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
		const key = fs.realpathSync(entryPath);

		if (entry.isDirectory()) {
			results.push(...findRuleFiles(entryPath, visited));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(key);
		} else if (entry.isSymbolicLink()) {
			try {
				const targetStat = fs.statSync(entryPath);
				if (targetStat.isDirectory()) {
					results.push(...findRuleFiles(entryPath, visited));
				} else if (targetStat.isFile() && entry.name.endsWith(".md")) {
					results.push(key);
				}
			} catch {
				// Broken symlink, skip
			}
		}
	}

	return results;
}

// ============================================================================
// Directory-level collection
// ============================================================================

/**
 * Collect all memory content from a single directory.
 * Scans: CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md, CLAUDE.local.md
 */
function collectDirContent(dir: string, isCwd: boolean): MemoryFileInfo[] {
	const result: MemoryFileInfo[] = [];
	const processedPaths = new Set<string>();

	// 1. CLAUDE.md (Project)
	const claudeMdPath = path.join(dir, "CLAUDE.md");
	if (fs.existsSync(claudeMdPath)) {
		const files = processMemoryFile(claudeMdPath, "Project", processedPaths);
		result.push(...files);
	}

	// 2. .claude/CLAUDE.md (Project)
	const dotClaudePath = path.join(dir, ".claude", "CLAUDE.md");
	if (fs.existsSync(dotClaudePath)) {
		const files = processMemoryFile(dotClaudePath, "Project", processedPaths);
		result.push(...files);
	}

	// 3. .claude/rules/*.md (Project)
	const rulesDir = path.join(dir, ".claude", "rules");
	if (fs.existsSync(rulesDir)) {
		const ruleFiles = findRuleFiles(rulesDir);
		for (const rulePath of ruleFiles) {
			const files = processMemoryFile(rulePath, "Project", processedPaths);
			result.push(...files);
		}
	}

	// 4. CLAUDE.local.md (Local — only from CWD)
	if (isCwd) {
		const localPath = path.join(dir, "CLAUDE.local.md");
		if (fs.existsSync(localPath)) {
			const files = processMemoryFile(localPath, "Local", processedPaths);
			result.push(...files);
		}
	}

	return result;
}

/**
 * Build a cache key for a directory combining all file mtimes.
 * Returns null if no files exist.
 */
function buildDirCacheKey(dir: string): string | null {
	const files = [
		path.join(dir, "CLAUDE.md"),
		path.join(dir, ".claude", "CLAUDE.md"),
		path.join(dir, ".claude", "rules"),
		path.join(dir, "CLAUDE.local.md"),
	];

	const parts: string[] = [];
	for (const f of files) {
		try {
			const stat = fs.statSync(f);
			parts.push(`${f}:${stat.mtimeMs}`);
		} catch {
			// File/dir doesn't exist
		}
	}

	return parts.length > 0 ? parts.join("|") : null;
}

/**
 * Format a list of MemoryFileInfo into a concatenated string.
 */
function formatMemoryFiles(files: MemoryFileInfo[], _dir: string): string | null {
	if (files.length === 0) return null;

	const parts = files.map((f) => {
		const label =
			f.type === "Local"
				? `# CLAUDE.local.md (${f.path})`
				: f.path.endsWith("CLAUDE.md")
					? `# CLAUDE.md (${f.path})`
					: `# Rules (${f.path})`;
		return `${label}\n\n${f.content}`;
	});

	return parts.join("\n\n---\n\n");
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Scan from `startDir` up to home/root, collect all CLAUDE.md files
 * plus .claude/CLAUDE.md, .claude/rules/*.md, and CLAUDE.local.md.
 *
 * Returns concatenated content, or null if none found.
 * Results are cached per directory.
 */
export async function loadClaudeMd(startDir: string, options?: LoadClaudeMdOptions): Promise<string | null> {
	return loadClaudeMdSync(startDir, options);
}

/**
 * Synchronous version of loadClaudeMd.
 */
export function loadClaudeMdSync(startDir: string, options?: LoadClaudeMdOptions): string | null {
	const home = os.homedir();
	const stopDir = options?.stopDir ? path.resolve(options.stopDir) : undefined;
	const parts: string[] = [];
	let current = path.resolve(startDir);
	const visited = new Set<string>();
	let isFirst = true; // First directory processed is the CWD

	while (true) {
		if (visited.has(current)) break;
		visited.add(current);

		// Stop BEFORE the boundary directory (exclusive)
		if (stopDir && current === stopDir) break;

		// Check cache
		const cacheKey = buildDirCacheKey(current);
		if (cacheKey && dirCache.has(cacheKey)) {
			const cached = dirCache.get(cacheKey)!;
			if (cached) parts.unshift(cached);
		} else {
			const memoryFiles = collectDirContent(current, isFirst);
			const formatted = formatMemoryFiles(memoryFiles, current);
			if (cacheKey) {
				dirCache.set(cacheKey, formatted);
			}
			if (formatted) parts.unshift(formatted);
		}

		isFirst = false;

		// Stop at home dir or filesystem root
		if (current === home || current === path.dirname(current)) break;
		current = path.dirname(current);
	}

	if (parts.length === 0) return null;
	return parts.join("\n\n---\n\n");
}

/**
 * Invalidate cache for a specific directory.
 */
export function invalidateClaudeMdCache(_dir: string): void {
	// Clear all cache entries (keyed by mtime, so we just clear everything)
	dirCache.clear();
}

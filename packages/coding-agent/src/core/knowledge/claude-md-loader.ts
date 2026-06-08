import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Module-level cache: resolved dir -> file content (or null if no CLAUDE.md)
const dirCache = new Map<string, string | null>();

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

/**
 * Scan from `startDir` up to home/root, collect all CLAUDE.md files.
 * Returns concatenated content, or null if none found.
 * Results are cached per directory — subsequent calls with the same dir are free.
 *
 * @param startDir - Directory to start scanning from
 * @param options.stopDir - Optional upper boundary. Traversal stops BEFORE this dir (exclusive).
 *   If omitted, traversal goes up to home or filesystem root.
 */
export async function loadClaudeMd(startDir: string, options?: LoadClaudeMdOptions): Promise<string | null> {
	return loadClaudeMdSync(startDir, options);
}

/**
 * Synchronous version of loadClaudeMd.
 * Scan from `startDir` up to home/root, collect all CLAUDE.md files.
 * Returns concatenated content, or null if none found.
 */
export function loadClaudeMdSync(startDir: string, options?: LoadClaudeMdOptions): string | null {
	const home = os.homedir();
	const stopDir = options?.stopDir ? path.resolve(options.stopDir) : undefined;
	const parts: string[] = [];
	let current = path.resolve(startDir);
	const visited = new Set<string>();

	while (true) {
		if (visited.has(current)) break;
		visited.add(current);

		// Stop BEFORE the boundary directory (exclusive)
		if (stopDir && current === stopDir) break;

		if (dirCache.has(current)) {
			const cached = dirCache.get(current)!;
			if (cached) parts.unshift(cached); // parent first
		} else {
			const claudeMdPath = path.join(current, "CLAUDE.md");
			try {
				const content = fs.readFileSync(claudeMdPath, "utf8").trim();
				if (content) {
					const labeled = `# CLAUDE.md (${claudeMdPath})\n\n${content}`;
					dirCache.set(current, labeled);
					parts.unshift(labeled);
				} else {
					dirCache.set(current, null);
				}
			} catch {
				// File doesn't exist or unreadable
				dirCache.set(current, null);
			}
		}

		// Stop at home dir or filesystem root
		if (current === home || current === path.dirname(current)) break;
		current = path.dirname(current);
	}

	if (parts.length === 0) return null;
	return parts.join("\n\n---\n\n");
}

/**
 * Invalidate cache for a specific directory (e.g. after CLAUDE.md is written).
 */
export function invalidateClaudeMdCache(dir: string): void {
	const resolved = path.resolve(dir);
	dirCache.delete(resolved);
}

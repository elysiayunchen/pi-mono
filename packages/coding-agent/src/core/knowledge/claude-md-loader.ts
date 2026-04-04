import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Module-level cache: resolved dir -> file content (or null if no CLAUDE.md)
const dirCache = new Map<string, string | null>();

/**
 * Scan from `startDir` up to home/root, collect all CLAUDE.md files.
 * Returns concatenated content, or null if none found.
 * Results are cached per directory — subsequent calls with the same dir are free.
 */
export async function loadClaudeMd(startDir: string): Promise<string | null> {
	const home = os.homedir();
	const parts: string[] = [];
	let current = path.resolve(startDir);
	const visited = new Set<string>();

	while (true) {
		if (visited.has(current)) break;
		visited.add(current);

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

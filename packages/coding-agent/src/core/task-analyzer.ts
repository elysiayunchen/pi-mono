/**
 * Task Analyzer (P2-D Phase 2)
 *
 * Lightweight pre-analysis of user input — no LLM call.
 * Predicts task complexity, suggests tool chains, estimates token budget.
 *
 * Integration: called from enter_plan_mode tool to inject analysis
 * into plan mode output, guiding LLM to plan more efficiently.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type TaskComplexity = "low" | "medium" | "high";

export interface TaskAnalysis {
	complexity: TaskComplexity;
	suggestedTools: string[];
	estimatedTokens: { min: number; max: number };
	/** Human-readable explanation of the analysis */
	explanation: string;
	/** Keyword categories that matched */
	matchedCategories: string[];
}

// ── Keyword Patterns ─────────────────────────────────────────────────────────

const HIGH_COMPLEXITY_PATTERNS = [
	/\brefactor\b/i,
	/\bmigrate\b/i,
	/\barchitect\b/i,
	/\boptimi[sz]e\b/i,
	/\bintegrat\w*\b/i,
	/\bimplement\b.*\b(system|framework|architecture|pipeline)\b/i,
	/\brestructur\w*\b/i,
	/\boverhaul\b/i,
	/\bdebug\b.*\b(complex|intermittent|race|deadlock)\b/i,
	/\btest\b.*\b(all|entire|full|integration|e2e)\b/i,
];

const MEDIUM_COMPLEXITY_PATTERNS = [
	/\badd\b.*\b(feature|endpoint|route|handler|component)\b/i,
	/\bfix\b/i,
	/\bupdate\b/i,
	/\bmodify\b/i,
	/\bchange\b/i,
	/\bcreate\b.*\b(file|module|class|service)\b/i,
	/\bwrite\b.*\b(test|spec)\b/i,
	/\breview\b/i,
	/\banalyze\b/i,
	/\bexplain\b/i,
	/\bconfigur\w*\b/i,
];

const LOW_COMPLEXITY_PATTERNS = [
	/\bread\b/i,
	/\bshow\b/i,
	/\blist\b/i,
	/\bdisplay\b/i,
	/\bwhat\s+(is|are|does|do)\b/i,
	/\bhow\s+(does|do|is|are)\b/i,
	/\bwhere\s+(is|are)\b/i,
	/\bgrep\b/i,
	/\bfind\b.*\b(file|string|text)\b/i,
	/\bdiff\b/i,
	/\bstatus\b/i,
	/\blog\b/i,
];

const TOOL_SUGGESTIONS: Record<string, string[]> = {
	read: ["/bread", "/bgrep", "/bfind"],
	write: ["/bwrite", "/bedit", "/bbash"],
	test: ["/bbash", "/bread", "/bwrite"],
	debug: ["/bgrep", "/bread", "/bbash"],
	config: ["/bread", "/bwrite", "/bgrep"],
	review: ["/bread", "/bgrep", "/bdiff"],
};

// ── File Pattern Detection ───────────────────────────────────────────────────

const FILE_PATTERNS = [
	/\*\*\/\*\.[a-z]+/g, // **/*.ts
	/\w+\.\w{1,5}/g, // file.ts
	/src\//,
	/test\//,
	/lib\//,
	/config\//,
];

function detectFileReferences(input: string): string[] {
	const found: string[] = [];
	for (const pattern of FILE_PATTERNS) {
		const matches = input.match(pattern);
		if (matches) found.push(...matches);
	}
	return [...new Set(found)];
}

function detectTaskType(input: string): string {
	const lower = input.toLowerCase();
	if (/\bread|show|display|list|cat|view|inspect|explain/.test(lower)) return "read";
	if (/\bwrite|create|add|implement|build|generate|scaffold/.test(lower)) return "write";
	if (/\btest|spec|coverage|assert|verify/.test(lower)) return "test";
	if (/\bdebug|fix|error|bug|crash|fail|broken/.test(lower)) return "debug";
	if (/\bconfig|setting|env|variable|option/.test(lower)) return "config";
	if (/\breview|check|audit|inspect|analyze/.test(lower)) return "review";
	return "general";
}

// ── Main Analysis ────────────────────────────────────────────────────────────

export function analyzeTask(userInput: string): TaskAnalysis {
	const matchedCategories: string[] = [];
	let complexity: TaskComplexity = "medium"; // default

	// Check high complexity first (overrides)
	for (const pattern of HIGH_COMPLEXITY_PATTERNS) {
		if (pattern.test(userInput)) {
			matchedCategories.push("high");
		}
	}

	for (const pattern of MEDIUM_COMPLEXITY_PATTERNS) {
		if (pattern.test(userInput)) {
			matchedCategories.push("medium");
		}
	}

	for (const pattern of LOW_COMPLEXITY_PATTERNS) {
		if (pattern.test(userInput)) {
			matchedCategories.push("low");
		}
	}

	// Determine complexity from matches
	if (matchedCategories.includes("high")) {
		complexity = "high";
	} else if (matchedCategories.includes("low") && !matchedCategories.includes("medium")) {
		complexity = "low";
	}

	// Adjust based on input length and file references
	const fileRefs = detectFileReferences(userInput);
	const wordCount = userInput.split(/\s+/).length;

	if (fileRefs.length > 5 || wordCount > 100) {
		complexity = complexity === "low" ? "medium" : complexity === "medium" ? "high" : "high";
	}

	// Suggest tools based on detected task type
	const taskType = detectTaskType(userInput);
	const suggestedTools = TOOL_SUGGESTIONS[taskType] || TOOL_SUGGESTIONS.general || [];

	// Estimate token budget
	const tokenEstimates: Record<TaskComplexity, { min: number; max: number }> = {
		low: { min: 500, max: 2000 },
		medium: { min: 2000, max: 10000 },
		high: { min: 10000, max: 50000 },
	};

	const explanation = buildExplanation(complexity, taskType, fileRefs, matchedCategories);

	return {
		complexity,
		suggestedTools,
		estimatedTokens: tokenEstimates[complexity],
		explanation,
		matchedCategories,
	};
}

function buildExplanation(
	complexity: TaskComplexity,
	taskType: string,
	fileRefs: string[],
	_categories: string[],
): string {
	const parts: string[] = [];

	parts.push(`Task type: ${taskType}`);
	parts.push(`Complexity: ${complexity}`);

	if (fileRefs.length > 0) {
		parts.push(
			`Files referenced: ${fileRefs.slice(0, 5).join(", ")}${fileRefs.length > 5 ? ` (+${fileRefs.length - 5} more)` : ""}`,
		);
	}

	const toolHints: Record<string, string> = {
		read: "Focus on reading and understanding before making changes.",
		write: "Break implementation into small, testable steps.",
		test: "Start by understanding existing test patterns in the codebase.",
		debug: "Gather evidence first — logs, error messages, reproduction steps.",
		config: "Check existing config patterns before modifying.",
		review: "Focus on key areas: correctness, performance, security.",
	};

	if (toolHints[taskType]) {
		parts.push(`Hint: ${toolHints[taskType]}`);
	}

	return parts.join("\n");
}

/**
 * Format analysis as a compact text block for injection into plan mode.
 */
export function formatAnalysisForPrompt(analysis: TaskAnalysis): string {
	return [
		"─── Task Analysis ───",
		analysis.explanation,
		`Suggested tools: ${analysis.suggestedTools.join(", ") || "none"}`,
		`Estimated token budget: ${analysis.estimatedTokens.min}–${analysis.estimatedTokens.max}`,
		"─── End Analysis ───",
	].join("\n");
}

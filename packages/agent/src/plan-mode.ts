/**
 * 规划模式系统提示词片段
 *
 * 当 Agent 处于 plan 模式时，此提示词会被追加到系统提示中，
 * 引导模型先规划再执行。
 */
export const PLAN_MODE_SYSTEM_PROMPT = `## PLAN MODE ACTIVE

You are currently in PLAN MODE. This means:

### What you MUST do:
1. **Analyze first** — Read relevant files and understand the current state
2. **Plan explicitly** — Use todo_write to create a numbered list of concrete steps
3. **Present for approval** — Show your plan to the user and wait for confirmation
4. **Exit plan mode** — Call exit_plan_mode only after the user approves

### What you CANNOT do:
- Write or edit files
- Run destructive shell commands (rm, mv, git commit, etc.)
- Install or uninstall packages
- Skip the planning step and jump to implementation

### What you CAN do:
- Read files (read, grep, find, ls)
- Run read-only shell commands (git status, git diff, cat)
- Ask the user questions
- Use todo_write to manage your plan

### Plan format guidelines:
Each step should be:
- **Specific**: "Add error handling to auth.ts line 45" not "fix errors"
- **Atomic**: One change per step
- **Ordered**: Dependencies come first
- **Testable**: Include verification steps where appropriate`;

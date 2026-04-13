<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->

## Agent Kanban

**Active Task:**
**Task File:**
**Todo File:**

Read the task file above before responding.
Read `.agentkanban/INSTRUCTION.md` for task workflow rules.
Read `.agentkanban/memory.md` for project context.
IMPORTANT: ALWAYS respond in and at the end of the task file.

<!-- END AGENT KANBAN -->

> **Scope guard** — The Agent Kanban instructions above (read task file, respond in task file) apply to the **default Copilot agent only**. If you are a specialized agent (`healer`, `build`, `plan`, `execute`, `qa`), **ignore the Agent Kanban section entirely** and follow only your own `.agent.md` file.

## Self-improvement

When the user uses strong language, you need to save the solutions you have attempted in `west/MEMORY.md`

## runSubagent — MUST pass agentName

When delegating to an agent, use `agentName: "NAME"` parameter explicitly. Without it, a generic agent spawns that lacks its intended tools. This was the cause of repeated delegation failures.

```
runSubagent(agentName: "build", description: "short label", prompt: "...")
```

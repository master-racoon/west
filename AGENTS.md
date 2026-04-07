<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->
## Agent Kanban

**Active Task:** [DEV] US-1.1 Define Warehouse with Bin Mode
**Task File:** `west/.agentkanban/tasks/task_20260404_01_flow5_define_warehouse.md`
**Todo File:** `west/.agentkanban/tasks/todo_20260404_01_flow5_define_warehouse.md`

Read the task file above before responding.
Read `.agentkanban/INSTRUCTION.md` for task workflow rules.
Read `.agentkanban/memory.md` for project context.
IMPORTANT: ALWAYS respond in and at the end of the task file.
<!-- END AGENT KANBAN -->


## Self-improvement
When the user uses strong language, you need to save the solutions you have attempted in `west/MEMORY.md`


## runSubagent — MUST pass agentName

When delegating to an agent, use `agentName: "NAME"` parameter explicitly. Without it, a generic agent spawns that lacks its intended tools. This was the cause of repeated delegation failures.

```
runSubagent(agentName: "build", description: "short label", prompt: "...")
```

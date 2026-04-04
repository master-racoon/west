# Kanban Workflow Skill

## Overview

The Agent Kanban system structures a collaborative `plan → todo → implement` workflow where agents and users work together to decompose features into tasks and track progress.

**Key principle:** Planning, decisions, and implementation all happen *in the task files*, not chat. This creates a persistent record of how decisions were made and what was done.

## Task Directory Structure

All tasks live in `.agentkanban/tasks/`:

```
.agentkanban/
  board.yaml          # Lane definitions and workflow config
  memory.md           # Persistent context across all tasks
  INSTRUCTION.md      # Complete workflow rules
  tasks/
    task_<id>_<slug>.md    # Planning/coordination task
    todo_<id>_<slug>.md    # Implementation checklist
    archive/               # Archived tasks
```

## Task File Format

Each task is a markdown file with YAML frontmatter and a **Conversation** section:

```markdown
---
title: <descriptive task title>
lane: <lane-slug>
created: <ISO 8601 timestamp>
updated: <ISO 8601 timestamp>
description: <one-line summary>
---

## Conversation

### user

<user message>

### agent

<agent response>

### user

<next user message>

### agent

<agent response>
```

**Critical Rules:**
- The `lane` (workflow stage) is managed by the user/extension—agents do not change it
- Append new entries at the end; never modify or delete existing ones
- Start each message with `### user` or `### agent` on its own line with a blank line between messages
- Inline comments from user appear as `[comment: <text>]` on agent responses—honor them
- After your response, add `### user` on a new line for the user's next entry

## Workflow: plan → todo → implement

### Phase 1: Plan
- **Goal:** Discuss, analyze, and plan collaboratively in the task file
- **Actions:** Read context, reason about requirements, explore approaches, record decisions
- **Output:** Clear planning notes in the task conversation
- **Constraint:** No code, no TODOs, no file modifications

### Phase 2: Todo
- **Goal:** Create an actionable checklist from the planning discussion
- **Actions:** Write clear, testable `- [ ]` items capturing all work
- **Output:** Updated todo file with numbered iterations and checklist items
- **Constraint:** No implementation (unless user explicitly asks)

### Phase 3: Implement
- **Goal:** Execute per plan and checklist
- **Actions:** Read both task and todo files, write code, check off items as completed
- **Output:** Working implementation, updated todo file with checked items, summary in task conversation
- **Constraint:** Do not deviate from plan without noting why in the task file

## Command Verbs

Users direct the workflow with command verbs. Agents respond by:

| Verb | Shorthand | Action |
|------|-----------|--------|
| `plan` | `p` | Phase 1: Discuss and plan collaboratively |
| `todo` | `t` | Phase 2: Create/update TODOs from planning |
| `implement` | `i` | Phase 3: Execute implementation |

Verbs can be combined: `plan todo` or `p t`, `todo implement` or `t i`, etc.

## Memory & Persistence

**`.agentkanban/memory.md`** persists context across all tasks:
- Project conventions and standards
- Key architectural decisions
- Useful patterns and references
- Notes on common pitfalls

**Read memory at the start of each task.** Update it when you discover or establish patterns that future tasks should know about.

## Key Locations

| File | Purpose |
|------|---------|
| `.agentkanban/INSTRUCTION.md` | Complete, authoritative workflow rules |
| `.agentkanban/memory.md` | Persistent project context |
| `.agentkanban/board.yaml` | Lane definitions and workflow config |
| `AGENTS.md` | Task file reference in worktree spaces |

## Example Task File

```markdown
---
title: "[DEV] Create User endpoint"
lane: in-progress
created: 2026-04-03T10:30:00Z
updated: 2026-04-03T11:45:00Z
description: Implement POST /api/users with validation and database insertion
---

## Conversation

### user

Create a task for the basic user creation endpoint.

### agent

I'll plan this task. Looking at the DFD, I need to:
1. Define request/response contracts for POST /api/users
2. Implement validation
3. Create database layer
4. Wire up the API endpoint

What format does the response use—UUID or auto-increment ID?

### user

UUID. Check the dfd_level0.md for the contract.

### agent

Got it. I've reviewed dfd_level0.md § Create User flow. The contract specifies:
- Request: name (1-100 chars), email (valid format)
- Response: id (UUID), name, email, created_at (ISO8601)

Ready to create TODOs when you say `todo`.

### user

todo

### agent

[Agent creates todo file and lists implementation items]

### user

implement

### agent

[Agent implements per TODOs, marks items complete, summarizes]
```

## When to Use This Skill

- **Planning an agent:** Reference this skill in your agent's role to understand task structure
- **Creating tasks:** Use the task file format template
- **Coordinating work:** Read memory.md and existing tasks to understand conventions
- **Updating memory:** Record decisions and patterns that future tasks should know about

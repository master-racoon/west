# MEMORY

## Healer agent - Reads Kanban Agent Instructions

No matter what I do, the healer agent keeps working on the kanban tickets, even though a healer agent should reasonably only care about healer agents stuff, not kanban agents 

## Healer agent — Process section was incomplete

The original healer.agent.md Process only listed 7 generic steps. The "What You Fix" section contained standing obligations (run db:generate/db:migrate, generate-api) that were easy to skip because they were not in the Process. Result: healer ran lint hook, saw type-check go green, never ran migrations or generate-api, and never read the original errors.

Fix applied: Process now has an explicit step 4 "Standing checks" that mandates db:generate/db:migrate and generate-api every run, and step 2 now requires capturing full error output before acting.

## runSubagent — MUST pass agentName

When delegating to the build agent, use `agentName: "build"` parameter explicitly. Without it, a generic agent spawns that has no edit tools and cannot write files. This was the cause of repeated delegation failures.

```
runSubagent(agentName: "build", description: "short label", prompt: "...")
```

## Auth/Authz naming drift

Recurring mistake: naming mixed auth helper files as `authorization` or `middleware` when they only expose request guard helpers like `getAuth`, `requireAuth`, and `requireRole`.

Rule: use `authorization` only when the file is primarily about permission decisions; use `middleware` only when it exports actual framework middleware. For mixed authn/authz helper files, prefer `auth` or `auth-guards`.

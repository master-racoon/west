# MEMORY

## runSubagent — MUST pass agentName

When delegating to the build agent, use `agentName: "build"` parameter explicitly. Without it, a generic agent spawns that has no edit tools and cannot write files. This was the cause of repeated delegation failures.

```
runSubagent(agentName: "build", description: "short label", prompt: "...")
```

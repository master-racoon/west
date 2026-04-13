# Hooks Registry

Hooks extend agent workflows by running targeted operations before agents act. Each hook is defined by a `.hook.json` manifest and optional companion script(s).

## Available Hooks

### `healer-lint.hook.json`

**Purpose**: Auto-fix code quality issues before healer applies substantive fixes.

**Invoked by**: Healer agent (pre-flight)

**Trigger**: `HealerStart`

**Action**: Runs on both `warehouse-backend/` and `warehouse-frontend/`:

- `oxfmt --write .` — format code with Oxfmt
- `oxlint --fix .` — lint with type-aware checks and auto-fix fixable issues

**Script**: `.github/hooks/healer-lint.sh`

**Reporting**: Results logged to stdout/stderr and reported back to healer agent

**Configuration**: Defined in `healer-lint.hook.json`

- Projects: warehouse-backend, warehouse-frontend
- Tools: oxfmt (enabled, auto-fix), oxlint (enabled, auto-fix, with-types)

## Hook File Structure

```json
{
  "name": "hook-identifier",
  "description": "What this hook does",
  "trigger": "TriggerEventName",
  "action": "inject-before-tool-use|pre-flight|post-operation",
  "applies-to": ["agent1", "agent2"],
  "script": ".github/hooks/script-name.sh",
  "logging": {
    "report-to-agent": true,
    "include-stdout": true,
    "include-stderr": true
  },
  "config": {
    "key": "value"
  }
}
```

## Creating New Hooks

1. Define manifest in `.github/hooks/HOOK_NAME.hook.json`
2. Create companion script (if needed) in `.github/hooks/HOOK_NAME.sh`
3. Make script executable: `chmod +x .github/hooks/HOOK_NAME.sh`
4. Update this registry with hook details

## Testing Hooks

Run a hook script directly:

```bash
./.github/hooks/healer-lint.sh
```

Expected output includes:

- ✅ Success indicators for each tool
- ⚠️ Non-blocking warnings
- ⏭️ Skipped tools (not installed)

---
name: ll-env
displayName: Luna Environment Manager
description: Validate .env files, generate .env.example, detect missing vars, per-environment configs
version: 1.0.0
category: devops
agent: luna-deployment
parameters:
  - name: action
    type: string
    description: Action to perform (validate, generate, sync, diff)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - scan_env_references
  - detect_missing_vars
  - validate_env_values
  - generate_env_example
  - sync_environments
  - check_secrets_exposure
  - generate_env_report
output:
  - .env.example
  - .luna/{current-project}/env-report.md
prerequisites: []
---

# Luna Environment Manager

Keep environment variables consistent and safe across all environments.

## What This Command Does

1. **Scan** — finds all `process.env.*` and `import.meta.env.*` references in code
2. **Detect** — identifies vars referenced in code but missing from .env
3. **Validate** — checks format (URLs are valid, ports are numbers, etc.)
4. **Generate** — creates .env.example with descriptions and safe defaults
5. **Sync** — compares .env.development, .env.staging, .env.production
6. **Secrets** — warns if secrets appear in committed files or logs
7. **Report** — documents all env vars with purpose and requirements

## Actions

| Action | What It Does |
|--------|-------------|
| `validate` | Check current .env against code references |
| `generate` | Create .env.example from code scan |
| `sync` | Compare vars across environments |
| `diff` | Show differences between two env files |

## Usage

```
/env                     # Full audit
/env validate            # Check for missing vars
/env generate            # Create .env.example
/env sync                # Compare environments
```

## Safety

- Never commits actual .env files
- Warns if .env is not in .gitignore
- Detects hardcoded secrets in source code
- Validates secret rotation needs

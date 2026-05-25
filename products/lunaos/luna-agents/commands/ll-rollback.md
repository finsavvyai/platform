---
name: ll-rollback
displayName: Luna Rollback Planner
description: Generate rollback procedures, down migrations, feature flags, canary config
version: 1.0.0
category: deployment
agent: luna-deployment
parameters:
  - name: deployment
    type: string
    description: Deployment to plan rollback for (latest, specific version, or feature name)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - analyze_deployment_changes
  - generate_rollback_steps
  - create_down_migrations
  - configure_feature_flags
  - create_canary_config
  - validate_rollback_path
  - generate_rollback_report
output:
  - .luna/{current-project}/rollback-plan.md
prerequisites: []
---

# Luna Rollback Planner

Generate safe rollback procedures for any deployment.

## What This Command Does

1. **Analyze** — reads deployment changes (code, schema, config)
2. **Steps** — generates ordered rollback procedure
3. **Migrations** — creates database down migrations
4. **Feature Flags** — sets up flags to disable features without redeploying
5. **Canary** — configures gradual rollout/rollback percentages
6. **Validate** — tests rollback path in staging
7. **Report** — complete rollback runbook

## Rollback Strategies

| Strategy | When to Use |
|----------|-------------|
| **Instant Revert** | Deploy previous version (no DB changes) |
| **Feature Flag** | Disable feature at runtime (DB safe) |
| **Down Migration** | Reverse database changes (schema changes) |
| **Canary Rollback** | Gradually shift traffic back (partial failure) |
| **Blue/Green** | Switch back to previous environment |

## Usage

```
/rollback                    # Plan for latest deployment
/rollback v1.2.0             # Specific version
/rollback "team billing"     # Specific feature
```

## Output

Runbook with exact commands to execute for each rollback scenario, including health check validation after each step.

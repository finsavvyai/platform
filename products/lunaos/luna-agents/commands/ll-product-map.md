---
name: ll-product-map
displayName: Luna Product Map
description: Visual product planning — hierarchical Product/Workflow/Feature cards with codebase mapping and approval workflows
version: 1.0.0
category: planning
agent: luna-product-mapper
parameters:
  - name: action
    type: string
    description: "Action to perform: create (new map), map (link code to features), plan (generate execution plan)"
    required: false
    default: create
    enum: [create, map, plan]
  - name: scope
    type: string
    description: "Scope to map: full project, specific module path, or feature name"
    required: false
workflow:
  - scan_project_structure
  - build_feature_hierarchy
  - map_code_to_features
  - generate_context_packages
  - create_approval_workflow
  - generate_test_specs
output: []
prerequisites: []
---

# Luna Product Map

Visual product planning inspired by Dossier. Creates a hierarchical Product, Workflow, and Feature card structure that maps your codebase to business features.

## What This Command Does

1. **Scan Project** — analyzes file structure, routes, components, and data models
2. **Build Hierarchy** — creates Product > Workflow > Feature card tree
3. **Map Code** — links source files, functions, and types to feature cards
4. **Generate Context** — creates a minimal context package per feature for agents
5. **Approval Workflow** — sets up review gates before agent execution
6. **Test Specs** — auto-generates E2E test specifications per feature

## Usage

```
/product-map
/product-map --action create
/product-map --action map --scope src/services/billing
/product-map --action plan --scope "user onboarding"
```

## Actions

### create
Generates a full product map from your codebase.

```
/product-map --action create
```

Output: `.luna/product-map/` directory with:
- `map.json` — machine-readable feature hierarchy
- `map.md` — human-readable product map
- `features/` — individual feature cards

### map
Links code to existing feature cards.

```
/product-map --action map --scope src/routes/billing
```

- Traces imports/exports from the scoped path
- Identifies which features the code supports
- Updates feature cards with file references

### plan
Generates an execution plan for a feature scope.

```
/product-map --action plan --scope "workflow execution"
```

- Identifies all tasks needed to complete the feature
- Orders tasks by dependency
- Estimates complexity and required agent types
- Creates context packages for each task

## Feature Card Format

```markdown
# Feature: Workflow Scheduling
- Product: LunaOS Engine
- Workflow: Execution Pipeline
- Status: In Progress
- Priority: P1

## Code References
- src/routes/schedules.ts (CRUD endpoints)
- src/services/scheduler.ts (cron evaluation)
- src/cron/heartbeat.ts (execution trigger)
- prisma/schema.prisma (workflow_schedules table)

## Context Package
- Token budget: 4,200
- Key types: WorkflowSchedule, CronConfig
- Dependencies: workflow-executor, d1-client

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Create schedule with valid cron -> 201
- Trigger schedule manually -> run created
- Disable schedule -> no future runs
- Invalid cron expression -> 400 validation error
```

## Hierarchy Visualization

```
LunaOS Platform
  +-- Engine API
  |     +-- Authentication
  |     |     +-- API Key Management
  |     |     +-- RBAC Permissions
  |     +-- Workflows
  |     |     +-- CRUD Operations
  |     |     +-- Versioning
  |     |     +-- Scheduling
  |     +-- Execution
  |           +-- Run Management
  |           +-- Step Processing
  |           +-- Log Streaming
  +-- Studio IDE
  |     +-- Visual Editor
  |     +-- Node Palette
  |     +-- Run Inspector
  +-- Dashboard
        +-- Team Management
        +-- Billing
        +-- Audit Logs
```

## Integration with Other Commands

- `/context-pack` uses feature context packages from product map
- `/smart-route` references feature complexity for model selection
- `/challenge` can generate challenges from unmapped features


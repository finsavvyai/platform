---
name: ll-migrate
displayName: Luna Database Migration
description: Generate database migrations — diff schema, generate SQL, validate up/down, seed test data
version: 1.0.0
category: database
agent: luna-database
parameters:
  - name: change
    type: string
    description: Migration description (e.g., "add teams table", "rename user.name to user.full_name")
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - analyze_current_schema
  - diff_schema_changes
  - generate_migration_up
  - generate_migration_down
  - generate_seed_data
  - validate_migration
  - generate_migration_report
output:
  - .luna/{current-project}/migrations/
  - .luna/{current-project}/migration-report.md
prerequisites: []
---

# Luna Database Migration

Generate safe, reversible database migrations.

## What This Command Does

1. **Analyze** — reads current Prisma/SQL schema and migration history
2. **Diff** — calculates what changed vs current state
3. **Generate UP** — creates forward migration SQL
4. **Generate DOWN** — creates rollback migration SQL
5. **Seed** — generates test data for new tables/columns
6. **Validate** — runs migration up then down to verify reversibility
7. **Report** — documents the migration with before/after schema

## Supported ORMs

- Prisma (D1, PostgreSQL, MySQL, SQLite)
- Drizzle
- Raw SQL migrations
- Knex

## Usage

```
/migrate "add organizations table with name, owner_id, created_at"
/migrate "add role column to team_members with default USER"
/migrate "rename workflows.definition to workflows.definition_json"
```

## Safety Rules

- Every UP migration must have a matching DOWN
- Destructive operations (DROP, DELETE) require explicit confirmation
- Data migrations include backup queries
- Validates foreign key constraints
- Tests with seed data before marking complete

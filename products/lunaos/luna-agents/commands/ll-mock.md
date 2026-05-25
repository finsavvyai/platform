---
name: ll-mock
displayName: Luna Mock Generator
description: Generate realistic test fixtures, API stubs, and factory functions from types/schema
version: 1.0.0
category: testing
agent: luna-testing-validation
parameters:
  - name: source
    type: string
    description: Path to types file, Prisma schema, or API routes
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - analyze_types_and_schema
  - generate_factory_functions
  - generate_fixtures
  - generate_msw_handlers
  - generate_seed_scripts
  - write_mock_tests
  - generate_mock_report
output:
  - .luna/{current-project}/mocks/
  - .luna/{current-project}/mock-report.md
prerequisites: []
---

# Luna Mock Generator

Generate realistic test data from your types and schemas.

## What This Command Does

1. **Analyze** — reads TypeScript types, Prisma schema, Zod schemas
2. **Factories** — creates factory functions with sensible defaults
3. **Fixtures** — generates realistic test data (names, emails, UUIDs)
4. **MSW Handlers** — creates Mock Service Worker API handlers
5. **Seed Scripts** — generates database seed scripts
6. **Tests** — validates all mocks match their types
7. **Report** — documents all generated mocks

## Output Structure

```
mocks/
  factories/
    user.factory.ts        # createUser(), createUsers(n)
    workflow.factory.ts    # createWorkflow(), withSteps()
    team.factory.ts        # createTeam(), withMembers()
  fixtures/
    users.json             # Static test data
    workflows.json
  handlers/
    auth.handlers.ts       # MSW handlers for auth API
    workflows.handlers.ts  # MSW handlers for workflows API
  seed.ts                  # Database seeder
  index.ts                 # Re-exports everything
```

## Usage

```
/mock src/types/              # From TypeScript types
/mock prisma/schema.prisma    # From Prisma schema
/mock src/routes/             # From API routes (generates MSW)
```

## Features

- Faker.js for realistic data (names, emails, dates, UUIDs)
- Factory pattern with builder methods (`.withRole('admin')`)
- MSW handlers that return factory data
- Relationships handled (user → teams → workflows)
- Deterministic mode for snapshot testing

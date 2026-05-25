---
name: ll-rules
displayName: Luna Session Rules
description: Apply strict coding session rules — 100-line file cap, full test coverage, Playwright e2e for every feature
version: 1.0.0
category: quality
agent: luna-code-review
parameters: []
workflow:
  - apply_session_rules
output: []
prerequisites: []
---

# Luna Session Rules

Apply strict coding standards and memory rules for the current session. Once invoked, these rules persist for the entire conversation.

## What This Command Does

Activates the following non-negotiable rules for every file you write or edit during this session:

### 1. File Size Cap — 100 Lines Max

- **Every source file** (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.py`, `*.css`) must be **100 lines or fewer**
- If a file approaches the limit, split immediately by responsibility
- Components, hooks, utils, types — each in their own file
- No exceptions. Count includes imports and exports
- Before finishing any file, verify line count

### 2. Full Unit Test Coverage — 100%

- **Every function, component, hook, and utility** must have unit tests
- Test file lives next to source: `foo.ts` → `foo.test.ts`
- Cover all branches: happy path, error cases, edge cases, null/undefined
- Use descriptive test names: `it('should return 403 when user lacks permission')`
- Mock external dependencies, test internal logic thoroughly
- Run tests after writing them — they must pass

### 3. Playwright E2E Test for Every Feature

- **Every new user-facing feature** gets a Playwright browser test
- Test file: `e2e/{feature-name}.e2e.test.ts`
- Test the complete user flow from start to finish
- Include:
  - Navigation to the feature
  - User interactions (clicks, typing, selections)
  - Visual assertions (element visible, text content)
  - API response validation (intercept and assert)
  - Error state handling (invalid input, network failure)
  - Mobile viewport test (at least one responsive check)
- Use Page Object Model for reusable selectors
- Each test must be independent — no shared state between tests

## Rules Summary

```
RULE 1: Max 100 lines per source file — split by responsibility
RULE 2: 100% unit test coverage — every function tested
RULE 3: Playwright e2e test — every new feature gets a browser flow test
```

## How to Apply

When this command runs, Claude will:

1. **Acknowledge** all three rules are active for the session
2. **Self-enforce** the rules on every file written or edited
3. **Split files proactively** when approaching 100 lines
4. **Write unit tests immediately** after each implementation file
5. **Write Playwright e2e tests** after each feature is complete
6. **Verify compliance** before marking any task as done

## Verification Checklist

Before completing any task, verify:

- [ ] No source file exceeds 100 lines (`wc -l`)
- [ ] Every source file has a corresponding `.test.ts` file
- [ ] All unit tests pass (`npm run test`)
- [ ] New features have `e2e/*.e2e.test.ts` files
- [ ] Playwright tests cover the full user flow
- [ ] All Playwright tests pass (`npx playwright test`)

## Tips

- Run `/rules` at the start of every coding session
- Pair with `/rev` to validate compliance after implementation
- Pair with `/test` to run the full test suite
- These rules stack with CLAUDE.md project rules (which allow 200 lines — this overrides to 100)

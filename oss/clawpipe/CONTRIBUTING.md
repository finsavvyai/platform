# Contributing to ClawPipe

Thank you for your interest in contributing to ClawPipe.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/finsavvyai/clawpipe.git
   cd clawpipe
   ```

2. Install SDK dependencies:
   ```bash
   cd sdk && npm install
   ```

3. Run tests:
   ```bash
   cd sdk && npm test
   ```

4. Preview the landing page:
   ```bash
   cd landing-page && npx wrangler pages dev .
   ```

## Branch Naming

- `feature/<description>` for new features
- `fix/<description>` for bug fixes
- `docs/<description>` for documentation changes

## Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

| Type       | When to use                                  |
|------------|----------------------------------------------|
| `feat`     | New feature or pipeline stage capability     |
| `fix`      | Bug fix or incorrect behaviour correction    |
| `docs`     | Documentation only changes                  |
| `refactor` | Code restructure, no behaviour change        |
| `test`     | Adding or updating tests                     |
| `chore`    | Build config, tooling, dependency updates    |

Examples:

```
feat(booster): add ISO 8601 date arithmetic rule
fix(router): handle undefined weight on first request
docs(readme): update Quick Start for v3 SDK
chore(sdk): bump vitest to 1.7
```

## Pull Request Process

1. Create a branch from `main` using the naming convention above.
2. Make your changes, keeping each source file under **200 lines**.
3. Write or update tests for your changes.
4. Ensure all tests pass locally (`cd sdk && npm test`).
5. Check no source file exceeds 200 lines (see File Size Limit below).
6. Open a PR against `main` using the PR template.
7. Wait for CI to pass and request a review.

## PR Checklist

Before marking your PR ready for review, confirm:

- [ ] All tests pass: `cd sdk && npm test`
- [ ] No source file in `sdk/src/` exceeds 200 lines
- [ ] Coverage thresholds met (>=90% line, >=85% branch; 100% for auth/payments/security)
- [ ] No secrets, credentials, or API keys committed
- [ ] No TODO/FIXME without a linked tracked issue
- [ ] Documentation updated where behaviour changed
- [ ] CHANGELOG entry added for user-visible changes

## Code Review

- All PRs require at least one approving review.
- CI must be green before merging.
- Coverage and security thresholds are enforced in CI.

## File Size Limit

Source files under `src/`, `app/`, and `lib/` must not exceed **200 lines**.
If a file grows past this limit, refactor it by splitting responsibilities.

To check which source files are approaching or over the limit:

```bash
find sdk/src -name "*.ts" -not -name "*.test.ts" -exec wc -l {} \; | sort -n
```

Any file reported over 200 lines must be split by feature or module responsibility
before the PR can merge.

## Code Style

- TypeScript with strict typing at system boundaries.
- Zod for input validation on all gateway endpoints.
- One module per pipeline stage (single responsibility).

## Reporting Issues

Use the issue templates in `.github/ISSUE_TEMPLATE/` for bug reports and
feature requests.

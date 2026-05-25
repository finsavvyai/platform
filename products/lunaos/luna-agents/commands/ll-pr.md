---
name: ll-pr
displayName: Luna PR Generator
description: Create pull request with summary, test plan, screenshots, linked issues, reviewer assignment
version: 1.0.0
category: workflow
agent: luna-code-review
parameters:
  - name: title
    type: string
    description: PR title (or auto-generate from commits)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - analyze_branch_changes
  - generate_summary
  - create_test_plan
  - detect_screenshots
  - link_issues
  - assign_reviewers
  - create_pr
  - generate_pr_report
output:
  - GitHub Pull Request
  - .luna/{current-project}/pr-report.md
prerequisites: []
---

# Luna PR Generator

Create comprehensive pull requests with everything reviewers need.

## What This Command Does

1. **Analyze** — reads all commits on current branch vs base
2. **Summary** — generates concise description of all changes
3. **Test Plan** — creates checklist of manual and automated tests
4. **Screenshots** — detects UI changes and adds screenshot placeholders
5. **Issues** — links related GitHub/Linear issues from commit messages
6. **Reviewers** — suggests reviewers based on code ownership
7. **Create** — opens PR via `gh pr create`
8. **Report** — saves PR details locally

## PR Template

```markdown
## Summary
- {bullet points of changes}

## Changes
| File | Change |
|------|--------|
| src/... | Added/Modified/Deleted |

## Test Plan
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing: {scenarios}

## Screenshots
{Before/After for UI changes}

## Related Issues
Closes #{issue_number}
```

## Usage

```
/pr                          # Auto-generate everything
/pr "Add team billing page"  # With custom title
```

## Features

- Auto-detects base branch (main/develop)
- Groups changes by type (features, fixes, refactors)
- Adds labels based on changed files (frontend, backend, docs)
- Warns about large PRs (>500 lines) and suggests splitting

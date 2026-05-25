---
name: ll-changelog
displayName: Luna Changelog
description: Auto-generate changelog from git history with semantic versioning
version: 1.0.0
category: documentation
agent: luna-documentation
parameters:
  - name: version
    type: string
    description: Version number (e.g., 1.2.0) or 'auto' for semantic detection
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - read_git_history
  - categorize_commits
  - determine_version
  - generate_changelog
  - update_package_version
  - generate_release_notes
output:
  - CHANGELOG.md
  - .luna/{current-project}/release-notes.md
prerequisites: []
---

# Luna Changelog

Auto-generate changelogs from git commits with semantic versioning.

## What This Command Does

1. **Read** — parses git log since last tag/release
2. **Categorize** — groups commits into Features, Fixes, Breaking Changes, etc.
3. **Version** — determines semver bump (major/minor/patch) from commit types
4. **Generate** — creates/updates CHANGELOG.md with new section
5. **Update** — bumps version in package.json
6. **Release Notes** — generates GitHub-ready release notes

## Commit Categories

| Prefix | Category | Version Bump |
|--------|----------|-------------|
| `feat:` | Features | minor |
| `fix:` | Bug Fixes | patch |
| `BREAKING:` | Breaking Changes | major |
| `perf:` | Performance | patch |
| `docs:` | Documentation | — |
| `refactor:` | Code Changes | — |
| `test:` | Tests | — |
| `chore:` | Maintenance | — |

## Usage

```
/changelog              # Auto-detect version
/changelog 2.0.0        # Specific version
/changelog auto         # Semantic auto-bump
```

## Output Format

```markdown
## [1.2.0] - 2026-03-29

### Features
- Add team billing page (#42)
- Support LinkedIn OAuth provider (#38)

### Bug Fixes
- Fix password reset 401 error (#41)

### Breaking Changes
- Remove legacy auth middleware (#40)
```

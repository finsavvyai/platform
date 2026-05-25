# Awesome-list submission plan — PipeWarden

Drafted 2026-05-04. Each entry below is a ready-to-fork PR. The body is copy-paste — only the fork-and-PR step needs to happen on a machine with `gh` auth + the target repo forked.

## Submission rules (read first)

Most awesome-list maintainers will close PRs that violate these:

1. **Alphabetical order** within the section. Find the right insertion point first.
2. **One project per PR.** Bundling = closed without review.
3. **No emoji or marketing language** in the line itself. Awesome-lists are terse.
4. **Project must meet maturity bar**: README, license, ≥30 days old, working examples. PipeWarden has all three.
5. **PR title format**: `Add PipeWarden` (not `feat: add ...`, not `Adding PipeWarden to ...`).

---

## 1. sindresorhus/awesome-nodejs … (skip — Node only)

## 2. avelino/awesome-go

- **Repo**: https://github.com/avelino/awesome-go
- **Section**: `Security` (CONTRIBUTING.md requires Go-native projects)
- **File**: `README.md`
- **Insertion**: alphabetical inside `## Security`
- **Line to add**:
  ```
  - [PipeWarden](https://github.com/finsavvyai/pipewarden) - CI/CD pipeline security scanner across GitHub, GitLab, Bitbucket, Jenkins, Azure DevOps, and CircleCI with Claude-AI remediation.
  ```
- **PR title**: `Add PipeWarden`
- **PR body**:
  ```
  Adds PipeWarden under Security.

  - Single Go binary, MIT licensed
  - 27k+ lines of production Go code, 491+ tests, CI green
  - Released, used in production, 30+ days old
  - One sentence description, no emoji, alphabetically inserted
  ```

## 3. analysis-tools-dev/static-analysis

- **Repo**: https://github.com/analysis-tools-dev/static-analysis
- **Section**: `## CI/CD` or `## Security`
- **Format**: this list uses YAML frontmatter per tool (`api/tools/`)
- **File to add**: `api/tools/pipewarden.yml`
- **Stub**:
  ```yaml
  name: PipeWarden
  categories:
    - security
    - devops
  languages:
    - golang
  other:
    - sarif
    - dlp
  homepage: https://pipewarden.com
  source: https://github.com/finsavvyai/pipewarden
  pricing: open_source
  license: MIT
  description: |
    CI/CD pipeline security scanner across GitHub Actions, GitLab CI,
    Bitbucket Pipelines, Jenkins, Azure DevOps, and CircleCI. Heuristic
    + Claude-AI analysis, DLP, OPA policy engine, SARIF export.
  ```
- **PR title**: `Add PipeWarden`

## 4. paragonie/awesome-appsec

- **Repo**: https://github.com/paragonie/awesome-appsec
- **Section**: `Tools and Services > CI/CD`
- **Line**:
  ```
  * [PipeWarden](https://github.com/finsavvyai/pipewarden) — Multi-platform CI/CD pipeline security scanner.
  ```

## 5. sbilly/awesome-security

- **Repo**: https://github.com/sbilly/awesome-security
- **Section**: `## DevSecOps` or `## CI/CD`
- **Line**:
  ```
  * [PipeWarden](https://github.com/finsavvyai/pipewarden) - CI/CD pipeline security scanner with Claude-AI remediation.
  ```

## 6. mre/awesome-static-analysis (legacy alias of analysis-tools-dev)

Skip — they redirect to analysis-tools-dev/static-analysis (#3).

## 7. nicolas-van/awesome-claude (or similar Anthropic-ecosystem lists)

- Search: `awesome claude`, `awesome anthropic`, `awesome llm tools`
- Angle: PipeWarden is a production app that uses Claude Messages API for security analysis with a custom sanitizer for untrusted CI input.

## 8. Mailing-list / community submissions (not awesome-lists, but high-leverage)

- **Hacker News Show HN** — `marketing/hn-show-hn.md` already drafted
- **Product Hunt** — `marketing/product-hunt-listing.md` already drafted
- **Reddit r/devops, r/golang, r/cybersecurity** — write per-subreddit version, no marketing tone
- **Lobsters** — invite-only, but PipeWarden fits `security` + `devops` tags well

---

## Execution order (recommended)

1. **Day 0**: avelino/awesome-go (#2) — biggest, clearest fit, alphabetic insert is straightforward.
2. **Day 1**: analysis-tools-dev/static-analysis (#3) — YAML schema, mechanical.
3. **Day 2-3**: paragonie/awesome-appsec (#4) + sbilly/awesome-security (#5) — both small, both review fast.
4. **Week 2**: HN Show HN + Product Hunt the same week (cross-promo).

Don't submit them all the same day — looks like spam.

## What's needed from the operator

- `gh auth status` → must show `finsavvyai` (not personal account if you want attribution)
- For each PR: `gh repo fork <target>` → clone fork → branch → edit → commit → `gh pr create`
- Track in a spreadsheet: target repo, PR URL, status (open/merged/closed/changes-requested)

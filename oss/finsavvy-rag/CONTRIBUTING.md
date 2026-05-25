# Contributing to finsavvy-rag

Thanks for considering a contribution. This is an Apache 2.0 OSS project; PRs
welcome.

## Quick rules

- **One thing per PR.** Small diffs ship.
- **Tests required** for any behaviour change (see below).
- **No SQL string concatenation.** All queries must use SQLAlchemy bound
  parameters (`text(":foo")` + `{"foo": value}`). PRs that introduce
  string-built SQL will be closed.
- **No secrets in commits.** Use `.env.example` placeholders only.
- **File size cap: 200 lines** for new files. Refactor if you exceed it.
- **No `@finsavvyai/*` imports.** This package is OSS-independent.

## Setting up locally

```bash
git clone <your-fork>
cd finsavvy-rag
cp .env.example .env
docker compose -f docker/compose.yml --env-file .env up -d
python3 -m venv .venv && source .venv/bin/activate
pip install -r services/rag/requirements.txt -r services/gateway/requirements.txt
```

## Running tests

A formal test harness is being introduced. Until then:

- For Python changes: add `pytest`-style tests under `services/<svc>/tests/`.
  Run with `pytest services/`.
- For TS type changes (under `src/types/`): types are compile-time only; verify
  with `tsc --noEmit` against a small consumer snippet.

Once a `pyproject.toml` / `vitest` setup lands, CI will require:

- Unit + integration tests for every PR
- ≥90% line coverage, ≥85% branch coverage overall
- 100% coverage on critical paths (ingest, search, any auth/audit hooks)

## Code style

- **Python:** `ruff` + `black` defaults. Type hints required on public
  functions.
- **TypeScript:** strict mode, no `any`, no silent catches.
- **SQL:** lowercase keywords, parameterised, formatted in `text("""...""")`
  blocks for readability.

## Commit + PR style

- Conventional commits encouraged: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`.
- PR description must explain **why**, not just what. Reference an issue
  number if applicable.
- Include before/after for any user-visible API change.

## Reporting security issues

Do **not** open a public issue for security bugs. Email the maintainers
privately (address listed in the GitHub repository's SECURITY.md once published)
and allow 90 days for coordinated disclosure.

## CLA

A Contributor License Agreement may be added later. For now, by submitting a
PR you confirm that:

1. You own the contribution or have permission to submit it.
2. You license it under Apache 2.0 (the project's license).
3. You are not aware of any third-party rights that would conflict.

This placeholder will be replaced with a formal CLA before the project
accepts contributions from external corporate contributors.

## Code of conduct

Be excellent to each other. Disagree on technical substance, not on people.
Maintainers reserve the right to close issues or PRs that violate this norm.

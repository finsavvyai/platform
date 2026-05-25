# Branch Protection (Recommended)

Use this to enforce live UI quality gates before merge.

## Target Branches
- `main`
- `develop` (optional, if you want the same gate there)

## Required Status Checks
Add this required check:
- `Playwright Live Validation`

This check is produced by:
- Workflow: `.github/workflows/live-e2e-sdlc.yml`
- Job: `playwright-live`

## GitHub Settings (UI)
1. Go to `Settings` -> `Branches`.
2. Create or edit a branch protection rule for `main`.
3. Enable:
- `Require a pull request before merging`
- `Require status checks to pass before merging`
- `Require branches to be up to date before merging` (recommended)
4. In required checks, select:
- `Playwright Live Validation`
5. Save changes.

## Notes
- The workflow runs live tests against `https://sdlc.cc`.
- Artifacts are uploaded on every run:
- `playwright-report-live-sdlc`
- `playwright-results-live-sdlc`

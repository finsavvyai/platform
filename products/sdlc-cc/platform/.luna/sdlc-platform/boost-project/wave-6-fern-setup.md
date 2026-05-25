# Wave 6 — Fern SDK Generation

> Status: infrastructure only (no SDKs regenerated yet)
> Owner: Platform / DX
> Blocks: none
> Depends on: `services/gateway/api/openapi.yaml` being authoritative

## Goal

Replace hand-maintained SDKs in `packages/sdk-ts`, `packages/sdk-py`, and
`packages/sdk-go` with code generated from the gateway's OpenAPI spec via
[Fern](https://github.com/fern-api/fern). SDKs are regenerated nightly and
submitted as reviewed pull requests.

## Why Fern

- Open-source alternative to Stainless, no per-seat pricing.
- Multi-language generators (TS, Python, Go, Java, C#, Ruby) from a single
  OpenAPI spec.
- Generators are versioned Docker images — deterministic, pinned output.
- Plays well with `local-file-system` output so generated code lives in-repo
  and reviews happen via normal PRs.

## Architecture

```
services/gateway/api/openapi.yaml  (source of truth)
             │
             ▼
       fern/generators.yml
             │
     fern generate --local
             │
  ┌──────────┼──────────────┐
  ▼          ▼              ▼
packages/  packages/     packages/
sdk-ts     sdk-py        sdk-go
```

## Files added in this wave

- `fern/fern.config.json` — organization + CLI version pin
- `fern/generators.yml` — TS / Py / Go generators with output paths
- `fern/definition/api.yml` — API metadata
- `fern/README.md` — contributor docs
- `scripts/regenerate-sdks.sh` — local wrapper around `fern generate --local`
- `.github/workflows/regenerate-sdks.yml` — nightly CI job
- `.luna/sdlc-platform/boost-project/wave-6-fern-setup.md` — this file

## Workflow overview

### Local regeneration

```bash
# one-time
npm install -g fern-api

# repeat any time the OpenAPI spec changes
./scripts/regenerate-sdks.sh
```

The wrapper verifies the fern CLI is installed, verifies the OpenAPI spec
exists, runs `fern generate --local` inside `fern/`, and prints a
`git diff --stat` of the generated packages.

### Nightly CI

`.github/workflows/regenerate-sdks.yml` runs at 03:00 UTC and on manual
`workflow_dispatch`:

1. Checkout `main`.
2. Install Node 20 + Fern CLI.
3. `fern generate --local`.
4. If a diff exists in `packages/sdk-*`, open a PR titled
   `chore: regenerate SDKs from OpenAPI` labelled `auto-generated` via
   `peter-evans/create-pull-request@v6`.

The bot never force-merges. A human must approve every PR.

## Adding a new generator

Example — adding the Java SDK:

1. Create `packages/sdk-java/` (empty, plus a short `README.md`).
2. Append to `fern/generators.yml`:

   ```yaml
       - name: fernapi/fern-java-sdk
         version: 2.0.0
         output:
           location: local-file-system
           path: ../packages/sdk-java
         metadata:
           package-name: "ai.sdlc.sdk"
           repository-url: "https://github.com/sdlc/sdlc-platform"
   ```

3. Run `./scripts/regenerate-sdks.sh`.
4. Open a PR; label it `auto-generated`.
5. Add the new path to the `add-paths` list in
   `.github/workflows/regenerate-sdks.yml`.

## PR review — human in the loop

Auto-generated PRs must be reviewed by a human. Reviewers check for:

- **Breaking changes**
  - Removed endpoints, renamed fields, changed types, removed enum values.
  - If any are intentional, confirm the OpenAPI spec change is also
    reflected in release notes and SDK consumers are warned.
- **Unexpected churn**
  - Large diffs with no OpenAPI change usually mean a generator version
    bump slipped in. Pin the generator version in `generators.yml`.
- **Build health**
  - CI must be green on the generated PR branch (lint, typecheck, unit
    tests for each SDK package).
- **Security**
  - No new dependencies with critical/high vulnerabilities.
  - No secrets or internal URLs leaked from the OpenAPI spec.

Breaking changes that ship anyway must:

- Bump the SDK major version.
- Update changelog entries in each SDK package.
- Be called out in the PR description.

## Troubleshooting

**`fern: command not found`**
Install with `npm install -g fern-api`. On CI, the workflow installs it
explicitly in the `Install Fern CLI` step.

**`docker: command not found` when running locally**
`fern generate --local` uses Docker to pull generator images. Install
Docker Desktop (macOS/Windows) or the Docker Engine (Linux) and re-run.

**Generator image pull failures**
Fern pulls images from `fernapi/fern-*-sdk`. Check Docker Hub rate limits,
authenticate with `docker login`, or retry with
`docker pull fernapi/fern-typescript-sdk:<version>` to prime the cache.

**Huge unexpected diff**
Likely a generator version bump. Pin the `version:` field in
`generators.yml` to the previous known-good version and regenerate.

**OpenAPI spec fails to parse**
Run `fern check` inside `fern/`. Fix validation errors in
`services/gateway/api/openapi.yaml`; Fern follows the OpenAPI 3.0.3 spec
strictly.

**CI opens no PR even though I expected one**
The `Detect SDK changes` step short-circuits if `git status --porcelain`
on `packages/sdk-*` is empty. Trigger via `workflow_dispatch` with a
modified spec to verify.

## Next steps (out of scope for this wave)

- Enable Fern's breaking-change detection (`fern check --breaking`) as a
  required CI check on the generated PR.
- Publish `packages/sdk-ts` to npm under `@sdlc/sdk` on tagged releases.
- Publish `packages/sdk-py` to PyPI under `sdlc-sdk`.
- Add `packages/sdk-java` once the Java API partner lands.

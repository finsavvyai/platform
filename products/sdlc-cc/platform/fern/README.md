# Fern SDK Generation

This directory contains the [Fern](https://github.com/fern-api/fern) workspace
that regenerates `packages/sdk-ts`, `packages/sdk-py`, and `packages/sdk-go`
from the gateway's OpenAPI specification at
`services/gateway/api/openapi.yaml`.

## Layout

```
fern/
  fern.config.json        # Organization + Fern CLI version
  generators.yml          # Generator definitions (TS / Python / Go)
  definition/
    api.yml               # API metadata (name + display name)
  README.md               # This file
```

The OpenAPI spec is imported directly via the `api.specs` entry in
`generators.yml`, so the source of truth remains
`services/gateway/api/openapi.yaml`. Do not hand-edit SDKs in
`packages/sdk-*/` — any change there will be overwritten on the next run.

## Prerequisites

- Node.js 18+
- `npm install -g fern-api`

Verify the install:

```bash
fern --version
```

## Running locally

From the repo root:

```bash
./scripts/regenerate-sdks.sh
```

This wraps `fern generate --local`, which:

1. Reads `fern/generators.yml`.
2. Pulls the generator Docker images (TypeScript, Python, Go).
3. Writes freshly generated code into `packages/sdk-ts/`, `packages/sdk-py/`,
   and `packages/sdk-go/`.
4. Prints a `git diff --stat` summary for review.

If you want to run Fern directly:

```bash
cd fern
fern generate --local
```

## Adding a new generator (e.g. Java)

1. Append a new entry under `groups.local.generators` in `generators.yml`:

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

2. Create `packages/sdk-java/` with a placeholder `README.md`.
3. Run `./scripts/regenerate-sdks.sh` and commit the generated files in a PR
   labelled `auto-generated`.

## Nightly CI

`.github/workflows/regenerate-sdks.yml` runs every night at 03:00 UTC and can
also be triggered manually via `workflow_dispatch`. The workflow:

1. Checks out `main`.
2. Installs Fern CLI (`npm install -g fern-api`).
3. Runs `fern generate --local` inside `fern/`.
4. If there is a non-empty diff under `packages/sdk-*/`, opens a pull request
   titled `chore: regenerate SDKs from OpenAPI` with the label
   `auto-generated` using `peter-evans/create-pull-request`.

Breaking-change detection is handled at review time — a human must approve
every auto-generated PR before it merges. See
`.luna/sdlc-platform/boost-project/wave-6-fern-setup.md` for the review
checklist and troubleshooting notes.

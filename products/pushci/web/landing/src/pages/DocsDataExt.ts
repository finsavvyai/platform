import type { DocSection } from './DocsData'

export const extSections: DocSection[] = [
  {
    id: 'runners',
    title: 'Self-Hosted Runners',
    content: `# Register a runner
pushci runner register --name my-laptop

# Start the runner daemon
pushci runner start

# List active runners
pushci runner list

# Runners execute builds on your hardware.
# $0 compute cost. No cold starts. Any OS.
# 1 runner free forever. Unlimited on Team plans.`,
  },
  {
    id: 'artifacts',
    title: 'Build Artifacts',
    content: `# Artifacts are captured automatically from every run.
# Track bundle sizes, test reports, and build outputs.

# View artifacts for a run
pushci logs --run 42 --artifacts

# Compare artifacts between runs
pushci bench --compare main..feature

# Set size thresholds to catch regressions
# pushci.yml:
artifacts:
  track: [dist/**, coverage/lcov.info]
  max_bundle: 500kb`,
  },
  {
    id: 'api',
    title: 'API Reference',
    content: `Base URL: https://api.pushci.dev/v1

POST   /webhooks/:provider     Receive git provider webhooks
GET    /runs                    List pipeline runs
GET    /runs/:id                Get run details + logs
POST   /runs/:id/rerun          Rerun a pipeline
GET    /projects                List projects
POST   /projects                Create project
GET    /runners                 List runners
POST   /runners/register        Register a runner
GET    /artifacts/:runId        List artifacts for a run
GET    /channels                List notification channels
POST   /channels                Create channel
DELETE /channels/:id            Remove channel
POST   /ask                     AI assistant query
GET    /billing/usage           Current billing usage`,
  },
  {
    id: 'examples',
    title: 'Examples',
    content: `# Node.js / TypeScript
npx pushci init     # detects package.json, runs npm test

# Go
npx pushci init     # detects go.mod, runs go test ./...

# Python
npx pushci init     # detects requirements.txt, runs pytest

# Rust
npx pushci init     # detects Cargo.toml, runs cargo test

# Monorepo
npx pushci init     # detects workspaces, runs all packages`,
  },
  {
    id: 'dogfood-opensyber',
    title: 'Case Study: Dogfooding PushCI on a 47-Package Monorepo',
    content: `We ran pushci init against a real production monorepo — 47 packages,
pnpm workspaces, Turborepo for task orchestration. Six bugs surfaced
in the first run. All six were fixed the same day. Here is what broke
and how each fix works.

## The Repo

- 47 npm packages in a pnpm workspace
- turbo.json defining build, test, lint, and typecheck pipelines
- Nested package directories under apps/ and packages/
- Build artifacts in .next/, .turbo/, dist/, and node_modules/

## Bug 1 — pnpm workspaces not detected

Symptom: pushci init generated a separate stage for each of the 47
packages instead of treating them as a unified workspace. The output
pushci.yml had 47 install steps.

Root cause: The workspace detection path only looked for
yarn.lock + workspaces field in package.json. It skipped pnpm-workspace.yaml.

Fix: internal/detect/workspace.go now reads pnpm-workspace.yaml
and consolidates all packages under a single root install stage.
One pnpm install at the root. Packages inherit via node_modules/.pnpm/.

## Bug 2 — Static npm install regardless of lockfile

Symptom: Even with pnpm-lock.yaml present, the generated pipeline
used npm install.

Root cause: The install command was hardcoded. The lockfile was
never inspected.

Fix: internal/detect/node_buildtool.go now checks for lockfiles in
priority order:

\`\`\`
pnpm-lock.yaml   → pnpm install --frozen-lockfile
yarn.lock        → yarn install --frozen-lockfile
package-lock.json → npm ci
(none)           → npm install
\`\`\`

CI-safe flag (--frozen-lockfile / ci) is used automatically
so installs fail fast on lockfile drift instead of silently
updating packages mid-pipeline.

## Bug 3 — turbo.json ignored

Symptom: pushci init did not generate Turborepo-aware stages.
All packages got generic npm run build / npm test commands
instead of turbo run build --filter=... calls.

Root cause: cmd/pushci/cmd_init_generate.go did not check for
turbo.json at the repo root.

Fix: buildTurboStages() reads turbo.json, extracts the pipeline
keys (build, test, lint, typecheck, etc.), and generates a single
stage per pipeline key using:

\`\`\`
turbo run <task>
\`\`\`

Turborepo handles caching and parallelism. PushCI just invokes
the correct entry point.

## Bug 4 — Build artifact directories treated as packages

Symptom: pushci init found 63 "packages" instead of 47. The extra
16 were .next/server/, .turbo/cache/, dist/cjs/, and similar
build output directories.

Root cause: internal/detect/find.go walked all directories looking
for package.json. Build artifacts in .next/ contain generated
package.json files that confused the detector.

Fix: Extended the skipDirs list from 4 entries to 12:

\`\`\`
.next        .turbo       .cache       dist
out          build        coverage     .nyc_output
storybook-static   .docusaurus   public/build   .svelte-kit
\`\`\`

The scanner now skips these on the way down, so their contents
are never walked.

## Bug 5 — Redundant root install stage

Symptom: The generated pipeline had both a root-level install
stage and per-package install stages, so npm install ran 48 times.

Root cause: Workspace consolidation was not wired up — packages
were detected but the root workspace relationship was not
established, so the generator emitted both levels.

Fix: Absorbed by the workspace consolidation in Bug 1. Once
pnpm-workspace.yaml is detected, the generator emits only one
install stage at the workspace root. Per-package install stages
are suppressed.

## Bug 6 — pushci run --help silently ran the pipeline

Symptom: Typing pushci run --help kicked off a full build instead
of printing help. In a large monorepo this meant accidentally
running turbo build across all 47 packages.

Root cause: The run command parsed --help as a pipeline argument
and passed it through. The early-exit check ran after pipeline
dispatch, not before.

Fix: cmd/pushci/help_intercept.go adds a wantsHelp() check that
runs before any pipeline logic. If -h, --help, or help is present
in os.Args, the command prints usage and exits with code 0.
No pipeline is ever dispatched.

## Result

After all six fixes, pushci init on the same repo produces a
correct pipeline in ~2 seconds:

\`\`\`
Detected: pnpm workspace (47 packages)
Detected: Turborepo (build, test, lint, typecheck)
Generated: pushci.yml

stages:
  - name: install
    run: pnpm install --frozen-lockfile

  - name: build
    run: turbo run build

  - name: test
    run: turbo run test

  - name: lint
    run: turbo run lint
\`\`\`

All 47 packages are covered. Turbo handles caching and parallelism.
The regression test lives at internal/detect/dogfood_opensyber_test.go
and runs on every push.`,
  },
  {
    id: 'skills',
    title: 'Skills Marketplace',
    content: `# Browse available skills
pushci skill list

# Search by keyword
pushci skill search deploy

# Install a skill
pushci skill add ai-review

# Popular skills: secret-scan, ai-review, slack-notify,
# cloudflare-deploy, coverage-gate, k8s-deploy, ai-test-gen

# Create your own skill as a YAML file:
# See pushci.dev/skills for the full marketplace.`,
  },
]

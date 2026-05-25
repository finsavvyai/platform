# PushCI audit harness

A promise-vs-reality audit for PushCI. Rerun weekly to catch regressions
between marketing claims, the CLI, the API, and the landing site.

## Run it

```bash
make audit          # offline checks only
make audit-live     # adds live pushci.dev / api.pushci.dev probes
```

or directly:

```bash
bash audit/run.sh                    # all checks
bash audit/run.sh cli promises       # a subset
PUSHCI_LIVE=1 bash audit/run.sh      # enable live probes
PUSHCI=/path/to/custom-binary bash audit/run.sh
```

Exit code is 0 iff every check passed; 77-status checks count as skipped,
not failed.

## What each check asserts

| Check | What it verifies | Failure mode |
|---|---|---|
| `cli.sh` | Every visible and hidden subcommand responds to `--help` without panicking. | CLI broken or command missing. |
| `init_and_run.sh` | `pushci init` on a Node fixture detects the stack, writes a valid `pushci.yml`, and `pushci run` executes it. | Detection regression or runner regression. |
| `generate_valid_yaml.sh` | `pushci generate` (AI-driven) emits a `pushci.yml` with a `stages:` key that actually runs. **Known bug:** v1.7.0 emits a flat `checks:` root with bare commands that fail. | Regression or bug fix detection. |
| `ai_provider_override.sh` | `PUSHCI_AI_PROVIDER=groq` and `=anthropic` pick the right backend. **Known bug:** banner always says "Using your own ANTHROPIC_API_KEY". | Provider logic broken or banner still misleading. |
| `promises.sh` | Claims on package.json / landing index.html match reality (deploy target count, skill count, CLI version, CLAUDE.md freshness). | Marketing drift. |
| `landing_seo.sh` | Landing head has title, description, OG, Twitter card, canonical, JSON-LD, viewport. Dashboard is `noindex`. Legal pages exist. Hero claims match package.json. | SEO regression. |
| `mcp_handshake.sh` | MCP server responds to a JSON-RPC `initialize`. | MCP broken. |
| `live_site.sh` | Only runs when `PUSHCI_LIVE=1`. Probes `pushci.dev`, `api.pushci.dev`, GitHub releases. | Site down / redirect changed / CI release broken. |

## Skip semantics

Any check that can't run in the current environment (no API keys, live
network disabled, etc.) exits **77** and is recorded as `SKIP` — not
`FAIL`. Checks that catch a real regression exit non-zero.

## Output

```
audit/results/summary.json        aggregate JSON (pass/fail/skip counts per check)
audit/results/<check>.log         full stdout+stderr for each check
```

The JSON shape is stable so the harness can be consumed by dashboards or
a scheduled `pushci run`:

```json
{
  "started_at": "...",
  "pushci_version": "pushci 1.7.0",
  "totals": {"pass": 6, "fail": 1, "skip": 1, "total": 8},
  "checks": [
    {"name": "cli", "status": "pass", "rc": 0, "duration_s": 3,
     "log": "audit/results/cli.log"},
    ...
  ]
}
```

## Known bugs the harness tracks

These fire today (v1.7.0). The harness exists to catch the day they're fixed
— flip the assertion, or delete the check, when that happens.

1. **`pushci status` always reports 0 runs.** `internal/observe.Collector`
   keeps records only in memory; every invocation spins up a fresh
   collector. The VS Code extension's tree view depends on
   `.pushci/last-run.json` which is never written either.
2. **`pushci generate` produces an invalid `pushci.yml`** (top-level
   `checks:` instead of `stages:`, bare `build`/`test` commands that
   shell out to missing binaries).
3. **Provider banner always says "Using your own ANTHROPIC_API_KEY"**
   even when `PUSHCI_AI_PROVIDER=groq` (or any other backend) is active.
4. **Deploy target count mismatch.** `pushci deploy --help` lists 20
   targets; package.json claims 23; landing `featuresData.ts` says 16.
5. **CLAUDE.md version drift.** File claims v1.3.0 while the CLI is v1.7.0.
6. **Cosmetic:** `pushci scan --format json` interleaves ANSI-colored
   human status lines with the JSON body, so piping to `jq` requires a
   sed filter.

## Adding a check

1. Drop a new `audit/checks/<name>.sh` that reads `$PUSHCI` and exits 0 on
   pass, 77 on skip, any other code on fail.
2. Keep it idempotent and under ~5 seconds. No `rm -rf` outside of
   `$(mktemp -d)`.
3. Update the table above.

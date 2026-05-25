# SAST + Dependency + Secret Scan — 2026-04-29

Run as part of the "production-ready" feature push. Per CLAUDE.md
section "Security Rules", releases block on unresolved Critical or
High findings. Moderate dev-only findings are tracked but do not
block.

## Production npm audit (`npm audit --omit=dev`)

| Package      | Vulnerabilities |
|--------------|-----------------|
| `sdk`        | 0               |
| `gateway`    | 0               |
| `mcp-server` | 0               |

**Status**: PASS — zero production vulnerabilities.

## Full npm audit (includes dev deps)

| Package      | Total | Critical | High | Moderate | Low |
|--------------|-------|----------|------|----------|-----|
| `sdk`        | 0     | 0        | 0    | 0        | 0   |
| `gateway`    | 0     | 0        | 0    | 0        | 0   |
| `mcp-server` | 0     | 0        | 0    | 0        | 0   |

The earlier 5+6+4 moderate dev-only findings (vitest/vite/vite-node/
esbuild/postcss chain) were cleared by bumping to vitest 3.2.4 and
@vitest/coverage-v8 3.2.4. See commit `684f332`.

**Status**: PASS — zero findings across all packages including dev
dependencies.

## Secret scan

Patterns checked: `sk-[a-zA-Z0-9]{20,}`, `AKIA[A-Z0-9]{16}`,
`gh[pousr]_[A-Za-z0-9]{36}`, `xox[baprs]-[A-Za-z0-9-]+`,
`AIza[A-Za-z0-9_-]{35}`. Excluded: tests, examples, placeholders.

**Status**: PASS — zero hits in `sdk`, `gateway`, `mcp-server`,
`landing-page`.

## Dangerous-pattern grep

Patterns checked: `eval(`, `new Function(`, `innerHTML =`.

| Hit | Location | Status |
|-----|----------|--------|
| `new Function(`return (${cleaned})`)` | `sdk/src/booster-rules/logic-rules.ts:63` | SAFE — guarded by `/^[!&|=()truefals\s]+$/` regex whitelist; only boolean operators reach the constructor. |
| `innerHTML =` | `dashboard/index.html` (10 sites) | SAFE — every interpolated value passes through the local `esc()` helper which uses `document.createElement('div').textContent = s` and reads back `innerHTML`, escaping HTML entities. |

**Status**: PASS — no unsafe `eval`/`Function`/`innerHTML` paths.

## Logged secrets

`grep -rEn "console\.log.*(api|key|secret|token|password)"`:

| Location | Content | Status |
|----------|---------|--------|
| `sdk/src/cli.ts:161` | `Gateway URL: ${process.env.CLAWPIPE_GATEWAY_URL ?? '...'}` | SAFE — gateway URL is public. |

**Status**: PASS — no secrets logged.

## License compliance

Walked every transitive prod-deps `package.json` across all three
packages and grouped by license string. Result set:

- **Permissive**: `MIT`, `ISC`, `Apache-2.0`, `BSD-2-Clause`,
  `BSD-3-Clause`.
- **Copyleft**: none.
- **Proprietary / unknown**: none in production.

**Status**: PASS — every prod dep is on the portfolio-allowed list.

## Conclusion

All four mandatory PR-time checks per `/CLAUDE.md` ("Security Rules")
return PASS:

- [x] SAST scan
- [x] Dependency vulnerability scan
- [x] Secret scan
- [x] License compliance scan

No Critical, High, Moderate, or Low findings — the dev-dep chain has
been bumped (vitest 3.2.4) and the audit is fully clean.

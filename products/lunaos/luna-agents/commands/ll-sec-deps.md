---
name: ll-sec-deps
displayName: Luna Security — Dependency Audit
description: SCA via OSV-Scanner (Google) + license-checker. Catches vulnerable + non-compliant deps across npm/pypi/maven/cargo/go.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target
    type: string
    default: .
  - name: lockfiles
    type: string
    description: Comma-separated lockfile globs
    default: "**/package-lock.json,**/pnpm-lock.yaml,**/yarn.lock,**/poetry.lock,**/Pipfile.lock,**/go.sum,**/Cargo.lock,**/Gemfile.lock"
  - name: licenses_allow
    type: string
    default: "MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC,MPL-2.0,Unlicense,CC0-1.0,WTFPL"
  - name: strict
    type: boolean
    default: true
workflow:
  - install_osv_scanner_lazy
  - run_osv_scanner_sarif
  - run_license_checker
  - cross_check_with_dependabot_alerts
  - severity_gate
output:
  - .luna/{current-project}/security/raw/deps-osv.sarif
  - .luna/{current-project}/security/raw/deps-licenses.json
  - .luna/{current-project}/security/deps-summary.md
---

# Luna Security — Dependency Audit

Detects vulnerable + license-non-compliant transitive dependencies.

## Tools

| Tool | Repo | License | Role |
|------|------|---------|------|
| **osv-scanner** | github.com/google/osv-scanner | Apache-2.0 | Multi-ecosystem CVE/GHSA matching via OSV.dev |
| **license-checker-rseidelsohn** | github.com/RSeidelsohn/license-checker-rseidelsohn | BSD-3-Clause | npm license inventory |

OSV-Scanner preferred over `npm audit` — fewer false positives, supports go/cargo/maven/pypi too.

## Usage

```bash
/ll-sec-deps
/ll-sec-deps --target packages/api
/ll-sec-deps --licenses_allow "MIT,Apache-2.0"     # tightest allowlist
```

## Pipe

```
/pipe ll-sec-deps >> ll-sec-sast >> rev
/pipe ll-sec-deps >> ll-sec-push
```

## Output

- `deps-osv.sarif` — vuln findings keyed to lockfile entries.
- `deps-licenses.json` — package → license map.
- `deps-summary.md`:
  - vulnerabilities table (CVE · severity · pkg · ver · fix-version)
  - license violations table (pkg · license · status)
  - upgrade plan (`pnpm up <pkg>@<safe>`).

## Severity Gate

CVE Critical/High → block. Non-allowlisted license → block. Override with `--strict false`.

## Notes

- Scans transitive deps, not just declared.
- Caches OSV DB locally (~24h) to skip repeat downloads.
- Supports `--call-analysis go` for reachability filtering on Go.

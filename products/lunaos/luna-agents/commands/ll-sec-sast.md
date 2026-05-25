---
name: ll-sec-sast
displayName: Luna Security — SAST (Semgrep)
description: Static analysis with Semgrep using OWASP Top 10 + CWE Top 25 + language-specific rulesets
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target
    type: string
    default: .
  - name: rulesets
    type: string
    default: "p/owasp-top-ten,p/cwe-top-25,p/javascript,p/typescript,p/python,p/golang,p/secrets"
  - name: severity
    type: enum
    values: [info, warning, error]
    default: warning
  - name: strict
    type: boolean
    default: true
workflow:
  - install_semgrep_lazy
  - fetch_rulesets
  - run_semgrep_sarif
  - filter_severity
  - severity_gate
output:
  - .luna/{current-project}/security/raw/sast-semgrep.sarif
  - .luna/{current-project}/security/sast-summary.md
---

# Luna Security — SAST

Static code analysis. Catches injection, auth flaws, crypto misuse, race conditions, unsafe deserialization, etc.

## Tool

| Tool | Repo | License |
|------|------|---------|
| **semgrep** | github.com/semgrep/semgrep | LGPL-2.1 |

## Rulesets (OSS, no Pro key required)

- `p/owasp-top-ten` — direct OWASP coverage
- `p/cwe-top-25` — MITRE top 25 weaknesses
- `p/javascript` `p/typescript` `p/python` `p/golang` — language idiom rules
- `p/secrets` — secondary secret pattern catch
- `p/jwt` `p/sql-injection` `p/xss` — focused packs

## Usage

```bash
/ll-sec-sast
/ll-sec-sast --target src/api
/ll-sec-sast --rulesets "p/owasp-top-ten,p/jwt"
/ll-sec-sast --severity error    # only ERROR-level findings
```

## Pipe

```
/pipe feature "x" >> ll-sec-sast >> rev >> pr
/pipe ll-sec-sast >> ll-sec-push
```

## Output

- SARIF file for IDE / GitHub Code Scanning upload.
- `sast-summary.md`: severity table + top 10 findings + remediation links.

## Custom Rules

Drop `.semgrep/*.yaml` in repo root. Auto-loaded.

## Severity Gate

ERROR = Critical · WARNING = High · INFO = Med. Strict mode blocks Critical+High.

## Notes

- Runs ~15-30s on mid-size repos.
- `.semgrepignore` honored.
- Auto-skips `node_modules`, `dist`, `build`, `.next`, `vendor`.

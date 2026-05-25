---
name: ll-sec-fuzz
displayName: Luna Security — Fuzz
description: Coverage-guided fuzzing per language — Jazzer.js (JS/TS), Atheris (Python), go-fuzz / native libFuzzer (Go)
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target
    type: string
    description: Path or symbol to fuzz (e.g., src/parsers/json.ts:parseStrict)
    required: true
    prompt: true
  - name: language
    type: enum
    values: [auto, js, ts, python, go]
    default: auto
  - name: duration_seconds
    type: number
    default: 300
  - name: corpus_dir
    type: string
    default: .luna/{current-project}/security/fuzz/corpus
workflow:
  - detect_language
  - install_fuzzer_lazy
  - generate_or_load_corpus
  - run_fuzzer_with_timeout
  - minimize_crashes
  - emit_repro_cases
output:
  - .luna/{current-project}/security/fuzz/crashes/
  - .luna/{current-project}/security/fuzz/corpus/
  - .luna/{current-project}/security/fuzz-summary.md
---

# Luna Security — Fuzz

Coverage-guided fuzzing. Catches parser/deserialization/regex bugs that hand-written tests miss.

## Tools

| Lang | Tool | Repo | License |
|------|------|------|---------|
| JS/TS | **Jazzer.js** | github.com/CodeIntelligenceTesting/jazzer.js | Apache-2.0 |
| Python | **Atheris** | github.com/google/atheris | Apache-2.0 |
| Go | **native fuzz** (Go 1.18+) | (stdlib) | BSD |
| Multi | **AFL++** | github.com/AFLplusplus/AFLplusplus | Apache-2.0 |

## Usage

```bash
/ll-sec-fuzz --target src/parsers/json.ts:parseStrict --language ts --duration_seconds 600
/ll-sec-fuzz --target backend/api/auth.py:verify_token --language python
/ll-sec-fuzz --target ./internal/parser --language go
```

## Pipe

```
/schedule daily ll-sec-fuzz --target src/parsers
/pipe ll-sec-fuzz --duration_seconds 60 >> ll-sec-push
```

## Output

- `crashes/` — minimized inputs that triggered crashes (commit-friendly, deterministic repros).
- `corpus/` — accumulated coverage corpus (commit it; speeds up next run).
- `fuzz-summary.md`: edges covered, crashes found, top crash sites, suggested unit tests.

## Wiring Fuzz Targets

For TypeScript/JavaScript:
```ts
// src/parsers/json.fuzz.ts
import { parseStrict } from './json';
export function fuzz(data: Buffer) { try { parseStrict(data.toString()); } catch (e) { if (e.name === 'SyntaxError') return; throw e; } }
```

## Severity Gate

Any crash = High. Strict mode blocks merges/release.

## Notes

- Default 5 min run is enough for CI smoke fuzz; nightly runs should use 1-4h.
- Persist corpus in `.luna/{project}/security/fuzz/corpus/` and commit — speeds up re-runs and shares finds across machines.

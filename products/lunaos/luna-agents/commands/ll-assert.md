---
name: ll-assert
displayName: Luna Assert
description: Validate project constraints — file size, coverage, security, accessibility thresholds
version: 1.0.0
category: quality
agent: luna-code-review
parameters:
  - name: checks
    type: string
    description: Assertions to validate (coverage, file-size, security, a11y, deps, all)
    required: false
    prompt: true
workflow:
  - run_assertions
  - report_results
output:
  - .luna/{current-project}/assert-report.md
prerequisites: []
---

# Luna Assert

Validate project constraints and fail fast if thresholds aren't met.

## Built-in Assertions

| Assertion | What It Checks |
|-----------|---------------|
| `files.max_lines <= 100` | No source file exceeds 100 lines |
| `test.coverage >= 90` | Test coverage at or above 90% |
| `test.pass` | All tests passing |
| `security.critical == 0` | No critical vulnerabilities |
| `security.high == 0` | No high vulnerabilities |
| `a11y.critical == 0` | No critical accessibility issues |
| `deps.outdated <= 5` | Max 5 outdated dependencies |
| `deps.vulnerable == 0` | No vulnerable dependencies |

## Usage

### Standalone
```
/assert all                          # Run all assertions
/assert coverage                     # Coverage only
/assert file-size                    # File size only
/assert security                     # Security only
```

### In Pipes
```
/pipe go *5 >> assert files.max_lines <= 100 >> test
/pipe test >> assert $test.coverage >= 90 >> ship
/pipe sec >> assert security.critical == 0 >> ship
/pipe go >> assert files.max_lines <= 100 >> assert test.pass >> pr
```

### As Quality Gate
```
/pipe go *5 >> (
  assert files.max_lines <= 100 ~~
  assert test.coverage >= 90 ~~
  assert security.critical == 0 ~~
  assert a11y.critical == 0
) >> ship
```

## Custom Assertions

```
/pipe go >> assert $test.coverage >= 95    # Stricter coverage
/pipe go >> assert files.max_lines <= 80   # Stricter file size
/pipe go >> assert deps.vulnerable == 0    # Zero vulnerabilities
```

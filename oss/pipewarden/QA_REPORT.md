# QA Report — pipewarden
**Date:** 2026-03-20
**Wave:** 2

## File Size Check (≤200 lines)
- Total source files: 78
- Files over 200 lines: 33
- **FAIL**: Multiple files exceed 200 lines
  - cmd/pipewarden/main.go: 846 lines
  - internal/storage/storage.go: 406 lines
  - internal/storage/storage_test.go: 395 lines
  - internal/integrations/manager_test.go: 372 lines
  - internal/analysis/heuristic.go: 334 lines
  - internal/analysis/claude_test.go: 311 lines
  - internal/integrations/github/github.go: 291 lines
  - internal/analysis/claude.go: 290 lines
  - (24 more files over 200 lines)

## Test Results
- Test framework: Go/go test
- Tests present: Yes (via *_test.go files)
- Runner: go test (not executed - Go not in PATH)
- Status: UNABLE TO RUN (Go compiler not available in environment)

## Security Check
- Hardcoded secrets found: Yes (137+ matches)
- Findings:
  - Token, AppPassword, api_key references in main.go
  - Multiple password/token field definitions
  - Most are in type definitions/interfaces which are acceptable
  - Some in function parameters which is normal for handlers
- Status: NEEDS REVIEW (mostly type definitions, low risk)

## Overall: FAIL
- File size violations: CRITICAL (33 files exceed 200 lines)
- Tests: Unable to verify (Go environment not available)
- Security: Low risk (mostly parameter/type definitions, not hardcoded values)

**Recommendation**: Refactor large files to comply with 200-line limit.

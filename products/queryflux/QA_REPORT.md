# QA Report — queryflux
**Date:** 2026-03-20
**Wave:** 2

## File Size Check (≤200 lines)
- Total source files: 1,737 (excluding _archive, venv, dist, node_modules)
- Files over 200 lines: 892
- **FAIL**: SYSTEMIC VIOLATIONS - 51% of codebase exceeds limit
- NOTE 2026-05-29: The largest violators listed below were inside `sdlc-ai/`, which has since been moved out of queryflux to its own sibling product at `products/sdlc-ai/`. The numbers below are HISTORIC (pre-move) and should be re-measured against the slimmer queryflux tree.
  - ~~sdlc-ai/packages/sdk-go/pkg/sdln/test_comprehensive.go: 3,551 lines (17.8x limit)~~ (moved)
  - ~~sdlc-ai/packages/sdk-go/pkg/sdln/sdln_test.go: 2,555 lines (12.8x limit)~~ (moved)
  - ~~sdlc-ai/packages/sdk-go/pkg/sdln/qa_types.go: 2,341 lines (11.7x limit)~~ (moved)
  - ~~sdlc-ai/services/gateway/internal/sdk/generate.go: 2,186 lines (10.9x limit)~~ (moved)
  - ~~sdlc-ai/packages/sdk-go/pkg/sdln/monitoring_service_test.go: 1,983 lines (9.9x limit)~~ (moved)
  - ~~sdlc-ai/services/rag/app/services/context_assembly_service.py: 1,943 lines (9.7x limit)~~ (moved)
  - ~~sdlc-ai/services/rag/app/services/context_quality_monitor.py: 1,925 lines (9.6x limit)~~ (moved)
  - (885 more files over 200 lines — recount needed after sdlc-ai extraction)

## Test Results
- Test framework: Go + Python (pytest/unittest)
- Tests present: Extensive test files (sdln_test.go, monitoring_service_test.go, etc.)
- Status: CONFIGURED

## Security Check
- Hardcoded secrets found: Requires manual review
- Large files in services suggest sensitive logic
- Status: NEEDS REVIEW

## Overall: FAIL
- File size violations: CRITICAL AND SYSTEMIC
  - 51% of source files exceed limit (892/1,737)
  - Files are 10-18x the limit (test_comprehensive.go at 3,551 lines)
  - Go SDK files and RAG service files severely oversized
- Tests: Comprehensive suite present but files too large
- Security: Requires manual review of service files

**Recommendation**: URGENT - Complete SDK and service architecture refactoring. Priority: test_comprehensive.go, sdln_test.go, qa_types.go, and RAG services. Consider splitting test files by concern and extracting type definitions.

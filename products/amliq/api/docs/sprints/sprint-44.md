# Sprint 44: SDK Packages

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: G14
**Depends On**: S-41 (billing hardened — SDK plans must work)
**Status**: Complete

---

## Objective

Build and publish downloadable SDK packages for Go, Python, and Node.js. The billing system already sells SDK plans but no packages exist. Also enable offline/air-gapped screening for data sovereignty clients.

## Tasks

### T1: Go SDK
- [x] Package: `github.com/finsavvyai/amliq-go`
- [x] Type-safe client wrapping all API endpoints
- [x] Methods: `Screen()`, `BatchScreen()`, `GetAlerts()`, `ResolveAlert()`, `GetConfig()`, `UpdateConfig()`
- [x] Auth: API key via `X-API-Key` header
- [x] Error handling: typed errors for rate limit, auth, validation
- [x] **Directory**: `sdks/go/` (new)
- [x] **Files**: `client.go`, `screening.go`, `alerts.go`, `config.go`, `types.go`, `errors.go` (each <100 lines)
- [x] **Test**: `client_test.go`, `screening_test.go`

### T2: Python SDK
- [x] Package: `amliq` on PyPI
- [x] Async (httpx) + sync (requests) client
- [x] Pydantic models for all request/response types
- [x] Type hints throughout
- [x] **Directory**: `sdks/python/` (new)
- [x] **Files**: `amliq/client.py`, `amliq/screening.py`, `amliq/models.py`, `amliq/errors.py`
- [x] **Test**: `tests/test_client.py`, `tests/test_screening.py`

### T3: Node.js/TypeScript SDK
- [x] Package: `@amliq/sdk` on npm
- [x] Full TypeScript with type definitions
- [x] Promise-based API with fetch/axios
- [x] **Directory**: `sdks/node/` (new)
- [x] **Files**: `src/client.ts`, `src/screening.ts`, `src/types.ts`, `src/errors.ts`
- [x] **Test**: `tests/client.test.ts`

### T4: Offline screening mode
- [x] SDK can download sanctions list snapshot: `amliq.DownloadLists(outputDir)`
- [x] SDK can screen locally against downloaded lists (no API call)
- [x] Local screening uses Exact + Fuzzy + Phonetic + Token layers (no embedding/graph without DB)
- [x] List files encrypted at rest with tenant-specific key
- [x] **Files**: `offline.go` / `offline.py` / `offline.ts` in each SDK

### T5: SDK documentation
- [x] Quick-start guide for each language
- [x] Code examples: single screen, batch screen, alert management
- [x] API reference auto-generated from types
- [x] **Directory**: `sdks/docs/` (new)

## Acceptance Criteria

- [x] Go, Python, Node.js SDKs functional with all major API endpoints
- [x] Offline screening works without network access
- [x] Each SDK has >80% test coverage
- [x] Documentation with quick-start and examples

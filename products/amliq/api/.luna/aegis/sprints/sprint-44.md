# Sprint 44: SDK Packages

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: G14
**Depends On**: S-41 (billing hardened — SDK plans must work)
**Status**: Not Started

---

## Objective

Build and publish downloadable SDK packages for Go, Python, and Node.js. The billing system already sells SDK plans but no packages exist. Also enable offline/air-gapped screening for data sovereignty clients.

## Tasks

### T1: Go SDK
- [ ] Package: `github.com/finsavvyai/amliq-go`
- [ ] Type-safe client wrapping all API endpoints
- [ ] Methods: `Screen()`, `BatchScreen()`, `GetAlerts()`, `ResolveAlert()`, `GetConfig()`, `UpdateConfig()`
- [ ] Auth: API key via `X-API-Key` header
- [ ] Error handling: typed errors for rate limit, auth, validation
- [ ] **Directory**: `sdks/go/` (new)
- [ ] **Files**: `client.go`, `screening.go`, `alerts.go`, `config.go`, `types.go`, `errors.go` (each <100 lines)
- [ ] **Test**: `client_test.go`, `screening_test.go`

### T2: Python SDK
- [ ] Package: `amliq` on PyPI
- [ ] Async (httpx) + sync (requests) client
- [ ] Pydantic models for all request/response types
- [ ] Type hints throughout
- [ ] **Directory**: `sdks/python/` (new)
- [ ] **Files**: `amliq/client.py`, `amliq/screening.py`, `amliq/models.py`, `amliq/errors.py`
- [ ] **Test**: `tests/test_client.py`, `tests/test_screening.py`

### T3: Node.js/TypeScript SDK
- [ ] Package: `@amliq/sdk` on npm
- [ ] Full TypeScript with type definitions
- [ ] Promise-based API with fetch/axios
- [ ] **Directory**: `sdks/node/` (new)
- [ ] **Files**: `src/client.ts`, `src/screening.ts`, `src/types.ts`, `src/errors.ts`
- [ ] **Test**: `tests/client.test.ts`

### T4: Offline screening mode
- [ ] SDK can download sanctions list snapshot: `amliq.DownloadLists(outputDir)`
- [ ] SDK can screen locally against downloaded lists (no API call)
- [ ] Local screening uses Exact + Fuzzy + Phonetic + Token layers (no embedding/graph without DB)
- [ ] List files encrypted at rest with tenant-specific key
- [ ] **Files**: `offline.go` / `offline.py` / `offline.ts` in each SDK

### T5: SDK documentation
- [ ] Quick-start guide for each language
- [ ] Code examples: single screen, batch screen, alert management
- [ ] API reference auto-generated from types
- [ ] **Directory**: `sdks/docs/` (new)

## Acceptance Criteria

- [ ] Go, Python, Node.js SDKs functional with all major API endpoints
- [ ] Offline screening works without network access
- [ ] Each SDK has >80% test coverage
- [ ] Documentation with quick-start and examples

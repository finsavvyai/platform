# Gateway OpenAPI3 Migration — Status

> Last checked: 2026-04-11

## Current State: UNBLOCKED — handler splits rolled back, infrastructure retained

A prior session attempted to split the gateway's oversized handler files into
per-operation modules aligned with the OpenAPI3 spec. The splits landed in
the working tree but did not build: duplicate function declarations across
old and new files, an incomplete `FileManagementHandler` split, and
`openapi_validator.go` using a stale `kin-openapi` API.

Rather than force a half-finished migration to green, the 2026-04-11 session
rolled back the incomplete handler splits and kept the valuable migration
infrastructure (specs, tooling, middleware, integration tests). `go build
./...`, `go vet ./...`, and `go test ./...` are all green in
`services/gateway`.

## What Was Removed

Incomplete handler split files that duplicated or omitted logic from the
originals:

- `handlers/auth_login.go`, `auth_token.go`, `auth_user.go`
- `handlers/document_content.go`, `document_crud.go`, `document_types.go`
- `handlers/file_operations.go` (only 4 of 13 `FileManagementHandler` methods)
- `handlers/file_upload_handler.go`, `file_validation.go`, `file_types.go`
- `handlers/handlers_helpers.go`
- `handlers/rag_ingest.go`, `rag_query.go`, `rag_types.go`
- `handlers/tenant_crud.go`, `tenant_types.go`
- `handlers/user_crud.go`, `user_types.go`
- `routes/routes_v2.go` (referenced deleted split symbols)

The originals (`auth.go`, `document.go`, `file_management.go`, `file_upload.go`,
`rag.go`, `tenant.go`, `user.go`) are unchanged and remain the authoritative
handlers.

## What Was Kept

- `api/openapi-extensions.yaml` — extension endpoints (tenants, users, files,
  policies, DLP, vector). Moved `ErrorResponse` from `components.responses` to
  `components.schemas` (it was referenced as a schema throughout but misfiled
  as a response, which failed spec validation).
- `api/openapi.yaml` — core spec, unchanged.
- `OPENAPI3_MIGRATION.md`, `OPENAPI3_QUICKSTART.md` — migration docs.
- `scripts/generate-sdk.sh` — SDK generator (pending: run + verify output).
- `internal/interfaces/http/middleware/openapi_validator.go` — now builds
  against `kin-openapi v0.133.0`. Fixed `op.Responses.Status(code)` call
  (v0.126+ API) and `param.Value.Name` / `param.Value.In` dereferences on
  `*openapi3.ParameterRef`.
- `tests/integration/openapi_helpers.go` — now loads both `openapi.yaml` and
  `openapi-extensions.yaml` and merges paths, schemas, parameters, responses,
  and security schemes into a unified view for the spec tests.
- `tests/integration/openapi_test.go` — `TestCRUDOperations` now models
  per-resource method sets; `/files/{id}` intentionally omits `PATCH` (files
  are immutable blobs).

## Why the Handler Splits Were Incomplete

The rollback was the safe move because reconciling the in-place splits would
have lost real functionality:

1. **`file_operations.go`** reimplemented `FileManagementHandler` with only
   `ListFiles`, `GetFileMetadata`, `DeleteFile`, `CheckFileExists`,
   `writeJSONResponse`, `writeErrorResponse`, and two helpers — missing
   `InitiateMultipartUpload`, `UploadChunk`, `CompleteMultipartUpload`,
   `GetUploadProgress`, `GetFile`, `UpdateFile`, `DownloadFile`,
   `GrantFileAccess`, `RevokeFileAccess`, `ListFileAccess`, and
   `validateInitiateUploadRequest`.
2. **`document_crud.go`** renamed `UploadDocument` → `CreateDocument`, a route
   contract change, not a mechanical split.
3. **`user_crud.go`** / **`tenant_crud.go`** dropped `convertUserToMap`,
   `parseUserRole`, `canManageUsers`, `convertTenantToMap`, `parseTenantStatus`.
4. **`file_upload_handler.go`** introduced a `FileUploadBaseHandler` receiver
   and called `h.HandleError(...)`, while the rest of the package exposes
   `HandleError` as a package-level function. The two call conventions could
   not coexist in one package without reshaping the whole handler tree.

Those are intentional refactors that need design decisions, not a mechanical
"delete the old file" pass.

## Remaining Work (Deferred)

If we return to the migration:

1. Decide `HandleError` convention (package function vs. receiver method) and
   apply it consistently.
2. Decide `FileUploadBaseHandler` — is it a new abstraction layer or just
   noise? If kept, rewrite the existing handlers against it.
3. Decide whether `/documents` uses `POST /documents` (upload) or a rename to
   `create`. Update OpenAPI + routes to match.
4. Either split the original handlers file-by-file (200-line cap) with a
   proper review, or accept the current layout as the canonical handler tree.
5. Run `scripts/generate-sdk.sh` and verify generated SDKs compile.
6. Remove the `//go:build ignore` tag from
   `internal/domain/services/file_upload_service.go` once the broader
   refactor lands (still carries the tag today).

## Rollback Record

- Deleted 18 untracked handler split files and 1 routes file.
- Moved `ErrorResponse` schema into `components.schemas` in
  `openapi-extensions.yaml`.
- Fixed `openapi_validator.go` for `kin-openapi v0.133.0`.
- Updated `openapi_helpers.go` to merge core + extensions specs for tests.
- Updated `TestCRUDOperations` to drop the incorrect `PATCH /files/{id}`
  expectation.
- Verified `go build ./...`, `go vet ./...`, `go test ./...` all green.

# ADR-006: OpenAPI SDKs are a contract gate, not the public surface

- Status: Accepted
- Date: 2026-04-25
- Decision drivers: spec drift, hand-authored SDK investment, generator bugs

## Context

The repo has two competing SDK strategies:

1. **Hand-authored** SDKs in `packages/sdk-{go,py,ts}/` — ~50 curated subpackages
   (`auth/`, `cqrs/`, `crypto/`, `llm/`, `rag/`, `vector/`, ...) that are
   already imported by callers.
2. **Generated** SDKs from `services/gateway/api/openapi*.yaml` via
   `services/gateway/scripts/generate-sdk.sh`. Output is ~60K LOC across
   Go/Python/TypeScript.

Running the generator as configured today produces:
- 4 Go schema-vs-operation name collisions (`LoginResponse`, `LogoutResponse`,
  `RefreshTokenResponse`, `VectorSearchResponse`).
- A `objectToJSON` undefined-export bug in `@openapitools/openapi-generator-cli`
  7.21.0 affecting multipart endpoints.
- A merge step that requires `go-yq` (Homebrew) and writes directly into
  `packages/sdk-*`, which would clobber the hand-authored SDKs.

## Decision

Keep `packages/sdk-{go,py,ts}/` as the **published surface**. Use generated
SDK output as a **CI contract gate** only:

- Output redirected to `services/gateway/internal/sdk-generated/{go,py,ts}/`
  and gitignored.
- `make sdk-tools` ensures the toolchain is present.
- `make sdk-generate` regenerates output locally.
- `make sdk-contract` regenerates and builds the generated Go client — fails
  fast if the spec is internally inconsistent.
- `.github/workflows/sdk-contract.yml` runs the same gate on PRs that touch
  `services/gateway/api/openapi*.yaml` or the generator script.
- `openapi-generator-cli` pinned to `7.10.0` (avoids the 7.21.0 multipart
  regression) and invoked via `npx` so we don't depend on a global install.
- Spec collision schemas renamed to `*Result` (`LoginResult`, `LogoutResult`,
  `RefreshTokenResult`, `VectorSearchResult`).

## Consequences

- Spec authors learn about contract drift on PR, not on customer ship.
- Hand-authored SDKs stay stable; no surprise customer-visible churn.
- We pay the cost of dual maintenance, but only on the slow-changing public
  surface — generated code carries the high-churn type definitions.
- If we later decide to ship generated SDKs as the public surface, the
  contract gate is already wired and the spec is already collision-free.

## Out of scope

- Migrating consumers of `packages/sdk-*` onto generated types.
- Publishing the generated SDKs to package registries.
- Splitting the OpenAPI spec into smaller files (it's 4.5K LOC across two
  files; split is a separate refactor).

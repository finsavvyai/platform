# Dependency Licensing

PipeWarden CI enforces license compliance via `go-licenses check ./...
--disallowed_types=forbidden,restricted,unknown`
(`.github/workflows/ci.yml`, "Run go-licenses compliance check").

That flag rejects any module whose license falls in the `forbidden`,
`restricted`, or `unknown` go-licenses category. All other categories
(`notice`, `permissive`, `unencumbered`, `reciprocal`) pass without a
config change.

## Pre-vetted upcoming dependencies

These modules are scheduled to land via current boost-project work
(`/.luna/pipewarden/boost/integration-plan.md`) and have been verified
to fall outside the disallowed set, so adding them will not require any
CI change:

| Module | License | go-licenses category | Boost step |
|--------|---------|---------------------|------------|
| `tailscale.com/tsnet` (and `tailscale.com/...` deps) | BSD-3-Clause | notice | N1 — Tailscale Enterprise embed |
| `mozilla-ai/llamafile` (binary, not a Go import) | Apache-2.0 + LLaMA license carve-outs | not scanned (binary artifact) | N2 — air-gap variant |

Source for the BSD-3-Clause classification on `tailscale.com`:
https://github.com/tailscale/tailscale/blob/main/LICENSE

## When adding a new dependency

1. Run locally: `go-licenses check ./... --disallowed_types=forbidden,restricted,unknown`.
2. If go-licenses fails on a category change rather than the upstream
   project, file an issue — never widen the disallowed list silently.
3. If the dep is a binary artifact (e.g. llamafile pulled by Goreleaser),
   document its license here under "Binary artifacts" rather than
   relying on `go-licenses`.

## Binary artifacts

| Artifact | Source | License | Where bundled |
|----------|--------|---------|---------------|
| `llamafile` | https://github.com/Mozilla-Ocho/llamafile | Apache-2.0 with LLaMA license carve-outs | `pipewarden-airgap-*` Goreleaser variant (N2) |

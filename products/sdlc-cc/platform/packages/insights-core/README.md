# @sdlc/insights-core

Shared scoring + adapter primitives for Compliance Insights. Dual impl in Go
(`go/`) and TypeScript (`ts/`) with JSON golden tests in CI for parity.

Consumers: `services/insights-detector`, `services/gateway`, and — post-GA —
`qestro`, `push-ci.dev`, `aegis`.

See: `docs/compliance-insights-design.md` §7, §8.

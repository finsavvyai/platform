# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-20

### Added
- Initial OSS extraction from the [sdlc.cc](https://sdlc.cc) hosted platform.
- `internal/ratelimit` — Tier-based Redis rate limiter (free/starter/professional/enterprise) with per-minute/hour/day windows, concurrent counters, payload size enforcement.
- `internal/fingerprint` — Device fingerprint over IP + UA + Accept-* + CH-UA + TLS cipher → SHA-256, with `RequireStable` and `Validator` middleware options.
- `internal/scim` — SCIM 2.0 Users handler (RFC 7643/7644). PATCH parses `PatchOp` envelope; PUT does full-replace.
- `internal/events` — Redis pub/sub publisher with tenant-scoped channels and dropped-message counter.
- `internal/redisclient` — Self-contained Redis client builder.
- `internal/memstore` — In-memory `scim.Store` for dev / quickstart.
- `cmd/server` — Wired binary with chi router + healthz + SCIM mount.
- Helm chart with Bitnami Redis sub-chart, HPA, PDB.
- Cloudflare Worker recipe for fronting the gateway with edge anycast.
- Docker Compose + raw Kubernetes example manifests.
- GitHub Actions CI: vet + race tests + coverage gate + lint + container build.
- Release workflow: multi-arch (amd64 + arm64) image push to ghcr.io with provenance + SBOM.

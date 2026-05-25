# sdlc-core

Shared Go library for the **sdlc.cc** compliance LLM gateway and any
portfolio product that needs the same primitives in-process (AMLIQ /
aegis is the first such consumer).

## What's in here

```
sdlc-core/
├── ai/      Provider abstractions, fallback chain, retry, cache,
│            Anthropic + Bedrock + Gemma clients
├── dlp/     Fintech-aware DLP — PAN (Luhn), IBAN (mod-97),
│            SWIFT BIC, Israeli ID, email + phone redaction
└── cache/   TTL-bounded prompt cache (in-memory; Redis-pluggable)
```

## What's NOT in here

- HTTP handlers — those live in `github.com/finsavvyai/sdlc-cc`
- Authentication / SAML — product-level concern
- Observability sink wiring — products plug their own audit store
- Migrations — products own their schemas

## Why a library, not a service

AMLIQ's transaction-stream pipeline calls AI mid-screening; a network
hop to a separate gateway adds 50-200ms per call. Shared library = one
DLP implementation, in-process speed for AMLIQ, same code path that
sdlc.cc's customer-facing binary runs. Eat-our-own-dog-food without
the latency penalty.

## Versioning

Semver tags. Consumers pin via go.mod. Breaking changes get major
version bumps and a migration note in CHANGELOG.md.

## License

Proprietary. © FinSavvy AI 2026.

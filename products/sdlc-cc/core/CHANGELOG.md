# Changelog

## v0.1.0 — 2026-05-05

Initial extraction from `github.com/finsavvyai/aegis`. Sets up
the shared library that both `sdlc-cc` (the gateway product
binary) and `aegis` (AMLIQ backend) will import.

### ai/

- Provider interface (`IsConfigured`, `Complete`, `Name`)
- AnthropicClient (direct API)
- BedrockClient + hand-rolled SigV4
- FallbackChain (was `fallback.go`, renamed `chain.go`)
- RetryProvider (exponential backoff, transient-error fallthrough)

### dlp/

- Email + phone redaction (was `pii_mask.go`)
- PAN with Luhn validation
- IBAN with ISO 13616 mod-97
- SWIFT BIC redaction
- Israeli ID (תעודת זהות) checksum
- Composite MaskFintechPII + MaskAML

### cache/

- TTL-bounded prompt cache with tenant scoping
- Lazy eviction on Get + Set

### Out of scope (still in aegis for now)

- GemmaClient + DeepSeek/Groq/Gemini/OpenRouter/Ollama routing
  (will land in v0.2 when needed)
- SAML SSO (stays in aegis — product-level concern)
- Quota enforcer (extracted next)
- Audit log emitter (extracted next)

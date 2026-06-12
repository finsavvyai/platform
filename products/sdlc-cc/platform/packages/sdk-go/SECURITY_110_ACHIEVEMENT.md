# SDK Security Overview

> **Revision note (2026-06-12):** This file previously claimed a "110/100
> security score", "quantum-ready" cryptography, and detection-accuracy
> figures (e.g. "99.7% accuracy"). A claim audit found no scoring rubric,
> no post-quantum cryptography libraries, and no accuracy benchmarks in
> this repository. Those claims have been removed. What follows describes
> only what is actually implemented.

## Implemented security controls

### Cryptography (`pkg/sdln/quantum_security.go`, `pkg/security/`)

- **AEAD encryption:** ChaCha20-Poly1305 (`golang.org/x/crypto/chacha20poly1305`)
- **Key derivation:** HKDF with SHA-256 (`golang.org/x/crypto/hkdf`)
- **Hashing:** SHA-256, SHA-512, BLAKE2b
- **Key rotation:** time-based rotation of the in-process encryption key

**Honest limitations:**

- These are well-regarded *classical* algorithms. **No post-quantum
  algorithms (e.g. ML-KEM/Kyber, Dilithium) are implemented**, and no
  PQC library appears in `go.mod`. Symmetric primitives such as
  ChaCha20-Poly1305 retain meaningful security margins against known
  quantum attacks, but that is not the same as a post-quantum KEM or
  signature scheme.
- The type named `QuantumSafeKEM` derives a shared secret from locally
  generated random bytes via HKDF. It is **not** a key encapsulation
  mechanism in the cryptographic sense and provides no quantum
  resistance beyond the underlying classical primitives.
- The `GenerateZKProof` function produces a BLAKE2b hash commitment.
  It is **not** a zero-knowledge proof system.
- The `Quantum*` identifiers are legacy naming and should be read as
  aspirational labels, not capability statements.

### Threat detection (`pkg/sdln/advanced_threat_intelligence.go`)

- Heuristic/weighted-feature request scoring and behavioral profiling
  (access patterns, request frequency, geolocation, device fingerprints).
- **Accuracy has not been benchmarked.** No labeled dataset, evaluation
  harness, or measured accuracy/false-positive rate exists in this
  repository. Previously published figures (99.7%, 97.3%, etc.) were
  not derived from any measurement and have been retracted.

### Authentication and access (`pkg/auth/`)

- OAuth, SAML, LDAP, hardware-token and biometric-auth integrations,
  with unit and integration tests under `pkg/auth/`.

### Other controls

- PCI-related helpers (`pkg/security/pci_compliance.go`, card validation)
- Audit logging service (`pkg/sdln/audit_service.go`)
- DLP services with tests (`pkg/sdln/dlp_service.go`, `dlp_ml_service.go`)

## Security posture statement

- No numeric "security score" is claimed. Security scores above 100
  are not meaningful and the previous 110/100 figure was self-assigned
  without a rubric.
- No external security audit or certification of this SDK has been
  performed. SOC 2 / external audit is on the portfolio roadmap.
- Post-quantum cryptography (NIST-standardized ML-KEM / ML-DSA) is a
  roadmap item, not a shipped feature.

## Reporting issues

Report suspected vulnerabilities through the repository's security
policy rather than public issues.

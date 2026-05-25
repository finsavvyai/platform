// Package byok handles per-tenant LLM provider credentials (BYOK).
// Claude Team A3 closeout. The customer supplies their own
// `sk-ant-…` key via the admin API; we seal it with AES-256-GCM
// before persisting and unseal it on every /anthropic/v1/messages
// request that the tenant owns.
//
// CMEK envelope encryption is a separate hardening layer — out of
// scope here. This sealer uses a single platform-wide key from the
// BYOK_ENCRYPTION_KEY env var (32 raw bytes, hex-encoded).
package byok

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

// Sealer wraps AES-256-GCM seal/open over a fixed key.
type Sealer struct {
	gcm cipher.AEAD
}

// NewSealer returns a Sealer constructed from a hex-encoded 32-byte
// key. Returns an error when the key is the wrong length so a
// misconfigured deployment fails fast at boot rather than silently
// at first request.
func NewSealer(hexKey string) (*Sealer, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("byok: BYOK_ENCRYPTION_KEY hex decode: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("byok: BYOK_ENCRYPTION_KEY must be 32 bytes (got %d)", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("byok: aes.NewCipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("byok: cipher.NewGCM: %w", err)
	}
	return &Sealer{gcm: gcm}, nil
}

// Seal returns (nonce, ciphertext) for the provided plaintext. The
// nonce is freshly generated; callers must store it alongside the
// ciphertext to be able to Open later.
func (s *Sealer) Seal(plaintext []byte) (nonce, ciphertext []byte, err error) {
	nonce = make([]byte, s.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("byok: nonce read: %w", err)
	}
	ciphertext = s.gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, ciphertext, nil
}

// Open recovers the plaintext from (nonce, ciphertext). Returns
// ErrTampered when the AEAD tag check fails so callers can audit
// every tamper attempt without leaking why the operation failed.
func (s *Sealer) Open(nonce, ciphertext []byte) ([]byte, error) {
	if len(nonce) != s.gcm.NonceSize() {
		return nil, ErrTampered
	}
	plaintext, err := s.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrTampered
	}
	return plaintext, nil
}

// ErrTampered is the only error Open returns on cryptographic
// failure. The underlying cause (wrong key, truncated ciphertext,
// invalid nonce length) is intentionally hidden so an attacker
// probing the API cannot distinguish tampering modes.
var ErrTampered = errors.New("byok: ciphertext tampered or wrong key")

// AES-GCM envelope encryption for session recording payloads.
//
// Each Encrypt call generates a fresh per-record DEK (32-byte AES-256
// key), wraps it via the KEKProvider, and seals the plaintext with the
// DEK using AES-GCM (96-bit nonce, 128-bit auth tag). The on-disk
// representation is the marshaled Ciphertext{WrappedDEK, Nonce, Sealed}
// so a future KMS-backed KEKProvider slots in without changing the
// recorder, the schema, or the marshaling.
//
// This file is the contract between the recorder and the KMS layer:
// add a new KEKProvider impl (AWS KMS, GCP KMS, HashiCorp Vault Transit)
// and the recorder is encrypted-at-rest with no further changes.
package record

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

// KEKProvider unwraps + wraps per-record DEKs. The interface is
// intentionally tiny so a real KMS impl is a drop-in replacement.
type KEKProvider interface {
	Wrap(ctx context.Context, dek []byte) (wrappedDEK []byte, err error)
	Unwrap(ctx context.Context, wrappedDEK []byte) (dek []byte, err error)
}

// EnvKEK reads a 32-byte AES-256 KEK from the RECORD_KEK_BASE64 env
// var. "Wrapping" here is symmetric AES-GCM with the KEK; in
// production this is replaced with a real KMS Wrap/Unwrap. EnvKEK is
// fine for dev + tests + emergency offline recovery.
type EnvKEK struct {
	kek []byte
}

// NewEnvKEK loads the KEK from RECORD_KEK_BASE64 and validates length.
// Errors loudly when the env var is missing or wrong-length so a
// misconfigured deploy fails closed instead of silently accepting a
// shorter key.
func NewEnvKEK() (*EnvKEK, error) {
	raw := os.Getenv("RECORD_KEK_BASE64")
	if raw == "" {
		return nil, errors.New("record: RECORD_KEK_BASE64 env var is required for envelope encryption")
	}
	kek, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("record: RECORD_KEK_BASE64 is not valid base64: %w", err)
	}
	if len(kek) != 32 {
		return nil, fmt.Errorf("record: RECORD_KEK_BASE64 must decode to 32 bytes (AES-256), got %d", len(kek))
	}
	return &EnvKEK{kek: kek}, nil
}

// Wrap seals dek with the KEK using AES-GCM. The output prepends the
// 12-byte nonce so Unwrap can recover it without external metadata.
func (e *EnvKEK) Wrap(_ context.Context, dek []byte) ([]byte, error) {
	return aesGCMSeal(e.kek, dek)
}

// Unwrap reverses Wrap; auth tag failures surface as an error.
func (e *EnvKEK) Unwrap(_ context.Context, wrappedDEK []byte) ([]byte, error) {
	return aesGCMOpen(e.kek, wrappedDEK)
}

// Ciphertext is the marshalled-to-disk shape. JSON keeps the on-disk
// format inspectable; the BYTEA column stores the JSON bytes.
type Ciphertext struct {
	WrappedDEK []byte `json:"wrapped_dek"`
	Nonce      []byte `json:"nonce"`
	Sealed     []byte `json:"sealed"`
}

// Envelope encrypts/decrypts payloads via a KEKProvider.
type Envelope struct {
	KEK KEKProvider
}

// NewEnvelope returns an Envelope. Pass nil to disable encryption — the
// recorder treats that as "fall back to plaintext payload".
func NewEnvelope(kek KEKProvider) *Envelope {
	return &Envelope{KEK: kek}
}

// Encrypt generates a fresh DEK, wraps it, and seals plaintext.
func (e *Envelope) Encrypt(ctx context.Context, plaintext []byte) (Ciphertext, error) {
	if e == nil || e.KEK == nil {
		return Ciphertext{}, errors.New("record: envelope has no KEK provider")
	}
	dek := make([]byte, 32) // AES-256
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return Ciphertext{}, fmt.Errorf("record: rand dek: %w", err)
	}
	wrapped, err := e.KEK.Wrap(ctx, dek)
	if err != nil {
		return Ciphertext{}, fmt.Errorf("record: wrap dek: %w", err)
	}
	nonce, sealed, err := aesGCMSealSplit(dek, plaintext)
	if err != nil {
		return Ciphertext{}, fmt.Errorf("record: seal payload: %w", err)
	}
	return Ciphertext{WrappedDEK: wrapped, Nonce: nonce, Sealed: sealed}, nil
}

// Decrypt reverses Encrypt. A wrong KEK or tampered ciphertext fails
// here with the AES-GCM auth-tag error.
func (e *Envelope) Decrypt(ctx context.Context, c Ciphertext) ([]byte, error) {
	if e == nil || e.KEK == nil {
		return nil, errors.New("record: envelope has no KEK provider")
	}
	dek, err := e.KEK.Unwrap(ctx, c.WrappedDEK)
	if err != nil {
		return nil, fmt.Errorf("record: unwrap dek: %w", err)
	}
	return aesGCMOpenSplit(dek, c.Nonce, c.Sealed)
}

// MarshalCiphertext + UnmarshalCiphertext keep the on-disk shape in
// one place so the recorder + restore path agree.
func MarshalCiphertext(c Ciphertext) ([]byte, error)   { return json.Marshal(c) }
func UnmarshalCiphertext(b []byte) (Ciphertext, error) {
	var c Ciphertext
	err := json.Unmarshal(b, &c)
	return c, err
}

// aesGCMSeal/Open are the "nonce-prefixed" pair used by EnvKEK to wrap
// the DEK; they keep the wrapped form self-contained.
func aesGCMSeal(key, plaintext []byte) ([]byte, error) {
	nonce, sealed, err := aesGCMSealSplit(key, plaintext)
	if err != nil {
		return nil, err
	}
	return append(nonce, sealed...), nil
}

func aesGCMOpen(key, blob []byte) ([]byte, error) {
	if len(blob) < 12 {
		return nil, errors.New("record: ciphertext too short")
	}
	return aesGCMOpenSplit(key, blob[:12], blob[12:])
}

func aesGCMSealSplit(key, plaintext []byte) (nonce, sealed []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	sealed = gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, sealed, nil
}

func aesGCMOpenSplit(key, nonce, sealed []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, sealed, nil)
}

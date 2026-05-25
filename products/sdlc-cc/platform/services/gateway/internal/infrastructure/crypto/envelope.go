// Package crypto implements CMEK envelope encryption.
//
// BEAT-PLAN S3.1 — every plaintext document/embedding is encrypted
// with a fresh per-row Data Encryption Key (DEK). The DEK itself is
// encrypted by a Key Encryption Key (KEK) the customer owns inside
// their AWS KMS / GCP KMS / Azure Key Vault account. The wire format
// stores ciphertext + nonce + KEK-wrapped DEK — the gateway never
// holds the plaintext DEK on disk.
//
// Revoke contract: when the customer revokes IAM on the KEK, the next
// Decrypt() call on any envelope returns ErrRevoked because Unwrap()
// against KMS fails. This is the destructive test asserting CMEK is
// real.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
)

// KMSClient is the minimal contract the envelope layer needs from a
// hosted KMS. Production wires AWS KMS / GCP KMS / Azure Key Vault;
// tests wire an in-memory fake. Wrap/Unwrap operate on a 32-byte AES-
// 256 DEK.
type KMSClient interface {
	// Wrap encrypts the DEK with the KEK identified by kekARN. The
	// returned bytes are vendor-specific opaque ciphertext.
	Wrap(ctx Ctx, kekARN string, dek []byte) ([]byte, error)
	// Unwrap reverses Wrap. Implementations MUST return ErrRevoked
	// when the KEK is unavailable (deleted / IAM-revoked / scheduled
	// for deletion); callers treat any other error as transient.
	Unwrap(ctx Ctx, kekARN string, wrapped []byte) ([]byte, error)
}

// Ctx is a thin context.Context shim so this package stays
// stdlib-only at the import-graph level.
type Ctx interface {
	Done() <-chan struct{}
	Err() error
}

// Envelope is the on-disk shape: ciphertext + nonce + wrapped DEK +
// the KEK identifier so the reader knows which KMS key to ask.
type Envelope struct {
	KEKARN     string `json:"kek_arn"`
	WrappedDEK []byte `json:"wrapped_dek"`
	Nonce      []byte `json:"nonce"`
	Ciphertext []byte `json:"ciphertext"`
}

// Encryptor encrypts/decrypts arbitrary plaintexts under a per-tenant
// KEK. Construct one per-process; it is goroutine-safe.
type Encryptor struct {
	kms KMSClient
}

// NewEncryptor wires a KMS client. Panics if kms is nil — there is no
// "no-op" mode; if you need plaintext, use a different code path.
func NewEncryptor(kms KMSClient) *Encryptor {
	if kms == nil {
		panic("crypto: KMSClient required")
	}
	return &Encryptor{kms: kms}
}

// Encrypt generates a fresh AES-256 DEK, encrypts plaintext under it
// with AES-GCM, then wraps the DEK under kekARN. Returns the envelope.
func (e *Encryptor) Encrypt(ctx Ctx, kekARN string, plaintext []byte) (*Envelope, error) {
	if kekARN == "" {
		return nil, errors.New("crypto: kekARN required")
	}
	dek := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return nil, fmt.Errorf("crypto: dek gen: %w", err)
	}
	defer zero(dek)

	nonce, ciphertext, err := aesGCMSeal(dek, plaintext)
	if err != nil {
		return nil, err
	}
	wrapped, err := e.kms.Wrap(ctx, kekARN, dek)
	if err != nil {
		return nil, fmt.Errorf("crypto: kms wrap: %w", err)
	}
	return &Envelope{KEKARN: kekARN, WrappedDEK: wrapped, Nonce: nonce, Ciphertext: ciphertext}, nil
}

// Decrypt unwraps the DEK via KMS, decrypts the ciphertext. Returns
// ErrRevoked when the KMS unwrap fails because the KEK is gone — the
// caller surfaces this to the customer as a hard 503.
func (e *Encryptor) Decrypt(ctx Ctx, env *Envelope) ([]byte, error) {
	if env == nil {
		return nil, errors.New("crypto: nil envelope")
	}
	dek, err := e.kms.Unwrap(ctx, env.KEKARN, env.WrappedDEK)
	if err != nil {
		if errors.Is(err, ErrRevoked) {
			return nil, ErrRevoked
		}
		return nil, fmt.Errorf("crypto: kms unwrap: %w", err)
	}
	defer zero(dek)
	return aesGCMOpen(dek, env.Nonce, env.Ciphertext)
}

// ErrRevoked signals the KEK is unreachable (deleted/IAM-revoked).
// Returned by KMSClient.Unwrap and propagated by Decrypt so callers
// can distinguish "you no longer own the data" from transient errors.
var ErrRevoked = errors.New("crypto: KEK revoked or unavailable")

func aesGCMSeal(key, plaintext []byte) (nonce, ciphertext []byte, err error) {
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("aes: %w", err)
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, nil, fmt.Errorf("gcm: %w", err)
	}
	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("nonce: %w", err)
	}
	return nonce, gcm.Seal(nil, nonce, plaintext, nil), nil
}

func aesGCMOpen(key, nonce, ciphertext []byte) ([]byte, error) {
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes: %w", err)
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, fmt.Errorf("gcm: %w", err)
	}
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// zero overwrites a byte slice in place. Best-effort; the Go compiler
// does not guarantee no copies are left in registers.
func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

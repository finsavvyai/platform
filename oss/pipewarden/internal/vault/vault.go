package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
)

// Vault provides AES-256-GCM encryption for CI platform credentials.
// If initialized with an empty master key, it operates in pass-through mode (no encryption).
type Vault struct {
	gcm     cipher.AEAD
	enabled bool
}

// New creates a vault with the given master key (derived via SHA-256).
// If masterKey is empty, the vault is disabled and returns plaintext.
func New(masterKey string) (*Vault, error) {
	if masterKey == "" {
		return &Vault{gcm: nil, enabled: false}, nil
	}

	// Derive 32-byte AES key from master key via SHA-256
	hash := sha256.Sum256([]byte(masterKey))
	aesKey := hash[:]

	// Create AES cipher
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}

	// Wrap in GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM mode: %w", err)
	}

	return &Vault{gcm: gcm, enabled: true}, nil
}

// Encrypt encrypts a plaintext credential, returns base64-encoded ciphertext.
// If vault is disabled, returns plaintext as-is.
func (v *Vault) Encrypt(plaintext string) (string, error) {
	if !v.enabled {
		return plaintext, nil
	}

	// Generate random 12-byte nonce
	nonce := make([]byte, v.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt plaintext
	ciphertext := v.gcm.Seal(nil, nonce, []byte(plaintext), nil)

	// Prepend nonce to ciphertext
	combined := append(nonce, ciphertext...)

	// Base64 encode for storage
	encoded := base64.StdEncoding.EncodeToString(combined)
	return encoded, nil
}

// Decrypt decrypts a base64-encoded ciphertext back to plaintext.
// If vault is disabled, returns ciphertext as-is (assuming it was plaintext).
func (v *Vault) Decrypt(ciphertext string) (string, error) {
	if !v.enabled {
		return ciphertext, nil
	}

	// Base64 decode
	combined, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	nonceSize := v.gcm.NonceSize()
	if len(combined) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and actual ciphertext
	nonce := combined[:nonceSize]
	encryptedData := combined[nonceSize:]

	// Decrypt
	plaintext, err := v.gcm.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// Enabled returns true if the vault has a valid encryption key.
func (v *Vault) Enabled() bool {
	return v.enabled
}

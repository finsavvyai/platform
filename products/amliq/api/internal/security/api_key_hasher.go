package security

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
)

const (
	// APIKeyPrefix identifies AMLIQ API keys.
	APIKeyPrefix = "amliq_sk_"
	// keyRandomBytes is the number of random bytes (32 hex chars).
	keyRandomBytes = 16
	// saltLength for hashing.
	saltLength = 16
)

// ErrInvalidAPIKey is returned for malformed API keys.
var ErrInvalidAPIKey = errors.New("invalid API key format")

// GenerateAPIKey creates a new API key and its hash.
// Returns (plaintext, hash). Plaintext is shown once at creation.
func GenerateAPIKey() (string, string, error) {
	randomBytes := make([]byte, keyRandomBytes)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", err
	}
	plaintext := APIKeyPrefix + hex.EncodeToString(randomBytes)
	hash, err := HashAPIKey(plaintext)
	if err != nil {
		return "", "", err
	}
	return plaintext, hash, nil
}

// HashAPIKey produces a salted SHA-256 hash of the API key.
// Format: salt$hash (both hex-encoded).
func HashAPIKey(key string) (string, error) {
	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	saltHex := hex.EncodeToString(salt)
	hash := hashWithSalt(key, saltHex)
	return saltHex + "$" + hash, nil
}

// VerifyAPIKey checks a plaintext key against a stored hash.
// Uses constant-time comparison to prevent timing attacks.
func VerifyAPIKey(plaintext, storedHash string) bool {
	parts := splitHash(storedHash)
	if parts == nil {
		return false
	}
	computed := hashWithSalt(plaintext, parts[0])
	return subtle.ConstantTimeCompare(
		[]byte(computed), []byte(parts[1]),
	) == 1
}

func hashWithSalt(key, saltHex string) string {
	h := sha256.New()
	h.Write([]byte(saltHex))
	h.Write([]byte(key))
	return hex.EncodeToString(h.Sum(nil))
}

func splitHash(s string) []string {
	for i, c := range s {
		if c == '$' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return nil
}

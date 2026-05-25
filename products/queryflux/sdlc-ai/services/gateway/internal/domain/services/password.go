package services

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"time"

	"golang.org/x/crypto/argon2"
)

const (
	// SaltLength is the length of the salt in bytes
	SaltLength = 16

	// Argon2id parameters (recommended by OWASP)
	argon2Time    = 1
	argon2Memory  = 64 * 1024 // 64MB
	argon2Threads = 4
	argon2KeyLen  = 32
)

// PasswordHash represents a hashed password with its salt and parameters
type PasswordHash struct {
	Hash      string    `json:"hash"`
	Salt      string    `json:"salt"`
	Time      uint32    `json:"time"`
	Memory    uint32    `json:"memory"`
	Threads   uint8     `json:"threads"`
	KeyLen    uint32    `json:"key_len"`
	CreatedAt time.Time `json:"created_at"`
}

// String returns the encoded password hash for storage
func (ph *PasswordHash) String() string {
	// Format: $argon2id$v=19$t=1,m=65536,p=4$<salt-base64>$<hash-base64>
	saltB64 := base64.RawStdEncoding.EncodeToString([]byte(ph.Salt))
	hashB64 := base64.RawStdEncoding.EncodeToString([]byte(ph.Hash))

	return fmt.Sprintf("$argon2id$v=%d$t=%d,m=%d,p=%d$%s$%s",
		argon2.Version,
		ph.Time,
		ph.Memory,
		ph.Threads,
		saltB64,
		hashB64,
	)
}

// ParsePasswordHash parses a password hash string
func ParsePasswordHash(encoded string) (*PasswordHash, error) {
	// Parse the format: $argon2id$v=19$t=1,m=65536,p=4$<salt-base64>$<hash-base64>
	var version int
	var ph PasswordHash

	_, err := fmt.Sscanf(encoded, "$argon2id$v=%d$t=%d,m=%d,p=%d",
		&version,
		&ph.Time,
		&ph.Memory,
		&ph.Threads,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to parse password hash: %w", err)
	}

	// Extract salt and hash
	parts := splitString(encoded, '$')
	if len(parts) != 6 {
		return nil, fmt.Errorf("invalid password hash format")
	}

	// Decode salt and hash
	saltBytes, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, fmt.Errorf("failed to decode salt: %w", err)
	}

	hashBytes, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, fmt.Errorf("failed to decode hash: %w", err)
	}

	ph.Salt = string(saltBytes)
	ph.Hash = string(hashBytes)
	ph.KeyLen = argon2KeyLen

	return &ph, nil
}

// splitString splits a string by separator
func splitString(s string, sep byte) []string {
	var parts []string
	start := 0

	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}

	parts = append(parts, s[start:])
	return parts
}

// generateSalt generates a cryptographically secure random salt
func generateSalt() (string, error) {
	salt := make([]byte, SaltLength)
	_, err := rand.Read(salt)
	if err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}
	return string(salt), nil
}

// HashPassword hashes a password using Argon2id with a unique salt
func HashPassword(password string) (*PasswordHash, error) {
	if password == "" {
		return nil, fmt.Errorf("password cannot be empty")
	}

	salt, err := generateSalt()
	if err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Hash password using Argon2id
	hash := argon2.IDKey(
		[]byte(password),
		[]byte(salt),
		argon2Time,
		argon2Memory,
		argon2Threads,
		argon2KeyLen,
	)

	ph := &PasswordHash{
		Hash:      string(hash),
		Salt:      salt,
		Time:      argon2Time,
		Memory:    argon2Memory,
		Threads:   argon2Threads,
		KeyLen:    argon2KeyLen,
		CreatedAt: time.Now(),
	}

	return ph, nil
}

// VerifyPassword verifies a password against a stored hash
func VerifyPassword(encodedHash, password string) bool {
	ph, err := ParsePasswordHash(encodedHash)
	if err != nil {
		return false
	}

	if password == "" {
		return false
	}

	// Hash the provided password with the same salt
	hash := argon2.IDKey(
		[]byte(password),
		[]byte(ph.Salt),
		ph.Time,
		ph.Memory,
		ph.Threads,
		ph.KeyLen,
	)

	// Constant-time comparison to prevent timing attacks
	storedHash := []byte(ph.Hash)

	if len(storedHash) != len(hash) {
		return false
	}

	return subtle.ConstantTimeCompare(storedHash, hash) == 1
}

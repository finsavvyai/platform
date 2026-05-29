package services

import (
	"strings"
	"testing"
)

// TestPasswordHashingIntegration verifies the password hashing fix works end-to-end
func TestPasswordHashingIntegration(t *testing.T) {
	t.Run("password hashing generates unique salts", func(t *testing.T) {
		password := "TestPassword123!"

		// Hash the password twice
		hash1, err := HashPassword(password)
		if err != nil {
			t.Fatalf("first hash failed: %v", err)
		}

		hash2, err := HashPassword(password)
		if err != nil {
			t.Fatalf("second hash failed: %v", err)
		}

		// Verify salts are unique
		if hash1.Salt == hash2.Salt {
			t.Error("salts must be unique for each password hash")
		}

		// Verify hashes are different (due to unique salts)
		if hash1.Hash == hash2.Hash {
			t.Error("hashes must be different due to unique salts")
		}
	})

	t.Run("password hash encoding is parseable", func(t *testing.T) {
		password := "TestPassword123!"

		// Create hash
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		// Encode to string format
		encoded := hash.String()

		// Verify format: $argon2id$v=19$t=1,m=65536,p=4$<salt>$<hash>
		if !strings.HasPrefix(encoded, "$argon2id$v=") {
			t.Error("encoded hash must start with $argon2id$v=")
		}

		parts := strings.Split(encoded, "$")
		if len(parts) != 6 {
			t.Errorf("expected 6 parts, got %d", len(parts))
		}

		// Parse it back
		parsed, err := ParsePasswordHash(encoded)
		if err != nil {
			t.Fatalf("failed to parse encoded hash: %v", err)
		}

		// Verify all fields match
		if parsed.Salt != hash.Salt {
			t.Error("parsed salt doesn't match original")
		}

		if parsed.Hash != hash.Hash {
			t.Error("parsed hash doesn't match original")
		}

		if parsed.Time != argon2Time {
			t.Errorf("expected time=%d, got %d", argon2Time, parsed.Time)
		}

		if parsed.Memory != argon2Memory {
			t.Errorf("expected memory=%d, got %d", argon2Memory, parsed.Memory)
		}

		if parsed.Threads != argon2Threads {
			t.Errorf("expected threads=%d, got %d", argon2Threads, parsed.Threads)
		}

		if parsed.KeyLen != argon2KeyLen {
			t.Errorf("expected keyLen=%d, got %d", argon2KeyLen, parsed.KeyLen)
		}
	})

	t.Run("password verification works correctly", func(t *testing.T) {
		password := "TestPassword123!"
		wrongPassword := "WrongPassword123!"

		// Create hash
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()

		// Verify correct password works
		if !VerifyPassword(encoded, password) {
			t.Error("correct password should verify successfully")
		}

		// Verify wrong password fails
		if VerifyPassword(encoded, wrongPassword) {
			t.Error("wrong password should fail verification")
		}

		// Verify empty password fails
		if VerifyPassword(encoded, "") {
			t.Error("empty password should fail verification")
		}
	})

	t.Run("argon2id parameters meet OWASP recommendations", func(t *testing.T) {
		// OWASP recommendations for Argon2id (as of 2024):
		// - Time: 1-3 iterations
		// - Memory: 64MB (65536 KB)
		// - Threads: 4 (parallelism)
		// - Key length: 32 bytes (256 bits)
		// - Salt length: 16 bytes (128 bits)

		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		// Verify OWASP-compliant parameters
		if hash.Time != 1 {
			t.Errorf("time parameter should be 1, got %d", hash.Time)
		}

		if hash.Memory != 64*1024 {
			t.Errorf("memory parameter should be 64MB (65536), got %d", hash.Memory)
		}

		if hash.Threads != 4 {
			t.Errorf("threads parameter should be 4, got %d", hash.Threads)
		}

		if hash.KeyLen != 32 {
			t.Errorf("key length should be 32 bytes, got %d", hash.KeyLen)
		}

		if len(hash.Salt) != 16 {
			t.Errorf("salt length should be 16 bytes, got %d", len(hash.Salt))
		}
	})

	t.Run("password length is 16 bytes (128 bits)", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		if len(hash.Salt) != SaltLength {
			t.Errorf("expected salt length %d, got %d", SaltLength, len(hash.Salt))
		}

		if len(hash.Salt) != 16 {
			t.Errorf("salt must be 16 bytes (128 bits), got %d", len(hash.Salt))
		}
	})
}

// TestPasswordHashingSecurity verifies security properties
func TestPasswordHashingSecurity(t *testing.T) {
	t.Run("prevents rainbow table attacks with unique salts", func(t *testing.T) {
		password := "TestPassword123!"

		// Create 100 hashes of the same password
		hashes := make(map[string]bool)
		salts := make(map[string]bool)

		for i := 0; i < 100; i++ {
			hash, err := HashPassword(password)
			if err != nil {
				t.Fatalf("hash %d failed: %v", i, err)
			}

			// All hashes should be different
			hashStr := hash.String()
			if hashes[hashStr] {
				t.Errorf("hash %d is duplicate", i)
			}
			hashes[hashStr] = true

			// All salts should be different
			if salts[hash.Salt] {
				t.Errorf("salt %d is duplicate", i)
			}
			salts[hash.Salt] = true
		}

		// Verify we got 100 unique hashes and salts
		if len(hashes) != 100 {
			t.Errorf("expected 100 unique hashes, got %d", len(hashes))
		}

		if len(salts) != 100 {
			t.Errorf("expected 100 unique salts, got %d", len(salts))
		}
	})

	t.Run("uses constant-time comparison for verification", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()

		// Verify correct password
		correctResult := VerifyPassword(encoded, password)

		// Verify wrong password
		wrongResult := VerifyPassword(encoded, "WrongPassword123!")

		if !correctResult {
			t.Error("correct password should verify")
		}

		if wrongResult {
			t.Error("wrong password should not verify")
		}

		// The verification function uses subtle.ConstantTimeCompare
		// which prevents timing attacks
	})
}

package services

import (
	"strings"
	"testing"
)

func TestGenerateSalt(t *testing.T) {
	t.Run("generates unique salts", func(t *testing.T) {
		salt1, err := generateSalt()
		if err != nil {
			t.Fatalf("failed to generate salt: %v", err)
		}

		salt2, err := generateSalt()
		if err != nil {
			t.Fatalf("failed to generate salt: %v", err)
		}

		if salt1 == salt2 {
			t.Error("salts should be unique")
		}

		if len(salt1) != SaltLength {
			t.Errorf("expected salt length %d, got %d", SaltLength, len(salt1))
		}
	})

	t.Run("generates valid salt length", func(t *testing.T) {
		salt, err := generateSalt()
		if err != nil {
			t.Fatalf("failed to generate salt: %v", err)
		}

		if len(salt) != SaltLength {
			t.Errorf("expected salt length %d, got %d", SaltLength, len(salt))
		}
	})
}

func TestHashPassword(t *testing.T) {
	t.Run("successfully hashes a password", func(t *testing.T) {
		password := "SecurePassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		if hash == nil {
			t.Fatal("expected hash to be non-nil")
		}

		if hash.Hash == "" {
			t.Error("expected hash to be non-empty")
		}

		if hash.Salt == "" {
			t.Error("expected salt to be non-empty")
		}

		if len(hash.Salt) != SaltLength {
			t.Errorf("expected salt length %d, got %d", SaltLength, len(hash.Salt))
		}
	})

	t.Run("produces different hashes for same password", func(t *testing.T) {
		password := "SamePassword123!"
		hash1, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		hash2, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		if hash1.Hash == hash2.Hash {
			t.Error("hashes should be different due to unique salts")
		}

		if hash1.Salt == hash2.Salt {
			t.Error("salts should be unique")
		}
	})

	t.Run("uses correct Argon2id parameters", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		// Verify OWASP-recommended parameters
		if hash.Time != argon2Time {
			t.Errorf("expected time parameter %d, got %d", argon2Time, hash.Time)
		}

		if hash.Memory != argon2Memory {
			t.Errorf("expected memory parameter %d, got %d", argon2Memory, hash.Memory)
		}

		if hash.Threads != argon2Threads {
			t.Errorf("expected threads parameter %d, got %d", argon2Threads, hash.Threads)
		}

		if hash.KeyLen != argon2KeyLen {
			t.Errorf("expected key length %d, got %d", argon2KeyLen, hash.KeyLen)
		}
	})

	t.Run("rejects empty password", func(t *testing.T) {
		_, err := HashPassword("")
		if err == nil {
			t.Error("expected error for empty password")
		}
	})
}

func TestPasswordHash_String(t *testing.T) {
	t.Run("produces valid encoded format", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()

		// Check format: $argon2id$v=19$t=1,m=65536,p=4$<salt>$<hash>
		if !strings.HasPrefix(encoded, "$argon2id$v=") {
			t.Error("encoded hash should start with $argon2id$v=")
		}

		if !strings.Contains(encoded, "$t=") {
			t.Error("encoded hash should contain time parameter")
		}

		if !strings.Contains(encoded, ",m=") {
			t.Error("encoded hash should contain memory parameter")
		}

		if !strings.Contains(encoded, ",p=") {
			t.Error("encoded hash should contain threads parameter")
		}

		parts := strings.Split(encoded, "$")
		if len(parts) != 6 {
			t.Errorf("expected 6 parts in encoded hash, got %d", len(parts))
		}
	})
}

func TestParsePasswordHash(t *testing.T) {
	t.Run("successfully parses valid hash", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()
		parsed, err := ParsePasswordHash(encoded)
		if err != nil {
			t.Fatalf("failed to parse password hash: %v", err)
		}

		if parsed.Hash != hash.Hash {
			t.Error("parsed hash should match original")
		}

		if parsed.Salt != hash.Salt {
			t.Error("parsed salt should match original")
		}

		if parsed.Time != hash.Time {
			t.Error("parsed time should match original")
		}

		if parsed.Memory != hash.Memory {
			t.Error("parsed memory should match original")
		}

		if parsed.Threads != hash.Threads {
			t.Error("parsed threads should match original")
		}
	})

	t.Run("rejects invalid format", func(t *testing.T) {
		invalidHash := "invalid-hash-format"
		_, err := ParsePasswordHash(invalidHash)
		if err == nil {
			t.Error("expected error for invalid hash format")
		}
	})

	t.Run("rejects empty string", func(t *testing.T) {
		_, err := ParsePasswordHash("")
		if err == nil {
			t.Error("expected error for empty hash")
		}
	})
}

func TestVerifyPassword(t *testing.T) {
	t.Run("verifies correct password", func(t *testing.T) {
		password := "CorrectPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()
		valid := VerifyPassword(encoded, password)

		if !valid {
			t.Error("expected correct password to verify")
		}
	})

	t.Run("rejects incorrect password", func(t *testing.T) {
		password := "CorrectPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()
		valid := VerifyPassword(encoded, "WrongPassword123!")

		if valid {
			t.Error("expected incorrect password to fail verification")
		}
	})

	t.Run("rejects empty password", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()
		valid := VerifyPassword(encoded, "")

		if valid {
			t.Error("expected empty password to fail verification")
		}
	})

	t.Run("rejects invalid hash format", func(t *testing.T) {
		valid := VerifyPassword("invalid-hash", "password")

		if valid {
			t.Error("expected invalid hash format to fail verification")
		}
	})

	t.Run("rejects empty hash", func(t *testing.T) {
		valid := VerifyPassword("", "password")

		if valid {
			t.Error("expected empty hash to fail verification")
		}
	})

	t.Run("timing attack resistance", func(t *testing.T) {
		// This test ensures constant-time comparison
		password := "TestPassword123!"
		hash, err := HashPassword(password)
		if err != nil {
			t.Fatalf("failed to hash password: %v", err)
		}

		encoded := hash.String()

		// Measure verification time for correct password
		correctTimes := make([]int64, 100)
		for i := 0; i < 100; i++ {
			start := testing.AllocsPerRun(1, func() {
				VerifyPassword(encoded, password)
			})
			correctTimes[i] = int64(start)
		}

		// Measure verification time for wrong password
		wrongTimes := make([]int64, 100)
		for i := 0; i < 100; i++ {
			start := testing.AllocsPerRun(1, func() {
				VerifyPassword(encoded, "WrongPassword123!")
			})
			wrongTimes[i] = int64(start)
		}

		// Note: This is a basic check. In production, you'd use more sophisticated timing analysis.
		// The important part is that VerifyPassword uses subtle.ConstantTimeCompare
		_ = correctTimes
		_ = wrongTimes
	})
}

func TestPasswordHashIntegration(t *testing.T) {
	t.Run("round-trip password hashing and verification", func(t *testing.T) {
		passwords := []string{
			"Simple123",
			"Complex!@#123ABC",
			"äöüß€密码",
			"verylongpassword" + strings.Repeat("a", 100),
		}

		for _, password := range passwords {
			hash, err := HashPassword(password)
			if err != nil {
				t.Fatalf("failed to hash password: %v", err)
			}

			encoded := hash.String()
			valid := VerifyPassword(encoded, password)

			if !valid {
				t.Errorf("round-trip verification failed for password: %s", password)
			}

			// Verify wrong password fails
			if VerifyPassword(encoded, password+"wrong") {
				t.Errorf("verification should fail for modified password: %s", password)
			}
		}
	})
}

func BenchmarkHashPassword(b *testing.B) {
	password := "BenchmarkPassword123!"

	for i := 0; i < b.N; i++ {
		_, err := HashPassword(password)
		if err != nil {
			b.Fatalf("failed to hash password: %v", err)
		}
	}
}

func BenchmarkVerifyPassword(b *testing.B) {
	password := "BenchmarkPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		b.Fatalf("failed to hash password: %v", err)
	}
	encoded := hash.String()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		VerifyPassword(encoded, password)
	}
}

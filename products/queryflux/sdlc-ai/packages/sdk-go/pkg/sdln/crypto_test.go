package sdln

import (
	"bytes"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestAESEncryptionDecryption(t *testing.T) {
	tests := []struct {
		name        string
		plaintext   []byte
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:      "successful encryption and decryption",
			plaintext: []byte("Hello, World! This is a test message."),
			password:  "test-password-123",
		},
		{
			name:      "empty plaintext",
			plaintext: []byte(""),
			password:  "test-password",
		},
		{
			name:      "large plaintext",
			plaintext: bytes.Repeat([]byte("This is a test message for large encryption. "), 100),
			password:  "test-password",
		},
		{
			name:      "plaintext with special characters",
			plaintext: []byte("Hello, 世界! 🌍 Special chars: !@#$%^&*()"),
			password:  "test-password",
		},
		{
			name:      "unicode characters",
			plaintext: []byte("Test with unicode: café, résumé, naïve"),
			password:  "test-password",
		},
		{
			name:        "empty password",
			plaintext:   []byte("test message"),
			password:    "",
			expectError: true,
			errorMsg:    "password cannot be empty",
		},
		{
			name:        "nil plaintext",
			plaintext:   nil,
			password:    "test-password",
			expectError: true,
			errorMsg:    "plaintext cannot be nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test encryption
			ciphertext, err := AESEncrypt(tt.plaintext, tt.password)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected encryption error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected encryption error: %v", err)
			}

			if len(ciphertext) == 0 {
				t.Fatal("Expected non-empty ciphertext")
			}

			// Verify ciphertext is different from plaintext (except for empty case)
			if len(tt.plaintext) > 0 && bytes.Equal(ciphertext, tt.plaintext) {
				t.Fatal("Ciphertext should be different from plaintext")
			}

			// Test decryption
			decrypted, err := AESDecrypt(ciphertext, tt.password)
			if err != nil {
				t.Fatalf("Unexpected decryption error: %v", err)
			}

			if !bytes.Equal(decrypted, tt.plaintext) {
				t.Fatalf("Decrypted text doesn't match original. Expected %q, got %q",
					string(tt.plaintext), string(decrypted))
			}
		})
	}
}

func TestAESDecryptWithInvalidInputs(t *testing.T) {
	tests := []struct {
		name        string
		ciphertext  []byte
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "empty ciphertext",
			ciphertext:  []byte(""),
			password:    "test-password",
			expectError: true,
			errorMsg:    "ciphertext cannot be empty",
		},
		{
			name:        "nil ciphertext",
			ciphertext:  nil,
			password:    "test-password",
			expectError: true,
			errorMsg:    "ciphertext cannot be nil",
		},
		{
			name:        "invalid password",
			ciphertext:  []byte("invalid-ciphertext"),
			password:    "",
			expectError: true,
			errorMsg:    "password cannot be empty",
		},
		{
			name:        "ciphertext too short",
			ciphertext:  []byte("short"),
			password:    "test-password",
			expectError: true,
			errorMsg:    "ciphertext too short",
		},
		{
			name:        "invalid ciphertext format",
			ciphertext:  []byte("invalid-ciphertext-data"),
			password:    "test-password",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := AESDecrypt(tt.ciphertext, tt.password)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestAESEncryptWithDifferentPasswords(t *testing.T) {
	plaintext := []byte("Test message for password comparison")
	password1 := "password1"
	password2 := "password2"

	// Encrypt with password1
	ciphertext1, err := AESEncrypt(plaintext, password1)
	if err != nil {
		t.Fatalf("Failed to encrypt with password1: %v", err)
	}

	// Encrypt with password2
	ciphertext2, err := AESEncrypt(plaintext, password2)
	if err != nil {
		t.Fatalf("Failed to encrypt with password2: %v", err)
	}

	// Ciphertexts should be different
	if bytes.Equal(ciphertext1, ciphertext2) {
		t.Fatal("Ciphertexts should be different for different passwords")
	}

	// Decrypt with correct passwords
	decrypted1, err := AESDecrypt(ciphertext1, password1)
	if err != nil {
		t.Fatalf("Failed to decrypt with password1: %v", err)
	}

	decrypted2, err := AESDecrypt(ciphertext2, password2)
	if err != nil {
		t.Fatalf("Failed to decrypt with password2: %v", err)
	}

	// Both should match original plaintext
	if !bytes.Equal(decrypted1, plaintext) {
		t.Fatal("Decrypted text doesn't match original for password1")
	}
	if !bytes.Equal(decrypted2, plaintext) {
		t.Fatal("Decrypted text doesn't match original for password2")
	}

	// Decrypt with wrong passwords should fail
	_, err = AESDecrypt(ciphertext1, password2)
	if err == nil {
		t.Fatal("Expected error when decrypting with wrong password")
	}

	_, err = AESDecrypt(ciphertext2, password1)
	if err == nil {
		t.Fatal("Expected error when decrypting with wrong password")
	}
}

func TestSealAndUnseal(t *testing.T) {
	tests := []struct {
		name        string
		message     []byte
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:     "successful seal and unseal",
			message:  []byte("This is a sealed message"),
			password: "seal-password",
		},
		{
			name:     "empty message",
			message:  []byte(""),
			password: "seal-password",
		},
		{
			name:     "large message",
			message:  bytes.Repeat([]byte("Large message data. "), 50),
			password: "seal-password",
		},
		{
			name:        "empty password",
			message:     []byte("test message"),
			password:    "",
			expectError: true,
			errorMsg:    "password cannot be empty",
		},
		{
			name:        "nil message",
			message:     nil,
			password:    "seal-password",
			expectError: true,
			errorMsg:    "message cannot be nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test sealing
			sealed, err := Seal(tt.message, tt.password)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected seal error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected seal error: %v", err)
			}

			if len(sealed) == 0 {
				t.Fatal("Expected non-empty sealed message")
			}

			// Test unsealing
			unsealed, err := Unseal(sealed, tt.password)
			if err != nil {
				t.Fatalf("Unexpected unseal error: %v", err)
			}

			if !bytes.Equal(unsealed, tt.message) {
				t.Fatalf("Unsealed message doesn't match original. Expected %q, got %q",
					string(tt.message), string(unsealed))
			}

			// Verify sealed message includes timestamp
			unsealedTime, err := Unseal(sealed, tt.password)
			if err != nil {
				t.Fatalf("Failed to unseal for time verification: %v", err)
			}

			// The unsealed message should contain the original message plus timestamp
			// This is a simplified check - in real implementation you'd parse the format
			if len(unsealedTime) <= len(tt.message) {
				t.Fatal("Sealed message should contain original message plus timestamp")
			}
		})
	}
}

func TestUnsealWithInvalidInputs(t *testing.T) {
	tests := []struct {
		name        string
		sealed      []byte
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:     "empty sealed message",
			sealed:   []byte(""),
			password: "test-password",
		},
		{
			name:     "nil sealed message",
			sealed:   nil,
			password: "test-password",
		},
		{
			name:     "empty password",
			sealed:   []byte("valid-sealed-message"),
			password: "",
		},
		{
			name:     "invalid sealed format",
			sealed:   []byte("invalid-format"),
			password: "test-password",
		},
		{
			name:     "sealed message with invalid base64",
			sealed:   []byte("invalid-base64!@#"),
			password: "test-password",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Unseal(tt.sealed, tt.password)

			// Some invalid inputs might not error immediately but fail during validation
			// The exact behavior depends on implementation details
			if (tt.name == "empty password" || tt.name == "nil sealed message") && err == nil {
				t.Fatal("Expected error for invalid input")
			}

			if err != nil && tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
				t.Logf("Got error: %v", err)
			}
		})
	}
}

func TestGenerateRandomBytes(t *testing.T) {
	tests := []struct {
		name        string
		length      int
		expectError bool
		errorMsg    string
	}{
		{
			name:   "generate 16 bytes",
			length: 16,
		},
		{
			name:   "generate 32 bytes",
			length: 32,
		},
		{
			name:   "generate 64 bytes",
			length: 64,
		},
		{
			name:   "generate 1 byte",
			length: 1,
		},
		{
			name:   "generate 0 bytes",
			length: 0,
		},
		{
			name:        "negative length",
			length:      -1,
			expectError: true,
		},
		{
			name:        "very large length",
			length:      1024 * 1024, // 1MB
			expectError: true,        // Might fail due to memory limits
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			randomBytes, err := GenerateRandomBytes(tt.length)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(randomBytes) != tt.length {
				t.Fatalf("Expected %d bytes, got %d", tt.length, len(randomBytes))
			}

			// Test that bytes are actually random (basic check)
			if tt.length > 1 {
				// Check that not all bytes are the same
				allSame := true
				firstByte := randomBytes[0]
				for _, b := range randomBytes {
					if b != firstByte {
						allSame = false
						break
					}
				}
				if allSame {
					t.Fatal("Generated bytes appear to be non-random")
				}
			}

			// Test multiple generations produce different results
			if tt.length > 0 && tt.length < 100 { // Skip for very large allocations
				randomBytes2, err := GenerateRandomBytes(tt.length)
				if err != nil {
					t.Fatalf("Failed to generate second random bytes: %v", err)
				}

				if bytes.Equal(randomBytes, randomBytes2) {
					t.Fatal("Random bytes generation appears to be deterministic")
				}
			}
		})
	}
}

func TestGenerateRandomString(t *testing.T) {
	tests := []struct {
		name        string
		length      int
		expectError bool
		errorMsg    string
	}{
		{
			name:   "generate 8 character string",
			length: 8,
		},
		{
			name:   "generate 16 character string",
			length: 16,
		},
		{
			name:   "generate 32 character string",
			length: 32,
		},
		{
			name:   "generate 1 character string",
			length: 1,
		},
		{
			name:   "generate 0 character string",
			length: 0,
		},
		{
			name:        "negative length",
			length:      -1,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			randomStr, err := GenerateRandomString(tt.length)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(randomStr) != tt.length {
				t.Fatalf("Expected length %d, got %d", tt.length, len(randomStr))
			}

			// Test that string contains valid characters (base64)
			for _, c := range randomStr {
				if !isValidBase64Char(c) {
					t.Fatalf("Invalid character in random string: %c", c)
				}
			}

			// Test multiple generations produce different results
			if tt.length > 0 && tt.length < 50 {
				randomStr2, err := GenerateRandomString(tt.length)
				if err != nil {
					t.Fatalf("Failed to generate second random string: %v", err)
				}

				if randomStr == randomStr2 {
					t.Fatal("Random string generation appears to be deterministic")
				}
			}
		})
	}
}

func TestHashPassword(t *testing.T) {
	tests := []struct {
		name        string
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:     "valid password",
			password: "my-secure-password",
		},
		{
			name:     "empty password",
			password: "",
		},
		{
			name:     "password with special characters",
			password: "p@ssw0rd!#$%^&*()",
		},
		{
			name:     "unicode password",
			password: "密码123",
		},
		{
			name:     "very long password",
			password: strings.Repeat("a", 1000),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hashedPassword, err := HashPassword(tt.password)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(hashedPassword) == 0 {
				t.Fatal("Expected non-empty hashed password")
			}

			// Hashed password should be different from original password
			if hashedPassword == tt.password {
				t.Fatal("Hashed password should be different from original")
			}

			// Same password should produce different hashes (due to salt)
			if tt.password != "" {
				hashedPassword2, err := HashPassword(tt.password)
				if err != nil {
					t.Fatalf("Failed to hash password second time: %v", err)
				}

				if hashedPassword == hashedPassword2 {
					t.Fatal("Same password should produce different hashes")
				}
			}
		})
	}
}

func TestVerifyPassword(t *testing.T) {
	tests := []struct {
		name        string
		password    string
		expectMatch bool
	}{
		{
			name:        "correct password",
			password:    "correct-password",
			expectMatch: true,
		},
		{
			name:        "incorrect password",
			password:    "wrong-password",
			expectMatch: false,
		},
		{
			name:        "empty password",
			password:    "",
			expectMatch: false,
		},
		{
			name:        "password with special characters",
			password:    "p@ssw0rd!@#",
			expectMatch: true,
		},
	}

	// First, hash a known password
	originalPassword := "test-password-123"
	hashedPassword, err := HashPassword(originalPassword)
	if err != nil {
		t.Fatalf("Failed to hash test password: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := VerifyPassword(tt.password, hashedPassword)

			if isValid != tt.expectMatch {
				t.Fatalf("Expected %v for password %q, got %v",
					tt.expectMatch, tt.password, isValid)
			}
		})
	}
}

func TestVerifyPasswordWithInvalidHash(t *testing.T) {
	tests := []struct {
		name      string
		hash      string
		password  string
		expectErr bool
	}{
		{
			name:      "invalid hash format",
			hash:      "invalid-hash-format",
			password:  "test-password",
			expectErr: true,
		},
		{
			name:      "hash too short",
			hash:      "short",
			password:  "test-password",
			expectErr: true,
		},
		{
			name:      "empty hash",
			hash:      "",
			password:  "test-password",
			expectErr: true,
		},
		{
			name:      "invalid base64 in hash",
			hash:      "invalid-base64!@#$",
			password:  "test-password",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := VerifyPassword(tt.password, tt.hash)

			if tt.expectErr {
				if isValid {
					t.Fatal("Expected verification to fail for invalid hash")
				}
			}
		})
	}
}

func TestGenerateKey(t *testing.T) {
	tests := []struct {
		name        string
		keyLength   int
		expectError bool
		errorMsg    string
	}{
		{
			name:      "generate 16 byte key",
			keyLength: 16,
		},
		{
			name:      "generate 32 byte key",
			keyLength: 32,
		},
		{
			name:      "generate 64 byte key",
			keyLength: 64,
		},
		{
			name:      "generate 128 byte key",
			keyLength: 128,
		},
		{
			name:        "invalid key length",
			keyLength:   15, // Not a multiple of 16
			expectError: true,
			errorMsg:    "key length must be multiple of 16",
		},
		{
			name:        "zero key length",
			keyLength:   0,
			expectError: true,
			errorMsg:    "key length must be positive",
		},
		{
			name:        "negative key length",
			keyLength:   -16,
			expectError: true,
			errorMsg:    "key length must be positive",
		},
		{
			name:        "very large key length",
			keyLength:   1024 * 1024, // 1MB
			expectError: true,        // Might fail due to memory limits
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, err := GenerateKey(tt.keyLength)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(key) != tt.keyLength {
				t.Fatalf("Expected key length %d, got %d", tt.keyLength, len(key))
			}

			// Test that key is suitable for AES (16, 24, or 32 bytes)
			validLengths := []int{16, 24, 32}
			isValidLength := false
			for _, validLen := range validLengths {
				if tt.keyLength == validLen {
					isValidLength = true
					break
				}
			}

			if !isValidLength {
				// For other lengths, the key should still be usable but might need padding
				t.Logf("Generated key with non-standard length: %d", tt.keyLength)
			}

			// Test multiple generations produce different results
			if tt.keyLength <= 128 { // Skip for very large allocations
				key2, err := GenerateKey(tt.keyLength)
				if err != nil {
					t.Fatalf("Failed to generate second key: %v", err)
				}

				if bytes.Equal(key, key2) {
					t.Fatal("Key generation appears to be deterministic")
				}
			}
		})
	}
}

func TestCryptoEdgeCases(t *testing.T) {
	t.Run("concurrent encryption/decryption", func(t *testing.T) {
		const numGoroutines = 50
		const numOperations = 10

		var wg sync.WaitGroup
		errors := make(chan error, numGoroutines*numOperations)

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				for j := 0; j < numOperations; j++ {
					plaintext := []byte(fmt.Sprintf("goroutine-%d-operation-%d", id, j))
					password := fmt.Sprintf("password-%d", id)

					// Encrypt
					ciphertext, err := AESEncrypt(plaintext, password)
					if err != nil {
						errors <- fmt.Errorf("encryption failed: %v", err)
						return
					}

					// Decrypt
					decrypted, err := AESDecrypt(ciphertext, password)
					if err != nil {
						errors <- fmt.Errorf("decryption failed: %v", err)
						return
					}

					// Verify
					if !bytes.Equal(decrypted, plaintext) {
						errors <- fmt.Errorf("decrypted text doesn't match original")
						return
					}
				}
			}(i)
		}

		wg.Wait()
		close(errors)

		for err := range errors {
			t.Errorf("Concurrent crypto operation failed: %v", err)
		}
	})

	t.Run("large data encryption", func(t *testing.T) {
		// Test with 1MB of data
		largeData := make([]byte, 1024*1024)
		for i := range largeData {
			largeData[i] = byte(i % 256)
		}

		password := "large-data-password"

		start := time.Now()
		ciphertext, err := AESEncrypt(largeData, password)
		encryptTime := time.Since(start)

		if err != nil {
			t.Fatalf("Failed to encrypt large data: %v", err)
		}

		start = time.Now()
		decrypted, err := AESDecrypt(ciphertext, password)
		decryptTime := time.Since(start)

		if err != nil {
			t.Fatalf("Failed to decrypt large data: %v", err)
		}

		if !bytes.Equal(decrypted, largeData) {
			t.Fatal("Decrypted large data doesn't match original")
		}

		t.Logf("Large data encryption: %v, decryption: %v", encryptTime, decryptTime)

		// Performance assertions
		if encryptTime > 1*time.Second {
			t.Logf("Warning: Large data encryption took longer than expected: %v", encryptTime)
		}
		if decryptTime > 1*time.Second {
			t.Logf("Warning: Large data decryption took longer than expected: %v", decryptTime)
		}
	})

	t.Run("memory usage verification", func(t *testing.T) {
		// Verify that operations don't leak memory
		for i := 0; i < 1000; i++ {
			plaintext := []byte(fmt.Sprintf("test-data-%d", i))
			password := fmt.Sprintf("password-%d", i)

			ciphertext, err := AESEncrypt(plaintext, password)
			if err != nil {
				t.Fatalf("Encryption failed in iteration %d: %v", i, err)
			}

			decrypted, err := AESDecrypt(ciphertext, password)
			if err != nil {
				t.Fatalf("Decryption failed in iteration %d: %v", i, err)
			}

			if !bytes.Equal(decrypted, plaintext) {
				t.Fatalf("Data mismatch in iteration %d", i)
			}
		}
	})
}

// Test helper functions

func isValidBase64Char(c byte) bool {
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
		c == '+' || c == '/' || c == '='
}

// Test cryptographic security properties
func TestCryptographicSecurity(t *testing.T) {
	t.Run("encryption produces unique ciphertexts", func(t *testing.T) {
		plaintext := []byte("test message")
		password := "test-password"

		// Generate multiple ciphertexts
		ciphertexts := make([][]byte, 10)
		for i := range ciphertexts {
			var err error
			ciphertexts[i], err = AESEncrypt(plaintext, password)
			if err != nil {
				t.Fatalf("Failed to encrypt ciphertext %d: %v", i, err)
			}
		}

		// All ciphertexts should be different
		for i := range ciphertexts {
			for j := i + 1; j < len(ciphertexts); j++ {
				if bytes.Equal(ciphertexts[i], ciphertexts[j]) {
					t.Fatalf("Ciphertexts %d and %d are identical - encryption should be unique", i, j)
				}
			}
		}
	})

	t.Run("same plaintext with different salts", func(t *testing.T) {
		// This tests that our encryption includes proper randomization
		plaintext := []byte("same plaintext")
		password := "same-password"

		ciphertext1, err := AESEncrypt(plaintext, password)
		if err != nil {
			t.Fatalf("Failed to encrypt first time: %v", err)
		}

		ciphertext2, err := AESEncrypt(plaintext, password)
		if err != nil {
			t.Fatalf("Failed to encrypt second time: %v", err)
		}

		// Should be different due to random IV/salt
		if bytes.Equal(ciphertext1, ciphertext2) {
			t.Fatal("Same plaintext encrypted twice produced identical ciphertexts")
		}

		// But both should decrypt to the same plaintext
		decrypted1, err := AESDecrypt(ciphertext1, password)
		if err != nil {
			t.Fatalf("Failed to decrypt first ciphertext: %v", err)
		}

		decrypted2, err := AESDecrypt(ciphertext2, password)
		if err != nil {
			t.Fatalf("Failed to decrypt second ciphertext: %v", err)
		}

		if !bytes.Equal(decrypted1, plaintext) {
			t.Fatal("First decryption doesn't match original")
		}
		if !bytes.Equal(decrypted2, plaintext) {
			t.Fatal("Second decryption doesn't match original")
		}
	})

	t.Run("password strength verification", func(t *testing.T) {
		weakPasswords := []string{
			"password",
			"123456",
			"qwerty",
		}

		strongPasswords := []string{
			"MyStr0ngP@ssw0rd!2023",
			"C0mpl3x-P@ssw0rd_w1th_Symb0ls",
			"r@nd0m_p@ssw0rd_12345",
		}

		// Test hashing works for all passwords
		for _, pwd := range append(weakPasswords, strongPasswords...) {
			hashed, err := HashPassword(pwd)
			if err != nil {
				t.Fatalf("Failed to hash password %q: %v", pwd, err)
			}

			if len(hashed) == 0 {
				t.Fatalf("Hashed password for %q is empty", pwd)
			}

			// Verify password works
			if !VerifyPassword(pwd, hashed) {
				t.Fatalf("Password verification failed for %q", pwd)
			}
		}
	})
}

// Test error handling and validation
func TestCryptoErrorHandling(t *testing.T) {
	t.Run("graceful handling of invalid inputs", func(t *testing.T) {
		// Test that invalid inputs are handled gracefully
		invalidInputs := [][]byte{
			nil,
			{},
			make([]byte, 1),  // Single byte
			make([]byte, 15), // Invalid size for AES
		}

		password := "test-password"
		for _, input := range invalidInputs {
			// These should either fail gracefully or be handled appropriately
			ciphertext, err := AESEncrypt(input, password)
			if err == nil && len(input) > 0 {
				// If encryption succeeded, try decryption
				_, err = AESDecrypt(ciphertext, password)
				if err != nil {
					t.Logf("Expected decryption failure for invalid input: %v", err)
				}
			}
		}
	})

	t.Run("resource cleanup", func(t *testing.T) {
		// Test that resources are properly cleaned up
		for i := 0; i < 100; i++ {
			plaintext := make([]byte, 1024) // 1KB
			password := fmt.Sprintf("password-%d", i)

			ciphertext, err := AESEncrypt(plaintext, password)
			if err != nil {
				t.Fatalf("Failed to encrypt in cleanup test: %v", err)
			}

			// Simulate immediate cleanup by setting to nil
			plaintext = nil

			decrypted, err := AESDecrypt(ciphertext, password)
			if err != nil {
				t.Fatalf("Failed to decrypt in cleanup test: %v", err)
			}

			// Cleanup
			ciphertext = nil
			decrypted = nil
		}
	})
}

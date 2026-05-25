package vault

import (
	"strings"
	"testing"
)

// TestEncryptDecrypt_RoundTrip verifies basic encryption/decryption cycle.
func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	v, err := New("my-secret-master-key")
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	plaintext := "github_pat_11ABC123xyz456"
	encrypted, err := v.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	decrypted, err := v.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("Round-trip failed: expected %q, got %q", plaintext, decrypted)
	}
}

// TestEncrypt_DifferentCiphertexts verifies random nonce generation.
// Same plaintext should produce different ciphertexts due to random nonce.
func TestEncrypt_DifferentCiphertexts(t *testing.T) {
	v, err := New("my-secret-master-key")
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	plaintext := "github_pat_11ABC123xyz456"
	encrypted1, err := v.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("First Encrypt failed: %v", err)
	}

	encrypted2, err := v.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Second Encrypt failed: %v", err)
	}

	if encrypted1 == encrypted2 {
		t.Error("Same plaintext produced identical ciphertexts; random nonce likely not working")
	}

	// Both should decrypt to the same plaintext
	dec1, err := v.Decrypt(encrypted1)
	if err != nil {
		t.Fatalf("Decrypt encrypted1 failed: %v", err)
	}

	dec2, err := v.Decrypt(encrypted2)
	if err != nil {
		t.Fatalf("Decrypt encrypted2 failed: %v", err)
	}

	if dec1 != dec2 || dec1 != plaintext {
		t.Error("Decrypted values don't match or don't equal plaintext")
	}
}

// TestDecrypt_InvalidCiphertext verifies error handling for malformed ciphertext.
func TestDecrypt_InvalidCiphertext(t *testing.T) {
	v, err := New("my-secret-master-key")
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	// Invalid base64
	_, err = v.Decrypt("not-valid-base64!!!")
	if err == nil {
		t.Error("Expected error for invalid base64, got nil")
	}
}

// TestDecrypt_TamperedCiphertext verifies integrity checking via GCM auth tag.
func TestDecrypt_TamperedCiphertext(t *testing.T) {
	v, err := New("my-secret-master-key")
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	plaintext := "secret-token-12345"
	encrypted, err := v.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Tamper with the ciphertext by replacing middle characters
	runes := []rune(encrypted)
	if len(runes) > 4 {
		runes[len(runes)/2] = 'X'
	}
	tampered := string(runes)

	_, err = v.Decrypt(tampered)
	if err == nil {
		t.Error("Expected error for tampered ciphertext, got nil")
	}
}

// TestNew_EmptyKey verifies graceful degradation with empty master key.
func TestNew_EmptyKey(t *testing.T) {
	v, err := New("")
	if err != nil {
		t.Fatalf("New with empty key failed: %v", err)
	}

	if v.Enabled() {
		t.Error("Vault with empty key should not be enabled")
	}

	plaintext := "test-token"
	encrypted, err := v.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt with disabled vault failed: %v", err)
	}

	if encrypted != plaintext {
		t.Errorf("Disabled vault should return plaintext; expected %q, got %q", plaintext, encrypted)
	}

	decrypted, err := v.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt with disabled vault failed: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("Disabled vault should return plaintext; expected %q, got %q", plaintext, decrypted)
	}
}

// TestEnabled verifies the Enabled() method returns correct state.
func TestEnabled(t *testing.T) {
	v1, err := New("")
	if err != nil {
		t.Fatalf("New with empty key failed: %v", err)
	}
	if v1.Enabled() {
		t.Error("Vault with empty key should be disabled")
	}

	v2, err := New("some-master-key")
	if err != nil {
		t.Fatalf("New with master key failed: %v", err)
	}
	if !v2.Enabled() {
		t.Error("Vault with master key should be enabled")
	}
}

// TestEncrypt_LongToken verifies encryption of realistic long tokens.
func TestEncrypt_LongToken(t *testing.T) {
	v, err := New("master-key-for-test")
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	longToken := strings.Repeat("abcdefghijklmnopqrstuvwxyz0123456789", 10)
	encrypted, err := v.Encrypt(longToken)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	decrypted, err := v.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != longToken {
		t.Errorf("Round-trip failed for long token")
	}
}

// TestEncrypt_SpecialCharacters verifies encryption of tokens with special chars.
func TestEncrypt_SpecialCharacters(t *testing.T) {
	v, err := New("master-key")
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}

	specialToken := "glpat-K_1xWx5Mm-xXvYz@#$%^&*()_+-=[]{}|;:',.<>?/~`"
	encrypted, err := v.Encrypt(specialToken)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	decrypted, err := v.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != specialToken {
		t.Errorf("Round-trip failed for special characters; expected %q, got %q", specialToken, decrypted)
	}
}

// TestDifferentKeys verifies that different master keys produce incompatible ciphertexts.
func TestDifferentKeys(t *testing.T) {
	v1, err := New("key-1")
	if err != nil {
		t.Fatalf("New with key-1 failed: %v", err)
	}

	v2, err := New("key-2")
	if err != nil {
		t.Fatalf("New with key-2 failed: %v", err)
	}

	plaintext := "my-secret-token"
	encrypted, err := v1.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt with v1 failed: %v", err)
	}

	_, err = v2.Decrypt(encrypted)
	if err == nil {
		t.Error("Expected error when decrypting with different key, got nil")
	}
}

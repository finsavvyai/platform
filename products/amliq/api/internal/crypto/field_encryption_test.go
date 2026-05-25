package crypto

import (
	"crypto/rand"
	"testing"
)

func TestFieldEncryptorRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	rand.Read(key)

	enc, err := NewFieldEncryptor(key)
	if err != nil {
		t.Fatalf("NewFieldEncryptor: %v", err)
	}

	tests := []struct {
		name      string
		plaintext string
	}{
		{"simple", "John Smith"},
		{"unicode", "محمد أحمد"},
		{"empty", ""},
		{"long", "This is a longer string with numbers 12345 and symbols @#$%"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := enc.Encrypt(tt.plaintext)
			if err != nil {
				t.Fatalf("Encrypt: %v", err)
			}
			if encrypted == tt.plaintext && tt.plaintext != "" {
				t.Error("encrypted should differ from plaintext")
			}
			decrypted, err := enc.Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt: %v", err)
			}
			if decrypted != tt.plaintext {
				t.Errorf("got %q, want %q", decrypted, tt.plaintext)
			}
		})
	}
}

func TestFieldEncryptorBadKey(t *testing.T) {
	_, err := NewFieldEncryptor([]byte("short"))
	if err == nil {
		t.Error("expected error for short key")
	}
}

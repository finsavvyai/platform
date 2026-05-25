package secrets

import (
	"bytes"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := make([]byte, 32) // AES-256 zero key
	plain := []byte("super-secret-value")

	ct, err := encrypt(plain, key)
	if err != nil {
		t.Fatalf("encrypt() error = %v", err)
	}
	got, err := decrypt(ct, key)
	if err != nil {
		t.Fatalf("decrypt() error = %v", err)
	}
	if !bytes.Equal(got, plain) {
		t.Errorf("decrypt() = %q, want %q", got, plain)
	}
}

func TestDecryptWrongKey(t *testing.T) {
	key1 := make([]byte, 32)
	key2 := make([]byte, 32)
	key2[0] = 0xFF

	ct, err := encrypt([]byte("data"), key1)
	if err != nil {
		t.Fatalf("encrypt() error = %v", err)
	}
	_, err = decrypt(ct, key2)
	if err == nil {
		t.Error("decrypt() with wrong key should fail")
	}
}

func TestDecryptShortCiphertext(t *testing.T) {
	key := make([]byte, 32)
	_, err := decrypt([]byte("short"), key)
	if err == nil {
		t.Error("decrypt() with short ciphertext should fail")
	}
}

func TestEncryptRandomNonce(t *testing.T) {
	key := make([]byte, 32)
	plain := []byte("same-input")

	ct1, err := encrypt(plain, key)
	if err != nil {
		t.Fatalf("encrypt() error = %v", err)
	}
	ct2, err := encrypt(plain, key)
	if err != nil {
		t.Fatalf("encrypt() error = %v", err)
	}
	if bytes.Equal(ct1, ct2) {
		t.Error("encrypt() should produce different output each time")
	}
}

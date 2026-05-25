// Sealer unit tests. The repo path needs Postgres + is exercised
// indirectly by the anthropic_compat handler integration test.
package byok

import (
	"strings"
	"testing"
)

const goodKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" // 32 bytes hex

func TestNewSealer_RejectsShortKey(t *testing.T) {
	_, err := NewSealer("deadbeef")
	if err == nil {
		t.Fatal("expected error for 4-byte key, got nil")
	}
	if !strings.Contains(err.Error(), "32 bytes") {
		t.Errorf("error message should mention 32 bytes; got %q", err.Error())
	}
}

func TestNewSealer_RejectsNonHex(t *testing.T) {
	_, err := NewSealer("not-hex-and-also-too-short")
	if err == nil {
		t.Fatal("expected error for non-hex key, got nil")
	}
}

func TestSealer_RoundTrip(t *testing.T) {
	s, err := NewSealer(goodKey)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	plaintext := []byte("sk-ant-api03-AbCdEf01234567890123456789012345")
	nonce, ct, err := s.Seal(plaintext)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if len(nonce) != 12 {
		t.Errorf("nonce size = %d, want 12 (GCM standard)", len(nonce))
	}
	if string(ct) == string(plaintext) {
		t.Error("ciphertext equals plaintext — sealing is broken")
	}
	got, err := s.Open(nonce, ct)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if string(got) != string(plaintext) {
		t.Errorf("Open returned %q, want %q", got, plaintext)
	}
}

func TestSealer_TamperedCiphertextReturnsErrTampered(t *testing.T) {
	s, _ := NewSealer(goodKey)
	nonce, ct, _ := s.Seal([]byte("secret"))
	ct[0] ^= 0xFF // flip a bit
	_, err := s.Open(nonce, ct)
	if err != ErrTampered {
		t.Errorf("expected ErrTampered, got %v", err)
	}
}

func TestSealer_WrongKeyReturnsErrTampered(t *testing.T) {
	s1, _ := NewSealer(goodKey)
	s2, _ := NewSealer("ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100")
	nonce, ct, _ := s1.Seal([]byte("secret"))
	_, err := s2.Open(nonce, ct)
	if err != ErrTampered {
		t.Errorf("expected ErrTampered when opening with wrong key, got %v", err)
	}
}

func TestSealer_TamperedNonceReturnsErrTampered(t *testing.T) {
	s, _ := NewSealer(goodKey)
	nonce, ct, _ := s.Seal([]byte("secret"))
	nonce[0] ^= 0xFF
	_, err := s.Open(nonce, ct)
	if err != ErrTampered {
		t.Errorf("expected ErrTampered with tampered nonce, got %v", err)
	}
}

func TestSealer_ShortNonceReturnsErrTampered(t *testing.T) {
	s, _ := NewSealer(goodKey)
	_, ct, _ := s.Seal([]byte("secret"))
	_, err := s.Open([]byte{0x00, 0x01}, ct)
	if err != ErrTampered {
		t.Errorf("expected ErrTampered with short nonce, got %v", err)
	}
}

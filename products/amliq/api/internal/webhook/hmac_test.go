package webhook

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateSecret(t *testing.T) {
	s, err := GenerateSecret()
	if err != nil {
		t.Fatalf("GenerateSecret() error = %v", err)
	}
	if !strings.HasPrefix(s, SecretPrefix) {
		t.Errorf("secret missing prefix: %s", s)
	}
	if len(s) != len(SecretPrefix)+64 {
		t.Errorf("secret length = %d, want %d", len(s), len(SecretPrefix)+64)
	}
}

func TestSignAndVerify(t *testing.T) {
	secret := "whsec_test123"
	body := []byte(`{"event":"alert.created"}`)

	sig := Sign(secret, body)
	if err := Verify(secret, body, sig); err != nil {
		t.Errorf("Verify valid signature: %v", err)
	}
}

func TestVerifyWrongSecret(t *testing.T) {
	sig := Sign("secret1", []byte("body"))
	if err := Verify("secret2", []byte("body"), sig); err == nil {
		t.Error("expected signature mismatch error")
	}
}

func TestVerifyExpiredSignature(t *testing.T) {
	secret := "whsec_test"
	body := []byte("body")
	oldTs := time.Now().Add(-10 * time.Minute).Unix()
	sig := SignWithTimestamp(secret, body, oldTs)
	if err := Verify(secret, body, sig); err == nil {
		t.Error("expected expired error")
	}
}

func TestVerifyMalformed(t *testing.T) {
	if err := Verify("s", []byte("b"), "notasignature"); err == nil {
		t.Error("expected malformed error")
	}
}

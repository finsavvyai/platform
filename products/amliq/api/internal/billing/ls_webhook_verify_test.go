package billing

import (
	"testing"
)

func TestVerifyWebhookSignature(t *testing.T) {
	secret := "test_secret"
	payload := []byte("test_payload")

	signature := GenerateWebhookSignature(payload, secret)

	err := VerifyWebhookSignature(payload, signature, secret)
	if err != nil {
		t.Errorf("VerifyWebhookSignature() error = %v", err)
	}
}

func TestVerifyWebhookSignatureInvalid(t *testing.T) {
	secret := "test_secret"
	payload := []byte("test_payload")

	err := VerifyWebhookSignature(payload, "invalid_signature", secret)
	if err == nil {
		t.Error("VerifyWebhookSignature() should fail with invalid signature")
	}
}

func TestGenerateWebhookSignature(t *testing.T) {
	secret := "test_secret"
	payload := []byte("test_payload")

	sig := GenerateWebhookSignature(payload, secret)
	if sig == "" {
		t.Error("GenerateWebhookSignature() returned empty string")
	}
	if len(sig) != 64 {
		t.Errorf("GenerateWebhookSignature() length = %d, want 64", len(sig))
	}
}

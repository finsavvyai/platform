package mfa

import (
	"testing"
	"time"
)

func TestGenerateSecret(t *testing.T) {
	s := GenerateSecret()
	if len(s) < 16 {
		t.Errorf("secret too short: %d", len(s))
	}
}

func TestGenerateRecoveryCodes(t *testing.T) {
	codes := GenerateRecoveryCodes()
	if len(codes) != 8 {
		t.Errorf("expected 8 codes, got %d", len(codes))
	}
	seen := map[string]bool{}
	for _, c := range codes {
		if len(c) != 8 {
			t.Errorf("code length %d, want 8", len(c))
		}
		if seen[c] {
			t.Errorf("duplicate code: %s", c)
		}
		seen[c] = true
	}
}

func TestVerifySelfGenerated(t *testing.T) {
	secret := GenerateSecret()
	// Generate current code and verify it
	code := generateCode(secret, time.Now().Unix()/30)
	if !Verify(secret, code) {
		t.Errorf("Verify failed for self-generated code")
	}
}

func TestVerifyWrongCode(t *testing.T) {
	secret := GenerateSecret()
	if Verify(secret, "000000") {
		t.Errorf("Verify should reject wrong code")
	}
}

func TestQRCodeURL(t *testing.T) {
	url := QRCodeURL("JBSWY3DPEHPK3PXP", "test@amliq.finance", "AMLIQ")
	if url == "" {
		t.Error("empty URL")
	}
	if len(url) < 50 {
		t.Errorf("URL too short: %s", url)
	}
}


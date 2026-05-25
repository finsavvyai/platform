package saml

import (
	"net/http"
	"strings"
	"testing"
)

// TestValidateResponse_GarbageInput exercises the error branch of
// our wrapper without needing a fully-signed SAML XML fixture.
// crewjam's ParseResponse coverage isn't ours to own; what we own
// is "does the wrapper correctly bubble up the error". A garbage
// HTTP request hits exactly that path.
func TestValidateResponse_GarbageInput(t *testing.T) {
	keyPEM, certPEM, _ := GenerateSPKeypair("https://aegis.cc/sso/tnt/x")
	signer, leaf, _ := LoadSPKeypair(keyPEM, certPEM)
	cfg := SAMLConfig{
		SSOURL:      "https://idp.example.com/sso",
		SPEntityID:  "https://aegis.cc/sso/tnt/x",
		ACSURL:      "https://aegis.cc/sso/tnt/acs",
		MetadataURL: "https://aegis.cc/sso/tnt/x",
	}
	p, err := NewSAMLProvider(cfg, signer, leaf)
	if err != nil {
		t.Fatalf("provider build: %v", err)
	}
	req, _ := http.NewRequest("POST", "/sso/tnt/acs",
		strings.NewReader("SAMLResponse=garbage-not-base64-signed-xml"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if _, err := p.ValidateResponse(req, []string{"any-id"}); err == nil {
		t.Fatal("expected error on garbage SAMLResponse")
	}
}

// TestNewSAMLProvider_ConfigValidation locks in the validation
// branches that gate every per-request build. A regression here
// would mean a misconfigured tenant could end up with a partially-
// initialized ServiceProvider — the kind of bug crewjam papers over
// silently and only fails at AuthnRequest sign time.
func TestNewSAMLProvider_ConfigValidation(t *testing.T) {
	keyPEM, certPEM, err := GenerateSPKeypair("https://aegis.cc/sso/tnt_x/metadata")
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	signer, leaf, err := LoadSPKeypair(keyPEM, certPEM)
	if err != nil {
		t.Fatalf("loadkp: %v", err)
	}

	tests := []struct {
		name    string
		cfg     SAMLConfig
		wantErr string
	}{
		{"missing SSO URL",
			SAMLConfig{SPEntityID: "ent", ACSURL: "https://x.cc/acs"},
			"SSOURL"},
		{"missing SP entity",
			SAMLConfig{SSOURL: "https://idp/sso", ACSURL: "https://x.cc/acs"},
			"SPEntityID"},
		{"missing ACS URL",
			SAMLConfig{SSOURL: "https://idp/sso", SPEntityID: "ent"},
			"ACSURL"},
		{"valid",
			SAMLConfig{
				SSOURL: "https://idp.example.com/sso",
				SPEntityID: "https://aegis.cc/sso/tnt_x/metadata",
				ACSURL: "https://aegis.cc/sso/tnt_x/acs",
				MetadataURL: "https://aegis.cc/sso/tnt_x/metadata",
			}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewSAMLProvider(tt.cfg, signer, leaf)
			if tt.wantErr == "" {
				if err != nil {
					t.Errorf("expected ok, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("error %q missing substring %q", err.Error(), tt.wantErr)
			}
		})
	}
}

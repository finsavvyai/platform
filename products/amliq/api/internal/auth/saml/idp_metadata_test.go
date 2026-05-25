package saml

import (
	"strings"
	"testing"
)

// TestBuildIdPMetadata_BadCert covers the error branch when the cert
// PEM block is malformed. crewjam will silently produce a non-trust-
// chained metadata otherwise — we want a hard error so a misconfigured
// row 500s at provider build, not at AuthnRequest validation.
func TestBuildIdPMetadata_BadCert(t *testing.T) {
	cfg := SAMLConfig{
		IdPEntityID: "https://idp.example.com",
		SSOURL:      "https://idp.example.com/sso",
		IdPCertPEM:  []byte("not a real PEM"),
	}
	_, err := buildIdPMetadata(cfg)
	if err == nil {
		t.Fatal("expected error on garbage cert PEM")
	}
	if !strings.Contains(err.Error(), "invalid IdP certificate PEM") {
		t.Errorf("wrong error: %v", err)
	}
}

// TestBuildIdPMetadata_NoCert is the documented "metadata-only-from-fields"
// path: when IdPCertPEM is empty, the descriptor should still build
// (signature verification is then skipped, which crewjam handles by
// rejecting unsigned assertions — the desired behaviour for dev /
// initial onboarding).
func TestBuildIdPMetadata_NoCert(t *testing.T) {
	cfg := SAMLConfig{
		IdPEntityID: "https://idp.example.com",
		SSOURL:      "https://idp.example.com/sso",
	}
	desc, err := buildIdPMetadata(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if desc.EntityID != cfg.IdPEntityID {
		t.Errorf("EntityID drift: %q", desc.EntityID)
	}
}

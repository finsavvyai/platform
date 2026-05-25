package sso

import (
	"crypto"
	"crypto/x509"
	"testing"
)

// validCfg returns a SAMLConfig with all required fields populated.
func validCfg(spEntityID, acsURL, ssoURL string) SAMLConfig {
	return SAMLConfig{
		IdPEntityID: "https://idp.example.com/saml",
		SSOURL:      ssoURL,
		SPEntityID:  spEntityID,
		ACSURL:      acsURL,
		MetadataURL: "https://sp.example.com/saml/metadata",
	}
}

func TestGenerateSPKeypair_Roundtrip(t *testing.T) {
	keyPEM, certPEM, err := GenerateSPKeypair("https://sp.example.com/saml/test")
	if err != nil {
		t.Fatalf("GenerateSPKeypair: %v", err)
	}
	if len(keyPEM) == 0 || len(certPEM) == 0 {
		t.Fatal("expected non-empty PEM blocks")
	}
	signer, leaf, err := LoadSPKeypair(keyPEM, certPEM)
	if err != nil {
		t.Fatalf("LoadSPKeypair: %v", err)
	}
	if signer == nil || leaf == nil {
		t.Fatal("expected non-nil signer and leaf cert")
	}
}

func TestLoadSPKeypair_InvalidKey(t *testing.T) {
	_, certPEM, _ := GenerateSPKeypair("x")
	_, _, err := LoadSPKeypair([]byte("not-a-key"), certPEM)
	if err == nil {
		t.Fatal("expected error for invalid PEM key")
	}
}

func TestNewSAMLProvider_MissingSSO(t *testing.T) {
	key, cert := mustGenKeypair(t)
	cfg := validCfg("https://sp.example.com", "https://sp.example.com/acs", "")
	_, err := NewSAMLProvider(cfg, key, cert)
	if err == nil {
		t.Fatal("expected error when SSOURL is empty")
	}
}

func TestNewSAMLProvider_MissingEntityID(t *testing.T) {
	key, cert := mustGenKeypair(t)
	cfg := validCfg("", "https://sp.example.com/acs", "https://idp.example.com/sso")
	_, err := NewSAMLProvider(cfg, key, cert)
	if err == nil {
		t.Fatal("expected error when SPEntityID is empty")
	}
}

func TestNewSAMLProvider_ValidConfig(t *testing.T) {
	key, cert := mustGenKeypair(t)
	cfg := validCfg(
		"https://sp.example.com/saml",
		"https://sp.example.com/saml/acs",
		"https://idp.example.com/saml/sso",
	)
	provider, err := NewSAMLProvider(cfg, key, cert)
	if err != nil {
		t.Fatalf("NewSAMLProvider: %v", err)
	}
	if provider == nil || provider.sp == nil {
		t.Fatal("expected non-nil SAMLProvider")
	}
}

func TestBuildIdPMetadata_WithCert(t *testing.T) {
	_, certPEM, _ := GenerateSPKeypair("test-idp")
	cfg := validCfg("sp", "https://sp/acs", "https://idp/sso")
	cfg.IdPCertPEM = certPEM
	meta, err := buildIdPMetadata(cfg)
	if err != nil {
		t.Fatalf("buildIdPMetadata: %v", err)
	}
	if len(meta.IDPSSODescriptors[0].KeyDescriptors) != 1 {
		t.Fatal("expected one KeyDescriptor for the IdP cert")
	}
}

func TestBuildIdPMetadata_InvalidCert(t *testing.T) {
	cfg := validCfg("sp", "https://sp/acs", "https://idp/sso")
	cfg.IdPCertPEM = []byte("not-pem")
	_, err := buildIdPMetadata(cfg)
	if err == nil {
		t.Fatal("expected error for invalid IdP cert PEM")
	}
}

func TestMakeAuthRequest_ValidConfig(t *testing.T) {
	key, cert := mustGenKeypair(t)
	cfg := validCfg(
		"https://sp.example.com/saml",
		"https://sp.example.com/saml/acs",
		"https://idp.example.com/saml/sso",
	)
	provider, err := NewSAMLProvider(cfg, key, cert)
	if err != nil {
		t.Fatalf("NewSAMLProvider: %v", err)
	}
	redirectURL, requestID, err := provider.MakeAuthRequest("relay-state-xyz")
	if err != nil {
		t.Fatalf("MakeAuthRequest: %v", err)
	}
	if redirectURL == "" {
		t.Fatal("expected non-empty redirect URL")
	}
	if requestID == "" {
		t.Fatal("expected non-empty request ID")
	}
}

// mustGenKeypair generates an RSA keypair for test use and returns
// (crypto.Signer, *x509.Certificate).
func mustGenKeypair(t *testing.T) (crypto.Signer, *x509.Certificate) {
	t.Helper()
	keyPEM, certPEM, err := GenerateSPKeypair("https://sp.test/saml")
	if err != nil {
		t.Fatalf("GenerateSPKeypair: %v", err)
	}
	signer, leaf, err := LoadSPKeypair(keyPEM, certPEM)
	if err != nil {
		t.Fatalf("LoadSPKeypair: %v", err)
	}
	return signer, leaf
}

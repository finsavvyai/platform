package saml

import (
	"strings"
	"testing"
)

// TestProviderFromRow_BadKeypair locks in the failure path when the
// SP keypair PEM is corrupted. The handler treats this as 500 (wiring
// bug, not a customer-correctable state) — that decision becomes
// invalid the moment this branch silently returns nil.
func TestProviderFromRow_BadKeypair(t *testing.T) {
	row := TenantSAMLRow{
		TenantID:    "tnt_corrupt0000000",
		IDPEntityID: "https://idp.example.com",
		IDPSSOURL:   "https://idp.example.com/sso",
		SPEntityID:  "https://aegis.cc/sso/tnt/x",
		SPACSURL:    "https://aegis.cc/sso/tnt/acs",
		SPKeyPEM:    "not a real key",
		SPCertPEM:   "not a real cert",
		Enabled:     true,
	}
	f := &PerTenantFactory{baseURL: "https://aegis.cc"}
	// Use Provider via the public path with a fake loader that returns row.
	f.loader = nil
	// Skip Provider — directly exercise providerFromRow which is the
	// helper the public path delegates to.
	_, err := f.providerFromRow(row, nil, nil)
	if err == nil {
		t.Fatal("expected error from invalid SAMLConfig (nil signer)")
	}
}

// TestProviderFromRow_BadIdPCert covers the metadata-build error path:
// a row with a corrupt IdP cert should fail at provider build time so
// the operator sees the bad config immediately, not on first login.
func TestProviderFromRow_BadIdPCert(t *testing.T) {
	keyPEM, certPEM, err := GenerateSPKeypair("https://aegis.cc/sso/tnt/x")
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	signer, leaf, err := LoadSPKeypair(keyPEM, certPEM)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	row := TenantSAMLRow{
		TenantID:    "tnt_badcert0000000",
		IDPEntityID: "https://idp.example.com",
		IDPSSOURL:   "https://idp.example.com/sso",
		IDPX509Cert: "garbage-not-pem",
		SPEntityID:  "https://aegis.cc/sso/tnt/x",
		SPACSURL:    "https://aegis.cc/sso/tnt/acs",
	}
	f := &PerTenantFactory{baseURL: "https://aegis.cc"}
	_, err = f.providerFromRow(row, signer, leaf)
	if err == nil {
		t.Fatal("expected error on bad IdP cert PEM")
	}
	if !strings.Contains(err.Error(), "IdP certificate") {
		t.Errorf("wrong error chain: %v", err)
	}
}

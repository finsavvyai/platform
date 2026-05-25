package saml

import (
	"strings"
	"testing"
)

// TestPerTenantFactory_MetadataURL locks in the per-tenant URL shape
// so a typo doesn't silently break SP↔IdP trust by serving metadata
// at the wrong path. The customer's IdP admin pastes this exact URL
// into their console; drift here = production outage.
func TestPerTenantFactory_MetadataURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		tenant  string
		want    string
	}{
		{"basic", "https://api.aegis.cc", "tnt_abc",
			"https://api.aegis.cc/sso/tnt_abc/metadata"},
		{"trailing slash on base — preserved by url.Parse semantics",
			"https://api.aegis.cc/", "tnt_xyz",
			"https://api.aegis.cc/sso/tnt_xyz/metadata"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &PerTenantFactory{baseURL: tt.baseURL}
			if got := f.metadataURL(tt.tenant); got != tt.want {
				t.Errorf("got %q want %q", got, tt.want)
			}
		})
	}
}

// TestProviderFromRow_HappyPath exercises the row→cfg→provider mapping
// without touching Postgres. Caught a class of bugs during dev where
// the SAMLConfig field names diverged from TenantSAMLRow column names
// (e.g. SPACSURL vs ACSURL).
func TestProviderFromRow_HappyPath(t *testing.T) {
	keyPEM, certPEM, err := GenerateSPKeypair("https://aegis.cc/sso/tnt_x/metadata")
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	signer, leaf, err := LoadSPKeypair(keyPEM, certPEM)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	row := TenantSAMLRow{
		TenantID:    "tnt_abc123def456",
		IDPEntityID: "https://idp.example.com/exk",
		IDPSSOURL:   "https://idp.example.com/sso",
		SPEntityID:  "https://aegis.cc/sso/tnt_abc123def456/metadata",
		SPACSURL:    "https://aegis.cc/sso/tnt_abc123def456/acs",
		Enabled:     true,
	}
	f := &PerTenantFactory{baseURL: "https://aegis.cc"}
	provider, err := f.providerFromRow(row, signer, leaf)
	if err != nil {
		t.Fatalf("providerFromRow: %v", err)
	}
	if provider == nil {
		t.Fatal("expected non-nil provider")
	}
	// Smoke: build an AuthnRequest. crewjam will succeed only if the
	// config round-trip preserved IdP SSO URL + SP keys correctly.
	url, _, err := provider.MakeAuthRequest("rs")
	if err != nil {
		t.Fatalf("MakeAuthRequest: %v", err)
	}
	if !strings.HasPrefix(url, "https://idp.example.com/sso") {
		t.Errorf("redirect URL drift: %q", url)
	}
}

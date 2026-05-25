package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/sdlc-cc/internal/tenant"
)

// TestPrecedence_KeyBeatsCIDR exercises the production middleware
// stacking: WithAPIKeys outermost, WithTenantResolver inner. A valid
// sk_sdlc_* key must attribute to the key's tenant, ignoring whatever
// CIDR rule would otherwise match.
func TestPrecedence_KeyBeatsCIDR(t *testing.T) {
	verifier := fakeVerifier{want: "sk_sdlc_winner", tenant: "tnt_from_key"}
	resolver := tenant.NewNetworkMap([]tenant.Row{
		{CIDR: "10.0.0.0/8", TenantID: "tnt_from_cidr"},
	})

	var seen string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	})

	// Same stacking as cmd/api/main.go for the transparent-proxy path:
	//   WithAPIKeys → WithTenantResolver → handler
	stack := WithAPIKeys(verifier, WithTenantResolver(resolver, inner))

	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer sk_sdlc_winner")
	req.RemoteAddr = "10.1.2.3:55555" // would match the CIDR rule
	stack.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "tnt_from_key" {
		t.Errorf("API key should win over CIDR; got %q", seen)
	}
}

// TestPrecedence_CIDRWhenNoKey exercises the transparent-proxy
// fallback: no sk_sdlc_* token, so the API-key gate passes through
// unchanged and the CIDR resolver attributes by source IP.
func TestPrecedence_CIDRWhenNoKey(t *testing.T) {
	verifier := fakeVerifier{want: "irrelevant", tenant: "irrelevant"}
	resolver := tenant.NewNetworkMap([]tenant.Row{
		{CIDR: "10.0.0.0/8", TenantID: "tnt_from_cidr"},
	})
	var seen string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	})
	stack := WithAPIKeys(verifier, WithTenantResolver(resolver, inner))

	req := httptest.NewRequest("POST", "/v1/messages", nil)
	// No Authorization at all — passes through API-key gate.
	req.RemoteAddr = "10.1.2.3:55555"
	stack.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "tnt_from_cidr" {
		t.Errorf("CIDR fallback should fire when no key; got %q", seen)
	}
}

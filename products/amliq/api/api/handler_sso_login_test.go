package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	authsaml "github.com/aegis-aml/aegis/internal/auth/saml"
)

// fakeSAMLAuth implements samlAuthenticator for handler tests.
type fakeSAMLAuth struct {
	redirectURL string
	requestID   string
	makeErr     error
	validateRet map[string]string
	validateErr error
}

func (f *fakeSAMLAuth) MakeAuthRequest(string) (string, string, error) {
	return f.redirectURL, f.requestID, f.makeErr
}
func (f *fakeSAMLAuth) ValidateResponse(*http.Request, []string) (map[string]string, error) {
	return f.validateRet, f.validateErr
}

// fakeSAMLFactory returns a pre-configured authenticator or err,
// plus optional role-mapping returned by RoleMapping.
type fakeSAMLFactory struct {
	auth     samlAuthenticator
	err      error
	roleAttr string
	roleMap  map[string]string
}

func (f *fakeSAMLFactory) Provider(context.Context, string) (samlAuthenticator, error) {
	return f.auth, f.err
}

func (f *fakeSAMLFactory) RoleMapping(context.Context, string) (string, map[string]string, error) {
	return f.roleAttr, f.roleMap, nil
}

func TestHandleSSOLogin(t *testing.T) {
	tests := []struct {
		name   string
		factory samlFactory
		tenant string
		expect int
	}{
		{"happy redirect", &fakeSAMLFactory{
			auth: &fakeSAMLAuth{
				redirectURL: "https://idp.example.com/sso?req=abc",
				requestID:   "id-123",
			}}, "tnt_abc123def456", http.StatusFound},
		{"not configured", &fakeSAMLFactory{
			err: authsaml.ErrTenantSAMLNotConfigured,
		}, "tnt_abc123def456", http.StatusNotFound},
		{"factory generic error", &fakeSAMLFactory{
			err: errors.New("db down"),
		}, "tnt_abc123def456", http.StatusInternalServerError},
		{"missing tenant", &fakeSAMLFactory{
			auth: &fakeSAMLAuth{redirectURL: "x"},
		}, "", http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/sso/"+tt.tenant+"/login", nil)
			req.SetPathValue("tenant", tt.tenant)
			rec := httptest.NewRecorder()
			handleSSOLogin(tt.factory)(rec, req)
			if rec.Code != tt.expect {
				t.Fatalf("status: want %d got %d body=%s",
					tt.expect, rec.Code, rec.Body.String())
			}
		})
	}
}

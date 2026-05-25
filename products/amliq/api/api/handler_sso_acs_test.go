package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExtractSSOAttrs(t *testing.T) {
	tests := []struct {
		name    string
		in      map[string]string
		wantErr bool
		wantEmail string
		wantRole  string
	}{
		{"plain email + role",
			map[string]string{"nameID": "u1", "email": "a@b.co", "role": "admin"},
			false, "a@b.co", "admin"},
		{"azure-style claim URIs",
			map[string]string{
				"nameID": "u1",
				"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "a@b.co",
				"http://schemas.microsoft.com/ws/2008/06/identity/claims/role":       "manager",
			}, false, "a@b.co", "manager"},
		{"missing email", map[string]string{"nameID": "u1"}, true, "", ""},
		{"role defaults to viewer",
			map[string]string{"nameID": "u1", "email": "a@b.co"},
			false, "a@b.co", "viewer"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := extractSSOAttrs(tt.in, "", nil)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr {
				if got.Email != tt.wantEmail {
					t.Errorf("email: got %q want %q", got.Email, tt.wantEmail)
				}
				if got.Role != tt.wantRole {
					t.Errorf("role: got %q want %q", got.Role, tt.wantRole)
				}
			}
		})
	}
}

func TestHandleSSOACS(t *testing.T) {
	tests := []struct {
		name    string
		factory samlFactory
		expect  int
	}{
		{"validate error", &fakeSAMLFactory{
			auth: &fakeSAMLAuth{validateErr: errors.New("bad signature")},
		}, http.StatusUnauthorized},
		{"missing email", &fakeSAMLFactory{
			auth: &fakeSAMLAuth{validateRet: map[string]string{"nameID": "u"}},
		}, http.StatusBadRequest},
		{"happy", &fakeSAMLFactory{
			auth: &fakeSAMLAuth{validateRet: map[string]string{
				"nameID": "u", "email": "a@b.co",
			}},
		}, http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/sso/tnt_abc/acs",
				strings.NewReader(""))
			req.SetPathValue("tenant", "tnt_abc")
			rec := httptest.NewRecorder()
			handleSSOACS(tt.factory)(rec, req)
			if rec.Code != tt.expect {
				t.Fatalf("status: want %d got %d body=%s",
					tt.expect, rec.Code, rec.Body.String())
			}
		})
	}
}

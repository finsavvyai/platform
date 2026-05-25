package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBAOzLvdcPu1Hvln1d
ldq2RSIekzu2q0JP91TzC6xCtb/fJowd8+uQaETkjajKtfi3sSRIDNcGufztsvz2
M2WvRkUYOYDjM35RbUh9vdKGNXrG208LJfNe0k7Ewt+zh17/QgQeaN47gLRr3hrY
vd1x448AIx16rgbzdvrGv/4EE60tAgMBAAECgYAY64QqCuTKxa0PunaX0tDJu3AB
O8MgMmw0C3PyB/86lxBmdIyEAOmIPolN9y9ZYnOI/vAi/Pk7zgQlLP/RtrVtQkHW
nwfc5HMi0+fMmq9KIfsKV3hrmxwc1WW4HcPElR+9vcxKMkrYN3VdYnk+5pqyrCEK
fQqfF0HJgvjIi3YvoQJBAPaijVogAAkWQ8gDcyQ1a/1WW0xsQ/lRLP/dPw42dNje
K3NcI7Rll4Vy9amK995Mw/D63Kx5lKeENd1ga+BiE+UCQQD1yYwOdXMPvArLrajS
D+nrXTlu0euLX/NtbWv1PAqrQkwL9mvRHeo5K08PGxcr0rpTWlbGqnm5hiJ09izD
H6+pAkEAlV9l1MvEubwuWRkdxzRDry96JBL+KCWt51kMM4NvyVjlX/zR8xQEbOJv
PrvX218K3QxSUnNgQQSlyun26/L6sQJAaRPbTqsjn8xyiRUbIYMwLDFUxm30V0eU
GGo5R0R+Ay16uXqGKYayhfJgAENCqreSdOQgSRrEo24W+Q3toRXA0QJASTrqID8A
3l0WGkQir7cH3cg5FEz034iu1x1JzRmQ2Z7Mv2ym2BLDsIeAHMFNl/So5E0pv3en
cV/ky8fsButCLg==
-----END RSA PRIVATE KEY-----`

func TestNewGitHubApp(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	if app.AppID != 12345 || app.ClientID != "client_id" {
		t.Errorf("unexpected AppID or ClientID")
	}
}

func TestGenerateJWT(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	token, err := app.GenerateJWT()
	if err != nil || token == "" {
		t.Fatalf("GenerateJWT failed: %v", err)
	}
}

func TestGenerateJWTInvalidKey(t *testing.T) {
	app := NewGitHubApp(12345, "invalid_key", "secret", "client_id", "client_secret")
	_, err := app.GenerateJWT()
	if err == nil {
		t.Error("expected error for invalid key")
	}
}

func TestHandleCallback_Success(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	req := httptest.NewRequest("GET", "/?installation_id=67890", nil)
	id, err := app.HandleCallback(req)
	if err != nil || id != 67890 {
		t.Fatalf("HandleCallback failed: %v, id: %d", err, id)
	}
}

func TestHandleCallback_MissingID(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	req := httptest.NewRequest("GET", "/", nil)
	_, err := app.HandleCallback(req)
	if err == nil {
		t.Error("expected error for missing installation_id")
	}
}

func TestHandleCallback_InvalidID(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	req := httptest.NewRequest("GET", "/?installation_id=not_a_number", nil)
	_, err := app.HandleCallback(req)
	if err == nil {
		t.Error("expected error for invalid installation_id")
	}
}

func TestGenerateInstallationToken_Success(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"token":      "ghu_test_token",
			"expires_at": time.Now().Add(1 * time.Hour),
		})
	}))
	defer server.Close()
	app.APIBaseURL = server.URL
	token, err := app.GenerateInstallationToken(67890, server.Client())
	if err != nil || token.Token != "ghu_test_token" {
		t.Fatalf("GenerateInstallationToken failed: %v", err)
	}
}

func TestGenerateInstallationToken_APIError(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"Bad credentials"}`))
	}))
	defer server.Close()
	app.APIBaseURL = server.URL
	_, err := app.GenerateInstallationToken(67890, server.Client())
	if err == nil {
		t.Error("expected error for API failure")
	}
}

func TestVerifyWebhookSignature_Valid(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "my_secret", "client_id", "client_secret")
	payload := []byte(`{"action":"created"}`)
	h := hmac.New(sha256.New, []byte("my_secret"))
	h.Write(payload)
	digest := h.Sum(nil)
	signature := "sha256=" + fmt.Sprintf("%x", digest)
	if !app.VerifyWebhookSignature(payload, signature) {
		t.Error("expected signature to be valid")
	}
}

func TestVerifyWebhookSignature_Invalid(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "my_secret", "client_id", "client_secret")
	payload := []byte(`{"action":"created"}`)
	if app.VerifyWebhookSignature(payload, "sha256=invalidsig") {
		t.Error("expected signature to be invalid")
	}
}

func TestVerifyWebhookSignature_Empty(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "", "client_id", "client_secret")
	payload := []byte(`{"action":"created"}`)
	if app.VerifyWebhookSignature(payload, "") {
		t.Error("expected empty signature to be invalid")
	}
}

func TestListInstallations_Success(t *testing.T) {
	app := NewGitHubApp(12345, testPrivateKey, "secret", "client_id", "client_secret")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode([]map[string]interface{}{
			{
				"id":       67890,
				"app_id":   12345,
				"account":  map[string]interface{}{"login": "test-user", "id": 123},
				"html_url": "https://github.com/settings/installations/67890",
			},
		})
	}))
	defer server.Close()
	app.APIBaseURL = server.URL
	installations, err := app.ListInstallations(server.Client())
	if err != nil || len(installations) != 1 || installations[0].ID != 67890 {
		t.Fatalf("ListInstallations failed: %v", err)
	}
}

func TestGenerateState(t *testing.T) {
	state1, err := GenerateState()
	if err != nil || state1 == "" {
		t.Fatalf("GenerateState failed: %v", err)
	}
	state2, _ := GenerateState()
	if state1 == state2 {
		t.Error("expected different states on each call")
	}
}

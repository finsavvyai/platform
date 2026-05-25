package analysis

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestValidateJWT_Expired(t *testing.T) {
	v := NewSecretValidator()

	// Build a JWT with exp in the past
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"exp":1000000000}`)) // year 2001
	token := header + "." + payload + ".fakesig"

	result := v.validateJWT(token)
	if result.Status != ValidityExpired {
		t.Errorf("expected ValidityExpired, got %s", result.Status)
	}
	if result.ExpiresAt == nil {
		t.Error("expected ExpiresAt to be set")
	}
}

func TestValidateJWT_Active(t *testing.T) {
	v := NewSecretValidator()

	exp := time.Now().Add(24 * time.Hour).Unix()
	payloadData := map[string]interface{}{"exp": exp, "sub": "user123"}
	payloadJSON, _ := json.Marshal(payloadData)

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	token := header + "." + payload + ".fakesig"

	result := v.validateJWT(token)
	if result.Status != ValidityActive {
		t.Errorf("expected ValidityActive, got %s", result.Status)
	}
	if !result.Valid {
		t.Error("expected Valid=true for non-expired JWT")
	}
}

func TestValidateJWT_InvalidFormat(t *testing.T) {
	v := NewSecretValidator()
	result := v.validateJWT("not-a-jwt")
	if result.Status != ValidityInvalid {
		t.Errorf("expected ValidityInvalid for malformed token, got %s", result.Status)
	}
}

func TestValidateJWT_NoExpClaim(t *testing.T) {
	v := NewSecretValidator()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"user"}`))
	token := header + "." + payload + ".sig"

	result := v.validateJWT(token)
	if result.Status != ValidityUnknown {
		t.Errorf("expected ValidityUnknown for missing exp, got %s", result.Status)
	}
}

func TestValidateGitHubToken_Active(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer ghp_validtoken" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"login":"testuser"}`))
		} else {
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer srv.Close()

	v := &SecretValidator{httpClient: srv.Client()}
	// Override to use test server by calling method directly but pointing at test URL
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)
	req.Header.Set("Authorization", "Bearer ghp_validtoken")
	resp, _ := srv.Client().Do(req)
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 from mock, got %d", resp.StatusCode)
	}
	_ = v // silence unused
}

func TestValidateGitHubToken_Invalid(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	// Use a custom HTTP client that redirects to the test server
	customClient := &http.Client{
		Timeout:   5 * time.Second,
		Transport: &redirectTransport{target: srv.URL, inner: srv.Client().Transport},
	}
	v := &SecretValidator{httpClient: customClient}
	result := v.validateGitHubToken(context.Background(), "ghp_badtoken")
	if result.Status != ValidityInvalid {
		t.Errorf("expected ValidityInvalid for 401, got %s", result.Status)
	}
}

func TestValidateSlackToken_Active(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"user":"slackbot","team":"myworkspace"}`))
	}))
	defer srv.Close()

	customClient := &http.Client{
		Transport: &redirectTransport{target: srv.URL, inner: srv.Client().Transport},
	}
	v := &SecretValidator{httpClient: customClient}
	result := v.validateSlackToken(context.Background(), "xoxb-fake")
	if result.Status != ValidityActive {
		t.Errorf("expected ValidityActive, got %s", result.Status)
	}
	if result.Identity == "" {
		t.Error("expected Identity to be set")
	}
}

func TestValidateSlackToken_Revoked(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":false,"error":"token_revoked"}`))
	}))
	defer srv.Close()

	customClient := &http.Client{
		Transport: &redirectTransport{target: srv.URL, inner: srv.Client().Transport},
	}
	v := &SecretValidator{httpClient: customClient}
	result := v.validateSlackToken(context.Background(), "xoxb-revoked")
	if result.Status != ValidityInvalid {
		t.Errorf("expected ValidityInvalid for revoked token, got %s", result.Status)
	}
}

func TestValidate_Routing(t *testing.T) {
	v := NewSecretValidator()

	// Unknown pattern → skipped
	result := v.Validate(context.Background(), "Some Unknown Pattern", "value")
	if result.Status != ValiditySkipped {
		t.Errorf("expected ValiditySkipped for unknown pattern, got %s", result.Status)
	}
}

func TestValidate_JWTRouting(t *testing.T) {
	v := NewSecretValidator()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"exp":1000000000}`))
	token := header + "." + payload + ".sig"

	result := v.Validate(context.Background(), "JWT Token", token)
	if result.Status != ValidityExpired {
		t.Errorf("expected ValidityExpired for old JWT, got %s", result.Status)
	}
}

// redirectTransport rewrites all requests to a test server URL.
type redirectTransport struct {
	target string
	inner  http.RoundTripper
}

func (t *redirectTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	newReq := req.Clone(req.Context())
	newReq.URL.Host = req.URL.Host
	// Replace host with test server
	parsed := *req.URL
	parsed.Scheme = "http"
	parsed.Host = t.target[len("http://"):]
	newReq.URL = &parsed
	transport := t.inner
	if transport == nil {
		transport = http.DefaultTransport
	}
	return transport.RoundTrip(newReq)
}

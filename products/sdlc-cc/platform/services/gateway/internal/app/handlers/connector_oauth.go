// Package handlers — Shared OAuth start/callback for every connector.
//
// Routes:
//   GET /v1/connectors/{name}/oauth/start?tenant_id=...
//   GET /v1/connectors/{name}/oauth/callback?code=...&state=...
//
// State token is HMAC(server-secret, tenant|connector|nonce|expiry).
// Secret comes from CONNECTOR_OAUTH_SECRET. The handler is registry-
// driven: any connector registered in the connectors.Registry gains
// these routes for free.
package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

// ConnectorOAuthDeps wires the handler.
type ConnectorOAuthDeps struct {
	Registry     *connectors.Registry
	Secret       []byte
	AuthorizeURL func(connector string) (string, error) // returns vendor authorize URL template (without state)
	AdminUIURL   string                                 // redirected here after success
	Now          func() time.Time
	StateTTL     time.Duration
}

// MountConnectorOAuth registers /v1/connectors/{name}/oauth/* on r.
func MountConnectorOAuth(r chi.Router, deps ConnectorOAuthDeps) {
	if deps.Now == nil {
		deps.Now = time.Now
	}
	if deps.StateTTL == 0 {
		deps.StateTTL = 10 * time.Minute
	}
	r.Route("/v1/connectors/{name}/oauth", func(r chi.Router) {
		r.Get("/start", oauthStart(deps))
		r.Get("/callback", oauthCallback(deps))
	})
}

// signState packs tenant|connector|nonce|expiry and HMACs it. The signed
// blob is returned base64url-encoded (one token).
func signState(secret []byte, tenant uuid.UUID, connector, nonce string, expiry time.Time) string {
	payload := strings.Join([]string{tenant.String(), connector, nonce, strconv.FormatInt(expiry.Unix(), 10)}, "|")
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(payload+"|"+sig))
}

// verifyState returns (tenant, connector, error). It checks signature
// + expiry. The connector name from the URL is matched against the
// signed connector name to defend against state-swap attacks.
func verifyState(secret []byte, expectedConnector, token string, now time.Time) (uuid.UUID, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("state: decode: %w", err)
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 5 {
		return uuid.Nil, "", errors.New("state: malformed")
	}
	tenant, err := uuid.Parse(parts[0])
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("state: tenant: %w", err)
	}
	connectorName, exp, sig := parts[1], parts[3], parts[4]
	expUnix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("state: expiry: %w", err)
	}
	if now.Unix() > expUnix {
		return uuid.Nil, "", errors.New("state: expired")
	}
	if connectorName != expectedConnector {
		return uuid.Nil, "", errors.New("state: connector mismatch")
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(strings.Join(parts[:4], "|")))
	want := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(want)) {
		return uuid.Nil, "", errors.New("state: bad signature")
	}
	return tenant, connectorName, nil
}

func newNonce() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func oauthStart(deps ConnectorOAuthDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := chi.URLParam(r, "name")
		if _, ok := deps.Registry.Get(name); !ok {
			http.Error(w, "unknown connector", http.StatusNotFound)
			return
		}
		tenantStr := r.URL.Query().Get("tenant_id")
		tenant, err := uuid.Parse(tenantStr)
		if err != nil {
			http.Error(w, "invalid tenant_id", http.StatusBadRequest)
			return
		}
		expiry := deps.Now().Add(deps.StateTTL)
		state := signState(deps.Secret, tenant, name, newNonce(), expiry)
		authURL, err := deps.AuthorizeURL(name)
		if err != nil {
			http.Error(w, "authorize url unavailable", http.StatusInternalServerError)
			return
		}
		sep := "?"
		if strings.Contains(authURL, "?") {
			sep = "&"
		}
		http.Redirect(w, r, authURL+sep+"state="+state, http.StatusFound)
	}
}

func oauthCallback(deps ConnectorOAuthDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := chi.URLParam(r, "name")
		c, ok := deps.Registry.Get(name)
		if !ok {
			http.Error(w, "unknown connector", http.StatusNotFound)
			return
		}
		code := r.URL.Query().Get("code")
		state := r.URL.Query().Get("state")
		if code == "" || state == "" {
			http.Error(w, "missing code or state", http.StatusBadRequest)
			return
		}
		tenant, _, err := verifyState(deps.Secret, name, state, deps.Now())
		if err != nil {
			http.Error(w, "invalid state: "+err.Error(), http.StatusBadRequest)
			return
		}
		if err := c.Authenticate(r.Context(), tenant, code); err != nil {
			http.Error(w, "authenticate: "+err.Error(), http.StatusBadGateway)
			return
		}
		dest := deps.AdminUIURL
		if dest == "" {
			dest = "/admin/connectors"
		}
		http.Redirect(w, r, dest+"?connected="+name, http.StatusFound)
	}
}

package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/storage"
)

type OAuthHandler struct {
	users    storage.UserRepository
	tenants  storage.TenantRepository
	oauthCfg config.OAuthConfig
	secret   string
	expiry   int
}

func NewOAuthHandler(
	users storage.UserRepository,
	tenants storage.TenantRepository,
	oauthCfg config.OAuthConfig,
	secret string, expiry int,
) *OAuthHandler {
	return &OAuthHandler{
		users: users, tenants: tenants,
		oauthCfg: oauthCfg, secret: secret, expiry: expiry,
	}
}

func (h *OAuthHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	p, ok := h.oauthCfg.Providers[provider]
	if !ok {
		Error(w, "UNKNOWN_PROVIDER",
			fmt.Sprintf("provider %s not configured", provider),
			http.StatusBadRequest)
		return
	}

	state := generateSignedState(h.secret)
	callbackURL := fmt.Sprintf("%s/auth/oauth/%s/callback",
		strings.TrimRight(h.oauthCfg.APIURL, "/"), provider)

	params := url.Values{
		"client_id":     {p.ClientID},
		"redirect_uri":  {callbackURL},
		"response_type": {"code"},
		"scope":         {strings.Join(p.Scopes, " ")},
		"state":         {state},
	}

	http.Redirect(w, r, p.AuthURL+"?"+params.Encode(),
		http.StatusTemporaryRedirect)
}

func generateSignedState(secret string) string {
	b := make([]byte, 16)
	rand.Read(b)
	nonce := hex.EncodeToString(b)
	ts := fmt.Sprintf("%d", time.Now().Unix())
	data := nonce + "." + ts
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(data))
	sig := hex.EncodeToString(mac.Sum(nil))
	return data + "." + sig
}

func verifyState(state, secret string) bool {
	parts := strings.SplitN(state, ".", 3)
	if len(parts) != 3 {
		return false
	}
	data := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(data))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(parts[2]), []byte(expected))
}

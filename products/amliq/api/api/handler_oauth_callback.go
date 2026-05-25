package api

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
)

func (h *OAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	state := r.URL.Query().Get("state")
	if !verifyState(state, h.secret) {
		h.redirectWithError(w, r, "invalid oauth state")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		h.redirectWithError(w, r, "missing authorization code")
		return
	}

	p, ok := h.oauthCfg.Providers[provider]
	if !ok {
		h.redirectWithError(w, r, "unknown provider")
		return
	}

	token, err := exchangeCode(p, code, h.oauthCfg.APIURL, r)
	if err != nil {
		log.Printf("oauth: token exchange failed for %s: %v (api_url=%s)", provider, err, h.oauthCfg.APIURL)
		h.redirectWithError(w, r, "token exchange failed")
		return
	}

	userInfo, err := fetchUserInfo(p, token, provider)
	if err != nil {
		log.Printf("oauth: user info failed for %s: %v (userinfo_url=%s)", provider, err, p.UserInfoURL)
		h.redirectWithError(w, r, "failed to fetch user info")
		return
	}

	user, err := h.findOrCreateUser(r, provider, userInfo)
	if err != nil {
		h.redirectWithError(w, r, err.Error())
		return
	}

	jwt, err := SignJWT(user.TenantID, user.ID, user.Role, h.secret, h.expiry)
	if err != nil {
		h.redirectWithError(w, r, "token generation failed")
		return
	}

	redirect := fmt.Sprintf("%s/login?token=%s", h.oauthCfg.FrontendURL, jwt)
	http.Redirect(w, r, redirect, http.StatusTemporaryRedirect)
}

func (h *OAuthHandler) redirectWithError(w http.ResponseWriter, r *http.Request, msg string) {
	redirect := fmt.Sprintf("%s/login?error=%s", h.oauthCfg.FrontendURL, url.QueryEscape(msg))
	http.Redirect(w, r, redirect, http.StatusTemporaryRedirect)
}

type oauthUserInfo struct {
	ID    string
	Email string
	Name  string
}

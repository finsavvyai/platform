package handlers

import (
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// AuthGitHubStart redirects the user to GitHub's OAuth authorize page.
// State is signed in a one-shot cookie (HMAC over random nonce + next-url)
// so we can verify the callback wasn't tampered with — no DB round-trip
// needed for the state check.
//
// Reuses the GitHub App's ClientID/ClientSecret if configured; the Web
// OAuth flow works with App credentials too. Falls back to standalone
// PIPEWARDEN_GITHUB_CLIENT_ID env if no App is configured.
func (h *Handlers) AuthGitHubStart(w http.ResponseWriter, r *http.Request) {
	clientID := h.githubClientID()
	if clientID == "" {
		jsonError(w, "GitHub OAuth not configured (set PIPEWARDEN_GITHUB_CLIENT_ID or auth.githubApp.clientId)", http.StatusServiceUnavailable)
		return
	}
	state, err := auth.GenerateState()
	if err != nil {
		jsonError(w, "state generation failed", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "pipewarden_gh_state",
		Value:    state,
		Path:     "/",
		Expires:  time.Now().Add(10 * time.Minute),
		HttpOnly: true,
		Secure:   isHTTPSReq(r),
		SameSite: http.SameSiteLaxMode,
	})
	q := url.Values{}
	q.Set("client_id", clientID)
	q.Set("redirect_uri", h.githubRedirectURI(r))
	q.Set("scope", "read:user user:email")
	q.Set("state", state)
	http.Redirect(w, r, "https://github.com/login/oauth/authorize?"+q.Encode(), http.StatusFound)
}

// AuthGitHubCallback handles GitHub's redirect after the user approves.
// Exchanges code → access token → user identity, finds-or-creates the
// local user, issues a session cookie, redirects to /dashboard or
// /onboarding.
func (h *Handlers) AuthGitHubCallback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	code := q.Get("code")
	state := q.Get("state")

	cookie, err := r.Cookie("pipewarden_gh_state")
	if err != nil || cookie.Value == "" || cookie.Value != state {
		jsonError(w, "OAuth state mismatch — please try again", http.StatusBadRequest)
		return
	}
	// One-shot — clear immediately.
	http.SetCookie(w, &http.Cookie{Name: "pipewarden_gh_state", Value: "", Path: "/", MaxAge: -1, HttpOnly: true})

	if code == "" {
		jsonError(w, "missing code parameter", http.StatusBadRequest)
		return
	}

	token, err := h.exchangeGitHubCode(r.Context(), code, h.githubRedirectURI(r))
	if err != nil {
		jsonError(w, "token exchange failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	id, email, name, err := h.fetchGitHubUser(r.Context(), token)
	if err != nil {
		jsonError(w, "user fetch failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	// Find by github_id; fall back to email; otherwise auto-provision.
	user, err := h.db.GetUserByGitHubID(id)
	if errors.Is(err, storage.ErrUserNotFound) {
		// First-time GitHub login. If the email already has a local
		// account, refuse — operator must link via account settings to
		// avoid silent account-takeover via email-collision.
		if existing, e2 := h.db.GetUserByEmail(email); e2 == nil && existing != nil {
			jsonError(w, "an account with this email already exists; sign in with password and link GitHub from settings", http.StatusConflict)
			return
		}
		user, err = h.db.CreateUserFromGitHub(id, email, name)
	}
	if err != nil {
		jsonError(w, "user provisioning failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sessionTok, err := auth.IssueSession(user.ID, user.Email, user.Onboarded, user.PasswordVersion)
	if err != nil {
		jsonError(w, "session issue failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	auth.IssueSessionCookie(w, r, sessionTok)
	next := "/dashboard"
	if !user.Onboarded {
		next = "/onboarding"
	}
	http.Redirect(w, r, next, http.StatusFound)
}

// HTTP token exchange + user-fetch helpers live in auth_github_api.go to
// keep this file under the 200-line cap.

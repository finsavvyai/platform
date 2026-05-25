package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/auth"
)

// AuthPasskeyLoginBegin starts a passkey login ceremony. Body: {email}.
// Returns CredentialRequestOptions for navigator.credentials.get.
//
// Email-less ("discoverable credential") flow is also supported: an
// empty email yields options without an allowed-credentials list, and
// the browser prompts the user to pick any registered passkey.
func (h *Handlers) AuthPasskeyLoginBegin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer func() { _ = r.Body.Close() }()
	var req struct {
		Email string `json:"email"`
	}
	_ = json.Unmarshal(body, &req)

	wa, err := h.webAuthn()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Discoverable-credential flow: no email, browser picks the credential.
	if req.Email == "" {
		options, sessionData, err := wa.BeginDiscoverableLogin()
		if err != nil {
			jsonError(w, "begin discoverable login: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if err := h.stashChallenge(w, 0, sessionData, purposeLogin); err != nil {
			jsonError(w, "stash challenge: "+err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, options)
		return
	}

	// Allowed-credentials flow: pre-resolve the user.
	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		jsonError(w, "no account found for that email", http.StatusNotFound)
		return
	}
	creds, _ := h.db.ListPasskeysForUser(user.ID)
	if len(creds) == 0 {
		jsonError(w, "no passkey registered for that account", http.StatusNotFound)
		return
	}
	pUser := &auth.PasskeyUser{
		UserID:      user.ID,
		UserName:    user.Email,
		DisplayName: user.Name,
		Credentials: passkeyRecordsToCredentials(creds),
	}
	options, sessionData, err := wa.BeginLogin(pUser)
	if err != nil {
		jsonError(w, "begin login: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.stashChallenge(w, user.ID, sessionData, purposeLogin); err != nil {
		jsonError(w, "stash challenge: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, options)
}

// AuthPasskeyLoginFinish completes the assertion. Verifies the signature,
// updates sign_count, issues the session cookie. Discoverable-credential
// flow infers user-id from the credential.
func (h *Handlers) AuthPasskeyLoginFinish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wa, err := h.webAuthn()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	sessionData, err := h.popChallenge(r, 0, purposeLogin) // 0 = don't enforce uid match here
	if err != nil {
		jsonError(w, "challenge: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Discoverable: server didn't know which user we were authenticating
	// when the ceremony started, so we resolve via a callback that maps
	// (rawID, userHandle) → matching credential.
	if len(sessionData.AllowedCredentialIDs) == 0 {
		cred, err := wa.FinishDiscoverableLogin(h.discoverableLookup, *sessionData, r)
		if err != nil {
			jsonError(w, "finish login: "+err.Error(), http.StatusUnauthorized)
			return
		}
		stored, err := h.db.GetPasskeyByCredentialID(cred.ID)
		if err != nil {
			jsonError(w, "credential not found", http.StatusUnauthorized)
			return
		}
		_ = h.db.UpdatePasskeySignCount(stored.ID, cred.Authenticator.SignCount)
		h.issueSessionForUserID(w, r, stored.UserID)
		return
	}

	// Allowed-credentials flow.
	stored, err := h.db.GetPasskeyByCredentialID(sessionData.AllowedCredentialIDs[0])
	if err != nil {
		jsonError(w, "credential not found", http.StatusUnauthorized)
		return
	}
	user, err := h.db.GetUserByID(stored.UserID)
	if err != nil {
		jsonError(w, "user not found", http.StatusUnauthorized)
		return
	}
	creds, _ := h.db.ListPasskeysForUser(user.ID)
	pUser := &auth.PasskeyUser{
		UserID:      user.ID,
		UserName:    user.Email,
		DisplayName: user.Name,
		Credentials: passkeyRecordsToCredentials(creds),
	}
	cred, err := wa.FinishLogin(pUser, *sessionData, r)
	if err != nil {
		jsonError(w, "finish login: "+err.Error(), http.StatusUnauthorized)
		return
	}
	_ = h.db.UpdatePasskeySignCount(stored.ID, cred.Authenticator.SignCount)
	h.issueSessionForUserID(w, r, user.ID)
}

// discoverableLookup is the callback the WebAuthn library calls during
// the discoverable-credential ceremony. Given the credential's rawID
// + userHandle (the WebAuthnID we wrote during registration), we return
// the matching webauthn.User for signature verification.
func (h *Handlers) discoverableLookup(rawID, userHandle []byte) (webauthnUser, error) {
	stored, err := h.db.GetPasskeyByCredentialID(rawID)
	if err != nil {
		return nil, err
	}
	user, err := h.db.GetUserByID(stored.UserID)
	if err != nil {
		return nil, err
	}
	creds, _ := h.db.ListPasskeysForUser(user.ID)
	return &auth.PasskeyUser{
		UserID:      user.ID,
		UserName:    user.Email,
		DisplayName: user.Name,
		Credentials: passkeyRecordsToCredentials(creds),
	}, nil
}

// issueSessionForUserID creates a session cookie for a user just verified
// by passkey or GitHub OAuth. Shared between passkey login and the
// GitHub callback so cookie issuance is consistent.
func (h *Handlers) issueSessionForUserID(w http.ResponseWriter, r *http.Request, userID int64) {
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		jsonError(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	token, err := auth.IssueSession(user.ID, user.Email, user.Onboarded, user.PasswordVersion)
	if err != nil {
		jsonError(w, "session issue failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	auth.IssueSessionCookie(w, r, token)
	next := "/dashboard"
	if !user.Onboarded {
		next = "/onboarding"
	}
	jsonOK(w, map[string]any{"user": user, "next": next})
}

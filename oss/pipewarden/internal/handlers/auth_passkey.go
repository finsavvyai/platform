package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/go-webauthn/webauthn/webauthn"
)

const (
	passkeyChallengeCookie = "pipewarden_passkey_chal"
	purposeRegister        = "register"
	purposeLogin           = "login"
)

// AuthPasskeyRegisterBegin starts a registration ceremony. Requires an
// authenticated session (you can only add a passkey to your own account).
// Returns the publicKey CredentialCreationOptions object the browser
// passes to navigator.credentials.create.
func (h *Handlers) AuthPasskeyRegisterBegin(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	user, err := h.db.GetUserByID(claims.UserID)
	if err != nil {
		jsonError(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	wa, err := h.webAuthn()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	creds, _ := h.db.ListPasskeysForUser(user.ID)
	pUser := &auth.PasskeyUser{
		UserID:      user.ID,
		UserName:    user.Email,
		DisplayName: user.Name,
		Credentials: passkeyRecordsToCredentials(creds),
	}

	options, sessionData, err := wa.BeginRegistration(pUser)
	if err != nil {
		jsonError(w, "begin registration: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := h.stashChallenge(w, user.ID, sessionData, purposeRegister); err != nil {
		jsonError(w, "stash challenge: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, options)
}

// AuthPasskeyRegisterFinish completes the registration ceremony.
// Body: the AuthenticatorAttestationResponse the browser produced.
func (h *Handlers) AuthPasskeyRegisterFinish(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	user, err := h.db.GetUserByID(claims.UserID)
	if err != nil {
		jsonError(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	wa, err := h.webAuthn()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	sessionData, err := h.popChallenge(r, user.ID, purposeRegister)
	if err != nil {
		jsonError(w, "challenge: "+err.Error(), http.StatusBadRequest)
		return
	}

	creds, _ := h.db.ListPasskeysForUser(user.ID)
	pUser := &auth.PasskeyUser{
		UserID:      user.ID,
		UserName:    user.Email,
		DisplayName: user.Name,
		Credentials: passkeyRecordsToCredentials(creds),
	}
	cred, err := wa.FinishRegistration(pUser, *sessionData, r)
	if err != nil {
		jsonError(w, "finish registration: "+err.Error(), http.StatusBadRequest)
		return
	}

	rec := storage.PasskeyRecord{
		UserID:       user.ID,
		CredentialID: cred.ID,
		PublicKey:    cred.PublicKey,
		SignCount:    cred.Authenticator.SignCount,
		Transports:   transportsToString(cred.Transport),
		Name:         strings.TrimSpace(r.URL.Query().Get("name")),
	}
	if rec.Name == "" {
		rec.Name = "Passkey " + time.Now().UTC().Format("2006-01-02")
	}
	saved, err := h.db.CreatePasskey(rec)
	if err != nil {
		jsonError(w, "save passkey: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"passkey": saved})
}

// stashChallenge saves the WebAuthn ceremony state and writes a one-shot
// session-id cookie the browser returns on the finish request.
func (h *Handlers) stashChallenge(w http.ResponseWriter, userID int64, sessionData *webauthn.SessionData, purpose string) error {
	id, err := randomHex()
	if err != nil {
		return err
	}
	encoded, err := json.Marshal(sessionData)
	if err != nil {
		return err
	}
	if err := h.db.SaveChallenge(id, userID, string(encoded), purpose); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     passkeyChallengeCookie,
		Value:    id,
		Path:     "/",
		Expires:  time.Now().Add(5 * time.Minute),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// popChallenge reads the stashed ceremony state from the one-shot cookie
// and ensures the purpose + user-id match what we expect (login vs register).
func (h *Handlers) popChallenge(r *http.Request, expectedUserID int64, expectedPurpose string) (*webauthn.SessionData, error) {
	c, err := r.Cookie(passkeyChallengeCookie)
	if err != nil {
		return nil, errors.New("missing challenge cookie")
	}
	uid, encoded, purpose, err := h.db.LoadChallenge(c.Value)
	if err != nil {
		return nil, err
	}
	if purpose != expectedPurpose {
		return nil, errors.New("challenge purpose mismatch")
	}
	if expectedPurpose == purposeRegister && uid != expectedUserID {
		return nil, errors.New("challenge user mismatch")
	}
	var sd webauthn.SessionData
	if err := json.Unmarshal([]byte(encoded), &sd); err != nil {
		return nil, err
	}
	return &sd, nil
}

func (h *Handlers) webAuthn() (*webauthn.WebAuthn, error) {
	return auth.NewWebAuthn(auth.LoadWebAuthnConfig())
}

func randomHex() (string, error) {
	b := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

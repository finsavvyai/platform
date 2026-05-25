package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func seedPasskey(userID int64, credID string) storage.PasskeyRecord {
	return storage.PasskeyRecord{
		UserID:       userID,
		CredentialID: []byte(credID),
		PublicKey:    []byte("fake-public-key-bytes"),
		SignCount:    0,
		Transports:   "internal",
		Name:         "test",
	}
}

// TestAuthPasskeyRegisterBeginAuthed exercises the full begin path that
// previously only hit the unauth branch. WebAuthn BeginRegistration is
// pure crypto setup — no browser needed; it returns CredentialCreationOptions
// the client would later pass to navigator.credentials.create.
func TestAuthPasskeyRegisterBeginAuthed(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")

	u, _ := db.CreateUser("pk-begin@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "PK", "")

	req := makeAuthedRequest(t, "POST", "/api/v1/auth/passkey/register/begin", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthPasskeyRegisterBegin(w, req)

	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	// Response should include CredentialCreationOptions with a challenge.
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response not JSON: %v\nbody=%s", err, w.Body.String())
	}
	pub, ok := resp["publicKey"].(map[string]any)
	if !ok {
		t.Fatalf("missing publicKey in CredentialCreationOptions: %s", w.Body.String())
	}
	if _, ok := pub["challenge"]; !ok {
		t.Fatalf("missing challenge in publicKey: %v", pub)
	}
	// Challenge cookie must be set.
	cookies := w.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == passkeyChallengeCookie && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Fatalf("challenge cookie not set; cookies: %v", cookies)
	}
}

// TestAuthPasskeyLoginBeginEmptyEmailReturnsDiscoverable hits the discoverable
// branch (empty email → BeginDiscoverableLogin), proving the cookie + options
// emerge end-to-end.
func TestAuthPasskeyLoginBeginEmptyEmailDiscoverable(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")

	w, _ := doJSON(t, h.AuthPasskeyLoginBegin, "POST", `{"email":""}`, nil)
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "challenge") {
		t.Fatalf("missing challenge: %s", w.Body.String())
	}
}

// TestAuthPasskeyLoginBeginWithPasskey exercises the allowed-credentials
// flow where the user has a registered passkey on file.
func TestAuthPasskeyLoginBeginWithPasskey(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")

	u, _ := db.CreateUser("pk-login@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "P", "")
	if _, err := db.CreatePasskey(seedPasskey(u.ID, "cred-login")); err != nil {
		t.Fatalf("seed passkey: %v", err)
	}

	body := `{"email":"pk-login@pipewarden.io"}`
	w, _ := doJSON(t, h.AuthPasskeyLoginBegin, "POST", body, nil)
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "challenge") {
		t.Fatalf("missing challenge: %s", w.Body.String())
	}
	// allowCredentials list should reference the seeded passkey.
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	pub, _ := resp["publicKey"].(map[string]any)
	allow, _ := pub["allowCredentials"].([]any)
	if len(allow) == 0 {
		t.Fatalf("expected allowCredentials populated; got: %v", pub)
	}
}

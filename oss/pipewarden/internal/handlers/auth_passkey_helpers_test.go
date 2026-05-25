package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-webauthn/webauthn/webauthn"
)

func TestStashAndPopChallengeRoundtrip(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("ch@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "C", "")

	w := httptest.NewRecorder()
	sd := &webauthn.SessionData{Challenge: "abc123", UserID: []byte{1, 2, 3}, AllowedCredentialIDs: [][]byte{{4}}}
	if err := h.stashChallenge(w, u.ID, sd, purposeRegister); err != nil {
		t.Fatalf("stash: %v", err)
	}
	cookies := w.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("no challenge cookie")
	}

	req := httptest.NewRequest("POST", "/", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	got, err := h.popChallenge(req, u.ID, purposeRegister)
	if err != nil {
		t.Fatalf("pop: %v", err)
	}
	if string(got.Challenge) != "abc123" {
		t.Fatalf("challenge mismatch: %s", got.Challenge)
	}
}

func TestPopChallengePurposeMismatch(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("ch2@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "C", "")

	w := httptest.NewRecorder()
	sd := &webauthn.SessionData{Challenge: "abc", UserID: []byte{1}}
	_ = h.stashChallenge(w, u.ID, sd, purposeRegister)
	cookies := w.Result().Cookies()

	req := httptest.NewRequest("POST", "/", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	if _, err := h.popChallenge(req, u.ID, purposeLogin); err == nil {
		t.Fatal("purpose mismatch should error")
	}
}

func TestPopChallengeUserMismatch(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("ch3@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "C", "")

	w := httptest.NewRecorder()
	sd := &webauthn.SessionData{Challenge: "abc"}
	_ = h.stashChallenge(w, u.ID, sd, purposeRegister)
	cookies := w.Result().Cookies()

	req := httptest.NewRequest("POST", "/", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	if _, err := h.popChallenge(req, u.ID+999, purposeRegister); err == nil {
		t.Fatal("user mismatch should error")
	}
}

// TestPopChallengeBadJSON exercises the json.Unmarshal error path by writing
// a session row with invalid JSON directly.
func TestPopChallengeBadJSON(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("ch4@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "C", "")

	if err := db.SaveChallenge("bad-session", u.ID, "{not-json", purposeLogin); err != nil {
		t.Fatalf("SaveChallenge: %v", err)
	}
	req := httptest.NewRequest("POST", "/", nil)
	req.AddCookie(&http.Cookie{Name: passkeyChallengeCookie, Value: "bad-session"})
	if _, err := h.popChallenge(req, 0, purposeLogin); err == nil {
		t.Fatal("bad JSON should error")
	}
}

func TestRandomHex(t *testing.T) {
	a, err := randomHex()
	if err != nil {
		t.Fatalf("randomHex: %v", err)
	}
	if len(a) != 32 {
		t.Fatalf("len=%d, want 32", len(a))
	}
	b, _ := randomHex()
	if a == b {
		t.Fatal("randomHex collision should be vanishingly rare")
	}
}

func TestWebAuthnConstructionWithDefaults(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RPID", "")
	t.Setenv("PIPEWARDEN_WEBAUTHN_ORIGINS", "")
	t.Setenv("PIPEWARDEN_WEBAUTHN_NAME", "")
	w, err := h.webAuthn()
	if err != nil || w == nil {
		t.Fatalf("default webAuthn: w=%v err=%v", w, err)
	}
}

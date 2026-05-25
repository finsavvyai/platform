package handlers

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// authedSetup creates a user + active session cookies for tests that need
// to exercise the post-auth branches of various handlers.
func authedSetup(t *testing.T) (*Handlers, *storage.DB, *storage.UserRecord) {
	t.Helper()
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, err := db.CreateUser("authed@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "A", "Co")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return h, db, u
}

func TestAuthRecoveryStatusAuthed(t *testing.T) {
	h, _, u := authedSetup(t)
	req := makeAuthedRequest(t, "GET", "/api/v1/auth/recovery/status", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthRecoveryStatus(w, req)
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if _, ok := resp["unused_codes"]; !ok {
		t.Fatalf("missing unused_codes: %s", w.Body.String())
	}
}

func TestAuthRecoveryGenerateAuthed(t *testing.T) {
	h, _, u := authedSetup(t)
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/recovery/generate", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthRecoveryGenerate(w, req)
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	codes, _ := resp["codes"].([]any)
	if len(codes) == 0 {
		t.Fatalf("expected recovery codes: %s", w.Body.String())
	}
}

func TestAuthSettingsAuthed(t *testing.T) {
	h, _, u := authedSetup(t)
	req := makeAuthedRequest(t, "GET", "/api/v1/auth/settings", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthSettings(w, req)
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthListPasskeysWithPasskey(t *testing.T) {
	h, db, u := authedSetup(t)
	_, _ = db.CreatePasskey(seedPasskey(u.ID, "cred-list"))
	req := makeAuthedRequest(t, "GET", "/api/v1/auth/passkeys", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthListPasskeys(w, req)
	if w.Code != 200 {
		t.Fatalf("status=%d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "cred-list") &&
		!strings.Contains(w.Body.String(), "test") {
		t.Fatalf("missing seeded passkey: %s", w.Body.String())
	}
}

func TestAuthDeletePasskeyAuthed(t *testing.T) {
	h, db, u := authedSetup(t)
	pk, err := db.CreatePasskey(seedPasskey(u.ID, "cred-del"))
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	idStr := strings.TrimPrefix("/api/v1/auth/passkeys/", "/") // for path
	_ = idStr
	pkID := pk.ID
	req := makeAuthedRequest(t, "DELETE", "/api/v1/auth/passkeys/"+fmt.Sprintf("%d", pkID), "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthDeletePasskey(w, req)
	if w.Code != 200 {
		t.Fatalf("delete: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthVerifyRequestAuthed(t *testing.T) {
	h, _, u := authedSetup(t)
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/verify/request", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthVerifyRequest(w, req)
	if w.Code != 200 {
		t.Fatalf("verify request: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "sent") {
		t.Fatalf("missing sent flag: %s", w.Body.String())
	}
}

func TestAuthTOTPDisableAuthedNoTOTP(t *testing.T) {
	h, _, u := authedSetup(t)
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/totp/disable", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthTOTPDisable(w, req)
	// Disable when nothing enabled returns 200 (idempotent) or 400/422
	if w.Code != 200 && w.Code != 400 && w.Code != 422 {
		t.Fatalf("totp disable: %d body=%s", w.Code, w.Body.String())
	}
}

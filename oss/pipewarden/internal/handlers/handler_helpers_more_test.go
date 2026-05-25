package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/go-webauthn/webauthn/protocol"
)

func TestPasskeyTransportRoundtrip(t *testing.T) {
	in := []protocol.AuthenticatorTransport{
		protocol.USB, protocol.NFC, protocol.BLE,
	}
	s := transportsToString(in)
	if s != "usb,nfc,ble" {
		t.Fatalf("transportsToString=%q", s)
	}
	out := parseTransports(s)
	if len(out) != 3 || out[1] != protocol.NFC {
		t.Fatalf("parseTransports=%v", out)
	}

	if got := parseTransports(""); got != nil {
		t.Fatalf("empty must return nil, got %v", got)
	}
	if got := parseTransports(" , ,"); len(got) != 0 {
		t.Fatalf("whitespace-only must yield empty: %v", got)
	}
}

func TestPasskeyRecordsToCredentials(t *testing.T) {
	recs := []storage.PasskeyRecord{
		{
			CredentialID: []byte("cred-1"),
			PublicKey:    []byte("pk-1"),
			SignCount:    7,
			Transports:   "usb,internal",
		},
		{
			CredentialID: []byte("cred-2"),
			PublicKey:    []byte("pk-2"),
			SignCount:    0,
			Transports:   "",
		},
	}
	creds := passkeyRecordsToCredentials(recs)
	if len(creds) != 2 {
		t.Fatalf("len=%d, want 2", len(creds))
	}
	if string(creds[0].ID) != "cred-1" || creds[0].Authenticator.SignCount != 7 {
		t.Fatalf("cred[0] mismatch: %+v", creds[0])
	}
	_ = creds[0] // type assert
}

func TestFmtTimePtr(t *testing.T) {
	if got := fmtTimePtr(nil); got != "—" {
		t.Fatalf("nil: %q", got)
	}
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	if got := fmtTimePtr(&now); !strings.HasPrefix(got, "2026-01-02") {
		t.Fatalf("ts: %q", got)
	}
}

func TestParsePeriodParam(t *testing.T) {
	if parsePeriodParam("") != nil {
		t.Fatalf("empty must be nil")
	}
	if parsePeriodParam("not-a-time") != nil {
		t.Fatalf("malformed must be nil")
	}
	got := parsePeriodParam("2026-05-13T10:00:00Z")
	if got == nil {
		t.Fatalf("valid RFC3339 returned nil")
	}
	if got.Year() != 2026 || got.Month() != 5 || got.Day() != 13 {
		t.Fatalf("parsed wrong date: %v", got)
	}
}

func TestIssueSessionForUserIDHappyAndMissing(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)

	// Missing user -> 500 lookup failed
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/", nil)
	h.issueSessionForUserID(w, req, 99999)
	if w.Code != 500 {
		t.Fatalf("missing user: %d body=%s", w.Code, w.Body.String())
	}

	// Real user -> 200 + cookie
	user, err := db.CreateUser("zoe@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "Zoe", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/", nil)
	h.issueSessionForUserID(w, req, user.ID)
	if w.Code != 200 {
		t.Fatalf("issue: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "/onboarding") {
		t.Fatalf("expected next=/onboarding for new user, got %s", w.Body.String())
	}

	// After onboarding -> next=/dashboard
	if err := db.MarkOnboarded(user.ID, "Zoe", "Co"); err != nil {
		t.Fatalf("MarkOnboarded: %v", err)
	}
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/", nil)
	h.issueSessionForUserID(w, req, user.ID)
	if !strings.Contains(w.Body.String(), "/dashboard") {
		t.Fatalf("expected next=/dashboard, got %s", w.Body.String())
	}
}

func TestDedupDepsViaSCAResponse(t *testing.T) {
	// dedupDeps is exercised through SCAScan; cover path that produces dups.
	h, _ := newTestHandlersDB(t)
	body := `{"logs":"github.com/sirupsen/logrus v1.9.0\nmodule example.com/test\n\nrequire github.com/sirupsen/logrus v1.9.0\n"}`
	w, _ := doJSON(t, h.SCAScan, "POST", body, nil)
	if w.Code != 200 {
		t.Fatalf("status: %d", w.Code)
	}
}

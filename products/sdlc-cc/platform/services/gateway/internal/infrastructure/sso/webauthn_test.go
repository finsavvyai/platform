// REAL — exercises the go-webauthn library wiring.
// Run via: cd services/gateway && go test ./internal/infrastructure/sso/...
//
// We can't drive a true Register→Login round-trip in unit tests because
// that requires a real authenticator (CTAP2 device or the platform
// browser). Instead we assert the wiring: real challenges are issued,
// real SessionData is shaped correctly, and config validation rejects
// malformed origins.
package sso

import (
	"context"
	"strings"
	"testing"

	"github.com/go-webauthn/webauthn/webauthn"
)

func validConfig() WebAuthnConfig {
	return WebAuthnConfig{
		RPID:      "localhost",
		RPName:    "SDLC Platform Test",
		RPOrigins: []string{"http://localhost:3000"},
	}
}

func memUser() *MemoryUser {
	return &MemoryUser{
		ID:          []byte("user-id-bytes-1234567890"),
		Name:        "alice@example.com",
		DisplayName: "Alice",
		Credentials: []webauthn.Credential{},
	}
}

func TestNewWebAuthnService_Valid(t *testing.T) {
	svc, err := NewWebAuthnService(validConfig())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if svc == nil || svc.wa == nil {
		t.Fatal("expected non-nil service and underlying *webauthn.WebAuthn")
	}
}

func TestNewWebAuthnService_InvalidConfig(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*WebAuthnConfig)
		wantSub string
	}{
		{"missing RPID", func(c *WebAuthnConfig) { c.RPID = "" }, "RPID"},
		{"missing RPName", func(c *WebAuthnConfig) { c.RPName = "" }, "RPName"},
		{"no origins", func(c *WebAuthnConfig) { c.RPOrigins = nil }, "RPOrigin"},
		{"bad origin scheme", func(c *WebAuthnConfig) { c.RPOrigins = []string{"ftp://x"} }, "invalid origin"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := validConfig()
			tc.mutate(&cfg)
			_, err := NewWebAuthnService(cfg)
			if err == nil {
				t.Fatalf("expected error for %s", tc.name)
			}
			if !strings.Contains(err.Error(), tc.wantSub) {
				t.Fatalf("error %q missing substring %q", err, tc.wantSub)
			}
		})
	}
}

func TestBeginRegistration_ProducesChallenge(t *testing.T) {
	svc, err := NewWebAuthnService(validConfig())
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	cc, session, err := svc.BeginRegistration(context.Background(), memUser())
	if err != nil {
		t.Fatalf("BeginRegistration: %v", err)
	}
	if cc == nil {
		t.Fatal("expected non-nil CredentialCreation")
	}
	if len(cc.Response.Challenge) == 0 {
		t.Fatal("expected a non-empty challenge in CredentialCreation")
	}
	if session == nil {
		t.Fatal("expected non-nil SessionData")
	}
	if len(session.Challenge) == 0 {
		t.Fatal("expected non-empty SessionData.Challenge")
	}
	if string(session.UserID) != string(memUser().ID) {
		t.Fatalf("SessionData.UserID = %q, want %q", session.UserID, memUser().ID)
	}
}

func TestBeginLogin_ProducesAssertion(t *testing.T) {
	svc, err := NewWebAuthnService(validConfig())
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	// BeginLogin requires at least one credential — fabricate one.
	user := memUser()
	user.Credentials = []webauthn.Credential{{
		ID:        []byte("cred-id-12345"),
		PublicKey: []byte("fake-pub-key-for-shape-test"),
	}}
	ca, session, err := svc.BeginLogin(context.Background(), user)
	if err != nil {
		t.Fatalf("BeginLogin: %v", err)
	}
	if ca == nil {
		t.Fatal("expected non-nil CredentialAssertion")
	}
	if len(ca.Response.Challenge) == 0 {
		t.Fatal("expected a non-empty challenge in CredentialAssertion")
	}
	if session == nil || len(session.Challenge) == 0 {
		t.Fatal("expected non-empty SessionData with challenge")
	}
}

func TestBeginRegistration_NilUser(t *testing.T) {
	svc, err := NewWebAuthnService(validConfig())
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, _, err := svc.BeginRegistration(context.Background(), nil); err == nil {
		t.Fatal("expected error for nil user")
	}
	if _, _, err := svc.BeginLogin(context.Background(), nil); err == nil {
		t.Fatal("expected error for nil user")
	}
	if _, err := svc.FinishRegistration(context.Background(), nil, nil, nil); err == nil {
		t.Fatal("expected error for nil user/session")
	}
	if _, err := svc.FinishLogin(context.Background(), nil, nil, nil); err == nil {
		t.Fatal("expected error for nil user/session")
	}
}

func TestMemoryUser_ImplementsInterface(t *testing.T) {
	var _ WebAuthnUser = (*MemoryUser)(nil)
	u := memUser()
	if string(u.WebAuthnID()) == "" {
		t.Fatal("WebAuthnID")
	}
	if u.WebAuthnName() == "" {
		t.Fatal("WebAuthnName")
	}
	if u.WebAuthnDisplayName() == "" {
		t.Fatal("WebAuthnDisplayName")
	}
	if u.WebAuthnCredentials() == nil {
		t.Fatal("WebAuthnCredentials nil slice")
	}
	_ = u.WebAuthnIcon()
}

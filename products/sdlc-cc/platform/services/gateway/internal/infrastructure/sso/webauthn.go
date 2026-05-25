// REAL — uses github.com/go-webauthn/webauthn.
// Add to go.mod via:
//   cd services/gateway && go get github.com/go-webauthn/webauthn@latest && go mod tidy
//
// This file wires the upstream go-webauthn library into the gateway.
// It is NOT a SCAFFOLD: every exported function delegates to the
// real library. The library handles CBOR/COSE attestation parsing,
// challenge generation, signature verification, and counter checks
// per W3C WebAuthn Level 3.
//
// Storage of credentials (public key, sign count, AAGUID, etc.) is
// the caller's responsibility — the WebAuthnUser interface lets the
// caller plug in any persistence layer.
package sso

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// WebAuthnConfig captures the relying-party identity. Per the W3C
// spec, RPID must be a registrable domain suffix of the origin and
// origins must be HTTPS (or http://localhost for dev).
type WebAuthnConfig struct {
	RPID      string   // e.g. "sdlc.ai"
	RPName    string   // e.g. "SDLC Platform"
	RPOrigins []string // e.g. ["https://app.sdlc.ai"]
}

// LoadWebAuthnConfigFromEnv reads RPID, RPName, and a comma-separated
// origins list from the standard environment variables.
func LoadWebAuthnConfigFromEnv() WebAuthnConfig {
	originsRaw := os.Getenv("WEBAUTHN_RP_ORIGINS")
	var origins []string
	for _, o := range strings.Split(originsRaw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	return WebAuthnConfig{
		RPID:      strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ID")),
		RPName:    strings.TrimSpace(os.Getenv("WEBAUTHN_RP_NAME")),
		RPOrigins: origins,
	}
}

// WebAuthnService wraps the upstream webauthn.WebAuthn handle.
type WebAuthnService struct {
	wa *webauthn.WebAuthn
}

// NewWebAuthnService constructs a service from cfg. Returns a clear
// error when required fields are missing or the library rejects the
// origin list (e.g. non-HTTPS in production builds).
func NewWebAuthnService(cfg WebAuthnConfig) (*WebAuthnService, error) {
	if cfg.RPID == "" {
		return nil, errors.New("sso/webauthn: RPID is required")
	}
	if cfg.RPName == "" {
		return nil, errors.New("sso/webauthn: RPName is required")
	}
	if len(cfg.RPOrigins) == 0 {
		return nil, errors.New("sso/webauthn: at least one RPOrigin is required")
	}
	for _, o := range cfg.RPOrigins {
		if !strings.HasPrefix(o, "https://") && !strings.HasPrefix(o, "http://localhost") {
			return nil, fmt.Errorf("sso/webauthn: invalid origin %q (must be https:// or http://localhost)", o)
		}
	}
	w, err := webauthn.New(&webauthn.Config{
		RPID:          cfg.RPID,
		RPDisplayName: cfg.RPName,
		RPOrigins:     cfg.RPOrigins,
	})
	if err != nil {
		return nil, fmt.Errorf("sso/webauthn: library init: %w", err)
	}
	return &WebAuthnService{wa: w}, nil
}

// WebAuthnUser is the surface the library expects from a user record.
// It mirrors webauthn.User exactly so any implementer can be passed
// straight through.
type WebAuthnUser interface {
	WebAuthnID() []byte
	WebAuthnName() string
	WebAuthnDisplayName() string
	WebAuthnCredentials() []webauthn.Credential
	WebAuthnIcon() string
}

// BeginRegistration starts the registration ceremony. The returned
// CredentialCreation is JSON-serialized and sent to the browser; the
// SessionData is stashed server-side and replayed in FinishRegistration.
func (s *WebAuthnService) BeginRegistration(_ context.Context, user WebAuthnUser) (*protocol.CredentialCreation, *webauthn.SessionData, error) {
	if user == nil {
		return nil, nil, errors.New("sso/webauthn: user is required")
	}
	return s.wa.BeginRegistration(user)
}

// FinishRegistration verifies the attestation response and returns
// the new credential. The caller persists it on the user record.
func (s *WebAuthnService) FinishRegistration(_ context.Context, user WebAuthnUser, session *webauthn.SessionData, response []byte) (*webauthn.Credential, error) {
	if user == nil || session == nil {
		return nil, errors.New("sso/webauthn: user and session are required")
	}
	parsed, err := protocol.ParseCredentialCreationResponseBody(strings.NewReader(string(response)))
	if err != nil {
		return nil, fmt.Errorf("sso/webauthn: parse attestation: %w", err)
	}
	return s.wa.CreateCredential(user, *session, parsed)
}

// BeginLogin starts an assertion ceremony.
func (s *WebAuthnService) BeginLogin(_ context.Context, user WebAuthnUser) (*protocol.CredentialAssertion, *webauthn.SessionData, error) {
	if user == nil {
		return nil, nil, errors.New("sso/webauthn: user is required")
	}
	return s.wa.BeginLogin(user)
}

// FinishLogin verifies the assertion and returns the credential that
// matched. The caller updates the stored sign-count from cred.Authenticator.SignCount.
func (s *WebAuthnService) FinishLogin(_ context.Context, user WebAuthnUser, session *webauthn.SessionData, response []byte) (*webauthn.Credential, error) {
	if user == nil || session == nil {
		return nil, errors.New("sso/webauthn: user and session are required")
	}
	parsed, err := protocol.ParseCredentialRequestResponseBody(strings.NewReader(string(response)))
	if err != nil {
		return nil, fmt.Errorf("sso/webauthn: parse assertion: %w", err)
	}
	return s.wa.ValidateLogin(user, *session, parsed)
}

// MemoryUser is a trivial in-memory WebAuthnUser used in tests and
// local development. Production wires its own user record type.
type MemoryUser struct {
	ID          []byte
	Name        string
	DisplayName string
	Icon        string
	Credentials []webauthn.Credential
}

// WebAuthnID implements WebAuthnUser.
func (m *MemoryUser) WebAuthnID() []byte { return m.ID }

// WebAuthnName implements WebAuthnUser.
func (m *MemoryUser) WebAuthnName() string { return m.Name }

// WebAuthnDisplayName implements WebAuthnUser.
func (m *MemoryUser) WebAuthnDisplayName() string { return m.DisplayName }

// WebAuthnCredentials implements WebAuthnUser.
func (m *MemoryUser) WebAuthnCredentials() []webauthn.Credential { return m.Credentials }

// WebAuthnIcon implements WebAuthnUser.
func (m *MemoryUser) WebAuthnIcon() string { return m.Icon }

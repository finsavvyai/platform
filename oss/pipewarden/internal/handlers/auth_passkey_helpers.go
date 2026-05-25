package handlers

import (
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// webauthnUser is the local alias for the WebAuthn library's User type.
// Kept here so the package compiles cleanly when the library import path
// renames; the alias is the only spot that needs updating.
type webauthnUser = webauthn.User

// passkeyRecordsToCredentials adapts our storage rows to the library's
// in-memory Credential type. Transports are CSV-encoded in the row so
// we split on save and restore here.
func passkeyRecordsToCredentials(recs []storage.PasskeyRecord) []webauthn.Credential {
	out := make([]webauthn.Credential, 0, len(recs))
	for _, r := range recs {
		out = append(out, webauthn.Credential{
			ID:        r.CredentialID,
			PublicKey: r.PublicKey,
			Authenticator: webauthn.Authenticator{
				SignCount: r.SignCount,
			},
			Transport: parseTransports(r.Transports),
		})
	}
	return out
}

func parseTransports(s string) []protocol.AuthenticatorTransport {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]protocol.AuthenticatorTransport, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, protocol.AuthenticatorTransport(p))
		}
	}
	return out
}

func transportsToString(ts []protocol.AuthenticatorTransport) string {
	parts := make([]string, 0, len(ts))
	for _, t := range ts {
		parts = append(parts, string(t))
	}
	return strings.Join(parts, ",")
}

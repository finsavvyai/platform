package auth

import (
	"errors"
	"os"
	"strings"

	"github.com/go-webauthn/webauthn/webauthn"
)

// WebAuthnConfig is the relying-party configuration. RPID is the
// public domain users see (no scheme, no port). RPOrigins is the
// list of acceptable origins the browser sends — must include the
// scheme and host:port for each frontend that initiates ceremonies.
//
// Reads from env so the same binary serves dev (localhost) and prod
// (pipewarden.io) without recompile:
//
//	PIPEWARDEN_WEBAUTHN_RPID     — e.g. "pipewarden.io" (default: localhost)
//	PIPEWARDEN_WEBAUTHN_ORIGINS  — comma-separated origins
//	                               (default: http://localhost:8080)
//	PIPEWARDEN_WEBAUTHN_NAME     — display name (default: PipeWarden)
type WebAuthnConfig struct {
	RPID    string
	Origins []string
	RPName  string
}

// LoadWebAuthnConfig builds the config from env, with sensible local-dev
// defaults so a fresh `pipewarden -config configs/development/config.yml`
// just works.
func LoadWebAuthnConfig() WebAuthnConfig {
	cfg := WebAuthnConfig{
		RPID:    envOr("PIPEWARDEN_WEBAUTHN_RPID", "localhost"),
		RPName:  envOr("PIPEWARDEN_WEBAUTHN_NAME", "PipeWarden"),
		Origins: parseOrigins(envOr("PIPEWARDEN_WEBAUTHN_ORIGINS", "http://localhost:8080")),
	}
	return cfg
}

// NewWebAuthn builds a *webauthn.WebAuthn from the config. Errors here
// are startup-time misconfig (e.g. RPID not a valid hostname) and should
// surface clearly.
func NewWebAuthn(cfg WebAuthnConfig) (*webauthn.WebAuthn, error) {
	if cfg.RPID == "" {
		return nil, errors.New("webauthn: PIPEWARDEN_WEBAUTHN_RPID is required")
	}
	if len(cfg.Origins) == 0 {
		return nil, errors.New("webauthn: PIPEWARDEN_WEBAUTHN_ORIGINS is required")
	}
	w, err := webauthn.New(&webauthn.Config{
		RPID:          cfg.RPID,
		RPDisplayName: cfg.RPName,
		RPOrigins:     cfg.Origins,
	})
	if err != nil {
		return nil, err
	}
	return w, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseOrigins(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

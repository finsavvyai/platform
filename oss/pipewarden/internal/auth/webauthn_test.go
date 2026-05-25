package auth

import (
	"strings"
	"testing"
)

func TestLoadWebAuthnConfig_DefaultsForLocalDev(t *testing.T) {
	t.Setenv("PIPEWARDEN_WEBAUTHN_RPID", "")
	t.Setenv("PIPEWARDEN_WEBAUTHN_ORIGINS", "")
	t.Setenv("PIPEWARDEN_WEBAUTHN_NAME", "")
	cfg := LoadWebAuthnConfig()
	if cfg.RPID != "localhost" {
		t.Errorf("RPID default = %q, want localhost", cfg.RPID)
	}
	if len(cfg.Origins) != 1 || cfg.Origins[0] != "http://localhost:8080" {
		t.Errorf("Origins default = %v, want [http://localhost:8080]", cfg.Origins)
	}
	if cfg.RPName != "PipeWarden" {
		t.Errorf("RPName default = %q, want PipeWarden", cfg.RPName)
	}
}

func TestLoadWebAuthnConfig_HonorsEnv(t *testing.T) {
	t.Setenv("PIPEWARDEN_WEBAUTHN_RPID", "pipewarden.io")
	t.Setenv("PIPEWARDEN_WEBAUTHN_ORIGINS", "https://pipewarden.io,https://app.pipewarden.io")
	t.Setenv("PIPEWARDEN_WEBAUTHN_NAME", "PipeWarden Production")
	cfg := LoadWebAuthnConfig()
	if cfg.RPID != "pipewarden.io" {
		t.Errorf("RPID = %q", cfg.RPID)
	}
	if len(cfg.Origins) != 2 {
		t.Errorf("expected 2 origins, got %v", cfg.Origins)
	}
	if cfg.Origins[1] != "https://app.pipewarden.io" {
		t.Errorf("origin parse: %v", cfg.Origins)
	}
}

func TestNewWebAuthn_FailsOnEmptyRPID(t *testing.T) {
	_, err := NewWebAuthn(WebAuthnConfig{Origins: []string{"http://localhost:8080"}})
	if err == nil || !strings.Contains(err.Error(), "RPID") {
		t.Errorf("expected RPID-required error, got %v", err)
	}
}

func TestNewWebAuthn_FailsOnEmptyOrigins(t *testing.T) {
	_, err := NewWebAuthn(WebAuthnConfig{RPID: "localhost"})
	if err == nil || !strings.Contains(err.Error(), "ORIGINS") {
		t.Errorf("expected ORIGINS-required error, got %v", err)
	}
}

func TestNewWebAuthn_BuildsForValidConfig(t *testing.T) {
	w, err := NewWebAuthn(WebAuthnConfig{
		RPID:    "localhost",
		RPName:  "Test",
		Origins: []string{"http://localhost:8080"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if w == nil {
		t.Error("expected non-nil WebAuthn")
	}
}

func TestPasskeyUser_AdaptsToInterface(t *testing.T) {
	u := &PasskeyUser{UserID: 42, UserName: "ada@x.com", DisplayName: "Ada"}
	if string(u.WebAuthnID()) != "42" {
		t.Errorf("WebAuthnID = %q, want 42", u.WebAuthnID())
	}
	if u.WebAuthnName() != "ada@x.com" {
		t.Errorf("WebAuthnName = %q", u.WebAuthnName())
	}
	if u.WebAuthnDisplayName() != "Ada" {
		t.Errorf("WebAuthnDisplayName = %q", u.WebAuthnDisplayName())
	}
}

func TestPasskeyUser_DisplayNameFallsBackToUserName(t *testing.T) {
	u := &PasskeyUser{UserID: 1, UserName: "noname@x.com"}
	if u.WebAuthnDisplayName() != "noname@x.com" {
		t.Errorf("empty display name should fall back to user name, got %q", u.WebAuthnDisplayName())
	}
}

package email

import (
	"strings"
	"testing"
)

func TestNewFromEnvLogOnly(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	s := NewFromEnv()
	if !s.LogOnly() {
		t.Fatalf("expected LogOnly when SMTP_HOST unset")
	}
}

func TestNewFromEnvWithSMTP(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "smtp.example.com")
	t.Setenv("PIPEWARDEN_SMTP_FROM", "test@example.com")
	t.Setenv("PIPEWARDEN_SMTP_PORT", "465")
	t.Setenv("PIPEWARDEN_SMTP_USER", "user")
	t.Setenv("PIPEWARDEN_SMTP_PASSWORD", "pw")
	s := NewFromEnv()
	if s.LogOnly() {
		t.Fatalf("expected non-LogOnly when SMTP_HOST set")
	}
	if s.host != "smtp.example.com" || s.port != "465" || s.from != "test@example.com" {
		t.Fatalf("fields: %+v", s)
	}
}

func TestNewFromEnvDefaults(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	t.Setenv("PIPEWARDEN_SMTP_FROM", "")
	t.Setenv("PIPEWARDEN_SMTP_PORT", "")
	s := NewFromEnv()
	if !strings.Contains(s.from, "noreply@pipewarden.io") {
		t.Fatalf("default from missing: %q", s.from)
	}
	if s.port != "587" {
		t.Fatalf("default port: %q", s.port)
	}
}

func TestSendLogOnly(t *testing.T) {
	s := &Sender{logOnly: true}
	if err := s.Send("to@example.com", "subj", "body"); err != nil {
		t.Fatalf("log-only send: %v", err)
	}
}

func TestSendSMTPFailsOnUnreachable(t *testing.T) {
	s := &Sender{
		host:    "127.0.0.1",
		port:    "1", // unreachable port to force fast failure
		from:    "from@example.com",
		logOnly: false,
	}
	err := s.Send("to@example.com", "subj", "body")
	if err == nil {
		t.Fatalf("expected SMTP dial error to unreachable host")
	}
}

func TestSendVerificationLogOnly(t *testing.T) {
	s := &Sender{logOnly: true}
	if err := s.SendVerification("u@example.com", "https://x/verify?t=abc"); err != nil {
		t.Fatalf("SendVerification: %v", err)
	}
}

func TestSendPasswordResetLogOnly(t *testing.T) {
	s := &Sender{logOnly: true}
	if err := s.SendPasswordReset("u@example.com", "https://x/reset?t=abc"); err != nil {
		t.Fatalf("SendPasswordReset: %v", err)
	}
}

func TestEnvOrFallback(t *testing.T) {
	t.Setenv("PIPEWARDEN_TEST_EMAIL_VAR", "")
	if got := envOr("PIPEWARDEN_TEST_EMAIL_VAR", "fb"); got != "fb" {
		t.Fatalf("fallback: %q", got)
	}
	t.Setenv("PIPEWARDEN_TEST_EMAIL_VAR", "set")
	if got := envOr("PIPEWARDEN_TEST_EMAIL_VAR", "fb"); got != "set" {
		t.Fatalf("env: %q", got)
	}
}

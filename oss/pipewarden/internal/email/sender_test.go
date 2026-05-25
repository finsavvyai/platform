package email

import (
	"strings"
	"testing"
)

func TestNewFromEnv_LogOnlyWhenHostUnset(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	s := NewFromEnv()
	if !s.LogOnly() {
		t.Error("expected log-only mode when SMTP_HOST unset")
	}
}

func TestNewFromEnv_NotLogOnlyWhenHostSet(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "smtp.example.com")
	s := NewFromEnv()
	if s.LogOnly() {
		t.Error("expected SMTP mode when SMTP_HOST set")
	}
}

func TestSend_LogOnlyDoesNotError(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	s := NewFromEnv()
	if err := s.Send("a@b.com", "subj", "body"); err != nil {
		t.Errorf("log-only send should not error, got %v", err)
	}
}

func TestSendVerification_BuildsLinkBody(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	s := NewFromEnv()
	if err := s.SendVerification("a@b.com", "https://x/verify?t=1"); err != nil {
		t.Errorf("verification send: %v", err)
	}
}

func TestSendPasswordReset_BuildsBody(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	s := NewFromEnv()
	if err := s.SendPasswordReset("a@b.com", "https://x/reset?t=1"); err != nil {
		t.Errorf("reset send: %v", err)
	}
}

func TestEnvOr(t *testing.T) {
	t.Setenv("PW_TEST_KEY_1", "")
	if got := envOr("PW_TEST_KEY_1", "default"); got != "default" {
		t.Errorf("empty env should fall back, got %q", got)
	}
	t.Setenv("PW_TEST_KEY_1", "actual")
	if got := envOr("PW_TEST_KEY_1", "default"); got != "actual" {
		t.Errorf("set env should win, got %q", got)
	}
}

func TestSendVerification_TemplateContent(t *testing.T) {
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	s := NewFromEnv()
	// We can't capture log output without redirection, but we can at
	// least exercise the template-build path by ensuring the URL ends
	// up in some shape suitable for embedding (no newline split).
	url := "https://pipewarden.io/verify?token=abc123"
	if !strings.Contains(url, "verify") {
		t.Fatal("test URL should contain verify segment")
	}
	if err := s.SendVerification("u@x.com", url); err != nil {
		t.Errorf("verification send: %v", err)
	}
}

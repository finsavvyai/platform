// Package email sends transactional auth emails (verification, password
// reset). Two backends:
//
//   - SMTP: when PIPEWARDEN_SMTP_HOST is set, real email goes out via
//     net/smtp using the configured credentials.
//   - Log-only: when SMTP env is unset, emails are logged to stderr in
//     a copyable form. Lets local dev test the full flow without SMTP
//     setup, and gives operators a clear "you forgot to set SMTP" signal.
//
// Templates intentionally live next to the sender so a single change to
// branding can update every email at once.
package email

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
)

// Sender is the package's single entry point. Construct with NewFromEnv
// so the choice of backend is centralised.
type Sender struct {
	from     string
	host     string
	port     string
	username string
	password string
	logOnly  bool
}

// NewFromEnv builds a Sender from environment variables. When SMTP_HOST
// is unset the Sender enters log-only mode — Send() prints instead of
// dialling, useful for local dev and CI tests.
func NewFromEnv() *Sender {
	host := os.Getenv("PIPEWARDEN_SMTP_HOST")
	from := os.Getenv("PIPEWARDEN_SMTP_FROM")
	if from == "" {
		from = "PipeWarden <noreply@pipewarden.io>"
	}
	return &Sender{
		from:     from,
		host:     host,
		port:     envOr("PIPEWARDEN_SMTP_PORT", "587"),
		username: os.Getenv("PIPEWARDEN_SMTP_USER"),
		password: os.Getenv("PIPEWARDEN_SMTP_PASSWORD"),
		logOnly:  host == "",
	}
}

// Send delivers a single email. Subject + body are required; from is
// taken from the configured sender.
func (s *Sender) Send(to, subject, body string) error {
	if s.logOnly {
		log.Printf("[email:log-only] to=%q subject=%q\n--- body ---\n%s\n--- end ---", to, subject, body)
		return nil
	}
	addr := s.host + ":" + s.port
	auth := smtp.PlainAuth("", s.username, s.password, s.host)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		s.from, to, subject, body))
	return smtp.SendMail(addr, auth, s.from, []string{to}, msg)
}

// SendVerification builds + sends the email-verification template.
// The verifyURL must be a fully qualified URL the recipient can click.
func (s *Sender) SendVerification(to, verifyURL string) error {
	body := fmt.Sprintf(`Welcome to PipeWarden.

Please verify your email by clicking the link below:

%s

This link expires in 24 hours. If you didn't sign up, you can safely
ignore this message.

— The PipeWarden team`, verifyURL)
	return s.Send(to, "Verify your PipeWarden email", body)
}

// SendPasswordReset builds + sends the password-reset template. Includes
// the resetURL and an explicit "ignore if not you" line per NIST guidance.
func (s *Sender) SendPasswordReset(to, resetURL string) error {
	body := fmt.Sprintf(`Someone requested a password reset for your PipeWarden
account. If that was you, click the link below to choose a new password:

%s

This link expires in 1 hour and can be used only once. If you didn't
request a reset, you can safely ignore this message — your password
won't change.

— The PipeWarden team`, resetURL)
	return s.Send(to, "Reset your PipeWarden password", body)
}

// LogOnly reports whether the sender will print rather than dial SMTP.
// Useful for tests + the operator-readiness endpoint.
func (s *Sender) LogOnly() bool { return s.logOnly }

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

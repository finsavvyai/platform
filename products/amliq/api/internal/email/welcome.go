package email

import (
	"fmt"
)

// WelcomeContext carries the per-tenant fields rendered into the
// welcome email body. Kept minimal so the composer is testable
// without touching the auth handler.
type WelcomeContext struct {
	OrgName     string
	DashboardURL string
	DocsURL      string
	SupportEmail string
	FreeDailyCap int
}

// DefaultWelcome returns a context populated with marketing defaults.
// Callers override OrgName per signup.
func DefaultWelcome(orgName string) WelcomeContext {
	return WelcomeContext{
		OrgName:      orgName,
		DashboardURL: "https://amliq.com/dashboard",
		DocsURL:      "https://amliq.com/docs",
		SupportEmail: "support@amliq.com",
		FreeDailyCap: 10,
	}
}

// WelcomeSubject is exported so tests and analytics share a constant.
const WelcomeSubject = "Welcome to AMLIQ — your sanctions screening account is ready"

// RenderWelcomeHTML returns the welcome-email body. Plain inline
// styling keeps it usable in clients that strip <style> blocks.
func RenderWelcomeHTML(ctx WelcomeContext) string {
	return fmt.Sprintf(`<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 12px 0;">Welcome to AMLIQ, %s.</h1>
  <p>Your account is live. Here's how to get screening done in the next five minutes:</p>
  <ol style="line-height:1.6;">
    <li>Sign in to the dashboard: <a href="%s">%s</a></li>
    <li>You're on the free tier — <strong>%d screenings per day</strong>. No card required.</li>
    <li>Pick the sanctions lists relevant to your jurisdiction (we suggest a starter set based on your country).</li>
    <li>Run your first screen against OFAC, UN, EU, or UK sanctions lists.</li>
  </ol>
  <p>API docs: <a href="%s">%s</a></p>
  <p>Reply to this email or write to <a href="mailto:%s">%s</a> if anything's unclear.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:12px;color:#666;">AMLIQ — AI-powered AML/CFT sanctions screening.</p>
</body></html>`,
		ctx.OrgName,
		ctx.DashboardURL, ctx.DashboardURL,
		ctx.FreeDailyCap,
		ctx.DocsURL, ctx.DocsURL,
		ctx.SupportEmail, ctx.SupportEmail,
	)
}

// SendWelcome dispatches a welcome email through s. Fatal-tolerant:
// if s is the NoopSender (dev) the call still returns nil so signup
// succeeds. Returns the underlying send error otherwise so callers
// can log without coupling to the email package.
func SendWelcome(s Sender, to string, ctx WelcomeContext) error {
	return s.Send(to, WelcomeSubject, RenderWelcomeHTML(ctx))
}

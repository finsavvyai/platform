package email

import "fmt"

// ResetPasswordEmail returns the HTML for a password reset email.
func ResetPasswordEmail(resetURL string) string {
	return fmt.Sprintf(`
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
  <img src="https://amliq.finance/logo.svg" alt="AMLIQ" style="height:32px;margin-bottom:24px">
  <h1 style="font-size:24px;color:#fff;margin:0 0 16px">Reset your password</h1>
  <p style="color:#888;font-size:14px;line-height:1.6">
    Click the button below to reset your AMLIQ password. This link expires in 1 hour.
  </p>
  <a href="%s" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#0A84FF;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
    Reset Password
  </a>
  <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
</div>`, resetURL)
}

// TeamInviteEmail returns the HTML for a team invitation email.
func TeamInviteEmail(inviteURL, teamName string) string {
	return fmt.Sprintf(`
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
  <img src="https://amliq.finance/logo.svg" alt="AMLIQ" style="height:32px;margin-bottom:24px">
  <h1 style="font-size:24px;color:#fff;margin:0 0 16px">You're invited to %s</h1>
  <p style="color:#888;font-size:14px;line-height:1.6">
    You've been invited to join the %s team on AMLIQ — the AI-powered AML screening platform.
  </p>
  <a href="%s" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#0A84FF;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
    Accept Invitation
  </a>
</div>`, teamName, teamName, inviteURL)
}

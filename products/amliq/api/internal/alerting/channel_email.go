package alerting

import (
	"context"
	"fmt"
	"html"
	"os"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/email"
)

// EmailChannel notifies ADMIN_ALERT_EMAIL via Resend on failure.
// Disabled silently when ADMIN_ALERT_EMAIL or RESEND_API_KEY is
// unset.
type EmailChannel struct {
	sender email.Sender
	to     string
}

// NewEmailChannel builds the channel from env. Returns nil when not
// configured — callers should filter nil before registering.
func NewEmailChannel() *EmailChannel {
	to := os.Getenv("ADMIN_ALERT_EMAIL")
	if to == "" {
		return nil
	}
	return &EmailChannel{sender: email.NewSender(), to: to}
}

// Name implements Channel.
func (c *EmailChannel) Name() string { return "email" }

// Send implements Channel.
func (c *EmailChannel) Send(
	_ context.Context, a domain.ListSyncAudit,
) error {
	subject := fmt.Sprintf("[AMLIQ] list sync failed: %s (%s)",
		a.ListID, a.TenantID)
	body := fmt.Sprintf(
		"<h3>List sync failure</h3>"+
			"<p><b>List:</b> %s<br>"+
			"<b>Tenant:</b> %s<br>"+
			"<b>Triggered by:</b> %s<br>"+
			"<b>Duration:</b> %dms<br>"+
			"<b>Fetch strategy:</b> %s</p>"+
			"<pre style='background:#f4f4f5;padding:12px;"+
			"border-radius:6px'>%s</pre>"+
			"<p>See <a href='https://app.amliq.finance/admin/list-health'>"+
			"/admin/list-health</a> for full history.</p>",
		html.EscapeString(a.ListID),
		html.EscapeString(a.TenantID),
		html.EscapeString(a.TriggeredBy),
		a.DurationMS,
		html.EscapeString(a.FetchStrategy),
		html.EscapeString(a.Error),
	)
	return c.sender.Send(c.to, subject, body)
}

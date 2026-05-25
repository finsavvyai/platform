package alerting

import (
	"context"
	"fmt"
	"os"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/notification"
)

// WhatsAppChannel sends failure alerts via Twilio WhatsApp to the
// number in ADMIN_ALERT_WHATSAPP (E.164 format). Returns nil when
// either the destination or the Twilio creds are unset.
type WhatsAppChannel struct {
	sender *notification.WhatsAppSender
	to     string
}

// NewWhatsAppChannel constructs the channel; nil when unconfigured.
func NewWhatsAppChannel() *WhatsAppChannel {
	to := os.Getenv("ADMIN_ALERT_WHATSAPP")
	if to == "" {
		return nil
	}
	s := notification.NewWhatsAppSender()
	if !s.IsConfigured() {
		return nil
	}
	return &WhatsAppChannel{sender: s, to: to}
}

// Name implements Channel.
func (c *WhatsAppChannel) Name() string { return "whatsapp" }

// Send implements Channel.
func (c *WhatsAppChannel) Send(
	_ context.Context, a domain.ListSyncAudit,
) error {
	body := fmt.Sprintf(
		"AMLIQ ALERT — list sync failed\nlist: %s\ntenant: %s\n"+
			"trigger: %s\nstrategy: %s\nerr: %s",
		a.ListID, a.TenantID, a.TriggeredBy,
		a.FetchStrategy, trunc(a.Error, 200),
	)
	return c.sender.Send(c.to, body)
}

package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SlackChannel posts failure messages to a Slack incoming webhook
// (SLACK_ALERT_WEBHOOK env var). Returns nil when the env var is
// missing so the factory can skip registration.
type SlackChannel struct {
	webhook string
	client  *http.Client
}

// NewSlackChannel constructs the channel; nil when unconfigured.
func NewSlackChannel() *SlackChannel {
	url := os.Getenv("SLACK_ALERT_WEBHOOK")
	if url == "" {
		return nil
	}
	return &SlackChannel{
		webhook: url,
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

// Name implements Channel.
func (c *SlackChannel) Name() string { return "slack" }

// Send implements Channel.
func (c *SlackChannel) Send(
	ctx context.Context, a domain.ListSyncAudit,
) error {
	text := fmt.Sprintf(
		":rotating_light: *AMLIQ list sync failed*\n"+
			"• list: `%s`\n• tenant: `%s`\n• trigger: `%s`\n"+
			"• duration: %dms\n• strategy: %s\n"+
			"```%s```",
		a.ListID, a.TenantID, a.TriggeredBy,
		a.DurationMS, a.FetchStrategy, trunc(a.Error, 500))
	payload, _ := json.Marshal(map[string]string{"text": text})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.webhook, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("slack post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("slack returned %d", resp.StatusCode)
	}
	return nil
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

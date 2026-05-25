package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// SlackSender posts alerts to a Slack webhook URL.
type SlackSender struct {
	client *http.Client
}

func NewSlackSender() *SlackSender {
	return &SlackSender{client: &http.Client{Timeout: 10 * time.Second}}
}

// SlackMessage is a Slack webhook payload.
type SlackMessage struct {
	Text   string       `json:"text"`
	Blocks []SlackBlock `json:"blocks,omitempty"`
}

// SlackBlock is a Slack Block Kit element.
type SlackBlock struct {
	Type string          `json:"type"`
	Text *SlackBlockText `json:"text,omitempty"`
}

// SlackBlockText holds text content for a block.
type SlackBlockText struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Send posts a message to the Slack webhook URL.
func (ss *SlackSender) Send(
	ctx context.Context, webhookURL string, msg SlackMessage,
) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		webhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := ss.client.Do(req)
	if err != nil {
		return fmt.Errorf("slack webhook: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("slack returned %d", resp.StatusCode)
	}
	return nil
}

// FormatAlertSlack creates a Slack message for a monitoring alert.
func FormatAlertSlack(entityName, newStatus string, confidence float64) SlackMessage {
	return SlackMessage{
		Text: fmt.Sprintf("AMLIQ Alert: %s → %s (%.0f%%)", entityName, newStatus, confidence*100),
		Blocks: []SlackBlock{{
			Type: "section",
			Text: &SlackBlockText{
				Type: "mrkdwn",
				Text: fmt.Sprintf(":warning: *%s* status changed to *%s*\nConfidence: %.0f%%",
					entityName, newStatus, confidence*100),
			},
		}},
	}
}

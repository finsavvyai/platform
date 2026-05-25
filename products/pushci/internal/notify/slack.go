package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// SlackNotifier sends notifications via Slack webhook.
type SlackNotifier struct {
	WebhookURL string
	Client     *http.Client
}

// NewSlackNotifier creates a SlackNotifier with the given webhook URL.
func NewSlackNotifier(webhookURL string) *SlackNotifier {
	return &SlackNotifier{
		WebhookURL: webhookURL,
		Client:     http.DefaultClient,
	}
}

type slackPayload struct {
	Attachments []slackAttachment `json:"attachments"`
}

type slackAttachment struct {
	Color string `json:"color"`
	Text  string `json:"text"`
}

// Send posts a formatted message to Slack.
func (s *SlackNotifier) Send(event NotifyEvent) error {
	color := "#36a64f"
	if event.Status == StatusFailed {
		color = "#e01e5a"
	}
	payload := slackPayload{
		Attachments: []slackAttachment{
			{Color: color, Text: FormatMessage(event)},
		},
	}
	return s.post(payload)
}

func (s *SlackNotifier) post(payload slackPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("slack marshal: %w", err)
	}
	resp, err := s.Client.Post(s.WebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("slack post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("slack returned status %d", resp.StatusCode)
	}
	return nil
}

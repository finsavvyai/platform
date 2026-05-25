package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// DiscordNotifier sends notifications via Discord webhook.
type DiscordNotifier struct {
	WebhookURL string
	Client     *http.Client
}

// NewDiscordNotifier creates a DiscordNotifier with the given URL.
func NewDiscordNotifier(webhookURL string) *DiscordNotifier {
	return &DiscordNotifier{
		WebhookURL: webhookURL,
		Client:     http.DefaultClient,
	}
}

type discordPayload struct {
	Embeds []discordEmbed `json:"embeds"`
}

type discordEmbed struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Color       int    `json:"color"`
}

// Send posts a formatted embed to Discord.
func (d *DiscordNotifier) Send(event NotifyEvent) error {
	color := 0x36a64f // green
	if event.Status == StatusFailed {
		color = 0xe01e5a // red
	}
	title := fmt.Sprintf("%s — %s", event.Repo, string(event.Status))
	payload := discordPayload{
		Embeds: []discordEmbed{
			{Title: title, Description: FormatMessage(event), Color: color},
		},
	}
	return d.post(payload)
}

func (d *DiscordNotifier) post(payload discordPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("discord marshal: %w", err)
	}
	resp, err := d.Client.Post(d.WebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("discord post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("discord returned status %d", resp.StatusCode)
	}
	return nil
}

package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// TelegramNotifier sends notifications via Telegram Bot API.
type TelegramNotifier struct {
	BotToken string
	ChatID   string
	Client   *http.Client
	BaseURL  string // override for testing; default: https://api.telegram.org
}

// NewTelegramNotifier creates a TelegramNotifier from token and chat ID.
func NewTelegramNotifier(botToken, chatID string) *TelegramNotifier {
	return &TelegramNotifier{
		BotToken: botToken,
		ChatID:   chatID,
		Client:   http.DefaultClient,
		BaseURL:  "https://api.telegram.org",
	}
}

type telegramPayload struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode"`
}

// Send posts a formatted message to a Telegram chat.
func (t *TelegramNotifier) Send(event NotifyEvent) error {
	payload := telegramPayload{
		ChatID:    t.ChatID,
		Text:      FormatMessage(event),
		ParseMode: "Markdown",
	}
	return t.post(payload)
}

func (t *TelegramNotifier) post(payload telegramPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("telegram marshal: %w", err)
	}
	url := fmt.Sprintf("%s/bot%s/sendMessage", t.BaseURL, t.BotToken)
	resp, err := t.Client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("telegram post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("telegram returned status %d", resp.StatusCode)
	}
	return nil
}

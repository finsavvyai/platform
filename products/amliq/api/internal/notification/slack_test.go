package notification

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSlackSenderSuccess(t *testing.T) {
	var received SlackMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := NewSlackSender()
	msg := FormatAlertSlack("John Smith", "MATCH", 0.92)

	err := sender.Send(context.Background(), server.URL, msg)
	if err != nil {
		t.Fatalf("Send error: %v", err)
	}
	if received.Text == "" {
		t.Error("expected non-empty text")
	}
	if len(received.Blocks) == 0 {
		t.Error("expected blocks in Slack message")
	}
}

func TestFormatAlertSlack(t *testing.T) {
	msg := FormatAlertSlack("Test Entity", "MATCH", 0.85)
	if msg.Text == "" {
		t.Error("expected text")
	}
	if len(msg.Blocks) != 1 {
		t.Errorf("expected 1 block, got %d", len(msg.Blocks))
	}
}

package notify

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTelegramFormat(t *testing.T) {
	event := sampleEvent()
	msg := FormatMessage(event)
	if !strings.Contains(msg, "org/repo") {
		t.Errorf("message missing repo name")
	}
	if !strings.Contains(msg, "main") {
		t.Errorf("message missing branch")
	}
}

func TestTelegramSend(t *testing.T) {
	var gotBody []byte
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(200)
	}))
	defer srv.Close()

	tn := NewTelegramNotifier("test-token", "12345")
	tn.BaseURL = srv.URL

	if err := tn.Send(sampleEvent()); err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	if gotPath != "/bottest-token/sendMessage" {
		t.Errorf("path = %s, want /bottest-token/sendMessage", gotPath)
	}

	var p telegramPayload
	if err := json.Unmarshal(gotBody, &p); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if p.ChatID != "12345" {
		t.Errorf("chat_id = %s, want 12345", p.ChatID)
	}
	if p.ParseMode != "Markdown" {
		t.Errorf("parse_mode = %s, want Markdown", p.ParseMode)
	}
	if !strings.Contains(p.Text, "org/repo") {
		t.Errorf("text missing repo: %s", p.Text)
	}
}

func TestTelegramError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
	}))
	defer srv.Close()

	tn := NewTelegramNotifier("bad-token", "999")
	tn.BaseURL = srv.URL

	err := tn.Send(sampleEvent())
	if err == nil {
		t.Fatal("expected error for 401 response")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("error = %v, want 401 mention", err)
	}
}

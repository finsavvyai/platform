package notify

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func sampleEvent() NotifyEvent {
	return NotifyEvent{
		Repo: "org/repo", Branch: "main",
		Status: StatusPassed, Duration: "12s",
		URL: "https://pushci.dev/runs/1",
		Checks: []CheckResult{
			{Name: "build", Status: StatusPassed, Duration: "5s"},
			{Name: "test", Status: StatusPassed, Duration: "7s"},
		},
	}
}

func TestFormatMessage(t *testing.T) {
	tests := []struct {
		name   string
		event  NotifyEvent
		expect string
	}{
		{
			name:   "passed run includes repo",
			event:  sampleEvent(),
			expect: "org/repo",
		},
		{
			name: "failed run shows X icon",
			event: NotifyEvent{
				Repo: "x/y", Branch: "dev", Status: StatusFailed,
				Duration: "3s",
			},
			expect: "❌",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := FormatMessage(tt.event)
			if !strings.Contains(msg, tt.expect) {
				t.Errorf("FormatMessage() = %q, want substring %q", msg, tt.expect)
			}
		})
	}
}

func TestSlackPayload(t *testing.T) {
	var body []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ = io.ReadAll(r.Body)
		w.WriteHeader(200)
	}))
	defer srv.Close()

	s := NewSlackNotifier(srv.URL)
	if err := s.Send(sampleEvent()); err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	var p slackPayload
	if err := json.Unmarshal(body, &p); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(p.Attachments) != 1 {
		t.Fatalf("attachments = %d, want 1", len(p.Attachments))
	}
	if p.Attachments[0].Color != "#36a64f" {
		t.Errorf("color = %s, want green", p.Attachments[0].Color)
	}
}

func TestDiscordPayload(t *testing.T) {
	var body []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ = io.ReadAll(r.Body)
		w.WriteHeader(200)
	}))
	defer srv.Close()

	d := NewDiscordNotifier(srv.URL)
	if err := d.Send(sampleEvent()); err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	var p discordPayload
	if err := json.Unmarshal(body, &p); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(p.Embeds) != 1 {
		t.Fatalf("embeds = %d, want 1", len(p.Embeds))
	}
	if p.Embeds[0].Color != 0x36a64f {
		t.Errorf("color = %d, want green", p.Embeds[0].Color)
	}
}

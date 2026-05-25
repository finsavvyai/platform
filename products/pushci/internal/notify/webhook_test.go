package notify

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWebhookPayload(t *testing.T) {
	var gotBody []byte
	var gotHeaders http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotBody, _ = io.ReadAll(r.Body)
		gotHeaders = r.Header
		w.WriteHeader(200)
	}))
	defer srv.Close()

	wh := NewWebhookNotifier(srv.URL)
	wh.Headers = map[string]string{"Authorization": "Bearer tok123"}

	if err := wh.Send(sampleEvent()); err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	var p webhookPayload
	if err := json.Unmarshal(gotBody, &p); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if p.Repo != "org/repo" {
		t.Errorf("repo = %s, want org/repo", p.Repo)
	}
	if p.Branch != "main" {
		t.Errorf("branch = %s, want main", p.Branch)
	}
	if p.Status != "passed" {
		t.Errorf("status = %s, want passed", p.Status)
	}
	if len(p.Checks) != 2 {
		t.Errorf("checks = %d, want 2", len(p.Checks))
	}
	if p.Timestamp == "" {
		t.Error("timestamp is empty")
	}
	if gotHeaders.Get("Authorization") != "Bearer tok123" {
		t.Errorf("auth header = %s", gotHeaders.Get("Authorization"))
	}
	if gotHeaders.Get("Content-Type") != "application/json" {
		t.Errorf("content-type = %s", gotHeaders.Get("Content-Type"))
	}
}

func TestWebhookError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	wh := NewWebhookNotifier(srv.URL)
	err := wh.Send(sampleEvent())
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error = %v, want 500 mention", err)
	}
}

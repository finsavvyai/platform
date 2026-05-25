package webhooks

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

func TestOpenSRESenderDisabledIsNoop(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "error"})
	s := NewOpenSRESender("", "", logger)
	if s.Enabled() {
		t.Fatal("sender with empty endpoint should be disabled")
	}
	if err := s.SendFinding(context.Background(), FindingEvent{}); err != nil {
		t.Fatalf("noop send returned error: %v", err)
	}
}

func TestOpenSRESenderSignsAndPostsAlert(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "error"})

	var got struct {
		body []byte
		sig  string
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		got.body = body
		got.sig = r.Header.Get("X-Signature-256")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := NewOpenSRESender(srv.URL, "shared-secret", logger)
	if !s.Enabled() {
		t.Fatal("sender should be enabled when endpoint+secret set")
	}

	finding := FindingEvent{
		ID:             7,
		ConnectionName: "prod-github",
		RunID:          "12345",
		Severity:       "high",
		Category:       "secret_leak",
		Title:          "AWS access key in workflow",
		Description:    "AKIA... in .github/workflows/deploy.yml",
		Remediation:    "Rotate key and move to GH Actions secret",
		File:           ".github/workflows/deploy.yml",
		Timestamp:      time.Now().UTC(),
	}
	if err := s.SendFinding(context.Background(), finding); err != nil {
		t.Fatalf("SendFinding error: %v", err)
	}

	if !strings.HasPrefix(got.sig, "sha256=") {
		t.Fatalf("expected sha256= signature prefix, got %q", got.sig)
	}
	mac := hmac.New(sha256.New, []byte("shared-secret"))
	mac.Write(got.body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(got.sig)) {
		t.Fatalf("signature mismatch: got %q want %q", got.sig, expected)
	}

	var alert OpenSREAlert
	if err := json.Unmarshal(got.body, &alert); err != nil {
		t.Fatalf("unmarshal alert: %v", err)
	}
	if alert.AlertSource != "pipewarden" {
		t.Errorf("alert_source = %q, want pipewarden", alert.AlertSource)
	}
	if alert.Severity != "high" {
		t.Errorf("severity = %q, want high", alert.Severity)
	}
	if alert.Labels["connection"] != "prod-github" {
		t.Errorf("labels.connection = %q, want prod-github", alert.Labels["connection"])
	}
	if alert.Labels["run_id"] != "12345" {
		t.Errorf("labels.run_id = %q, want 12345", alert.Labels["run_id"])
	}
	if alert.Annotations["remediation"] == "" {
		t.Errorf("expected remediation annotation, got empty")
	}
}

func TestOpenSRESenderPropagatesNon2xx(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "error"})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()
	s := NewOpenSRESender(srv.URL, "secret", logger)
	err := s.SendFinding(context.Background(), FindingEvent{Title: "x", Severity: "low"})
	if err == nil {
		t.Fatal("expected error for 403 response")
	}
}

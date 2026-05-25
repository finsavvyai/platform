package webhooks

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func testLogger() *logging.Logger {
	l, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	return l
}

func TestNewAuditSender(t *testing.T) {
	sender := NewAuditSender("http://localhost:3000", "test-token", testLogger())
	if sender == nil {
		t.Fatal("expected non-nil sender")
	}
	if sender.endpoint != "http://localhost:3000" {
		t.Errorf("expected endpoint, got %s", sender.endpoint)
	}
}

func TestAuditSender_Send_Disabled(t *testing.T) {
	sender := NewAuditSender("", "", testLogger())
	ctx := context.Background()
	err := sender.Send(ctx, AuditEvent{Action: "test"})
	if err != nil {
		t.Errorf("expected no error when disabled, got %v", err)
	}
}

func TestAuditSender_Send_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/integrations/audit" {
			t.Errorf("expected path /api/integrations/audit, got %s", r.URL.Path)
		}

		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-token" {
			t.Errorf("expected Bearer token, got %s", auth)
		}

		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Action != "scan_completed" {
			t.Errorf("expected action scan_completed, got %s", event.Action)
		}

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"id": "audit-123"})
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "test-token", testLogger())
	ctx := context.Background()
	err := sender.SendScanCompleted(ctx, "gh-main", "scan-1", "user123", 5)

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestAuditSender_Send_Failure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "invalid-token", testLogger())
	ctx := context.Background()
	err := sender.Send(ctx, AuditEvent{Action: "test"})

	if err == nil {
		t.Error("expected error for unauthorized response")
	}
}

func TestAuditSender_SendScanStarted(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Action != "scan_started" {
			t.Errorf("expected action scan_started, got %s", event.Action)
		}
		if event.Details["connection"] != "github-main" {
			t.Error("expected connection detail")
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "token", testLogger())
	ctx := context.Background()
	err := sender.SendScanStarted(ctx, "github-main", "scan-1", "user1")

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestAuditSender_SendFindingResolved(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Action != "finding_resolved" {
			t.Errorf("expected action finding_resolved, got %s", event.Action)
		}
		if event.ResourceType != "finding" {
			t.Errorf("expected resourceType finding, got %s", event.ResourceType)
		}
		if event.Details["remediation"] != "rotated credentials" {
			t.Error("expected remediation detail")
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "token", testLogger())
	ctx := context.Background()
	err := sender.SendFindingResolved(ctx, "finding-123", "github", "user1", "rotated credentials")

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestAuditSender_SendConnectionAdded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Action != "connection_added" {
			t.Errorf("expected action connection_added, got %s", event.Action)
		}
		if event.Details["platform"] != "github" {
			t.Error("expected platform detail")
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "token", testLogger())
	ctx := context.Background()
	err := sender.SendConnectionAdded(ctx, "my-github", "github", "user1")

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestAuditSender_SendConnectionRemoved(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Action != "connection_removed" {
			t.Errorf("expected action connection_removed, got %s", event.Action)
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "token", testLogger())
	ctx := context.Background()
	err := sender.SendConnectionRemoved(ctx, "my-github", "user1")

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestAuditSender_EventTimestamp(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Timestamp.IsZero() {
			t.Error("expected timestamp to be set")
		}
		if time.Since(event.Timestamp) > 1*time.Second {
			t.Error("expected recent timestamp")
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "token", testLogger())
	ctx := context.Background()
	_ = sender.Send(ctx, AuditEvent{Action: "test", Actor: "system"})
}

func TestAuditSender_SendPolicyViolation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var event AuditEvent
		_ = json.Unmarshal(body, &event)

		if event.Action != "policy_violation" {
			t.Errorf("expected action policy_violation, got %s", event.Action)
		}
		if event.ResourceType != "policy" {
			t.Errorf("expected resourceType policy, got %s", event.ResourceType)
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sender := NewAuditSender(server.URL, "token", testLogger())
	ctx := context.Background()
	err := sender.SendPolicyViolation(ctx, "policy-1", "No hardcoded secrets", "system")

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

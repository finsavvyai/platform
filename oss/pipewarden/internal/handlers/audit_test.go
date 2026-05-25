package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/webhooks"
)

func newAuditOnlyHandlers(t *testing.T) *Handlers {
	t.Helper()
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: true})
	return &Handlers{logger: logger}
}

func TestRecordAudit_NilSenderIsNoop(t *testing.T) {
	h := newAuditOnlyHandlers(t)
	// Should not panic and should not log a delivery failure.
	h.recordAudit(context.Background(), "test_action", "actor", "res", "type", nil)
}

func TestRecordAudit_FailureLoggedNotPropagated(t *testing.T) {
	h := newAuditOnlyHandlers(t)

	// Mock audit endpoint that always rejects so Send returns an error,
	// proving the error is swallowed and never bubbles up to the caller.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	h.auditSender = webhooks.NewAuditSender(srv.URL, "tok", h.logger)
	h.recordAudit(context.Background(), "test_fail", "actor", "res", "type", map[string]string{"k": "v"})
}

func TestRecordAudit_SuccessPath(t *testing.T) {
	h := newAuditOnlyHandlers(t)
	got := make(chan webhooks.AuditEvent, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Authorization"), "Bearer ") {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		got <- webhooks.AuditEvent{Action: r.Header.Get("X-PipeWarden-Test")}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	h.auditSender = webhooks.NewAuditSender(srv.URL, "tok", h.logger)
	h.recordAudit(context.Background(), "ok_action", "actor", "res", "type", nil)
	<-got
}

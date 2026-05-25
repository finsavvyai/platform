// SPDX-License-Identifier: AGPL-3.0-or-later
//
// End-to-end integration test for POST /v1/redact: real DLP
// detector → real handler → real httptest server. Proves the wire
// from network bytes to redactor output without needing docker
// compose or a live Postgres instance.

package redact_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/redact"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
)

type staticPolicy struct{ a middleware.Action }

func (s staticPolicy) DLPAction(_ context.Context, _ string) (middleware.Action, error) {
	return s.a, nil
}

func newServer(t *testing.T, action middleware.Action) *httptest.Server {
	t.Helper()
	dlp := middleware.NewDLP(middleware.NewDetector(), staticPolicy{action}, nil)
	scanner := redact.FromDLP(dlp)
	tenantFrom := func(*http.Request) string { return "tenant-from-header" }
	srv := httptest.NewServer(redact.Handler(scanner, tenantFrom))
	t.Cleanup(srv.Close)
	return srv
}

func post(t *testing.T, srv *httptest.Server, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, srv.URL, strings.NewReader(body))
	if err != nil {
		t.Fatalf("new req: %v", err)
	}
	req.Header.Set("content-type", "application/json")
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	return res
}

func decodeResponse(t *testing.T, res *http.Response) redact.Response {
	t.Helper()
	defer func() { _ = res.Body.Close() }()
	var got redact.Response
	if err := json.NewDecoder(res.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return got
}

func TestIntegration_RedactEmailEndToEnd(t *testing.T) {
	srv := newServer(t, middleware.ActionRedact)
	res := post(t, srv, `{"text":"ping alice@example.com please"}`)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", res.StatusCode)
	}
	got := decodeResponse(t, res)
	if got.Blocked {
		t.Fatalf("blocked unexpectedly: %+v", got)
	}
	if bytes.Contains([]byte(got.Redacted), []byte("alice@example.com")) {
		t.Fatalf("email leaked through: %q", got.Redacted)
	}
	if len(got.Detections) == 0 {
		t.Fatalf("expected at least one detection, got %+v", got)
	}
	hasEmail := false
	for _, d := range got.Detections {
		if d.Type == "email" {
			hasEmail = true
		}
	}
	if !hasEmail {
		t.Fatalf("no email detection in %+v", got.Detections)
	}
}

func TestIntegration_CleanTextPassesThrough(t *testing.T) {
	srv := newServer(t, middleware.ActionRedact)
	res := post(t, srv, `{"text":"hello world, no PII here"}`)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", res.StatusCode)
	}
	got := decodeResponse(t, res)
	if got.Blocked {
		t.Fatalf("blocked: %+v", got)
	}
	if got.Redacted != "hello world, no PII here" {
		t.Fatalf("text mutated: %q", got.Redacted)
	}
	if len(got.Detections) != 0 {
		t.Fatalf("expected zero detections, got %+v", got.Detections)
	}
}

func TestIntegration_BlockPolicyReturnsBlocked(t *testing.T) {
	srv := newServer(t, middleware.ActionBlock)
	res := post(t, srv, `{"text":"ssn 123-45-6789"}`)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", res.StatusCode)
	}
	got := decodeResponse(t, res)
	if !got.Blocked {
		t.Fatalf("expected blocked, got %+v", got)
	}
	if got.BlockReason == "" {
		t.Fatalf("missing block reason")
	}
	if got.Redacted != "" {
		t.Fatalf("redacted not empty on block: %q", got.Redacted)
	}
}

func TestIntegration_ContentTypeIsJSON(t *testing.T) {
	srv := newServer(t, middleware.ActionRedact)
	res := post(t, srv, `{"text":"hi"}`)
	ct := res.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("content-type: %q", ct)
	}
}

func TestIntegration_RejectsEmptyBody(t *testing.T) {
	srv := newServer(t, middleware.ActionRedact)
	res := post(t, srv, ``)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status: %d", res.StatusCode)
	}
}

func TestIntegration_RejectsUnknownFields(t *testing.T) {
	srv := newServer(t, middleware.ActionRedact)
	res := post(t, srv, `{"text":"hi","surprise":true}`)
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status: %d", res.StatusCode)
	}
}

func TestIntegration_RejectsGET(t *testing.T) {
	srv := newServer(t, middleware.ActionRedact)
	res, err := srv.Client().Get(srv.URL)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if res.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("status: %d", res.StatusCode)
	}
}

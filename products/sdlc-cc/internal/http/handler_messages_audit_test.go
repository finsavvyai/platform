package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/sdlc-core/audit"
)

// erroringProvider triggers the failure branch of HandleMessages so
// we can assert that error rows land in the repo just like success
// rows do.
type erroringProvider struct{}

func (erroringProvider) IsConfigured() bool { return true }
func (erroringProvider) Name() string       { return "fake" }
func (erroringProvider) Complete(_ context.Context, _ string) (string, error) {
	return "", errors.New("upstream 503 service unavailable")
}

func TestHandleMessages_RecordsSuccess(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	body, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku-4-5", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "ping"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "pong"}, repo, nil, nil)(rec, req)

	if rec.Code != 200 {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	rows, _ := repo.ListByTenant(req.Context(), "",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute), 10)
	if len(rows) != 1 {
		t.Fatalf("want 1 audit row, got %d", len(rows))
	}
	if rows[0].Status != "ok" || rows[0].Provider != "fake" {
		t.Errorf("unexpected audit row: %+v", rows[0])
	}
}

func TestHandleMessages_RecordsError(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	body, _ := json.Marshal(MessagesRequest{
		Model: "x", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "ping"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleMessages(erroringProvider{}, repo, nil, nil)(rec, req)

	if rec.Code != 502 {
		t.Fatalf("want 502 on provider failure, got %d", rec.Code)
	}
	rows, _ := repo.ListByTenant(req.Context(), "",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute), 10)
	if len(rows) != 1 || rows[0].Status != "error" || rows[0].ErrorCode != "UPSTREAM_5XX" {
		t.Fatalf("expected error row classified as UPSTREAM_5XX, got %+v", rows)
	}
}

func TestHandleMessages_NilRepo_NoCrash(t *testing.T) {
	body, _ := json.Marshal(MessagesRequest{
		Model: "x", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "ping"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "ok"}, nil, nil, nil)(rec, req)
	if rec.Code != 200 {
		t.Errorf("nil repo should not break the request, got %d", rec.Code)
	}
}

func TestHandleMessages_TenantContextRecorded(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	body, _ := json.Marshal(MessagesRequest{
		Model: "x", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: "ping"}},
	})
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(body))
	ctx := context.WithValue(req.Context(), tenantCtxKey{}, "tnt_corp")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "ok"}, repo, nil, nil)(rec, req)

	rows, _ := repo.ListByTenant(req.Context(), "tnt_corp",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute), 10)
	if len(rows) != 1 {
		t.Fatalf("expected 1 row scoped to tnt_corp, got %d", len(rows))
	}
}

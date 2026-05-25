package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestGetProviders_Success(t *testing.T) {
	h := newProvidersTestHandlers(t)

	httpReq := httptest.NewRequest("GET", "/api/v1/providers", nil)
	w := httptest.NewRecorder()

	h.GetProviders(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	providers, ok := resp["providers"].([]interface{})
	if !ok {
		t.Fatal("expected providers array in response")
	}

	if len(providers) != 3 {
		t.Errorf("expected 3 providers, got %d", len(providers))
	}

	count := resp["count"].(float64)
	if count != 3 {
		t.Errorf("expected count=3, got %v", count)
	}
}

func TestGetProvidersStatus_NoConnections(t *testing.T) {
	h := newProvidersTestHandlers(t)

	httpReq := httptest.NewRequest("GET", "/api/v1/providers/status", nil)
	w := httptest.NewRecorder()

	h.GetProvidersStatus(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	statuses, ok := resp["status"].([]interface{})
	if !ok {
		t.Fatal("expected status array in response")
	}

	if len(statuses) != 0 {
		t.Errorf("expected 0 statuses (no connections), got %d", len(statuses))
	}
}

func TestGetProvidersStatus_DisconnectedProviderMarksError(t *testing.T) {
	h := newProvidersTestHandlers(t)

	rec := &storage.ConnectionRecord{
		Name:         "broken-github",
		Platform:     string(integrations.PlatformGitHub),
		AuthMethod:   "token",
		Token:        "token",
		HealthStatus: "pending",
	}
	if err := h.db.SaveConnection(rec); err != nil {
		t.Fatalf("failed to save connection: %v", err)
	}

	if err := h.manager.Add(rec.Name, stubProvider{
		platform: integrations.PlatformGitHub,
		status: &integrations.ConnectionStatus{
			Connected:      false,
			Platform:       integrations.PlatformGitHub,
			ConnectionName: rec.Name,
			Message:        "bad credentials",
			RateLimitOK:    true,
			Latency:        25 * time.Millisecond,
		},
	}); err != nil {
		t.Fatalf("failed to register provider: %v", err)
	}

	httpReq := httptest.NewRequest("GET", "/api/v1/providers/status", nil)
	w := httptest.NewRecorder()

	h.GetProvidersStatus(w, httpReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Status []map[string]interface{} `json:"status"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Status) != 1 {
		t.Fatalf("expected 1 status, got %d", len(resp.Status))
	}

	if connected, _ := resp.Status[0]["connected"].(bool); connected {
		t.Fatalf("expected disconnected provider to report connected=false")
	}
	if status, _ := resp.Status[0]["status"].(string); status != "error" {
		t.Fatalf("expected disconnected provider to report status=error, got %q", status)
	}
	if message, _ := resp.Status[0]["message"].(string); message != "bad credentials" {
		t.Fatalf("expected failure message to be preserved, got %q", message)
	}

	stored, err := h.db.GetByName(rec.Name)
	if err != nil {
		t.Fatalf("failed to load updated connection: %v", err)
	}
	if stored.HealthStatus != "error" {
		t.Fatalf("expected connection health to be updated to error, got %q", stored.HealthStatus)
	}
}

type stubProvider struct {
	platform integrations.Platform
	status   *integrations.ConnectionStatus
	err      error
}

func (p stubProvider) Name() integrations.Platform {
	return p.platform
}

func (p stubProvider) TestConnection(context.Context) (*integrations.ConnectionStatus, error) {
	return p.status, p.err
}

func (p stubProvider) ListPipelines(context.Context, string, string) ([]integrations.Pipeline, error) {
	return nil, nil
}

func (p stubProvider) GetPipelineRun(context.Context, string, string, string) (*integrations.PipelineRun, error) {
	return nil, nil
}

func (p stubProvider) ListPipelineRuns(context.Context, string, string, int) ([]integrations.PipelineRun, error) {
	return nil, nil
}

func (p stubProvider) TriggerPipeline(context.Context, string, string, string, string) (*integrations.PipelineRun, error) {
	return nil, nil
}

func newProvidersTestHandlers(t *testing.T) *Handlers {
	t.Helper()

	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatalf("failed to create test DB: %v", err)
	}

	logger := logging.NewDefault()
	manager := integrations.NewManager(logger)

	return &Handlers{
		db:      db,
		manager: manager,
		logger:  logger,
	}
}

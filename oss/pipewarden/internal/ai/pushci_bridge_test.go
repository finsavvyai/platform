package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func TestStrategyForFinding(t *testing.T) {
	tests := []struct {
		category analysis.Category
		expected FixStrategy
	}{
		{analysis.CategorySecrets, FixRotateSecret},
		{analysis.CategoryDependency, FixBumpDependency},
		{analysis.CategoryConfig, FixUpdatePipeline},
		{analysis.CategoryAuth, FixRestrictPerms},
		{analysis.CategoryAccessControl, FixRestrictPerms},
		{analysis.CategoryInjection, FixAddSASTStep},
		{analysis.CategoryOther, ""},
		{analysis.CategoryDataExposure, ""},
	}
	for _, tt := range tests {
		f := analysis.Finding{Category: tt.category}
		got := StrategyForFinding(f)
		if got != tt.expected {
			t.Errorf("category=%s: expected %q, got %q", tt.category, tt.expected, got)
		}
	}
}

func TestCreateFixPR_NoStrategy(t *testing.T) {
	b := NewPushCIBridge(PushCIConfig{APIKey: "key"}, logging.NewDefault())
	f := analysis.Finding{Category: analysis.CategoryOther}

	result, err := b.CreateFixPR(context.Background(), "owner", "repo", "main", f)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Skipped {
		t.Error("expected Skipped=true for unmapped category")
	}
}

func TestCreateFixPR_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" && r.Method == http.MethodGet {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.Method != http.MethodPost || r.URL.Path != "/v1/fix" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		auth := r.Header.Get("Authorization")
		if auth != "Bearer testkey" {
			t.Errorf("expected auth header 'Bearer testkey', got %s", auth)
		}

		result := FixResult{
			PRURL:    "https://github.com/owner/repo/pull/42",
			PRNumber: 42,
			Strategy: FixRotateSecret,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}))
	defer srv.Close()

	b := &PushCIBridge{
		config:     PushCIConfig{APIKey: "testkey", BaseURL: srv.URL},
		httpClient: srv.Client(),
		logger:     logging.NewDefault(),
	}

	f := analysis.Finding{
		ID:          1,
		Category:    analysis.CategorySecrets,
		Severity:    analysis.SeverityCritical,
		Title:       "Hardcoded AWS key",
		Remediation: "Rotate and use environment variable",
	}

	result, err := b.CreateFixPR(context.Background(), "owner", "repo", "main", f)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Skipped {
		t.Error("expected Skipped=false")
	}
	if result.PRURL == "" {
		t.Error("expected non-empty PR URL")
	}
	if result.PRNumber != 42 {
		t.Errorf("expected PR number 42, got %d", result.PRNumber)
	}
}

func TestCreateFixPR_APIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" && r.Method == http.MethodGet {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer srv.Close()

	b := &PushCIBridge{
		config:     PushCIConfig{APIKey: "testkey", BaseURL: srv.URL},
		httpClient: srv.Client(),
		logger:     logging.NewDefault(),
	}

	f := analysis.Finding{Category: analysis.CategorySecrets}
	_, err := b.CreateFixPR(context.Background(), "owner", "repo", "main", f)
	if err == nil {
		t.Error("expected error for 500 response")
	}
}

func TestEnabled(t *testing.T) {
	b1 := NewPushCIBridge(PushCIConfig{APIKey: "key"}, logging.NewDefault())
	if !b1.Enabled() {
		t.Error("expected Enabled=true with API key")
	}

	b2 := NewPushCIBridge(PushCIConfig{}, logging.NewDefault())
	if b2.Enabled() {
		t.Error("expected Enabled=false without API key")
	}
}

func TestPushCIBridge_Healthy_OK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/healthz" {
			t.Errorf("expected /healthz, got %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("expected bearer, got %q", got)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	b := NewPushCIBridge(PushCIConfig{APIKey: "test-key", BaseURL: srv.URL}, logging.NewDefault())
	if err := b.Healthy(context.Background()); err != nil {
		t.Fatalf("Healthy returned error on 200: %v", err)
	}
}

func TestPushCIBridge_Healthy_404(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	b := NewPushCIBridge(PushCIConfig{APIKey: "test-key", BaseURL: srv.URL}, logging.NewDefault())
	err := b.Healthy(context.Background())
	if err == nil {
		t.Fatal("Healthy must error when upstream returns 404")
	}
	if !strings.Contains(err.Error(), "404") {
		t.Errorf("error should mention 404, got %v", err)
	}
}

func TestPushCIBridge_Healthy_DisabledWithoutKey(t *testing.T) {
	b := NewPushCIBridge(PushCIConfig{}, logging.NewDefault())
	err := b.Healthy(context.Background())
	if err == nil {
		t.Fatal("Healthy must error when APIKey is unset")
	}
}

func TestPushCIBridge_CreateFixPR_SkipsWhenUnhealthy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	b := NewPushCIBridge(PushCIConfig{APIKey: "k", BaseURL: srv.URL}, logging.NewDefault())
	res, err := b.CreateFixPR(context.Background(), "o", "r", "b", analysis.Finding{Category: analysis.CategorySecrets})
	if err != nil {
		t.Fatalf("CreateFixPR must not return error on unhealthy upstream: %v", err)
	}
	if !res.Skipped {
		t.Fatal("expected Skipped=true on unhealthy upstream")
	}
	if !strings.Contains(res.Reason, "pushci unhealthy") {
		t.Errorf("reason should mention pushci unhealthy, got %q", res.Reason)
	}
}
